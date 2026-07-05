const { ObjectId } = require("mongodb");
const { v4: uuidv4 } = require("uuid");
const gocardless = require("../config/gocardless");
const client = require("../config/db")
  .db("facesOnFaces")
  .collection("subscriptionEnrollments");

const MONTHLY_AMOUNT_PENCE = 10000; // £100.00
const CURRENCY = "GBP";

/**
 * STEP 1 — Create the redirect flow that sends the user to their bank
 * to set up the Direct Debit mandate.
 *
 * IMPORTANT: `session_token` here MUST be the exact same value you send
 * back to GoCardless in `completeGoCardlessFlow`. We use the enrollmentId
 * for this, since it's unique per user and we already have it.
 */
exports.createGoCardlessRedirectFlow = async (req, res) => {
  try {
    const { enrollmentId, name, email } = req.body;

    if (!enrollmentId || !ObjectId.isValid(enrollmentId)) {
      return res.status(400).json({ message: "Invalid enrollment ID." });
    }

    const enrollment = await client.findOne({ _id: new ObjectId(enrollmentId) });
    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found." });
    }

    // Guard: don't let someone spin up a second mandate for an enrollment
    // that already has an active subscription.
    if (enrollment.subscriptionId) {
      return res.status(409).json({ message: "Subscription already set up for this enrollment." });
    }

    const redirectFlow = await gocardless.redirectFlows.create({
      description: "Faces On Faces Academy — Monthly Subscription",
      session_token: enrollmentId,
      success_redirect_url: `${process.env.FRONTEND_URL}/subscription/success?enrollmentId=${enrollmentId}`,
      prefilled_customer: {
        given_name: name,
        email: email,
      },
    });

    await client.updateOne(
      { _id: new ObjectId(enrollmentId) },
      {
        $set: {
          gcRedirectFlowId: redirectFlow.id,
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      redirectUrl: redirectFlow.redirect_url,
      flowId: redirectFlow.id,
    });
  } catch (err) {
    console.error("GoCardless flow error:", err?.response?.body || err);
    return res.status(500).json({ message: "Failed to initiate bank payment setup." });
  }
};

/**
 * STEP 2 — Called after the user comes back from their bank.
 * Completes the redirect flow and returns the mandate + customer id.
 */
exports.completeGoCardlessFlow = async (req, res) => {
  try {
    const { flowId, enrollmentId } = req.body;

    if (!flowId) {
      return res.status(400).json({ message: "Missing redirect flow ID." });
    }
    if (!enrollmentId || !ObjectId.isValid(enrollmentId)) {
      return res.status(400).json({ message: "Missing or invalid enrollment ID." });
    }

    const enrollment = await client.findOne({ _id: new ObjectId(enrollmentId) });
    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found." });
    }

    // If we've already completed this flow before (e.g. user refreshed the
    // success page), don't call GoCardless again — just return what we have.
    if (enrollment.mandateId) {
      return res.status(200).json({
        mandateId: enrollment.mandateId,
        customerId: enrollment.gcCustomerId,
      });
    }

    // session_token must be identical to the one used when the flow was created
    let completedFlow;
    try {
      completedFlow = await gocardless.redirectFlows.complete(flowId, {
        session_token: enrollmentId,
      });
    } catch (gcErr) {
      const gcMessage = gcErr?.response?.body?.error?.message || "";
      const alreadyCompleted = /already been completed|invalid_state/i.test(gcMessage);

      if (alreadyCompleted) {
        // Most likely a duplicate/race call (e.g. StrictMode double-effect,
        // or the user refreshing the success page). Re-check the DB —
        // if the first call already saved the mandate, treat this as success.
        const fresh = await client.findOne({ _id: new ObjectId(enrollmentId) });
        if (fresh?.mandateId) {
          return res.status(200).json({
            mandateId: fresh.mandateId,
            customerId: fresh.gcCustomerId,
          });
        }
      }
      throw gcErr;
    }

    const mandateId = completedFlow.links.mandate;
    const customerId = completedFlow.links.customer;

    await client.updateOne(
      { _id: new ObjectId(enrollmentId) },
      {
        $set: {
          mandateId,
          gcCustomerId: customerId,
          status: "Mandate Created",
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({ mandateId, customerId });
  } catch (err) {
    console.error("GoCardless complete flow error:", err?.response?.body || err);
    return res.status(500).json({ message: "Failed to confirm bank mandate." });
  }
};

/**
 * STEP 3 — Create the recurring monthly subscription against the mandate.
 */
exports.createSubscription = async (req, res) => {
  try {
    const { mandateId, enrollmentId } = req.body;

    if (!mandateId) {
      return res.status(400).json({ message: "Missing mandate ID." });
    }
    if (!enrollmentId || !ObjectId.isValid(enrollmentId)) {
      return res.status(400).json({ message: "Invalid enrollment ID." });
    }

    const enrollment = await client.findOne({ _id: new ObjectId(enrollmentId) });
    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found." });
    }

    // Guard against double-creating the subscription (e.g. double click,
    // browser back button, retried request).
    if (enrollment.subscriptionId) {
      return res.status(200).json({
        success: true,
        subscriptionId: enrollment.subscriptionId,
        alreadyExisted: true,
      });
    }

    const subscription = await gocardless.subscriptions.create(
      {
        amount: MONTHLY_AMOUNT_PENCE,
        currency: CURRENCY,
        name: "Faces On Faces Academy — Monthly Subscription",
        interval_unit: "monthly",
        day_of_month: 1,
        links: { mandate: mandateId },
        metadata: { enrollmentId },
      },
      uuidv4() // idempotency key so a network retry can't create two subscriptions
    );

    await client.updateOne(
      { _id: new ObjectId(enrollmentId) },
      {
        $set: {
          mandateId,
          subscriptionId: subscription.id,
          paymentStatus: "Active",
          status: "Subscribed",
          subscribedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({ success: true, subscriptionId: subscription.id });
  } catch (err) {
    console.error("GoCardless subscription error:", err?.response?.body || err);
    return res.status(500).json({ message: "Failed to set up the monthly subscription." });
  }
};
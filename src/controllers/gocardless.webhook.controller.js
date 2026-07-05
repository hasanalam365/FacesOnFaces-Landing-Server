const gocardlessModule = require("gocardless-nodejs");
const webhooks = gocardlessModule.webhooks || gocardlessModule.default?.webhooks;
const { ObjectId } = require("mongodb");
const client = require("../config/db")
  .db("facesOnFaces")
  .collection("subscriptionEnrollments");

const WEBHOOK_SECRET = process.env.GOCARDLESS_WEBHOOK_SECRET;

// NOTE: this route MUST receive the raw request body (Buffer), not
// JSON-parsed. See the route file for the express.raw() middleware —
// signature verification will fail otherwise.
exports.handleWebhook = async (req, res) => {
  let events;
  try {
    events = webhooks.parse(
      req.body,
      WEBHOOK_SECRET,
      req.headers["webhook-signature"]
    );
  } catch (err) {
    if (err.name === "InvalidSignatureError") {
      console.warn("GoCardless webhook: invalid signature, rejecting.");
      return res.status(498).end();
    }
    console.error("GoCardless webhook parse error:", err);
    return res.status(400).end();
  }

  // Respond immediately — GoCardless just wants a 200 fast.
  res.status(200).send("OK");

  for (const event of events) {
    try {
      await processEvent(event);
    } catch (err) {
      console.error("Error processing GoCardless event", event.id, err);
    }
  }
};

async function processEvent(event) {
  switch (event.resource_type) {
    case "mandates": {
      if (event.action === "cancelled" || event.action === "failed") {
        await client.updateOne(
          { mandateId: event.links.mandate },
          { $set: { status: `Mandate ${event.action}`, updatedAt: new Date() } }
        );
      }
      break;
    }

    case "subscriptions": {
      if (event.action === "cancelled" || event.action === "finished") {
        await client.updateOne(
          { subscriptionId: event.links.subscription },
          {
            $set: {
              paymentStatus: event.action === "cancelled" ? "Cancelled" : "Finished",
              status: `Subscription ${event.action}`,
              updatedAt: new Date(),
            },
          }
        );
      }
      break;
    }

    case "payments": {
      if (event.action === "failed") {
        await client.updateOne(
          { subscriptionId: event.links.subscription },
          { $set: { lastPaymentStatus: "Failed", updatedAt: new Date() } }
        );
      } else if (event.action === "confirmed") {
        await client.updateOne(
          { subscriptionId: event.links.subscription },
          { $set: { lastPaymentStatus: "Confirmed", updatedAt: new Date() } }
        );
      }
      break;
    }

    default:
      break;
  }
}
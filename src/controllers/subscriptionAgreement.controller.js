const client = require("../config/db");
const sanitizeHtml = require("sanitize-html");
const { ObjectId } = require("mongodb");
const { validationResult } = require("express-validator");
const signwellService = require("../services/signwellService");
const { WEBHOOK_SECRET } = require("../config/signwell");

const subscriptionEnrollmentsCollection = client
  .db("facesOnFaces")
  .collection("subscriptionEnrollments");

// STEP 1: Form submit করলেই enrollment record + SignWell document তৈরি হয়
exports.createAgreement = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone } = req.body;

    const safeName = sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} });
    const safeEmail = sanitizeHtml(email, { allowedTags: [], allowedAttributes: {} });
    const safePhone = sanitizeHtml(phone, { allowedTags: [], allowedAttributes: {} });

    const enrollmentDoc = {
      name: safeName,
      email: safeEmail,
      phone: safePhone,
      course: "14 Certificate Fast-Track Course",
      enrollmentType: "Subscription",
      status: "Pending Signature",
      identityDocument: null,
      agreementSigned: false,
      signwellDocumentId: null,
      paymentIntentId: null,
      paymentStatus: "Pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await subscriptionEnrollmentsCollection.insertOne(enrollmentDoc);
    const enrollmentId = result.insertedId.toString();

    let documentId;
    try {
      const doc = await signwellService.createAgreementDocument({
        name: safeName,
        email: safeEmail,
        enrollmentId,
      });
      documentId = doc.documentId;
    } catch (swErr) {
  console.error(
    "SignWell create document error:",
    JSON.stringify(swErr.response?.data, null, 2) || swErr.message
  );
    }

    await subscriptionEnrollmentsCollection.updateOne(
      { _id: result.insertedId },
      { $set: { signwellDocumentId: documentId, updatedAt: new Date() } }
    );

    return res.status(200).json({ success: true, enrollmentId });
  } catch (error) {
    console.error("Create agreement error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// STEP 2: Frontend polling করে জানবে সাইন হয়েছে কিনা
exports.checkAgreementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ signed: false });
    }

    const enrollment = await subscriptionEnrollmentsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!enrollment) {
      return res.status(404).json({ signed: false });
    }

    return res.status(200).json({ signed: !!enrollment.agreementSigned });
  } catch (err) {
    console.error("Check agreement status error:", err);
    return res.status(500).json({ signed: false });
  }
};

// STEP 3: SignWell webhook — কিন্তু webhook body কে blindly trust করা হয় না।
// secret token URL এ match করলেই তারপর SignWell API কে সরাসরি জিজ্ঞেস করা হয়
// document আসলেই "Completed" কিনা। এই re-verification টাই মূল security।
exports.handleSignWellWebhook = async (req, res) => {
  try {
    const { secret } = req.params;
    if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
      return res.status(404).send("Not found");
    }

    const event = req.body;
    const eventType = event?.event_type || event?.event?.event_type;

    // শুধু completed event এ interest, বাকি সব ignore (viewed/sent ইত্যাদি)
    const completedEvents = ["document_completed", "document.completed"];
    if (!completedEvents.includes(eventType)) {
      return res.status(200).send("Ignored");
    }

    const documentId =
      event?.data?.object?.id ||
      event?.document_id ||
      event?.data?.id;

    const metadataEnrollmentId =
      event?.data?.object?.metadata?.enrollmentId ||
      event?.metadata?.enrollmentId;

    if (!documentId) {
      console.error("SignWell webhook missing document id", event);
      return res.status(400).send("Missing document id");
    }

    // ⚠️ webhook payload নয়, বরং SignWell API থেকে সরাসরি status fetch করে verify
    const liveDoc = await signwellService.getDocumentStatus(documentId);
    const isActuallyCompleted =
      liveDoc?.status === "Completed" || !!liveDoc?.completed_at;

    if (!isActuallyCompleted) {
      console.warn("Webhook said completed but live status disagrees:", documentId);
      return res.status(200).send("Not confirmed yet");
    }

    const filter = metadataEnrollmentId && ObjectId.isValid(metadataEnrollmentId)
      ? { _id: new ObjectId(metadataEnrollmentId) }
      : { signwellDocumentId: documentId };

    const result = await subscriptionEnrollmentsCollection.updateOne(filter, {
      $set: {
        agreementSigned: true,
        status: "Signed — Pending Payment",
        signedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log("SignWell webhook: enrollment updated:", result.modifiedCount);
    return res.status(200).send("OK");
  } catch (err) {
    console.error("SignWell webhook error:", err.response?.data || err.message);
    return res.status(500).send("Error");
  }
};
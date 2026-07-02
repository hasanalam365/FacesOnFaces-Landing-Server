// controllers/signwell.controller.js

// Example DB model (adjust to your project)
const SubscriptionPreEnrollment = require("../models/SubscriptionPreEnrollment");

const handleSignWellWebhook = async (req, res) => {
  try {
    const event = req.body;

    console.log("SignWell webhook received:", event);

    /**
     * SignWell event types (common):
     * - document.completed
     * - document.sent
     */

    if (event.event_type === "document.completed") {
      const documentId = event.document_id;

      // তোমার DB তে যেটা stored থাকবে (IMPORTANT)
      const enrollment = await SubscriptionPreEnrollment.findOne({
        signwellDocumentId: documentId,
      });

      if (!enrollment) {
        console.log("No enrollment found for document:", documentId);
        return res.status(200).send("No match found");
      }

      // MARK AS SIGNED
      enrollment.signed = true;
      enrollment.signedAt = new Date();

      await enrollment.save();

      console.log("Enrollment marked as SIGNED:", enrollment._id);
    }

    res.status(200).send("Webhook received");
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).send("Server error");
  }
};

module.exports = {
  handleSignWellWebhook,
};
const express = require("express");
const router = express.Router();
const controller = require("../controllers/gocardless.webhook.controller");

// express.raw() gives us the exact bytes GoCardless signed — do NOT use
// express.json() on this route or signature verification will always fail.
router.post(
  "/gc/webhook",
  express.raw({ type: "application/json" }),
  controller.handleWebhook
);

module.exports = router;
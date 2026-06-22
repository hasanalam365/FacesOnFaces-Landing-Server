const express = require("express");
const router = express.Router();

const {
  webhookHandler,
} = require("../controllers/webhook.controller");

router.post(
  "/stripe-webhook",
  express.raw({
    type: "application/json",
  }),
  webhookHandler
);

module.exports = router;
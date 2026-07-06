const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");
const controller = require("../controllers/subscriptionAgreement.controller");

// Polling endpoint-এর জন্য আলাদা, বেশি generous limiter
const pollingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // Local test-er jonno ba safe thakte ektu barate paren (protibar 2sec por por holeo 30ta request limit full hoye jete pare jodi user refresh dey)
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/create-subscription-agreement",
  [
    body("name").trim().notEmpty().isLength({ max: 100 }).escape(),
    body("email").trim().isEmail().normalizeEmail(),
    body("phone").trim().notEmpty().isLength({ max: 20 }),
  ],
  controller.createAgreement
);

router.get(
  "/subscription-agreement-status/:id",
  pollingLimiter,
  controller.checkAgreementStatus
);

router.post(
  "/signwell-agreement-webhook/:secret",
  controller.handleSignWellWebhook
);

module.exports = router;
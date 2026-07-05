const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

const controller = require("../controllers/subscriptionPreEnrollment.controller");
const handleDocumentUpload = require("../middlewares/uploadDocument");

/* =========================
   VALIDATION
========================= */
const preEnrollmentValidation = [
  body("name").trim().notEmpty().isLength({ max: 100 }).escape(),
  body("email").trim().isEmail().normalizeEmail(),
  body("phone").trim().notEmpty().isLength({ max: 20 }),
  body("documentType")
    .trim()
    .notEmpty()
    .isIn(["nid", "passport", "driving_license", "electricity_bill"]),
  body("documentNumber").optional().trim().isLength({ max: 50 }).escape(),
];

/* =========================
   PRE ENROLLMENT
========================= */
router.post(
  "/create-subscription-pre-enrollment",
  handleDocumentUpload,
  preEnrollmentValidation,
  controller.createSubscriptionPreEnrollment
);

/* =========================
   SAVE SIGNATURE (OLD OPTIONAL)
========================= */
router.post(
  "/save-subscription-signature",
  body("enrollmentId").trim().notEmpty(),
  body("signature").trim().notEmpty(),
  controller.saveSignature
);

/* =========================
   CHECK AGREEMENT STATUS
========================= */
router.get(
  "/check-agreement-status/:id",
  controller.checkAgreementStatus
);

/* =========================
   CONFIRM AGREEMENT SIGNED
   (was incorrectly pointed at createSubscriptionPreEnrollment before)
========================= */
router.post("/mark-agreement-signed/:id", controller.confirmAgreementSigned);

/* =========================
   SIGNWELL WEBHOOK
========================= */
router.post(
  "/signwell/webhook",
  controller.handleSignWellWebhook
);

module.exports = router;
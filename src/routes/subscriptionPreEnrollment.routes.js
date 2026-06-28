const express = require("express");
const router = express.Router();
const { body, param } = require("express-validator");
const controller = require("../controllers/subscriptionPreEnrollment.controller");
const handleDocumentUpload = require("../middlewares/uploadDocument");

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

const statusValidation = [
  param("enrollmentId").trim().notEmpty().isLength({ min: 24, max: 24 }),
];

router.post(
  "/create-subscription-pre-enrollment",
  handleDocumentUpload,
  preEnrollmentValidation,
  controller.createSubscriptionPreEnrollment
);

router.get(
  "/subscription-agreement-status/:enrollmentId",
  statusValidation,
  controller.getAgreementStatus
);
router.post(
  "/save-subscription-signature",
  body("enrollmentId").trim().notEmpty(),
  body("signature").trim().notEmpty(),
  controller.saveSignature
);

module.exports = router;
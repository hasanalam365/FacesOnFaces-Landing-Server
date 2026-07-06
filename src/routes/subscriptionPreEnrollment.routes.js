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
  body("documentType").trim().notEmpty().isIn(["nid", "passport", "driving_license", "electricity_bill"]),
  body("documentNumber").optional().trim().isLength({ max: 50 }).escape(),
  body("enrollmentId").optional().trim().isString(),
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

module.exports = router;
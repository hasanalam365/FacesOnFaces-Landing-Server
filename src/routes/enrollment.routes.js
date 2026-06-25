const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const controller = require("../controllers/enrollment.controller");

const enrollmentValidation = [
  body("name").trim().notEmpty().isLength({ max: 100 }).escape(),
  body("email").trim().isEmail().normalizeEmail(),
  body("phone").trim().notEmpty().isMobilePhone().isLength({ max: 20 }),
  body("paymentIntentId").trim().notEmpty().matches(/^pi_[a-zA-Z0-9_]+$/), 
 
];

router.post("/create-enrollment", enrollmentValidation, controller.createEnrollment);

module.exports = router;
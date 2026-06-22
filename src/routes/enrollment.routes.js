const express = require("express");

const router = express.Router();

const controller = require(
  "../controllers/enrollment.controller"
);

router.post(
  "/create-enrollment",
  controller.createEnrollment
);

module.exports = router;
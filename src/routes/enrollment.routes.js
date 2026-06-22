const express = require("express");

const router = express.Router();

const {
  createEnrollment,
  getEnrollments,
} = require("../controllers/enrollment.controller");



router.get(
  "/enrollments",
  getEnrollments
);

module.exports = router;
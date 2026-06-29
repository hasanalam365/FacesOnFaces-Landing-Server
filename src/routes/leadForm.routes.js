const express = require("express");
const router = express.Router();

const {
    createLead
} = require("../controllers/leadForm.controller");

router.post("/lead-form", createLead);

module.exports = router;
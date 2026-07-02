const express = require("express");
const router = express.Router();
const controller = require("../controllers/signwellWebhook.controller");

router.post("/signwell-webhook", controller.signwellWebhook);

module.exports = router; // ✅ MUST BE THIS
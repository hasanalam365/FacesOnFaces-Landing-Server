const express = require("express");
const router = express.Router();
const {
  handleSignWellWebhook
} = require("../controllers/signwell.controller");

// IMPORTANT: raw body লাগতে পারে (explained below)
router.post("/signwell/webhook", handleSignWellWebhook);

module.exports = router;
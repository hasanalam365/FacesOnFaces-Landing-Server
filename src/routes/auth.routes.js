const express = require("express");
const router = express.Router();
const controller = require("../controllers/auth.controller");

// JWT create
router.post("/jwt", controller.createJWT);

module.exports = router;
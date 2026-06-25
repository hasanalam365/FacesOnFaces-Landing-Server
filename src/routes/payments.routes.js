const express = require("express");
const router = express.Router();
const controller = require("../controllers/payments.controller");

router.post("/create-payment-intent", controller.createPaymentIntent);
router.post("/create-deposit-payment-intent",controller.createDepositPaymentIntent);

module.exports = router;

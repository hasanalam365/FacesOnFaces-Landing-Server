const stripe = require("../config/stripe");

exports.createPaymentIntent = async (req, res) => {
  try {
    const paymentIntent =
      await stripe.paymentIntents.create({
        amount: 109900, // £1099
        currency: "gbp",
        automatic_payment_methods: {
          enabled: true,
        },
      });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
};

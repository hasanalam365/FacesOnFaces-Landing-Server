const stripe = require("../config/stripe");
const client = require("../config/db");

const enrollmentsCollection = client
  .db("facesOnFaces")
  .collection("enrollments");

exports.webhookHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("Webhook Verification Failed:", err.message);

    return res.status(400).send(
      `Webhook Error: ${err.message}`
    );
  }

  if (
    event.type ===
    "payment_intent.succeeded"
  ) {
    const paymentIntent =
      event.data.object;

    try {
      // Prevent duplicate save
      const existingEnrollment =
        await enrollmentsCollection.findOne({
          paymentIntentId:
            paymentIntent.id,
        });

      if (existingEnrollment) {
        console.log(
          "Enrollment already exists"
        );

        return res.json({
          received: true,
        });
      }

      // Save enrollment
      const enrollment = {
        name:
          paymentIntent.metadata.name ||
          "",

        email:
          paymentIntent.metadata.email ||
          "",

        phone:
          paymentIntent.metadata.phone ||
          "",

        message:
          paymentIntent.metadata.message ||
          "",

        course:
          paymentIntent.metadata.course ||
          "",

        fee: Number(
          paymentIntent.metadata.fee || 0
        ),

        paymentIntentId:
          paymentIntent.id,

        paymentStatus: "paid",

        amount:
          paymentIntent.amount,

        currency:
          paymentIntent.currency,

        createdAt: new Date(),
      };

      await enrollmentsCollection.insertOne(
        enrollment
      );

      console.log(
        "Enrollment Saved Successfully"
      );

      // Send Web3Forms Email
      try {
        const web3Response =
          await fetch(
            "https://api.web3forms.com/submit",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                access_key:
                  process.env
                    .WEB3FORMS_KEY,

                subject:
                  "New Course Enrollment",

                name:
                  enrollment.name,

                email:
                  enrollment.email,

                phone:
                  enrollment.phone,

                message:
                  enrollment.message,

                course:
                  enrollment.course,

                fee:
                  `£${enrollment.fee}`,
              }),
            }
          );

        const web3Result =
          await web3Response.json();

        console.log(
          "Web3Forms Success:",
          web3Result
        );
      } catch (web3Error) {
        console.log(
          "Web3Forms Error:",
          web3Error
        );
      }
    } catch (error) {
      console.log(
        "Webhook Processing Error:",
        error
      );
    }
  }

  res.json({
    received: true,
  });
};
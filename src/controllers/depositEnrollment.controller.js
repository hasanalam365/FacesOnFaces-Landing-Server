const client = require("../config/db");
const stripe = require("../config/stripe");
const transporter = require("../config/mailer");
const { validationResult } = require("express-validator");
const sanitizeHtml = require("sanitize-html");

const depositEnrollmentsCollection = client
  .db("facesOnFaces")
  .collection("depositEnrollments");

const COURSE_NAME = "14 Certificate Foundation Course";

const DEPOSIT_AMOUNT_DISPLAY = "£699";
const REMAINING_BALANCE = "£400";

exports.createDepositEnrollment = async (req, res) => {
  try {
    // Validation Errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array(),
      });
    }

    const {
      paymentIntentId,
      name,
      email,
      phone,
    } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        message: "Payment Intent ID is required",
      });
    }

    // Duplicate Check
    const existing =
      await depositEnrollmentsCollection.findOne({
        paymentIntentId,
      });

    if (existing) {
      return res.status(409).json({
        message:
          "This payment has already been used.",
      });
    }

    // Verify Payment With Stripe
    const paymentIntent =
      await stripe.paymentIntents.retrieve(
        paymentIntentId
      );

    if (
      paymentIntent.status !== "succeeded"
    ) {
      return res.status(400).json({
        message: "Payment not completed",
      });
    }

    // Sanitize Inputs
    const safeName = sanitizeHtml(name, {
      allowedTags: [],
      allowedAttributes: {},
    });

    const safeEmail = sanitizeHtml(email, {
      allowedTags: [],
      allowedAttributes: {},
    });

    const safePhone = sanitizeHtml(phone, {
      allowedTags: [],
      allowedAttributes: {},
    });

    const enrollment = {
      name: safeName,
      email: safeEmail,
      phone: safePhone,

      course: COURSE_NAME,

      enrollmentType: "Deposit",

      depositPaid: DEPOSIT_AMOUNT_DISPLAY,
      remainingBalance:
        REMAINING_BALANCE,

      paymentIntentId,

      paymentStatus: "Paid",

      amount:
        paymentIntent.amount / 100,

      currency:
        paymentIntent.currency,

      enrolledAt: new Date(),
    };

    const result =
      await depositEnrollmentsCollection.insertOne(
        enrollment
      );

    // ADMIN EMAIL
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject:
        "New Deposit Enrollment",
      html: `
        <h2>New Deposit Enrollment</h2>

        <p><strong>Name:</strong> ${safeName}</p>

        <p><strong>Email:</strong> ${safeEmail}</p>

        <p><strong>Phone:</strong> ${safePhone}</p>

        <p><strong>Course:</strong> ${COURSE_NAME}</p>

        <p><strong>Deposit Paid:</strong> £${
          paymentIntent.amount / 100
        }</p>

        <p><strong>Remaining Balance:</strong> ${REMAINING_BALANCE}</p>

        <p><strong>Payment Intent:</strong> ${paymentIntentId}</p>
      `,
    });

    // STUDENT EMAIL
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: safeEmail,
      subject:
        "Deposit Payment Confirmed",
      html: `
        <h2>Thank You ${safeName}</h2>

        <p>
          Your deposit payment has been received successfully.
        </p>

        <p><strong>Course:</strong> ${COURSE_NAME}</p>

        <p><strong>Deposit Paid:</strong> ${DEPOSIT_AMOUNT_DISPLAY}</p>

        <p><strong>Remaining Balance:</strong> ${REMAINING_BALANCE}</p>

        <p>
          Our team will contact you shortly regarding the next steps.
        </p>
      `,
    });

    return res.status(200).json({
      success: true,
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const client = require("../config/db");
const stripe = require("../config/stripe");
const transporter = require("../config/mailer");
const { validationResult } = require("express-validator");
const sanitizeHtml = require("sanitize-html");

const depositEnrollmentsCollection = client
  .db("facesOnFaces")
  .collection("depositEnrollments");

const COURSE_NAME = "14 Certificate Fast-Track Course";

const DEPOSIT_AMOUNT_DISPLAY = "£250";
const REMAINING_BALANCE = "£849";

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
        <p><strong>Enrollment Type:</strong> Deposit</p>

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

     // confirm mail to user
   await transporter.sendMail({
  from: `"Faces On Faces Academy" <${process.env.EMAIL_USER}>`,
  to: safeEmail,
  subject: "🎉 Enrollment Confirmed – Faces On Faces Academy",

  html: `
    <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">

      <div style="background:#06b6d4;padding:30px;text-align:center;">
        <h1 style="color:#fff;margin:0;">
          Faces On Faces Academy
        </h1>

        <p style="color:#dff9ff;margin-top:8px;">
          Enrollment Confirmation
        </p>
      </div>

      <div style="padding:35px;">

        <h2 style="color:#111;">
          Congratulations ${safeName}! 🎉
        </h2>

        <p style="font-size:16px;line-height:1.8;color:#555;">
          Thank you for enrolling at
          <strong>Faces On Faces Academy</strong>.
        </p>

        <p style="font-size:16px;line-height:1.8;color:#555;">
          We're delighted to confirm that your enrollment has been
          successfully completed and your payment has been received.
        </p>

        <div style="background:#f8f8f8;padding:20px;border-radius:10px;margin:25px 0;">

          <h3 style="margin-top:0;">
            Enrollment Details
          </h3>

          <p><strong>Name:</strong> ${safeName}</p>

          <p><strong>Email:</strong> ${safeEmail}</p>

          <p><strong>Phone:</strong> ${safePhone}</p>

          <p><strong>Course:</strong> ${COURSE_NAME}</p>

          <p><strong>Enrollment Type:</strong> Deposit</p>

          <p><strong>Course Fee:</strong> £1,099</p>

          <p><strong>Amount Paid:</strong> £250</p>
          <p><strong>Amount Due:</strong> £849</p>

          <p>
            <strong>Payment Status:</strong>
            <span style="color:#16a34a;font-weight:bold;">
              Paid ✅
            </span>
          </p>

        </div>

        <h3 style="color:#111;">
          What Happens Next?
        </h3>

        <p style="font-size:16px;line-height:1.8;color:#555;">
          • Our admissions team will review your enrollment.<br>
          • You'll receive your course schedule and joining instructions shortly.<br>
          • We'll contact you before your training begins with everything you need.
        </p>

        <p style="font-size:16px;line-height:1.8;color:#555;">
          Thank you for choosing Faces On Faces Academy.
          We're excited to be part of your journey into the aesthetics industry and look forward to welcoming you soon.
        </p>

        <p style="margin-top:35px;">
          Best Regards,<br>
          <strong>Faces On Faces Academy</strong>
        </p>

      </div>

    </div>
  `
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
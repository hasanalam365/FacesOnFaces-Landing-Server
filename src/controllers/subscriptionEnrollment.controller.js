const client = require("../config/db");
const stripe = require("../config/stripe");
const transporter = require("../config/mailer");
const { validationResult } = require("express-validator");
const sanitizeHtml = require("sanitize-html");
const { ObjectId } = require("mongodb");
const path = require("path");

const subscriptionEnrollmentsCollection = client
  .db("facesOnFaces")
  .collection("subscriptionEnrollments");

const COURSE_NAME = "14 Certificate Fast-Track Course";
const FIRST_PAYMENT_DISPLAY = "£250";
const MONTHLY_AMOUNT = "£100";

exports.createSubscriptionEnrollment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

   const {
  paymentIntentId,
  enrollmentId,
  name,
  email,
  phone,
  selectedDate,
  selectedLocation,
} = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ message: "Payment Intent ID is required" });
    }

    // Guard: duplicate payment
    const existingByPayment = await subscriptionEnrollmentsCollection.findOne({
      paymentIntentId,
    });
    if (existingByPayment) {
      return res.status(409).json({ message: "This payment has already been used." });
    }

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const safeName = sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} });
    const safeEmail = sanitizeHtml(email, { allowedTags: [], allowedAttributes: {} });
    const safePhone = sanitizeHtml(phone, { allowedTags: [], allowedAttributes: {} });
    const safeDate = sanitizeHtml(selectedDate || "", {
  allowedTags: [],
  allowedAttributes: {},
});

const safeLocation = sanitizeHtml(selectedLocation || "", {
  allowedTags: [],
  allowedAttributes: {},
});

   // If enrollmentId provided, update the pre-enrollment record with payment info
    if (enrollmentId && ObjectId.isValid(enrollmentId)) {
      const preEnrollment = await subscriptionEnrollmentsCollection.findOne({
        _id: new ObjectId(enrollmentId),
      });
      if (!preEnrollment) {
        return res.status(404).json({ message: "Pre-enrollment record not found." });
      }

      // Update existing pre-enrollment record with payment info
      await subscriptionEnrollmentsCollection.updateOne(
  { _id: new ObjectId(enrollmentId) },
  {
    $set: {
      status: "Payment Complete",
      agreementSigned: true,
      paymentIntentId,
      paymentStatus: "Paid",
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,

      selectedDate: safeDate,
      selectedLocation: safeLocation,

      enrolledAt: new Date(),
      updatedAt: new Date(),
    },
  }
);
    }

    // Send admin email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "New Subscription Enrollment — Payment Received",
      html: `
        <h2>New Subscription Enrollment</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Phone:</strong> ${safePhone}</p>
        <p><strong>Course:</strong> ${COURSE_NAME}</p>
        <p><strong>Enrollment Type:</strong> Subscription</p>
        <p><strong>Course Date:</strong> ${safeDate}</p>
<p><strong>Location:</strong> ${safeLocation}</p>
        <p><strong>First Payment Paid:</strong> £${paymentIntent.amount / 100}</p>
        <p><strong>Monthly Amount:</strong> ${MONTHLY_AMOUNT}</p>
        <p><strong>Status:</strong> Pending Direct Debit Setup</p>
        <p><strong>Payment Intent:</strong> ${paymentIntentId}</p>
        ${enrollmentId ? `<p><strong>Pre-Enrollment ID:</strong> ${enrollmentId}</p>` : ""}
        <br/>
        
      `,
    });

  // COMPANY OWNER EMAIL
// await transporter.sendMail({
//   from: process.env.EMAIL_USER,
//   to: "Info@facesonfaces.com",
//   subject: "New Subscription Enrollment — Payment Received",
//   html: `
//     <h2>New Subscription Enrollment</h2>

//     <p><strong>Name:</strong> ${safeName}</p>

//     <p><strong>Email:</strong> ${safeEmail}</p>

//     <p><strong>Phone:</strong> ${safePhone}</p>

//     <p><strong>Course:</strong> ${COURSE_NAME}</p>

//     <p><strong>Enrollment Type:</strong> Subscription</p>

//     <p><strong>First Payment Paid:</strong> £${
//       paymentIntent.amount / 100
//     }</p>

//     <p><strong>Monthly Amount:</strong> ${MONTHLY_AMOUNT}</p>

//     <p><strong>Status:</strong> Pending Direct Debit Setup</p>

//     <p><strong>Payment Intent:</strong> ${paymentIntentId}</p>

//     ${
//       enrollmentId
//         ? `<p><strong>Pre-Enrollment ID:</strong> ${enrollmentId}</p>`
//         : ""
//     }

//     <br/>
//   `,
// });

    // Send student confirmation email
    
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
          Subscription Enrollment Confirmation
        </p>
      </div>

      <div style="padding:35px;">

        <h2 style="color:#111;">
          Congratulations ${safeName}! 🎉
        </h2>

        <p style="font-size:16px;line-height:1.8;color:#555;">
          Thank you for choosing
          <strong>Faces On Faces Academy</strong>.
        </p>

        <p style="font-size:16px;line-height:1.8;color:#555;">
          We're delighted to confirm that your subscription enrollment has been successfully received.
          Your initial payment has been processed successfully.
        </p>

        <div style="background:#f8f8f8;padding:20px;border-radius:10px;margin:25px 0;">

          <h3 style="margin-top:0;">
            Enrollment Details
          </h3>

          <p><strong>Name:</strong> ${safeName}</p>

          <p><strong>Email:</strong> ${safeEmail}</p>

          <p><strong>Phone:</strong> ${safePhone}</p>

          <p><strong>Course:</strong> ${COURSE_NAME}</p>

          <p><strong>Enrollment Type:</strong> Subscription</p>
          <p><strong>Course Date:</strong> ${safeDate}</p>
<p><strong>Location:</strong> ${safeLocation}</p>

          <p><strong>Initial Payment:</strong> ${FIRST_PAYMENT_DISPLAY}</p>

          <p><strong>Monthly Payment:</strong> ${MONTHLY_AMOUNT}</p>

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
          • Your Subscription Agreement is attached with this email.<br>
          • We'll set up your remaining monthly payments.<br>
          • You'll receive your course schedule and joining instructions shortly.
        </p>

        <p style="font-size:16px;line-height:1.8;color:#555;">
          Please keep the attached Subscription Agreement for your records.
        </p>

        <p style="font-size:16px;line-height:1.8;color:#555;">
          We're excited to welcome you to the Faces On Faces Academy family and look forward to helping you begin your journey in the aesthetics industry.
        </p>

        <p style="margin-top:35px;">
          Best Regards,<br>
          <strong>Faces On Faces Academy</strong>
        </p>

      </div>

    </div>
  `,

  attachments: [
    {
      filename: "Subscription Agreement [Faces On Faces].pdf",
     path: path.join(
  __dirname,
  "../agreements/Subscription Agreement [Faces On Faces].pdf"
),
      contentType: "application/pdf",
    },
  ],
});

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Subscription enrollment error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
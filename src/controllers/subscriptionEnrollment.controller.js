const client = require("../config/db");
const stripe = require("../config/stripe");
const transporter = require("../config/mailer");
const { validationResult } = require("express-validator");
const sanitizeHtml = require("sanitize-html");
const { ObjectId } = require("mongodb");

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

    const { paymentIntentId, enrollmentId, name, email, phone } = req.body;

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

    // If enrollmentId provided, verify agreement was signed before allowing payment completion
    if (enrollmentId && ObjectId.isValid(enrollmentId)) {
      const preEnrollment = await subscriptionEnrollmentsCollection.findOne({
        _id: new ObjectId(enrollmentId),
      });
      if (!preEnrollment) {
        return res.status(404).json({ message: "Pre-enrollment record not found." });
      }
      if (!preEnrollment.agreementSigned) {
        return res
          .status(403)
          .json({ message: "Agreement must be signed before payment." });
      }

      // Update existing pre-enrollment record with payment info
      await subscriptionEnrollmentsCollection.updateOne(
        { _id: new ObjectId(enrollmentId) },
        {
          $set: {
            status: "Pending Agreement",
            paymentIntentId,
            paymentStatus: "Paid",
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
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
        <p><strong>First Payment Paid:</strong> £${paymentIntent.amount / 100}</p>
        <p><strong>Monthly Amount:</strong> ${MONTHLY_AMOUNT}</p>
        <p><strong>Status:</strong> Pending Direct Debit Setup</p>
        <p><strong>Payment Intent:</strong> ${paymentIntentId}</p>
        ${enrollmentId ? `<p><strong>Pre-Enrollment ID:</strong> ${enrollmentId}</p>` : ""}
        <br/>
        <p>Agreement was signed via SignWell. Please set up the direct debit for the remaining 11 months.</p>
      `,
    });

    // Send student confirmation email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: safeEmail,
      subject: "First Payment Confirmed — Faces On Faces Academy",
      html: `
        <h2>Thank You, ${safeName}!</h2>
        <p>Your first monthly payment has been received and your agreement is signed.</p>
        <br/>
        <h3>Enrollment Summary</h3>
        <p><strong>Course:</strong> ${COURSE_NAME}</p>
        <p><strong>Payment Plan:</strong> Subscription</p>
        <p><strong>First Payment Paid:</strong> £${paymentIntent.amount / 100}</p>
        <p><strong>Monthly Payment:</strong> ${MONTHLY_AMOUNT} × 11 remaining months</p>
        <br/>
        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Our team will review your enrollment within 24 hours.</li>
          <li>We will set up your direct debit for the remaining 11 months.</li>
          <li>You will receive confirmation of your start date by email.</li>
        </ol>
        <br/>
        <p>If you have any questions, please contact us at support@facesonfaces.com</p>
        <p>— Faces On Faces Academy Team</p>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Subscription enrollment error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const client = require("../config/db");
const stripe = require("../config/stripe");
const transporter = require("../config/mailer");
const { validationResult } = require("express-validator");
const sanitizeHtml = require("sanitize-html");

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

    const { paymentIntentId, name, email, phone } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ message: "Payment Intent ID is required" });
    }

    const existing = await subscriptionEnrollmentsCollection.findOne({ paymentIntentId });
    if (existing) {
      return res.status(409).json({ message: "This payment has already been used." });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const safeName = sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} });
    const safeEmail = sanitizeHtml(email, { allowedTags: [], allowedAttributes: {} });
    const safePhone = sanitizeHtml(phone, { allowedTags: [], allowedAttributes: {} });

    const enrollment = {
      name: safeName,
      email: safeEmail,
      phone: safePhone,
      course: COURSE_NAME,
      enrollmentType: "Subscription",
      firstPaymentPaid: FIRST_PAYMENT_DISPLAY,
      monthlyAmount: MONTHLY_AMOUNT,
    
      status: "Pending Agreement",
      agreementSent: false,
      paymentIntentId,
      paymentStatus: "Paid",
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      enrolledAt: new Date(),
    };

    const result = await subscriptionEnrollmentsCollection.insertOne(enrollment);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "New Subscription Enrollment",
      html: `
        <h2>New Subscription Enrollment</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Phone:</strong> ${safePhone}</p>
        <p><strong>Course:</strong> ${COURSE_NAME}</p>
        <p><strong>Enrollment Type:</strong> Subscription</p>
        <p><strong>First Payment Paid:</strong> £${paymentIntent.amount / 100}</p>
        <p><strong>Monthly Amount:</strong> ${MONTHLY_AMOUNT}</p>
        
        <p><strong>Status:</strong> Pending Agreement</p>
        <p><strong>Payment Intent:</strong> ${paymentIntentId}</p>
        <br/>
        <p>Please send the subscription agreement to the student's email.</p>
      `,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: safeEmail,
      subject: "First Payment Confirmed — Faces On Faces Academy",
      html: `
        <h2>Thank You, ${safeName}!</h2>
        <p>Your first monthly payment has been received successfully.</p>
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
          <li>We will send your subscription agreement to this email address.</li>
          <li>Once signed, your direct debit will be set up for the remaining 11 months.</li>
        </ol>
        <br/>
        <p>If you have any questions, please contact us at support@facesonfaces.com</p>
        <p>— Faces On Faces Academy Team</p>
      `,
    });

    return res.status(200).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error("Subscription enrollment error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
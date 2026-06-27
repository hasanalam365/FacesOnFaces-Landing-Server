const client = require("../config/db");
const stripe = require("../config/stripe");
const transporter = require("../config/mailer");
const { validationResult } = require("express-validator");
const sanitizeHtml = require("sanitize-html");

const enrollmentsCollection = client
  .db("facesOnFaces")
  .collection("enrollments");

// Amount Stripe থেকে নেওয়া হবে, client থেকে না
const COURSE_FEE_DISPLAY = "£1,099";
const COURSE_NAME = "14 Certificate Fast-Track Course";

exports.createEnrollment = async (req, res) => {
  try {
    //  Input validation errors চেক
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paymentIntentId, name, email, phone, message } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ message: "Payment Intent ID is required" });
    }

    //  Duplicate enrollment চেক
    const existing = await enrollmentsCollection.findOne({ paymentIntentId });
    if (existing) {
      return res.status(409).json({ message: "This payment has already been used for enrollment" });
    }

    //  Stripe থেকে payment verify
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    //  Amount backend থেকে নেওয়া হচ্ছে — client পাঠানো course_fee ব্যবহার নেই
    const paidAmount = paymentIntent.amount;
    const paidCurrency = paymentIntent.currency;

    //  Input sanitize (XSS prevention)
    const safeName = sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} });
    const safeEmail = sanitizeHtml(email, { allowedTags: [], allowedAttributes: {} });
    const safePhone = sanitizeHtml(phone, { allowedTags: [], allowedAttributes: {} });
   

    const enrollment = {
      name: safeName,
      email: safeEmail,
      phone: safePhone,
      course: COURSE_NAME,           
      course_fee: COURSE_FEE_DISPLAY, 
      
      paymentIntentId,
      
enrollmentType: 'Pay in Full'
,
      paymentStatus: "Paid",
      amount: paidAmount / 100,      
      currency: paidCurrency,
      enrolledAt: new Date(),
    };

    const result = await enrollmentsCollection.insertOne(enrollment);

    // Admin Email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "New Course Enrollment",
      html: `
        <h2>New Enrollment Received</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Phone:</strong> ${safePhone}</p>
        <p><strong>Course:</strong> ${COURSE_NAME}</p>
        <p><strong>Enrollment Type:</strong> Pay in Full</p>
        <p><strong>Amount Paid:</strong> £${paidAmount / 100} ${paidCurrency.toUpperCase()}</p>
        <p><strong>Payment Intent ID:</strong> ${paymentIntentId}</p>
       
      `,
    });

    // Student Email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: safeEmail,
      subject: "New Enrollment Pay in Full",
      html: `
        <h2>Thank You ${safeName}</h2>
        <p>Your enrollment has been received successfully.</p>
        <p><strong>Course:</strong> ${COURSE_NAME}</p>
        <p><strong>Amount Paid:</strong> £${paidAmount / 100}</p>
        <p>We will contact you shortly with the next steps.</p>
      `,
    });

    res.json({ success: true, insertedId: result.insertedId });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" }); 
  }
};
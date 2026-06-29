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

          <p><strong>Enrollment Type:</strong> Pay in Full</p>

          <p><strong>Course Fee:</strong> ${COURSE_FEE_DISPLAY}</p>

          <p><strong>Amount Paid:</strong> £${paidAmount / 100}</p>

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

    res.json({ success: true, insertedId: result.insertedId });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" }); 
  }
};
const client = require("../config/db");
const stripe = require("../config/stripe");
const transporter = require("../config/mailer");

const enrollmentsCollection = client
.db("facesOnFaces")
.collection("enrollments");

exports.createEnrollment = async (req, res) => {
try {
const {
paymentIntentId,
name,
email,
phone,
course,
course_fee,
message,
} = req.body;




if (!paymentIntentId) {
  return res.status(400).send({
    message: "Payment Intent ID is required",
  });
}

// Verify payment from Stripe
const paymentIntent =
  await stripe.paymentIntents.retrieve(
    paymentIntentId
  );

if (paymentIntent.status !== "succeeded") {
  return res.status(400).send({
    message: "Payment not completed",
  });
}

const enrollment = {
  name,
  email,
  phone,
  course,
  course_fee,
  message,
  paymentIntentId,
  paymentStatus: "Paid",
  amount: paymentIntent.amount / 100,
  currency: paymentIntent.currency,
  enrolledAt: new Date(),
};

const result =
  await enrollmentsCollection.insertOne(
    enrollment
  );

 

// Admin Email
await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: process.env.EMAIL_USER,

  subject: "New Course Enrollment",

  html: `
    <h2>New Enrollment Received</h2>

    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone}</p>

    <p><strong>Course:</strong> ${course}</p>

    <p><strong>Course Fee:</strong> ${course_fee}</p>

    <p><strong>Payment Status:</strong> Paid</p>

    <p><strong>Payment Intent ID:</strong> ${paymentIntentId}</p>

    <p><strong>Message:</strong></p>

    <p>${message || "No message provided"}</p>
  `,
});

// Student Confirmation Email
await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: email,

  subject: "Enrollment Confirmed",

  html: `
    <h2>Thank You ${name}</h2>

    <p>
      Your enrollment has been received
      successfully.
    </p>

    <p>
      <strong>Course:</strong> ${course}
    </p>

    <p>
      <strong>Amount Paid:</strong> ${course_fee}
    </p>

    <p>
      We will contact you shortly with
      the next steps.
    </p>
  `,
});

res.send({
  success: true,
  insertedId: result.insertedId,
});


} catch (error) {
console.error(error);


res.status(500).send({
  message: error.message,
});


}
};

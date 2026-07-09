const client = require("../config/db");
const stripe = require("../config/stripe");
const transporter = require("../config/mailer");
const { validationResult } = require("express-validator");
const sanitizeHtml = require("sanitize-html");

const enrollmentsCollection = client
  .db("facesOnFaces")
  .collection("enrollments");

const COURSE_FEE_DISPLAY = "£1,099";
const COURSE_NAME = "14 Certificate Fast-Track Course";


exports.createEnrollment = async (req, res) => {

  try {

    // Validation check
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }


    const {
      paymentIntentId,
      name,
      email,
      phone,
      selectedDate,
      selectedLocation
    } = req.body;


 



    if (!paymentIntentId) {
      return res.status(400).json({
        message: "Payment Intent ID is required"
      });
    }



    // Duplicate payment check
    const existing = await enrollmentsCollection.findOne({
      paymentIntentId
    });


    if (existing) {
      return res.status(409).json({
        message: "This payment has already been used for enrollment"
      });
    }



    // Verify Stripe payment
    const paymentIntent =
      await stripe.paymentIntents.retrieve(paymentIntentId);



    if (paymentIntent.status !== "succeeded") {

      return res.status(400).json({
        message: "Payment not completed"
      });

    }



    const paidAmount = paymentIntent.amount;
    const paidCurrency = paymentIntent.currency;



    // Sanitize input
    const safeName = sanitizeHtml(name || "", {
      allowedTags: [],
      allowedAttributes: {}
    });


    const safeEmail = sanitizeHtml(email || "", {
      allowedTags: [],
      allowedAttributes: {}
    });


    const safePhone = sanitizeHtml(phone || "", {
      allowedTags: [],
      allowedAttributes: {}
    });


    const safeDate = sanitizeHtml(selectedDate || "", {
      allowedTags: [],
      allowedAttributes: {}
    });


    const safeLocation = sanitizeHtml(selectedLocation || "", {
      allowedTags: [],
      allowedAttributes: {}
    });



    // MongoDB document

    const enrollment = {

      name: safeName,

      email: safeEmail,

      phone: safePhone,


      course: COURSE_NAME,

      course_fee: COURSE_FEE_DISPLAY,


      // NEW FIELDS
      selectedDate: safeDate || null,

      selectedLocation: safeLocation || null,


      paymentIntentId,


      enrollmentType: "Pay in Full",

      paymentStatus: "Paid",

      amount: paidAmount / 100,

      currency: paidCurrency,


      enrolledAt: new Date()

    };



    const result =
      await enrollmentsCollection.insertOne(enrollment);




    // Admin email

    await transporter.sendMail({

      from: process.env.EMAIL_USER,

      to: process.env.EMAIL_USER,

      subject: "New Course Enrollment",

      html: `

      <h2>New Enrollment Received</h2>

      <p><b>Name:</b> ${safeName}</p>

      <p><b>Email:</b> ${safeEmail}</p>

      <p><b>Phone:</b> ${safePhone}</p>


      <p><b>Course:</b> ${COURSE_NAME}</p>

      <p><b>Date:</b> ${safeDate || "Not Selected"}</p>

      <p><b>Location:</b> ${safeLocation || "Not Selected"}</p>


      <p><b>Payment:</b> £${paidAmount / 100}</p>

      <p><b>Status:</b> Paid</p>

      <p><b>Payment ID:</b> ${paymentIntentId}</p>

      `

    });

  // COMPANY OWNER EMAIL
// await transporter.sendMail({
//   from: process.env.EMAIL_USER,
//   to: "Info@facesonfaces.com",
//   subject: "New Course Enrollment",
//   html: `
//     <h2>New Enrollment Received</h2>

//     <p><b>Name:</b> ${safeName}</p>

//     <p><b>Email:</b> ${safeEmail}</p>

//     <p><b>Phone:</b> ${safePhone}</p>

//     <p><b>Course:</b> ${COURSE_NAME}</p>

//     <p><b>Date:</b> ${safeDate || "Not Selected"}</p>

//     <p><b>Location:</b> ${safeLocation || "Not Selected"}</p>

//     <p><b>Payment:</b> £${paidAmount / 100}</p>

//     <p><b>Status:</b> Paid</p>

//     <p><b>Payment ID:</b> ${paymentIntentId}</p>
//   `
// });


    // Student confirmation email

    await transporter.sendMail({

      from:
      `"Faces On Faces Academy" <${process.env.EMAIL_USER}>`,


      to: safeEmail,


      subject:
      "🎉 Enrollment Confirmed – Faces On Faces Academy",



      html: `


      <div style="
      max-width:600px;
      margin:auto;
      font-family:Arial;
      border:1px solid #ddd;
      padding:30px;
      border-radius:12px;
      ">


      <h1 style="color:#06b6d4;">
      Faces On Faces Academy
      </h1>


      <h2>
      Congratulations ${safeName}! 🎉
      </h2>



      <p>
      Your enrollment has been successfully completed.
      </p>



      <hr/>


      <h3>Enrollment Details</h3>


      <p><b>Name:</b> ${safeName}</p>

      <p><b>Email:</b> ${safeEmail}</p>

      <p><b>Phone:</b> ${safePhone}</p>


      <p><b>Course:</b> ${COURSE_NAME}</p>


      <p>
      <b>Course Date:</b>
      ${safeDate || "Not Selected"}
      </p>


      <p>
      <b>Location:</b>
      ${safeLocation || "Not Selected"}
      </p>



      <p>
      <b>Course Fee:</b>
      ${COURSE_FEE_DISPLAY}
      </p>


      <p>
      <b>Payment Status:</b>
      <span style="color:green">
      Paid ✅
      </span>
      </p>



      <br/>

      <p>
      Our admissions team will contact you shortly with the next steps.
      </p>


      <p>
      Best Regards,<br/>
      <b>Faces On Faces Academy</b>
      </p>


      </div>


      `

    });




    return res.json({

      success:true,

      insertedId: result.insertedId

    });



  } catch(error) {


    console.error(
      "Enrollment Error:",
      error
    );


    return res.status(500).json({

      message:"Internal server error"

    });


  }

};
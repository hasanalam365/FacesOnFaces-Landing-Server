const client = require("../config/db");
const transporter = require("../config/mailer");
const { saveLeadToSheet } = require("../utils/saveLeadToSheet"); // ← NEW

const leadCollection = client
    .db("facesOnFaces")
    .collection("LeadForms");

const createLead = async (req, res) => {

    try {

        const {
            fullName,
            email,
            phone,
           
            bestTime,
            message
        } = req.body;

        if (
            !fullName ||
            !email ||
            !phone ||
            !bestTime
        ) {
            return res.status(400).json({
                success:false,
                message:"Required fields missing."
            });
        }

        const lead = {

            fullName,
            email,
            phone,
           

            bestTime,

            message: message || "",

            status:"Pending",

            createdAt:new Date()

        };

        const result = await leadCollection.insertOne(lead);

        // ── Google Sheets এ append (non-blocking, error isolated) ── NEW
        saveLeadToSheet(lead).catch((err) => {
            console.error("⚠️  Google Sheets append failed:", err.message);
            // এই error MongoDB save বা email এর উপর কোনো প্রভাব ফেলবে না
        });

        await transporter.sendMail({

            from: process.env.EMAIL_USER,

            to:process.env.EMAIL_USER,

            subject:"📞 New Advisor Lead",

            html:`

                <h2>New Lead Received</h2>

                <p><b>Name:</b> ${fullName}</p>

                <p><b>Email:</b> ${email}</p>

                <p><b>Phone:</b> ${phone}</p>

               

                <p><b>Best Time:</b> ${bestTime}</p>

                <p><b>Message:</b> ${message}</p>

            `
        });

        await transporter.sendMail({
  from: `"Faces On Faces Academy" <${process.env.EMAIL_USER}>`,
  to: email,
  subject: "🎉 Thank You for Contacting Faces On Faces Academy",

  html: `
    <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">

      <div style="background:#06b6d4;padding:30px;text-align:center;">
        <h1 style="color:#fff;margin:0;">
          Faces On Faces Academy
        </h1>
      </div>

      <div style="padding:35px;">

        <h2 style="color:#111;">
          Hello ${fullName},
        </h2>

        <p style="font-size:16px;line-height:1.8;color:#555;">
          Thank you for contacting
          <strong>Faces On Faces Academy</strong>.
        </p>

        <p style="font-size:16px;line-height:1.8;color:#555;">
          We have successfully received your enquiry and one of our
          advisors will contact you as soon as possible.
        </p>

        <div style="background:#f8f8f8;padding:20px;border-radius:10px;margin:25px 0;">

          <h3 style="margin-top:0;">
            Your Details
          </h3>

          <p><strong>Name:</strong> ${fullName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          
          <p><strong>Best Time:</strong> ${bestTime}</p>

        </div>

        <p style="font-size:16px;color:#555;">
          We appreciate your interest in our training courses.
        </p>

        <p style="margin-top:35px;">
          Best Regards,<br>
          <strong>Faces On Faces Academy</strong>
        </p>

      </div>

    </div>
  `
});

        res.json({

            success:true,

            message:"Lead submitted successfully.",

            insertedId:result.insertedId

        });

    } catch(err){

        console.log(err);

        res.status(500).json({

            success:false,

            message:"Server Error"

        });

    }

};

module.exports={createLead};
const client = require("../config/db");
const transporter = require("../config/mailer");

const leadCollection = client
    .db("facesOnFaces")
    .collection("LeadForms");

const createLead = async (req, res) => {

    try {

        const {
            fullName,
            email,
            phone,
            preferredContact,
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
            preferredContact:
                preferredContact || "Phone",

            bestTime,

            message: message || "",

            status:"Pending",

            createdAt:new Date()

        };

        const result = await leadCollection.insertOne(lead);

        await transporter.sendMail({

            from: process.env.EMAIL_USER,

            to:process.env.EMAIL_USER,

            subject:"📞 New Advisor Lead",

            html:`

                <h2>New Lead Received</h2>

                <p><b>Name:</b> ${fullName}</p>

                <p><b>Email:</b> ${email}</p>

                <p><b>Phone:</b> ${phone}</p>

                <p><b>Preferred Contact:</b> ${preferredContact}</p>

                <p><b>Best Time:</b> ${bestTime}</p>

                <p><b>Message:</b> ${message}</p>

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
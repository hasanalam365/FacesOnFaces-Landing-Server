const client = require("../config/db");
const transporter = require("../config/mailer");
const sanitizeHtml = require("sanitize-html");
const { ObjectId } = require("mongodb");
const { sendAgreement } = require("../config/signwell");
const { validationResult } = require("express-validator");

const subscriptionEnrollmentsCollection = client
  .db("facesOnFaces")
  .collection("subscriptionEnrollments");

const ALLOWED_DOC_TYPES = ["nid", "passport", "driving_license", "electricity_bill"];
const ALLOWED_MIMETYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * POST /create-subscription-pre-enrollment
 * - Validates identity document
 * - Stores pre-enrollment record (status: "Pending Signature")
 * - Sends SignWell agreement to student
 * Returns { enrollmentId }
 */
exports.createSubscriptionPreEnrollment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, documentType, documentNumber } = req.body;

    // Validate document type
    if (!ALLOWED_DOC_TYPES.includes(documentType)) {
      return res.status(400).json({ message: "Invalid document type." });
    }

    // Validate uploaded files
    const frontFile = req.files?.frontFile?.[0];
    if (!frontFile) {
      return res.status(400).json({ message: "Document upload is required." });
    }

    // Re-validate mimetype and size server-side (defence in depth)
    if (!ALLOWED_MIMETYPES.includes(frontFile.mimetype)) {
      return res.status(400).json({ message: "Invalid file type." });
    }
    if (frontFile.size > MAX_SIZE_BYTES) {
      return res.status(400).json({ message: "File too large. Max 10MB." });
    }

    const backFile = req.files?.backFile?.[0];
    if (backFile) {
      if (!ALLOWED_MIMETYPES.includes(backFile.mimetype)) {
        return res.status(400).json({ message: "Invalid back file type." });
      }
      if (backFile.size > MAX_SIZE_BYTES) {
        return res.status(400).json({ message: "Back file too large. Max 10MB." });
      }
    }

    const safeName = sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} });
    const safeEmail = sanitizeHtml(email, { allowedTags: [], allowedAttributes: {} });
    const safePhone = sanitizeHtml(phone, { allowedTags: [], allowedAttributes: {} });
    const safeDocNumber = documentNumber
      ? sanitizeHtml(documentNumber, { allowedTags: [], allowedAttributes: {} })
      : null;

    // Send agreement via SignWell
    let signwellDoc;
    try {
      signwellDoc = await sendAgreement({
        name: safeName,
        email: safeEmail,
        templateFields: {
          student_phone: { value: safePhone },
          course_name: { value: "14 Certificate Fast-Track Course" },
          first_payment: { value: "£250" },
          monthly_payment: { value: "£100" },
        },
      });
    } catch (swErr) {
      console.error("SignWell send error:", swErr);
      return res
        .status(502)
        .json({ message: "Could not send agreement. Please try again." });
    }

    // Save pre-enrollment to DB
    const preEnrollment = {
      name: safeName,
      email: safeEmail,
      phone: safePhone,
      course: "14 Certificate Fast-Track Course",
      enrollmentType: "Subscription",
      status: "Pending Signature",
      identityDocument: {
        type: documentType,
        number: safeDocNumber,
        // Store file metadata only; raw buffers are not persisted to DB
        frontFileName: frontFile.originalname,
        frontFileMimeType: frontFile.mimetype,
        frontFileSizeBytes: frontFile.size,
        backFileName: backFile?.originalname || null,
        backFileMimeType: backFile?.mimetype || null,
      },
      signwellDocumentId: signwellDoc.id,
      signwellStatus: signwellDoc.status,
      agreementSigned: false,
      paymentIntentId: null,
      paymentStatus: "Pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await subscriptionEnrollmentsCollection.insertOne(preEnrollment);

    // Internal admin notification
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "New Subscription Pre-Enrollment (Pending Signature)",
      html: `
        <h2>New Pre-Enrollment — Awaiting Agreement Signature</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Phone:</strong> ${safePhone}</p>
        <p><strong>Document Type:</strong> ${documentType}</p>
        <p><strong>Document Number:</strong> ${safeDocNumber || "N/A"}</p>
        <p><strong>SignWell Document ID:</strong> ${signwellDoc.id}</p>
        <p><strong>Status:</strong> Pending Signature</p>
        <p>The subscription agreement has been sent to the student's email via SignWell.</p>
      `,
    });

    return res.status(200).json({
      success: true,
      enrollmentId: result.insertedId.toString(),
    });
  } catch (error) {
    console.error("Pre-enrollment error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * GET /subscription-agreement-status/:enrollmentId
 * Polls SignWell to check if the document has been signed.
 * Updates DB when signed.
 */
exports.getAgreementStatus = async (req, res) => {
  try {
    const { enrollmentId } = req.params;

    if (!ObjectId.isValid(enrollmentId)) {
      return res.status(400).json({ message: "Invalid enrollment ID." });
    }

    const enrollment = await subscriptionEnrollmentsCollection.findOne({
      _id: new ObjectId(enrollmentId),
    });

    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found." });
    }

    // Already confirmed as signed in DB
    if (enrollment.agreementSigned) {
      return res.status(200).json({ signed: true });
    }

    // Poll SignWell for latest status
    const { getDocumentStatus } = require("../config/signwell");
    const signwellDoc = await getDocumentStatus(enrollment.signwellDocumentId);

    const isSigned =
      signwellDoc.status === "completed" ||
      signwellDoc.completed === true ||
      signwellDoc.status === "signed";

    if (isSigned) {
      await subscriptionEnrollmentsCollection.updateOne(
        { _id: new ObjectId(enrollmentId) },
        {
          $set: {
            agreementSigned: true,
            signwellStatus: signwellDoc.status,
            signedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );
    }

    return res.status(200).json({ signed: isSigned });
  } catch (error) {
    console.error("Agreement status check error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
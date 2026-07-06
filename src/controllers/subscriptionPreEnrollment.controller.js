const client = require("../config/db");
const sanitizeHtml = require("sanitize-html");
const { ObjectId } = require("mongodb");
const { validationResult } = require("express-validator");
const axios = require("axios");
const FormData = require("form-data");

const subscriptionEnrollmentsCollection = client
  .db("facesOnFaces")
  .collection("subscriptionEnrollments");

const ALLOWED_DOC_TYPES = ["nid", "passport", "driving_license", "electricity_bill"];
const ALLOWED_MIMETYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const uploadToImgBB = async (fileBuffer, fileName, mimeType) => {
  if (mimeType === "application/pdf") {
    return null;
  }

  const base64 = fileBuffer.toString("base64");

  const params = new URLSearchParams();
  params.append("image", base64);
  params.append("name", fileName);

  const response = await axios.post(
    `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
    params.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return response.data?.data?.url || null;
};

exports.createSubscriptionPreEnrollment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, documentType, documentNumber, enrollmentId } = req.body;

    if (enrollmentId) {
      if (!ObjectId.isValid(enrollmentId)) {
        return res.status(400).json({ message: "Invalid enrollment reference." });
      }
      const existing = await subscriptionEnrollmentsCollection.findOne({
        _id: new ObjectId(enrollmentId),
      });
      if (!existing) {
        return res.status(404).json({ message: "Enrollment not found." });
      }
      if (!existing.agreementSigned) {
        return res.status(403).json({ message: "Please sign the agreement before continuing." });
      }
    }

    if (!ALLOWED_DOC_TYPES.includes(documentType)) {
      return res.status(400).json({ message: "Invalid document type." });
    }

    const frontFile = req.files?.frontFile?.[0];
    if (!frontFile) {
      return res.status(400).json({ message: "Document upload is required." });
    }

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

    let frontImageUrl = null;
    let backImageUrl = null;

    try {
      frontImageUrl = await uploadToImgBB(
        frontFile.buffer,
        frontFile.originalname,
        frontFile.mimetype
      );
    } catch (imgErr) {
      console.error("ImgBB front upload error:", imgErr.message);
    }

    if (backFile) {
      try {
        backImageUrl = await uploadToImgBB(
          backFile.buffer,
          backFile.originalname,
          backFile.mimetype
        );
      } catch (imgErr) {
        console.error("ImgBB back upload error:", imgErr.message);
      }
    }

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
        frontFileName: frontFile.originalname,
        frontFileMimeType: frontFile.mimetype,
        frontFileSizeBytes: frontFile.size,
        frontImageUrl: frontImageUrl,
        backFileName: backFile?.originalname || null,
        backFileMimeType: backFile?.mimetype || null,
        backImageUrl: backImageUrl,
      },
      agreementSigned: false,
      paymentIntentId: null,
      paymentStatus: "Pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (enrollmentId && ObjectId.isValid(enrollmentId)) {
      await subscriptionEnrollmentsCollection.updateOne(
        { _id: new ObjectId(enrollmentId) },
        {
          $set: {
            identityDocument: preEnrollment.identityDocument,
            status: "Pending Payment",
            updatedAt: new Date(),
          },
        }
      );
      return res.status(200).json({ success: true, enrollmentId });
    }

    const result = await subscriptionEnrollmentsCollection.insertOne(preEnrollment);
    return res.status(200).json({
      success: true,
      enrollmentId: result.insertedId.toString(),
    });
  } catch (error) {
    console.error("Pre-enrollment error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.checkAgreementStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ signed: false });
    }

    const enrollment = await subscriptionEnrollmentsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!enrollment) {
      return res.status(404).json({ signed: false });
    }

    return res.status(200).json({
      signed: !!enrollment.agreementSigned,
    });
  } catch (err) {
    console.error("Check agreement error:", err);
    return res.status(500).json({ signed: false });
  }
};

exports.saveSignature = async (req, res) => {
  try {
    const { enrollmentId, signature } = req.body;

    if (!enrollmentId || !ObjectId.isValid(enrollmentId)) {
      return res.status(400).json({ message: "Invalid enrollment ID." });
    }

    if (!signature || !signature.startsWith("data:image/png;base64,")) {
      return res.status(400).json({ message: "Invalid signature." });
    }

    if (signature.length > 2000000) {
      return res.status(400).json({ message: "Signature too large." });
    }

    let signatureUrl = null;
    try {
      const base64Data = signature.replace("data:image/png;base64,", "");
      const params = new URLSearchParams();
      params.append("image", base64Data);
      params.append("name", `signature_${enrollmentId}`);

      const imgbbRes = await axios.post(
        `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
        params.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      signatureUrl = imgbbRes.data?.data?.url || null;
    } catch (imgErr) {
      console.error("ImgBB signature upload error:", imgErr.message);
    }

    await subscriptionEnrollmentsCollection.updateOne(
      { _id: new ObjectId(enrollmentId) },
      {
        $set: {
          agreementSigned: true,
          signatureUrl: signatureUrl,
          signedAt: new Date(),
          updatedAt: new Date(),
          status: "Signed — Pending Payment",
        },
      }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Save signature error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.handleSignWellWebhook = async (req, res) => {
  try {
    const event = req.body;

    console.log("SignWell webhook:", event);

    if (event.event_type === "document.completed") {
      const documentId = event.document_id;

      const result = await subscriptionEnrollmentsCollection.updateOne(
        { signwellDocumentId: documentId },
        {
          $set: {
            agreementSigned: true,
            signedAt: new Date(),
            status: "Signed — Pending Payment",
            updatedAt: new Date(),
          },
        }
      );

      console.log("Webhook updated:", result.modifiedCount);
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).send("Error");
  }
};

exports.confirmAgreementSigned = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid enrollment ID." });
    }

    const enrollment = await subscriptionEnrollmentsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found." });
    }

    await subscriptionEnrollmentsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          agreementSigned: true,
          signedAt: new Date(),
          status: "Signed — Pending Payment",
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Confirm agreement error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
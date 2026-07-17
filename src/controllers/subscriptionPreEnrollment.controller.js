const client = require("../config/db");
const sanitizeHtml = require("sanitize-html");
const { ObjectId } = require("mongodb");
const { validationResult } = require("express-validator");
const axios = require("axios");
const FormData = require("form-data");

const subscriptionEnrollmentsCollection = client
  .db("facesOnFaces")
  .collection("subscriptionEnrollments");

const ADDRESS_PROOF_TYPES = ["utility_bill", "bank_statement"];
const IDENTITY_PROOF_TYPES = ["passport", "driving_license"];
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

    const {
      name,
      email,
      phone,
      addressProofType,
      identityProofType,
      identityProofNumber,
      enrollmentId,
    } = req.body;

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

    if (!ADDRESS_PROOF_TYPES.includes(addressProofType)) {
      return res.status(400).json({ message: "Invalid address proof document type." });
    }
    if (!IDENTITY_PROOF_TYPES.includes(identityProofType)) {
      return res.status(400).json({ message: "Invalid identity proof document type." });
    }

    const addressProofFile = req.files?.addressProofFile?.[0];
    if (!addressProofFile) {
      return res.status(400).json({ message: "Address proof document is required." });
    }
    if (!ALLOWED_MIMETYPES.includes(addressProofFile.mimetype)) {
      return res.status(400).json({ message: "Invalid address proof file type." });
    }
    if (addressProofFile.size > MAX_SIZE_BYTES) {
      return res.status(400).json({ message: "Address proof file too large. Max 10MB." });
    }

    const identityFrontFile = req.files?.identityFrontFile?.[0];
    if (!identityFrontFile) {
      return res.status(400).json({ message: "Identity proof document is required." });
    }
    if (!ALLOWED_MIMETYPES.includes(identityFrontFile.mimetype)) {
      return res.status(400).json({ message: "Invalid identity proof file type." });
    }
    if (identityFrontFile.size > MAX_SIZE_BYTES) {
      return res.status(400).json({ message: "Identity proof file too large. Max 10MB." });
    }

    const identityBackFile = req.files?.identityBackFile?.[0];
    if (identityProofType === "driving_license" && !identityBackFile) {
      return res.status(400).json({ message: "Back side of the driving licence is required." });
    }
    if (identityBackFile) {
      if (!ALLOWED_MIMETYPES.includes(identityBackFile.mimetype)) {
        return res.status(400).json({ message: "Invalid identity proof back file type." });
      }
      if (identityBackFile.size > MAX_SIZE_BYTES) {
        return res.status(400).json({ message: "Identity proof back file too large. Max 10MB." });
      }
    }

    const safeName = sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} });
    const safeEmail = sanitizeHtml(email, { allowedTags: [], allowedAttributes: {} });
    const safePhone = sanitizeHtml(phone, { allowedTags: [], allowedAttributes: {} });
    const safeIdentityNumber = identityProofNumber
      ? sanitizeHtml(identityProofNumber, { allowedTags: [], allowedAttributes: {} })
      : null;

    let addressImageUrl = null;
    let identityFrontImageUrl = null;
    let identityBackImageUrl = null;

    try {
      addressImageUrl = await uploadToImgBB(
        addressProofFile.buffer,
        addressProofFile.originalname,
        addressProofFile.mimetype
      );
    } catch (imgErr) {
      console.error("ImgBB address proof upload error:", imgErr.message);
    }

    try {
      identityFrontImageUrl = await uploadToImgBB(
        identityFrontFile.buffer,
        identityFrontFile.originalname,
        identityFrontFile.mimetype
      );
    } catch (imgErr) {
      console.error("ImgBB identity front upload error:", imgErr.message);
    }

    if (identityBackFile) {
      try {
        identityBackImageUrl = await uploadToImgBB(
          identityBackFile.buffer,
          identityBackFile.originalname,
          identityBackFile.mimetype
        );
      } catch (imgErr) {
        console.error("ImgBB identity back upload error:", imgErr.message);
      }
    }

    const identityVerification = {
      addressProof: {
        type: addressProofType,
        fileName: addressProofFile.originalname,
        fileMimeType: addressProofFile.mimetype,
        fileSizeBytes: addressProofFile.size,
        imageUrl: addressImageUrl,
      },
      identityProof: {
        type: identityProofType,
        number: safeIdentityNumber,
        frontFileName: identityFrontFile.originalname,
        frontFileMimeType: identityFrontFile.mimetype,
        frontImageUrl: identityFrontImageUrl,
        backFileName: identityBackFile?.originalname || null,
        backFileMimeType: identityBackFile?.mimetype || null,
        backImageUrl: identityBackImageUrl,
      },
    };

    if (enrollmentId && ObjectId.isValid(enrollmentId)) {
      await subscriptionEnrollmentsCollection.updateOne(
        { _id: new ObjectId(enrollmentId) },
        {
          $set: {
            identityVerification,
            status: "Pending Payment",
            updatedAt: new Date(),
          },
        }
      );
      return res.status(200).json({ success: true, enrollmentId });
    }

    const preEnrollment = {
      name: safeName,
      email: safeEmail,
      phone: safePhone,
      course: "14 Certificate Fast-Track Course",
      enrollmentType: "Subscription",
      status: "Pending Signature",
      identityVerification,
      agreementSigned: false,
      paymentIntentId: null,
      paymentStatus: "Pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

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
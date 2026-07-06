const axios = require("axios");
const {
  SIGNWELL_API_KEY,
  TEMPLATE_ID,
  BASE_URL,
  TEST_MODE,
} = require("../config/signwell");

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    "X-Api-Key": SIGNWELL_API_KEY,
    "Content-Type": "application/json",
  },
});

exports.createAgreementDocument = async ({ name, email, enrollmentId }) => {
  const payload = {
    test_mode: TEST_MODE,
    template_id: TEMPLATE_ID,
    name: `Subscription Agreement - ${name}`,
    subject: "Please sign your Subscription Agreement",
    message:
      "Please review and sign your subscription agreement to continue your enrollment.",
    recipients: [
      {
        id: "1",
        placeholder_name: "Document Sender",
        name: "Harry Bostan",
        email: "info@facesonfaces.com",
      },
      {
        id: "2",
        placeholder_name: "Client",
        name,
        email,
      },
    ],
    metadata: { enrollmentId: String(enrollmentId) },
  };

  const { data } = await client.post("/document_templates/documents", payload);

  if (!data?.id) {
    throw new Error("SignWell did not return a document id");
  }

  return { documentId: data.id, raw: data };
};

exports.getDocumentStatus = async (documentId) => {
  const { data } = await client.get(`/documents/${documentId}`);
  return data;
};
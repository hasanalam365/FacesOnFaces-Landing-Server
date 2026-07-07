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
    message: "Please review and sign your subscription agreement to continue your enrollment.",
    embedded_signing: true,               // <-- required to get a per-recipient signing session
    embedded_signing_notifications: true, // so you still get notified when it's completed
    recipients: [
     
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

  const signingUrl = extractClientSigningUrl(data, email);

  return {
    documentId: data.id || data.document_id || null,
    signingUrl,
    raw: data,
  };
};

// Always resolve the Client's own embedded_signing_url by matching email/placeholder,
// never by array position (recipients[0] is the Document Sender, not the Client).
function extractClientSigningUrl(doc, clientEmail) {
  const recipients = doc?.recipients || [];
  const match =
    recipients.find(
      (r) => r.email && clientEmail && r.email.toLowerCase() === clientEmail.toLowerCase()
    ) || recipients.find((r) => r.placeholder_name === "Client");
  return match?.embedded_signing_url || null;
}

exports.getEmbeddedSigningUrl = async (documentId, clientEmail) => {
  const { data } = await client.get(`/documents/${documentId}`);
  return extractClientSigningUrl(data, clientEmail);
};

exports.getDocumentStatus = async (documentId) => {
  const { data } = await client.get(`/documents/${documentId}`);
  return data;
};
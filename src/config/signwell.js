// SignWell API helper
// Docs: https://developers.signwell.com/reference

const SIGNWELL_API_KEY = process.env.SIGNWELL_API_KEY;
const SIGNWELL_TEMPLATE_ID = process.env.SIGNWELL_TEMPLATE_ID;
const BASE_URL = "https://www.signwell.com/api/v1";

const signwellHeaders = {
  "X-Api-Token": SIGNWELL_API_KEY,
  "Content-Type": "application/json",
};

/**
 * Send a document from a pre-built SignWell template to a signer.
 * Returns the SignWell document object.
 */
const sendAgreement = async ({ name, email, templateFields = {} }) => {
  const body = {
    test_mode: process.env.NODE_ENV !== "production" ? "1" : "0",
    template_id: SIGNWELL_TEMPLATE_ID,
    subject: "Subscription Agreement — Faces On Faces Academy",
    message:
      "Please review and sign your subscription agreement to proceed with your enrollment.",
    signers: [
      {
        id: "student",
        name,
        email,
      },
    ],
    // Merge fields populated from template — extend as needed
    fields: {
      student_name: { value: name },
      ...templateFields,
    },
  };

  const response = await fetch(`${BASE_URL}/document_templates/send/`, {
    method: "POST",
    headers: signwellHeaders,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(
      `SignWell error: ${JSON.stringify(err)}`
    );
  }

  return response.json();
};

/**
 * Retrieve a single document's status from SignWell.
 */
const getDocumentStatus = async (documentId) => {
  const response = await fetch(`${BASE_URL}/documents/${documentId}/`, {
    headers: signwellHeaders,
  });
  if (!response.ok) {
    throw new Error(`Failed to retrieve SignWell document ${documentId}`);
  }
  return response.json();
};

module.exports = { sendAgreement, getDocumentStatus };
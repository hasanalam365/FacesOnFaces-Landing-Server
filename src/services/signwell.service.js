const axios = require("axios");
const { BASE_URL, headers } = require("../config/signwell");

// 1. Create signing document
const createDocument = async ({ name, email }) => {
  const res = await axios.post(
    `${BASE_URL}/document_templates/${process.env.SIGNWELL_TEMPLATE_ID}/documents/`,
    {
      test_mode: process.env.NODE_ENV !== "production" ? "1" : "0",
      draft: "0",
      with_signature_page: "0",
      recipients: [
        {
          id: "1",
          name,
          email,
        },
      ],
      fields: [
        {
          api_id: "TextField_1",
          value: name,
        },
        {
          api_id: "TextField_2",
          value: new Date().toLocaleDateString("en-GB"),
        },
      ],
    },
    { headers }
  );

  return res.data;
};

// 2. Get signed PDF (IMPORTANT)
const getSignedDocument = async (documentId) => {
  const res = await axios.get(
    `${BASE_URL}/documents/${documentId}/download/`,
    {
      headers,
      responseType: "arraybuffer",
    }
  );

  return res.data;
};

module.exports = {
  createDocument,
  getSignedDocument,
};
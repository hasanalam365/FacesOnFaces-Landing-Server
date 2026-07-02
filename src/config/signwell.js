
module.exports = {
  SIGNWELL_API_KEY: process.env.SIGNWELL_API_KEY,
  TEMPLATE_ID: process.env.SIGNWELL_TEMPLATE_ID,
  BASE_URL: "https://www.signwell.com/api/v1",
};






// const axios = require("axios");

// const SIGNWELL_API_KEY = process.env.SIGNWELL_API_KEY;
// const SIGNWELL_TEMPLATE_ID = process.env.SIGNWELL_TEMPLATE_ID;
// const BASE_URL = "https://www.signwell.com/api/v1";

// const authHeader = {
//   Authorization: `Bearer ${SIGNWELL_API_KEY}`,
//   "Content-Type": "application/json",
// };

// const sendAgreement = async ({ name, email }) => {
//   const response = await axios.post(
//     `${BASE_URL}/document_templates/${SIGNWELL_TEMPLATE_ID}/documents/`,
//     {
//       test_mode: process.env.NODE_ENV !== "production" ? "1" : "0",
//       draft: "0",
//       with_signature_page: "0",
//       recipients: [
//         {
//           id: "1",
//           name: name,
//           email: email,
//         },
//       ],
//       fields: [
//         {
//           api_id: "TextField_1",
//           value: name,
//         },
//         {
//           api_id: "TextField_2",
//           value: new Date().toLocaleDateString("en-GB", {
//             day: "numeric",
//             month: "long",
//             year: "numeric",
//           }),
//         },
        
//       ],
//       metadata: {
//         student_name: name,
//         student_email: email,
//       },
//     },
//     { headers: authHeader }
//   );

//   return response.data;
// };

// const getDocumentStatus = async (documentId) => {
//   const response = await axios.get(
//     `${BASE_URL}/documents/${documentId}/`,
//     { headers: authHeader }
//   );

//   return response.data;
// };

// module.exports = { sendAgreement, getDocumentStatus };
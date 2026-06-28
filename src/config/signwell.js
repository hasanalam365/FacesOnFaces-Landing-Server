// SignWell বাদ — Browser signature ব্যবহার করা হচ্ছে
// এই file টা শুধু compatibility এর জন্য রাখা হয়েছে

const sendAgreement = async ({ name, email }) => {
  // No-op — agreement এখন browser-এ sign হয়
  return { id: `local_${Date.now()}`, status: "pending" };
};

const getDocumentStatus = async (documentId) => {
  return { id: documentId, status: "pending", completed: false };
};

module.exports = { sendAgreement, getDocumentStatus };
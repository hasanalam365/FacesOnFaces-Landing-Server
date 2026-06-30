const { google } = require("googleapis");

// ── Auth client (singleton pattern) ──────────────────────────
let _sheetsClient = null;


const getSheetsClient = () => {
    if (_sheetsClient) return _sheetsClient;

    const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    _sheetsClient = google.sheets({ version: "v4", auth });
    return _sheetsClient;
};

// ── Header row একবার লেখার জন্য (optional but useful) ────────
const HEADERS = [
    "Full Name",
    "Email",
    "Phone",
   
    "Best Time",
    "Message",
    "Status",
    "Created At",
];

/**
 * Appends a single lead row to the configured Google Sheet.
 * Throws on failure — caller must handle.
 *
 * @param {Object} lead  — lead object from MongoDB insert
 */



const saveLeadToSheet = async (lead) => {
    const sheets = getSheetsClient();

    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const sheetName     = process.env.GOOGLE_SHEET_NAME || "Leads";
    const range         = `${sheetName}!A1`;

// const formatDate = (date) => {
//     const d = date instanceof Date ? date : new Date(date);

//     const day = String(d.getUTCDate()).padStart(2, "0");
//     const month = String(d.getUTCMonth() + 1).padStart(2, "0");
//     const year = d.getUTCFullYear();

//     let hours = d.getUTCHours();
//     const minutes = String(d.getUTCMinutes()).padStart(2, "0");
//     const ampm = hours >= 12 ? "PM" : "AM";
//     hours = hours % 12 || 12;

//     return `${hours}:${minutes}${ampm}, ${day}-${month}-${year}`;
// };

const row = [
    lead.fullName,
    lead.email,
    lead.phone,

    lead.bestTime,
    lead.message || "",
    lead.status,
   
];

    await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",        
    insertDataOption: "INSERT_ROWS",
    requestBody: {
        values: [row],
    },
});
};

module.exports = { saveLeadToSheet, HEADERS };
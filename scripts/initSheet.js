require("dotenv").config();
const { google } = require("googleapis");
const { HEADERS } = require("../src/utils/saveLeadToSheet");

const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

(async () => {
    await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: `${process.env.GOOGLE_SHEET_NAME || "Leads"}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [HEADERS] },
    });
    console.log("✅ Header row written successfully.");
})();
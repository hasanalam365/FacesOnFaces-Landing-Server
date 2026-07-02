// utils/pdfSigner.js
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

// Your existing template - same file you already attach to the confirmation email.
const TEMPLATE_PATH = path.join(
  __dirname,
  "../agreements/Subscription Agreement [Faces On Faces].pdf"
);

const SIGNED_DIR = path.join(__dirname, "../signed-agreements");

// If your template has NO AcroForm field, the signature is placed using these
// fallback coordinates instead. Adjust x/y to match where the signature line
// actually sits on your PDF (open the PDF, measure from the bottom-left corner
// in points - 72pt = 1 inch). pageIndex: -1 means "last page".
const FALLBACK_PLACEMENT = {
  pageIndex: -1,
  x: 80,
  y: 130,
  maxWidth: 180,
  maxHeight: 60,
};

// If you'd rather not guess coordinates, add a form field to the PDF (in Acrobat,
// PDFescape, etc.) named exactly this, positioned on the signature line. The
// code below will find it automatically and use its exact rectangle instead
// of the fallback coordinates above.
const SIGNATURE_FIELD_NAME = "signature";

async function ensureSignedDir() {
  await fs.mkdir(SIGNED_DIR, { recursive: true });
}

function base64ToPngBuffer(dataUrl) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) {
    const error = new Error("Signature must be a base64 PNG data URL");
    error.statusCode = 400;
    throw error;
  }
  return Buffer.from(match[1], "base64");
}

/**
 * Tries to find a named AcroForm field's rectangle + page index.
 * Returns null if the field doesn't exist (template has no form fields) so
 * the caller can fall back to fixed coordinates instead of crashing.
 */
function tryGetSignatureFieldRect(pdfDoc) {
  try {
    const form = pdfDoc.getForm();
    const field = form.getField(SIGNATURE_FIELD_NAME);
    const widgets = field.acroField.getWidgets();
    if (!widgets.length) return null;

    const widget = widgets[0];
    const rect = widget.getRectangle();
    const pages = pdfDoc.getPages();
    const pageRef = widget.P();
    let pageIndex = pages.length - 1;
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].ref === pageRef) {
        pageIndex = i;
        break;
      }
    }
    return { rect, pageIndex, field, form };
  } catch (_e) {
    return null; // field not found - use fallback coordinates
  }
}

/**
 * Embeds the user's signature into the agreement PDF, stamps a small audit
 * line (name + date) next to it, and returns the final bytes + a sha256 hash
 * so you can prove later the file wasn't tampered with.
 */
async function generateSignedAgreementPdf({
  signatureBase64,
  fullName,
  enrollmentId,
  ipAddress,
}) {
  const templateBytes = await fs.readFile(TEMPLATE_PATH).catch(() => {
    const error = new Error("Agreement template PDF not found on server");
    error.statusCode = 500;
    throw error;
  });

  const pdfDoc = await PDFDocument.load(templateBytes);
  const sigBuffer = base64ToPngBuffer(signatureBase64);
  const sigImage = await pdfDoc.embedPng(sigBuffer);

  const fieldMatch = tryGetSignatureFieldRect(pdfDoc);

  let page, x, y, maxW, maxH;
  if (fieldMatch) {
    page = pdfDoc.getPages()[fieldMatch.pageIndex];
    ({ x, y } = fieldMatch.rect);
    maxW = fieldMatch.rect.width;
    maxH = fieldMatch.rect.height;
  } else {
    const pages = pdfDoc.getPages();
    const pageIndex =
      FALLBACK_PLACEMENT.pageIndex === -1
        ? pages.length - 1
        : FALLBACK_PLACEMENT.pageIndex;
    page = pages[pageIndex];
    x = FALLBACK_PLACEMENT.x;
    y = FALLBACK_PLACEMENT.y;
    maxW = FALLBACK_PLACEMENT.maxWidth;
    maxH = FALLBACK_PLACEMENT.maxHeight;
  }

  const padding = 4;
  const scale = Math.min(
    (maxW - padding * 2) / sigImage.width,
    (maxH - padding * 2) / sigImage.height,
    1
  );
  const drawW = sigImage.width * scale;
  const drawH = sigImage.height * scale;

  page.drawImage(sigImage, {
    x: x + (maxW - drawW) / 2,
    y: y + (maxH - drawH) / 2,
    width: drawW,
    height: drawH,
  });

  // If we used a real form field, flatten the form afterward so the field
  // (and every other field in the PDF) becomes permanent, non-editable page content.
  if (fieldMatch) {
    fieldMatch.form.flatten();
  }

  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const signedDate = new Date();
  const auditLine = `Signed by ${fullName} on ${signedDate.toISOString()} | IP: ${
    ipAddress || "unknown"
  }`;
  page.drawText(auditLine, {
    x: 24,
    y: 16,
    size: 7,
    font: helv,
    color: rgb(0.4, 0.4, 0.4),
  });

  const bytes = await pdfDoc.save();
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

  await ensureSignedDir();
  const filename = `agreement_${enrollmentId}_${Date.now()}.pdf`;
  const filePath = path.join(SIGNED_DIR, filename);
  await fs.writeFile(filePath, bytes);

  return { filename, filePath, sha256, signedAt: signedDate };
}

module.exports = { generateSignedAgreementPdf, SIGNED_DIR, TEMPLATE_PATH };

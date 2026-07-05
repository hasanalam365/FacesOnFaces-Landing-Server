const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

/* =======================
   CORS CONFIG
======================= */
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://facesonfaces.vercel.app',
    "https://www.facesonfaces.co.uk",
    "https:facesonfaces.co.uk"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Manual preflight handler (Vercel এর জন্য)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (corsOptions.origin.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* =======================
   SECURITY HEADERS
======================= */
app.use(helmet());

/* =======================
   RATE LIMITING
======================= */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

/* =======================
   GOCARDLESS WEBHOOK — MUST COME BEFORE express.json()
   GoCardless signs the raw request body. If express.json() parses it
   first, the raw bytes are lost and signature verification will fail.
======================= */
app.use("/", require("./routes/gocardless.webhook.routes"));

/* =======================
   MIDDLEWARE
======================= */
app.use(express.json({ limit: "5mb" }));

/* =======================
   ROUTES
======================= */
app.use("/", require("./routes/auth.routes"));
app.use("/", strictLimiter, require("./routes/payments.routes"));
app.use("/", strictLimiter, require("./routes/enrollment.routes"));
app.use("/", strictLimiter, require("./routes/depositEnrollment.routes"));
app.use("/", strictLimiter, require("./routes/subscriptionEnrollment.routes"));
app.use("/", strictLimiter, require("./routes/subscriptionPreEnrollment.routes"));
app.use("/", strictLimiter, require("./routes/leadForm.routes"));
app.use("/", require("./routes/signwell.routes"));
app.use("/", require("./routes/gocardless.routes"));

/* =======================
   ROOT
======================= */
app.get("/", (req, res) => {
  res.send("Faces On Faces Server is Working");
});

/* =======================
   404 HANDLER
======================= */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* =======================
   GLOBAL ERROR HANDLER
======================= */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
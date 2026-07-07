const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

/* =======================
   TRUST PROXY
   Vercel serverless functions sit behind a proxy. express-rate-limit
   needs this to correctly read the client IP (X-Forwarded-For),
   otherwise it can throw a ValidationError and crash the function.
======================= */
app.set("trust proxy", 1);

/* =======================
   CORS CONFIG
======================= */
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://facesonfaces.vercel.app',
    "https://www.facesonfaces.co.uk",
    "https://facesonfaces.co.uk"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Single CORS mechanism — the `cors` package already handles the
// OPTIONS preflight response automatically. No manual header-setting
// middleware and no app.options("*", ...) needed (that wildcard route
// crashes on Express 4.20+ / path-to-regexp, which was the root cause
// of the production CORS failure).
app.use(cors(corsOptions));

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
  skip: (req) => {
    // Polling ও webhook endpoint-কে global limit থেকে exempt করা হলো
    // (এগুলোর নিজস্ব আলাদা limiter/protection আছে — polling route এ pollingLimiter,
    // webhook route এ secret-token protection + SignWell API re-verification)
    return (
      req.path.startsWith("/subscription-agreement-status") ||
      req.path.startsWith("/signwell-agreement-webhook")
    );
  },
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
app.use("/", require("./routes/signwell.routes"));
app.use("/", require("./routes/gocardless.routes"));
app.use("/", require("./routes/subscriptionAgreement.routes"));
app.use("/", strictLimiter, require("./routes/payments.routes"));
app.use("/", strictLimiter, require("./routes/enrollment.routes"));
app.use("/", strictLimiter, require("./routes/depositEnrollment.routes"));
app.use("/", strictLimiter, require("./routes/subscriptionEnrollment.routes"));
app.use("/", strictLimiter, require("./routes/subscriptionPreEnrollment.routes"));
app.use("/", strictLimiter, require("./routes/leadForm.routes"));


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
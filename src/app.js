const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

/* =======================
   SECURITY HEADERS
======================= */
app.use(helmet());

/* =======================
   GLOBAL CORS CONFIG
======================= */
const corsOptions = {
origin: [
  'http://localhost:5173',
  'https://facesonfaces.vercel.app'
],
  credentials: true,
  methods: [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "OPTIONS",
  ],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* =======================
   RATE LIMITING
======================= */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

/* =======================
   MIDDLEWARE
======================= */
app.use(express.json({ limit: "10kb" })); 

/* =======================
   ROUTES
======================= */
app.use("/", require("./routes/auth.routes"));
app.use("/", strictLimiter, require("./routes/payments.routes"));    
app.use("/", strictLimiter, require("./routes/enrollment.routes"));  

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
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* =======================
   GLOBAL CORS CONFIG
======================= */
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://facesonfaces.vercel.app"
    
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// 🔥 MUST BE FIRST
app.use(cors(corsOptions));

// 🔥 MUST HANDLE PREFLIGHT
app.options("*", cors(corsOptions));

/* =======================
   MIDDLEWARE
======================= */
app.use(express.json());

/* =======================
   ROUTES
======================= */
app.use("/", require("./routes/auth.routes"));

app.use("/", require("./routes/payments.routes"));


/* =======================
   ROOT
======================= */
app.get("/", (req, res) => {
  res.send("Faces On Faces Server is Working");
});

module.exports = app;

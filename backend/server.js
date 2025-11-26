// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoute = require('./routes/auth');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoute);

app.get("/health", (req, res) => {
  res.json({ ok: true, msg: "server running" });
});

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB(); // will throw if connection fails
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Could not start server due to DB error.");
    process.exit(1);
  }
};

start();

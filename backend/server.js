// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db")
const path = require("path")

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Optional tiny request logger for development
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} -> ${req.method} ${req.path}`);
  next();
});

// Mount routes (make sure these files exist)
app.use("/api/auth", require("./routes/auth"));
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/users", require("./routes/users"));
app.use("/api/therapies", require("./routes/therapies"));
app.use("/api/employee-services", require("./routes/employeeServices"));
app.use("/uploads", express.static(path.join(__dirname, 'uploads')));
app.use("/api/employee-media", require("./routes/employeeMedia"));
app.use("/api/clinics", require("./routes/clinics"));
app.use("/api/calendar", require("./routes/calandar"));

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, msg: "server running" });
});

const PORT = process.env.PORT || 5000;
let server;

// Bootstrap: connect DB then start server
const start = async () => {
  try {
    await connectDB();
    server = app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Could not start server (DB error):", err && err.message ? err.message : err);
    process.exit(1);
  }
};

start();

// Global handlers for stability
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err && err.message ? err.message : err);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err && err.message ? err.message : err);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Optional: graceful shutdown on SIGINT/SIGTERM
const gracefulShutdown = () => {
  console.log("⚠️ Shutting down gracefully...");
  if (server) {
    server.close(() => {
      console.log("✅ Server closed");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

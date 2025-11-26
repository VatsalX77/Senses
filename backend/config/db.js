// backend/config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    console.error("MONGO_URI not set in .env");
    return;
  }

  try {
    await mongoose.connect(mongoURI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    // rethrow so caller can decide (or comment out to continue without exiting)
    throw err;
  }
};

module.exports = connectDB;

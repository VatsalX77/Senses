// backend/models/Therapy.js
const mongoose = require("mongoose");

const therapySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  code: { type: String, trim: true }, // optional short code
  description: { type: String, trim: true },
  defaultDurationMins: { type: Number, default: 30 },
  defaultPrice: { type: Number, default: 0 }, // clinic's default price
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Therapy", therapySchema);

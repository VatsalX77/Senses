const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema({
  clinic: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true },
  title: { type: String, required: true },
  date: { type: Date, required: true }, // full day holiday (date portion)
  allDay: { type: Boolean, default: true },
  recurringYearly: { type: Boolean, default: false }, // for fixed-date holidays
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Holiday", holidaySchema);

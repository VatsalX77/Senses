// backend/models/Appointment.js
const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },      // who booked
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },  // employee (role: employee)
  datetime: { type: Date, required: true },                                       // start time
  durationMins: { type: Number, default: 30 },                                    // length in minutes
  reason: { type: String, trim: true },
  status: {
    type: String,
    enum: ["scheduled", "completed", "cancelled"],
    default: "scheduled"
  },
  createdAt: { type: Date, default: Date.now }
});

// optional: prevent double-booking quick check (not enforced by DB)
appointmentSchema.index({ employee: 1, datetime: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);

// backend/models/BedTask.js
const mongoose = require("mongoose");

const bedTaskSchema = new mongoose.Schema({
  bed: { type: mongoose.Schema.Types.ObjectId, ref: "Bed", required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // employee who created it
  patientName: { type: String, default: null }, // optional patient name for offline booking
  therapy: { type: mongoose.Schema.Types.ObjectId, ref: "Therapy", default: null }, // optional reference
  title: { type: String, required: true }, // short title of task
  notes: { type: String },
  durationMins: { type: Number, required: true }, // intended timer length
  remainingSecs: { type: Number }, // seconds left if running/paused
  status: { type: String, enum: ["pending","running","paused","completed","cancelled"], default: "pending" },
  startedAt: { type: Date, default: null },
  pausedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("BedTask", bedTaskSchema);

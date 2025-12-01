const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  from: { type: Date, required: true },
  to: { type: Date, required: true },
  reason: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // admin/offline
  createdAt: { type: Date, default: Date.now },
  // optional partial-day flags (start/end time) if needed
  partial: { type: Boolean, default: false },
  fromTime: { type: String }, // "13:00"
  toTime: { type: String }
});

module.exports = mongoose.model("Leave", leaveSchema);

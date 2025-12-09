const mongoose = require("mongoose");

const bedSchema = new mongoose.Schema({
  clinic: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true },
  name: { type: String, required: true }, // e.g., "Bed 1"
  description: { type: String },
  // list of employees allowed to use this bed (optional)
  employees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  meta: { type: Object }, // any metadata
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Bed", bedSchema);

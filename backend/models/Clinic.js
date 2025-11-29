// backend/models/Clinic.js
const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  line1: { type: String, required: true },
  line2: { type: String },
  city: { type: String },
  state: { type: String },
  postalCode: { type: String },
  country: { type: String },
  lat: { type: Number },
  lng: { type: Number }
}, { _id: false });

const clinicSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: addressSchema, required: true },
  images: [{ type: String }],                  // URLs like "/uploads/abc.jpg"
  employees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // employees at this clinic
  meta: { type: Object },                      // optional free-form metadata
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Clinic", clinicSchema);

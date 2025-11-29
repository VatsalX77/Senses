// User model
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  profilePic: { type: String, default: null}, //URL or Path to image
  certifications: [
    {
      title: {type: String, required: true},
      fileUrl: {type: String, required: true},
      issuedBy: { type: String},
      issuedAt: { type: Date },
      uploadedAt: { type: Date, default: Date.now }
    }
  ],

  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin", "employee", "offline"], default: "user" },
  services: [
    {
      therapy: { type: mongoose.Schema.Types.ObjectId, ref: "Therapy" },
      price: { type: Number },
      durationMins: { type: Number },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model("User", userSchema);
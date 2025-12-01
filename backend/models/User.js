// User model
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  clinic: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", default: null},
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
  phone: { type: String, trim: true, default: null},
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
  createdAt: { type: Date, default: Date.now },

  workingHours: {
    //default workweek: Mon-Fri 09:00-17:00
    // store as array of{ day: 0..6(Sun..Sat), from: "09:00", to: "17:00"}
    type: [
      {
      day: { type: Number }, // 0 == Sun ... 6 == Sat
      from: { type: String}, // "09:00" (24h)
      to: { type: String}
      }
    ],

    default: [
      { day:1 , from: "09:00", to: "17:00"},
      { day:2 , from: "09:00", to: "17:00"},
      { day:3 , from: "09:00", to: "17:00"},
      { day:4 , from: "09:00", to: "17:00"},
      { day:5 , from: "09:00", to: "17:00"},
    ]
  },

  slotDurationMins: { type: Number, default: 30}, // default slot size for UI generation

});


module.exports = mongoose.model("User", userSchema);
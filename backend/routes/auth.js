// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth"); // <- new

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, msg: "name, email and password required" });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ ok: false, msg: "email already registered" });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = new User({ name, email, password: hashed, role });
    await user.save();

    return res.status(201).json({ ok: true, msg: "user registered", userId: user._id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ ok: false, msg: "email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ ok: false, msg: "invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ ok: false, msg: "invalid credentials" });

    const payload = { userId: user._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET || "devsecret", { expiresIn: "7d" });

    return res.json({ ok: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

// GET /api/auth/me  (protected)
router.get("/me", auth, async (req, res) => {
  // auth middleware already attached req.user
  return res.json({ ok: true, user: req.user });
});


router.patch("/me", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, phone, password } = req.body;

    // collect updates
    const updates = {};
    if (typeof name === "string" && name.trim().length) updates.name = name.trim();
    if (typeof email === "string" && email.trim()) updates.email = email.trim().toLowerCase();
    if (typeof phone === "string" && phone.trim()) updates.phone = phone.trim();

    // If changing email, ensure it's not already used by another user
    if (updates.email) {
      const existing = await User.findOne({ email: updates.email, _id: { $ne: userId } });
      if (existing) return res.status(400).json({ ok: false, msg: "email already in use" });
    }

    // If changing password, hash it
    if (password) {
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ ok: false, msg: "password must be at least 6 characters" });
      }
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(password, salt);
    }

    // Apply updates and return new object (exclude password)
    const updated = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true }).select("-password");

    if (!updated) return res.status(404).json({ ok: false, msg: "user not found" });

    // Issue a refreshed token (optional but convenient if email changed)
    const payload = { userId: updated._id, role: updated.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET || "devsecret", { expiresIn: "7d" });

    return res.json({ ok: true, msg: "profile updated", user: updated, token });
  } catch (err) {
    console.error("update profile err:", err);
    // duplicate key error (race)
    if (err.code === 11000) return res.status(400).json({ ok: false, msg: "email already in use" });
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});




module.exports = router;

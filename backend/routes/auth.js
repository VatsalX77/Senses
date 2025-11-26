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

module.exports = router;

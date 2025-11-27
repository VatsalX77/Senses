// backend/routes/users.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");

// All routes require admin
router.use(auth, requireRole("admin"));

/**
 * GET /api/users
 * List users (paginated)
 * query: page=1&pageSize=50&role=
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.max(1, Math.min(200, parseInt(req.query.pageSize || "50", 10)));
    const skip = (page - 1) * pageSize;
    const q = {};
    if (req.query.role) q.role = req.query.role;

    const [results, total] = await Promise.all([
      User.find(q).select("-password").skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      User.countDocuments(q)
    ]);

    return res.json({ ok: true, page, pageSize, total, results });
  } catch (err) {
    console.error("list users err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * GET /api/users/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select("-password");
    if (!u) return res.status(404).json({ ok: false, msg: "user not found" });
    return res.json({ ok: true, user: u });
  } catch (err) {
    console.error("get user err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * POST /api/users
 * Create a new user (admin creates users: admin/employee/user)
 * body: { name, email, password, role }
 */
router.post("/", async (req, res) => {
  try {
    const { name, email, password, role = "user" } = req.body;
    if (!name || !email || !password) return res.status(400).json({ ok: false, msg: "name,email,password required" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ ok: false, msg: "email already registered" });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = new User({ name, email, password: hashed, role });
    await user.save();
    return res.status(201).json({ ok: true, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("create user err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * PUT /api/users/:id
 * Replace/update user fields (admin)
 * body: { name, email, password?, role? }
 */
router.put("/:id", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (role) updates.role = role;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(password, salt);
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select("-password");
    if (!user) return res.status(404).json({ ok: false, msg: "user not found" });

    return res.json({ ok: true, user });
  } catch (err) {
    console.error("update user err:", err);
    // handle duplicate email
    if (err.code === 11000) return res.status(400).json({ ok: false, msg: "email already in use" });
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a user (admin)
 * Note: this will NOT cascade-delete appointments. You may want to implement cascading or transfer logic.
 */
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id).select("-password");
    if (!user) return res.status(404).json({ ok: false, msg: "user not found" });
    return res.json({ ok: true, msg: "user deleted", user });
  } catch (err) {
    console.error("delete user err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

module.exports = router;

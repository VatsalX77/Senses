// backend/routes/therapies.js
const express = require("express");
const router = express.Router();
const Therapy = require("../models/Therapy");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");

// Admin-only routes
router.use(auth, requireRole("admin"));

/**
 * POST /api/therapies
 * body: { name, code?, description?, defaultDurationMins?, defaultPrice? }
 */
router.post("/", async (req, res) => {
  try {
    const { name, code, description, defaultDurationMins, defaultPrice } = req.body;
    if (!name) return res.status(400).json({ ok: false, msg: "name required" });

    const exists = await Therapy.findOne({ name });
    if (exists) return res.status(400).json({ ok: false, msg: "therapy already exists" });

    const t = new Therapy({ name, code, description, defaultDurationMins, defaultPrice });
    await t.save();
    return res.status(201).json({ ok: true, therapy: t });
  } catch (err) {
    console.error("create therapy err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * GET /api/therapies
 * public (but admin-only mounted) — returns list
 */
router.get("/", async (req, res) => {
  try {
    const list = await Therapy.find({}).sort({ name: 1 });
    return res.json({ ok: true, therapies: list });
  } catch (err) {
    console.error("list therapies err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * GET /api/therapies/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const t = await Therapy.findById(req.params.id);
    if (!t) return res.status(404).json({ ok: false, msg: "therapy not found" });
    return res.json({ ok: true, therapy: t });
  } catch (err) {
    console.error("get therapy err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * PUT /api/therapies/:id
 * body: { name?, code?, description?, defaultDurationMins?, defaultPrice? }
 */
router.put("/:id", async (req, res) => {
  try {
    const updates = req.body;
    const t = await Therapy.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!t) return res.status(404).json({ ok: false, msg: "therapy not found" });
    return res.json({ ok: true, therapy: t });
  } catch (err) {
    console.error("update therapy err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * DELETE /api/therapies/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const t = await Therapy.findByIdAndDelete(req.params.id);
    if (!t) return res.status(404).json({ ok: false, msg: "therapy not found" });
    return res.json({ ok: true, msg: "therapy deleted", therapy: t });
  } catch (err) {
    console.error("delete therapy err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

module.exports = router;

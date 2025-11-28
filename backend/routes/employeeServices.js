// backend/routes/employeeServices.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Therapy = require("../models/Therapy");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");

// Admin-only
router.use(auth, requireRole("admin"));

/**
 * POST /api/employee-services/:employeeId/assign
 * body: { therapyId, price?, durationMins? }
 */
router.post("/:employeeId/assign", async (req, res) => {
  try {
    const { therapyId, price, durationMins } = req.body;
    const { employeeId } = req.params;

    const [emp, therapy] = await Promise.all([
      User.findById(employeeId),
      Therapy.findById(therapyId)
    ]);
    if (!emp) return res.status(404).json({ ok: false, msg: "employee not found" });
    if (!therapy) return res.status(404).json({ ok: false, msg: "therapy not found" });
    if (emp.role !== "employee") return res.status(400).json({ ok: false, msg: "user is not an employee" });

    // avoid duplicate assignment
    const already = emp.services.find(s => s.therapy.toString() === therapyId);
    if (already) return res.status(400).json({ ok: false, msg: "therapy already assigned to employee" });

    emp.services.push({
      therapy: therapy._id,
      price: typeof price === "number" ? price : therapy.defaultPrice,
      durationMins: typeof durationMins === "number" ? durationMins : therapy.defaultDurationMins
    });

    await emp.save();
    return res.json({ ok: true, services: emp.services });
  } catch (err) {
    console.error("assign service err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * POST /api/employee-services/:employeeId/unassign
 * body: { therapyId }
 */
router.post("/:employeeId/unassign", async (req, res) => {
  try {
    const { therapyId } = req.body;
    const { employeeId } = req.params;

    const emp = await User.findById(employeeId);
    if (!emp) return res.status(404).json({ ok: false, msg: "employee not found" });

    emp.services = emp.services.filter(s => s.therapy.toString() !== therapyId);
    await emp.save();
    return res.json({ ok: true, services: emp.services });
  } catch (err) {
    console.error("unassign service err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * GET /api/employee-services/:employeeId
 * returns assigned services (populated)
 */
router.get("/:employeeId", auth, async (req, res) => {
  try {
    const { employeeId } = req.params;

    // allow admin and offline to view any, employees to view their own
    if (req.user.role === "employee" && req.user.id !== employeeId) {
      return res.status(403).json({ ok: false, msg: "forbidden" });
    }
    if (!(req.user.role === "admin" || req.user.role === "offline" || req.user.role === "employee")) {
      return res.status(403).json({ ok: false, msg: "forbidden" });
    }

    const emp = await User.findById(employeeId).populate("services.therapy");
    if (!emp) return res.status(404).json({ ok: false, msg: "employee not found" });
    return res.json({ ok: true, services: emp.services });
  } catch (err) {
    console.error("get employee services err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

module.exports = router;

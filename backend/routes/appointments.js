// backend/routes/appointments.js
const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");

// Helper: simple overlap check
const overlaps = (aStart, aDuration, bStart, bDuration) => {
  const aEnd = new Date(aStart.getTime() + aDuration * 60000);
  const bEnd = new Date(bStart.getTime() + bDuration * 60000);
  return aStart < bEnd && bStart < aEnd;
};

/**
 * POST /api/appointments
 * body: { employee, datetime (ISO string), durationMins, reason }
 * 
 * Permissions:
 * -user: create appointment for themselves
 * -admin: create appointment on behalf of any user
 * -offline: crate appointment on behalf of any user
 * -employee: cannot create appointments
 * any authenticated user can create an appointment (role=user or admin)
 */
// POST /api/appointments
// body: { employee, datetime, durationMins, reason, user }
// - normal user: creates for themselves
// - admin/offline: can create for any user (pass user in body)
router.post("/", auth, async (req, res) => {
  try {
    const { employee, datetime, durationMins = 30, reason, user } = req.body;
    if (!employee || !datetime) {
      return res.status(400).json({ ok: false, msg: "employee and datetime required" });
    }

    // who is the patient?
    // - for normal user → themselves
    // - for admin/offline → body.user if provided, else themselves
    let userId = req.user.id;
    const isAdminLike = req.user.role === "admin" || req.user.role === "offline";

    if (isAdminLike && user) {
      userId = user;

      // optional: ensure patient exists
      const patient = await User.findById(userId);
      if (!patient) {
        return res.status(400).json({ ok: false, msg: "patient user not found" });
      }
    }

    // ensure employee is valid employee
    const employeeUser = await User.findById(employee);
    if (!employeeUser || employeeUser.role !== "employee") {
      return res.status(400).json({ ok: false, msg: "employee not found or not an employee" });
    }

    const start = new Date(datetime);
    if (isNaN(start)) return res.status(400).json({ ok: false, msg: "invalid datetime" });

    // overlap check (basic)
    const windowStart = new Date(start.getTime() - 1000 * 60 * 60);
    const windowEnd = new Date(start.getTime() + 1000 * 60 * 60);

    const nearby = await Appointment.find({
      employee,
      datetime: { $gte: windowStart, $lte: windowEnd },
      status: "scheduled"
    });

    for (const ap of nearby) {
      if (overlaps(start, durationMins, ap.datetime, ap.durationMins)) {
        return res.status(409).json({ ok: false, msg: "Time slot unavailable for this employee" });
      }
    }

    const appt = new Appointment({
      user: userId,
      employee,
      datetime: start,
      durationMins,
      reason
    });

    await appt.save();
    return res.status(201).json({ ok: true, appointment: appt });
  } catch (err) {
    console.error("create appointment err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});


/**
 * GET /api/appointments
 * - admin => all appointments
 * - employee => appointments for that employee
 * - user => appointments created by that user
 * supports optional query params: ?status=scheduled&from=&to=
 */
router.get("/", auth, async (req, res) => {
  try {
    const { status, from, to } = req.query;
    const q = {};

    if (status) q.status = status;
    const role = req.user.role;

    if (role === "admin" || role === "offline") {
      // no extra filter
    } else if (req.user.role === "employee") {
      q.employee = req.user.id;
    } else {
      q.user = req.user.id;
    }

    if (from || to) q.datetime = {};
    if (from) q.datetime.$gte = new Date(from);
    if (to) q.datetime.$lte = new Date(to);

    const list = await Appointment.find(q).populate("user", "name email role").populate("employee", "name email role").sort({ datetime: 1 });
    return res.json({ ok: true, appointments: list });
  } catch (err) {
    console.error("list appts err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * GET /api/appointments/:id
 * - must be admin OR owner (user who booked) OR assigned employee
 */
router.get("/:id", auth, async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id).populate("user", "name email role").populate("employee", "name email role");
    if (!appt) return res.status(404).json({ ok: false, msg: "appointment not found" });

    const isOwner = appt.user._id.toString() === req.user.id;
    const isEmployee = appt.employee._id.toString() === req.user.id;
    const isAdminLike = req.user.role === 'admin' || req.user.role === 'offline';

    if (!(isAdminLike || isOwner || isEmployee)) {
      return res.status(403).json({ ok: false, msg: "forbidden" });
    }

    return res.json({ ok: true, appointment: appt });
  } catch (err) {
    console.error("get appt err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * PATCH /api/appointments/:id/cancel
 * - owner or admin can cancel; employee cannot cancel other's appointments (but admin can)
 */
router.patch("/:id/cancel", auth, async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ ok: false, msg: "appointment not found" });

    const isOwner = appt.user.toString() === req.user.id;
    const isAdminLike = req.user.role === 'admin' || req.user.role === 'offline'

    if (!(isAdminLike|| isOwner)) {
      return res.status(403).json({ ok: false, msg: "only owner, admin or offline can cancel" });
    }

    appt.status = "cancelled";
    await appt.save();
    return res.json({ ok: true, appointment: appt });
  } catch (err) {
    console.error("cancel appt err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * PATCH /api/appointments/:id/status
 * - allow employee or admin to update status (e.g., completed)
 * body: { status: "completed" }
 */
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !["scheduled", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ ok: false, msg: "invalid status" });
    }

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ ok: false, msg: "appointment not found" });

    const isEmployee = appt.employee.toString() === req.user.id;
    const isAdminLike = req.user.role === 'admin' || req.user.role === 'offline';

    if (!(isAdminLike || isEmployee)) {
      return res.status(403).json({ ok: false, msg: "only assigned employee, admin or offline can change status" });
    }

    appt.status = status;
    await appt.save();
    return res.json({ ok: true, appointment: appt });
  } catch (err) {
    console.error("update status err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

// GET /api/appointments/employee/schedule
// - employee sees their own schedule
// - admin may pass ?employee=<id> to view a specific employee
// - optional ?from=YYYY-MM-DD or full ISO, ?to=...
router.get("/employee/schedule", auth, async (req, res) => {
  try {
    // determine which employee to look up
    let employeeId;
    let role = req.user.role;

    if (role === "employee") {
      employeeId = req.user.id; // employee sees own schedule
    } else if (req.user.role === "admin" || role === "offline") {
      employeeId = req.query.employee; // admin can pass employee id
      if (!employeeId) return res.status(400).json({ ok: false, msg: "admin/offline must provide ?employee=<id>" });
    } else {
      // regular users cannot access this endpoint
      return res.status(403).json({ ok: false, msg: "forbidden: employees only" });
    }

    // parse date window
    const now = new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(now.setHours(0, 0, 0, 0));
    // default to 7 days after `from` if `to` not provided
    const to = req.query.to ? new Date(req.query.to) : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (isNaN(from) || isNaN(to)) return res.status(400).json({ ok: false, msg: "invalid from/to date" });

    // find scheduled appointments in window for that employee
    const appts = await Appointment.find({
      employee: employeeId,
      datetime: { $gte: from, $lte: to }
    })
      .populate("user", "name email")
      .populate("employee", "name email")
      .sort({ datetime: 1 });

    // group by YYYY-MM-DD (UTC ISO date)
    const grouped = {};
    for (const a of appts) {
      // use ISO date (YYYY-MM-DD) so frontend can render per-day easily
      const day = a.datetime.toISOString().split("T")[0];
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(a);
    }

    // produce sorted keys for convenience
    const days = Object.keys(grouped).sort();
    const result = {};
    for (const d of days) result[d] = grouped[d];

    return res.json({ ok: true, employeeId, from: from.toISOString(), to: to.toISOString(), schedule: result });
  } catch (err) {
    console.error("employee schedule err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * PUT /api/appointments/:id
 * Update appointment fields (owner or admin)
 * body: { datetime, durationMins, reason, employee }  -- employee change allowed only by admin
 */
router.put("/:id", auth, async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ ok: false, msg: "appointment not found" });

    const isOwner = appt.user.toString() === req.user.id;
    const isAdminLike = req.uesr.role === 'admin' || req.user.role === 'offline';

    if (!(isAdminLike || isOwner)) {
      return res.status(403).json({ ok: false, msg: "only owner, offline or admin can update" });
    }

    const { datetime, durationMins, reason, employee } = req.body;

    if (employee && !(req.user.role === 'admin' || req.user.role === 'offline')) {
      // only admin may reassign employee
      return res.status(403).json({ ok: false, msg: "only admin or offline change employee" });
    }

    if (datetime) {
      const dt = new Date(datetime);
      if (isNaN(dt)) return res.status(400).json({ ok: false, msg: "invalid datetime" });
      appt.datetime = dt;
    }

    if (durationMins) appt.durationMins = durationMins;
    if (reason !== undefined) appt.reason = reason;
    if (employee) appt.employee = employee;

    await appt.save();
    const updated = await Appointment.findById(appt._id).populate("user", "name email").populate("employee", "name email");
    return res.json({ ok: true, appointment: updated });
  } catch (err) {
    console.error("update appointment err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

// DELETE /api/appointments/:id
// Delete appointments(admin only)
router.delete("/:id", auth, requireRole("admin","offline"), async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndDelete(req.params.id);
    if (!appt) return res.status(404).json({ ok: false, msg: "appointment not found" });
    return res.json({ ok: true, msg: "appointment deleted", appointment: appt });
  } catch (err) {
    console.error("delete appointment err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

module.exports = router
// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const User = require("../models/User");
const Appointment = require("../models/Appointment");

// All routes require admin
router.use(auth, requireRole("admin"));

/**
 * GET /api/admin/summary
 * returns: totals (users/employees/appointments), upcoming counts, by-status,
 * top employees by appointment count, and recent appointments
 *
 * optional query:
 *  - upcomingDays (default 7)
 *  - topN (default 5)
 */
router.get("/summary", async (req, res) => {
  try {
    const upcomingDays = parseInt(req.query.upcomingDays || "7", 10);
    const topN = parseInt(req.query.topN || "5", 10);

    const now = new Date();
    const upcomingTo = new Date(now.getTime() + upcomingDays * 24 * 60 * 60 * 1000);

    // totals
    const [totalUsers, totalEmployees, totalAppointments] = await Promise.all([
      User.countDocuments({}), // all users
      User.countDocuments({ role: "employee" }),
      Appointment.countDocuments({})
    ]);

    // upcoming appointments (scheduled) in next upcomingDays
    const upcomingAppointmentsCount = await Appointment.countDocuments({
      datetime: { $gte: now, $lte: upcomingTo },
      status: "scheduled"
    });

    // appointments by status
    const byStatusAgg = await Appointment.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const appointmentsByStatus = byStatusAgg.reduce((acc, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    }, {});

    // appointments per employee (top N)
    const perEmployeeAgg = await Appointment.aggregate([
      { $group: { _id: "$employee", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: topN },
      // lookup employee info
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "employee"
        }
      },
      { $unwind: "$employee" },
      {
        $project: {
          _id: 0,
          employeeId: "$employee._id",
          name: "$employee.name",
          email: "$employee.email",
          role: "$employee.role",
          count: 1
        }
      }
    ]);

    // recent appointments (last 10)
    const recentAppointments = await Appointment.find({})
      .populate("user", "name email")
      .populate("employee", "name email")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.json({
      ok: true,
      totals: { totalUsers, totalEmployees, totalAppointments },
      upcoming: { upcomingDays, upcomingAppointmentsCount },
      appointmentsByStatus,
      topEmployees: perEmployeeAgg,
      recentAppointments
    });
  } catch (err) {
    console.error("admin summary err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * GET /api/admin/appointments-per-employee
 * returns full list of employees with appointment counts (paginated optionally)
 * query: page=1&pageSize=50
 */
router.get("/appointments-per-employee", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.max(1, Math.min(200, parseInt(req.query.pageSize || "50", 10)));
    const skip = (page - 1) * pageSize;

    const agg = [
      { $group: { _id: "$employee", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $skip: skip },
      { $limit: pageSize },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "employee"
        }
      },
      { $unwind: "$employee" },
      {
        $project: {
          _id: 0,
          employeeId: "$employee._id",
          name: "$employee.name",
          email: "$employee.email",
          role: "$employee.role",
          count: 1
        }
      }
    ];

    const results = await Appointment.aggregate(agg);
    return res.json({ ok: true, page, pageSize, results });
  } catch (err) {
    console.error("appointments-per-employee err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

module.exports = router;

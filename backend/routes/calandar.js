// backend/routes/calendar.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const Holiday = require("../models/Holiday");
const Leave = require("../models/Leave");
const Maintenance = require("../models/Maintenance");
const Appointment = require("../models/Appointment");
const User = require("../models/User");

// All calendar admin endpoints: admin or offline (receptionist)
router.use(auth, requireRole("admin", "offline"));

/**
 * Holidays
 */
router.post("/holidays", async (req, res) => {
  try {
    const { clinic, title, date, recurringYearly } = req.body;
    if (!clinic || !title || !date) return res.status(400).json({ ok:false, msg: "clinic, title, date required" });
    const h = new Holiday({ clinic, title, date: new Date(date), recurringYearly: !!recurringYearly, createdBy: req.user.id });
    await h.save();
    return res.status(201).json({ ok:true, holiday: h });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false, msg:"server error" }); }
});

router.get("/holidays", async (req, res) => {
  try {
    const { clinic, from, to } = req.query;
    if (!clinic) return res.status(400).json({ ok:false, msg: "clinic required" });
    const q = { clinic };
    if (from || to) q.date = {};
    if (from) q.date.$gte = new Date(from);
    if (to) q.date.$lte = new Date(to);
    const list = await Holiday.find(q).sort({ date: 1 });
    return res.json({ ok:true, holidays: list });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false, msg:"server error" }); }
});

router.delete("/holidays/:id", async (req,res) => {
  try { const h = await Holiday.findByIdAndDelete(req.params.id); return res.json({ ok:true, holiday:h });}
  catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

/**
 * Leaves
 */
router.post("/leaves", async (req,res) => {
  try {
    const { employee, from, to, reason, partial, fromTime, toTime } = req.body;
    if (!employee || !from || !to) return res.status(400).json({ ok:false, msg:"employee, from, to required" });
    const l = new Leave({ employee, from:new Date(from), to:new Date(to), reason, partial, fromTime, toTime, createdBy: req.user.id });
    await l.save();
    return res.status(201).json({ ok:true, leave: l });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

router.get("/leaves", async (req,res) => {
  try {
    const { employee, from, to } = req.query;
    const q = {};
    if (employee) q.employee = employee;
    if (from || to) q.from = {};
    if (from) q.from.$gte = new Date(from);
    // For range queries we may need more advanced matching; for simplicity return leaves overlapping window
    if (from || to) {
      const f = from ? new Date(from) : new Date(0);
      const t = to ? new Date(to) : new Date(8640000000000000);
      const list = await Leave.find({ employee, $or: [ { from: { $lte: t, $gte: f } }, { to: { $lte: t, $gte: f } }, { from: { $lte: f }, to: { $gte: t } } ] });
      return res.json({ ok:true, leaves:list });
    }
    const list = await Leave.find(q);
    return res.json({ ok:true, leaves:list });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

router.delete("/leaves/:id", async (req,res) => {
  try { const l = await Leave.findByIdAndDelete(req.params.id); return res.json({ ok:true, leave:l });}
  catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

/**
 * Maintenance
 */
router.post("/maintenance", async (req,res) => {
  try {
    const { clinic, title, from, to, resource } = req.body;
    if (!clinic || !from || !to) return res.status(400).json({ ok:false, msg:"clinic, from, to required" });
    const m = new Maintenance({ clinic, title, from:new Date(from), to:new Date(to), resource, createdBy:req.user.id });
    await m.save();
    return res.status(201).json({ ok:true, maintenance:m });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

router.get("/maintenance", async (req,res) => {
  try {
    const { clinic, from, to } = req.query;
    const q = {};
    if (clinic) q.clinic = clinic;
    if (from || to) q.from = {};
    if (from) q.from.$lte = new Date(to || new Date(8640000000000000));
    // for simplicity just return items overlapping window:
    const f = from ? new Date(from) : new Date(0);
    const t = to ? new Date(to) : new Date(8640000000000000);
    const list = await Maintenance.find({ clinic, $or: [ { from: { $lte: t, $gte: f } }, { to: { $lte: t, $gte: f } }, { from: { $lte: f }, to: { $gte: t } } ] });
    return res.json({ ok:true, maintenance:list });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

router.delete("/maintenance/:id", async (req,res)=>{ try{ const m = await Maintenance.findByIdAndDelete(req.params.id); return res.json({ ok:true, maintenance:m }); } catch(err){ console.error(err); return res.status(500).json({ ok:false }); } });


// Helper: parse "HH:MM" -> minutes since midnight
const parseHM = (s) => {
  if (!s) return null;
  const [hh, mm] = s.split(":").map(Number);
  return hh*60 + (mm||0);
};

// create slot times between fromMin and toMin with slotDuration
const generateSlots = (fromMin, toMin, slotDuration) => {
  const slots = [];
  for (let start = fromMin; start + slotDuration <= toMin; start += slotDuration) {
    slots.push({ startMin: start, endMin: start + slotDuration });
  }
  return slots;
};


// GET /api/calander/view
// Query:
// -Clinic
// -Year (e.g., 2025)
// -month (0 indexed month or 1..12? we'll accept 1..12)
// -employee (optional)
// -slotDuration(minutes, optional)
// -tz (IANA timezone string, optional - defaults server timezone)

router.get("/view", async (req,res) => {
  try {
    const { clinic, year, month, employee, slotDuration } = req.query;
    if (!clinic || !year || !month) return res.status(400).json({ ok:false, msg:"clinic, year, month required" });

    const y = parseInt(year,10);
    const m = parseInt(month,10); // expecting 1..12
    const sd = parseInt(slotDuration || "30",10);

    // compute month window (UTC)
    const fromDate = new Date(Date.UTC(y, m-1, 1, 0,0,0));
    const toDate = new Date(Date.UTC(y, m, 0, 23,59,59,999)); // last day of month

    // load holidays, maint, leaves, appointments, employees' working hours
    const [holidays, maintenance, appointments] = await Promise.all([
      Holiday.find({ clinic, date: { $gte: new Date(fromDate.toISOString().split("T")[0]), $lte: new Date(toDate.toISOString().split("T")[0]) } }).lean(),
      Maintenance.find({ clinic, $or:[ { from: { $lte: toDate, $gte: fromDate } }, { to: { $lte: toDate, $gte: fromDate } }, { from: { $lte: fromDate }, to: { $gte: toDate } } ] }).lean(),
      Appointment.find({ employee: employee ? employee : { $in: [] }, datetime: { $gte: fromDate, $lte: toDate }, status: "scheduled" }).populate("user", "name").lean()
    ]);

    // If employee filter not provided, load appointments for all clinic employees:
    let employeeList = [];
    if (employee) {
      const emp = await User.findById(employee).select("workingHours slotDurationMins services name clinic").lean();
      if (!emp) return res.status(404).json({ ok:false, msg:"employee not found" });
      employeeList = [emp];
      // get appointments for this employee
      const empAppts = await Appointment.find({ employee, datetime: { $gte: fromDate, $lte: toDate }, status: "scheduled" }).lean();
      appointments.splice(0, appointments.length, ...empAppts);
    } else {
      // fetch clinic employees
      const clinicDoc = await require("../models/Clinic").findById(clinic).populate("employees", "workingHours slotDurationMins services name").lean();
      employeeList = (clinicDoc && clinicDoc.employees) || [];
      // if appointments was empty because employee not provided earlier, now fetch all scheduled appts for clinic employees
      if (!appointments.length) {
        const empIds = employeeList.map(e=>e._id);
        const allAppts = await Appointment.find({ employee: { $in: empIds }, datetime: { $gte: fromDate, $lte: toDate }, status: "scheduled" }).lean();
        appointments.splice(0, appointments.length, ...allAppts);
      }
    }

    // load leaves for employees shown, overlapping month
    const empIds = employeeList.map(e=>e._id);
    const leaves = await require("../models/Leave").find({ employee: { $in: empIds }, $or:[
      { from: { $lte: toDate, $gte: fromDate } },
      { to: { $lte: toDate, $gte: fromDate } },
      { from: { $lte: fromDate }, to: { $gte: toDate } }
    ] }).lean();

    // Build day-by-day slots per employee (for simplicity show aggregated availability if multiple employees)
    // We'll create a structure: days: [{ date: "2025-12-01", employees: [ { employeeId, name, slots:[{start,end,status,appt?}] } ] }]
    const days = [];
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();

    for (let day=1; day<=lastDay; day++) {
      const dayStart = new Date(Date.UTC(y, m-1, day, 0,0,0));
      const dayKey = dayStart.toISOString().split("T")[0];
      const dayHolidays = holidays.filter(h => (new Date(h.date)).toISOString().split("T")[0] === dayKey);
      const dayMaint = maintenance.filter(mt => !(mt.to < dayStart || mt.from > new Date(dayStart.getTime()+24*60*60*1000-1)));
      const perEmployee = [];

      for (const emp of employeeList) {
        // determine working hours for that day (find matching day entry)
        const weekday = dayStart.getUTCDay(); // 0..6
        const wh = (emp.workingHours || []).find(w=>w.day === weekday);
        if (!wh) {
          // no working hours -> whole day unavailable
          perEmployee.push({ employeeId: emp._id, name: emp.name, slots: [] });
          continue;
        }

        // compute minutes since midnight for wh.from/to
        const fromMin = parseHM(wh.from);
        const toMin = parseHM(wh.to);
        const slots = generateSlots(fromMin, toMin, sd);

        // map slots to absolute Date objects (UTC)
        const slotObjs = slots.map(s => {
          const sDate = new Date(Date.UTC(y, m-1, day, 0,0,0));
          sDate.setUTCMinutes(s.startMin);
          const eDate = new Date(sDate.getTime() + sd * 60000);
          return { start: sDate, end: eDate, startMin: s.startMin, endMin: s.endMin, status: "available", appointment: null };
        });

        // mark holiday -> whole day unavailable
        if (dayHolidays && dayHolidays.length) {
          for (const so of slotObjs) so.status = "holiday";
        }

        // mark maintenance overlapping slots
        for (const mt of dayMaint) {
          for (const so of slotObjs) {
            if (!(so.end <= mt.from || so.start >= mt.to)) so.status = "maintenance";
          }
        }

        // mark employee leaves overlapping
        const empLeaves = leaves.filter(l => l.employee.toString() === emp._id.toString());
        for (const l of empLeaves) {
          for (const so of slotObjs) {
            if (!(so.end <= l.from || so.start >= l.to)) so.status = "leave";
          }
        }

        // mark booked appointments
        const empAppts = appointments.filter(a => a.employee.toString() === emp._id.toString());
        for (const a of empAppts) {
          const aStart = new Date(a.datetime);
          const aEnd = new Date(aStart.getTime() + (a.durationMins||sd)*60000);
          for (const so of slotObjs) {
            if (!(so.end <= aStart || so.start >= aEnd)) {
              so.status = "booked";
              so.appointment = a;
            }
          }
        }

        perEmployee.push({ employeeId: emp._id, name: emp.name, slots: slotObjs.map(s=>({ start: s.start, end: s.end, status: s.status, appointment: s.appointment })) });
      } // end employees for day

      days.push({ date: dayKey, employees: perEmployee });
    } // days loop

    return res.json({ ok:true, clinic, year: y, month: m, days });
  } catch (err) {
    console.error("calendar view err:", err);
    return res.status(500).json({ ok:false, msg:"server error" });
  }
});


// in routes/appointemtns.js or routes/calander.js (protected)
// in routes/appointments.js or routes/calendar.js (protected)
router.post("/reschedule", auth, async (req, res) => {
  try {
    const { appointmentId, newDatetime, newDurationMins } = req.body;
    if (!appointmentId || !newDatetime) return res.status(400).json({ ok:false, msg:"appointmentId and newDatetime required" });

    // find appointment
    const appt = await Appointment.findById(appointmentId);
    if (!appt) return res.status(404).json({ ok:false, msg:"appointment not found" });

    // permission: owner/admin/offline/employee-assigned can reschedule (tweak as needed)
    const isOwner = appt.user.toString() === req.user.id;
    const isEmployee = appt.employee.toString() === req.user.id;
    const isAdminLike = ["admin","offline"].includes(req.user.role);
    if (!(isOwner || isEmployee || isAdminLike)) return res.status(403).json({ ok:false, msg:"forbidden" });

    const newStart = new Date(newDatetime);
    const dur = typeof newDurationMins === "number" ? newDurationMins : appt.durationMins;

    // check overlap for the same employee
    const windowStart = new Date(newStart.getTime() - 60*60*1000);
    const windowEnd = new Date(newStart.getTime() + 60*60*1000);

    const nearby = await Appointment.find({
      employee: appt.employee,
      _id: { $ne: appt._id },
      datetime: { $gte: windowStart, $lte: windowEnd },
      status: "scheduled"
    });

    const overlaps = (aStart,aDur,bStart,bDur) => {
      const aEnd = new Date(aStart.getTime() + aDur*60000);
      const bEnd = new Date(bStart.getTime() + bDur*60000);
      return aStart < bEnd && bStart < aEnd;
    };

    for (const other of nearby) {
      if (overlaps(newStart, dur, other.datetime, other.durationMins)) {
        return res.status(409).json({ ok:false, msg:"time slot conflicts with another appointment" });
      }
    }

    // all good -> update
    appt.datetime = newStart;
    appt.durationMins = dur;
    await appt.save();

    const populated = await Appointment.findById(appt._id).populate("user","name email").populate("employee","name email").populate("therapy");
    return res.json({ ok:true, appointment: populated });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false, msg:"server error" }); }
});




module.exports = router;

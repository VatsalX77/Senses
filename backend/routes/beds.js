// backend/routes/beds.js
const express = require("express");
const router = express.Router();
const Bed = require("../models/Bed");
const BedTask = require("../models/BedTask");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const User = require("../models/User");

// Admin-only: CRUD beds
router.post("/clinic/:clinicId", auth, requireRole("admin"), async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { name, description, employees } = req.body;
    if (!name) return res.status(400).json({ ok:false, msg:"name required" });

    const bed = new Bed({ clinic: clinicId, name, description, employees: employees || [] });
    await bed.save();
    return res.status(201).json({ ok:true, bed });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false, msg:"server error" }); }
});

router.get("/clinic/:clinicId", auth, requireRole("admin","offline","employee"), async (req,res) => {
  try {
    const beds = await Bed.find({ clinic: req.params.clinicId }).lean();
    return res.json({ ok:true, beds });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

router.put("/:bedId", auth, requireRole("admin"), async (req,res) => {
  try {
    const updates = req.body;
    const bed = await Bed.findByIdAndUpdate(req.params.bedId, updates, { new: true });
    if (!bed) return res.status(404).json({ ok:false, msg:"bed not found" });
    return res.json({ ok:true, bed });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

router.delete("/:bedId", auth, requireRole("admin"), async (req,res) => {
  try {
    const b = await Bed.findByIdAndDelete(req.params.bedId);
    if (!b) return res.status(404).json({ ok:false, msg:"bed not found" });
    // optionally cascade delete tasks
    await BedTask.deleteMany({ bed: b._id });
    return res.json({ ok:true, msg:"bed deleted" });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

/**
 * Employee actions on tasks
 */

// list tasks for a bed
router.get("/:bedId/tasks", auth, requireRole("admin","offline","employee"), async (req,res) => {
  try {
    const tasks = await BedTask.find({ bed: req.params.bedId }).sort({ createdAt: -1 }).lean();
    return res.json({ ok:true, tasks });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

// create task (employee creates)
router.post("/:bedId/tasks", auth, requireRole("employee","admin","offline"), async (req,res) => {
  try {
    const bedId = req.params.bedId;
    const { patientName, title, notes, durationMins, therapy } = req.body;
    if (!title || !durationMins) return res.status(400).json({ ok:false, msg:"title and durationMins required" });

    const task = new BedTask({
      bed: bedId,
      createdBy: req.user.id,
      patientName: patientName || null,
      title,
      notes,
      durationMins,
      remainingSecs: durationMins * 60,
      status: "pending"
    });
    if (therapy) task.therapy = therapy;

    await task.save();

    // emit event to employee room(s) who are allowed to see this bed
    // simplest: broadcast to all clinic employees
    // find bed to determine clinic & employees
    const bed = await Bed.findById(bedId).populate("employees", "_id").lean();
    const io = req.app.get("io");
    if (bed && bed.employees) {
      for (const emp of bed.employees) {
        io.to(`user_${emp._id}`).emit("bedTaskCreated", { task });
      }
    }
    // also emit to creator's room
    io.to(`user_${req.user.id}`).emit("bedTaskCreated", { task });

    return res.status(201).json({ ok:true, task });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

// start timer
router.post("/tasks/:taskId/start", auth, requireRole("employee","admin","offline"), async (req,res) => {
  try {
    const { taskId } = req.params;
    const task = await BedTask.findById(taskId);
    if (!task) return res.status(404).json({ ok:false, msg:"task not found" });

    // permission: allow creator, assigned employee (if bed.employees contains user) or admin/offline
    const bed = await Bed.findById(task.bed);
    const isBedEmployee = bed && bed.employees.map(e=>e.toString()).includes(req.user.id);
    const allowed = req.user.role === "admin" || req.user.role === "offline" || isBedEmployee || task.createdBy.toString() === req.user.id;
    if (!allowed) return res.status(403).json({ ok:false, msg:"forbidden" });

    const timerManager = req.app.get("timerManager");
    const room = `user_${req.user.id}`;
    await timerManager.startTask(taskId, room);

    return res.json({ ok:true, msg:"started" });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

// pause
router.post("/tasks/:taskId/pause", auth, requireRole("employee","admin","offline"), async (req,res) => {
  try {
    const timerManager = req.app.get("timerManager");
    const room = `user_${req.user.id}`;
    await timerManager.pauseTask(req.params.taskId, room);
    return res.json({ ok:true, msg:"paused" });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

// resume
router.post("/tasks/:taskId/resume", auth, requireRole("employee","admin","offline"), async (req,res) => {
  try {
    const timerManager = req.app.get("timerManager");
    const room = `user_${req.user.id}`;
    await timerManager.resumeTask(req.params.taskId, room);
    return res.json({ ok:true, msg:"resumed" });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

// stop (cancel)
router.post("/tasks/:taskId/stop", auth, requireRole("employee","admin","offline"), async (req,res) => {
  try {
    const timerManager = req.app.get("timerManager");
    const room = `user_${req.user.id}`;
    await timerManager.stopTask(req.params.taskId, room);
    return res.json({ ok:true, msg:"stopped" });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

// update task (title/notes/duration)
router.put("/tasks/:taskId", auth, requireRole("employee","admin","offline"), async (req,res) => {
  try {
    const updates = (({ title, notes, durationMins, patientName }) => ({ title, notes, durationMins, patientName }))(req.body);
    const t = await BedTask.findByIdAndUpdate(req.params.taskId, updates, { new: true });
    if (!t) return res.status(404).json({ ok:false, msg:"task not found" });

    const io = req.app.get("io");
    // inform related employees (bed employees)
    const bed = await Bed.findById(t.bed).populate("employees", "_id").lean();
    if (bed && bed.employees) {
      for (const emp of bed.employees) {
        io.to(`user_${emp._id}`).emit("bedTaskUpdated", { task: t });
      }
    }
    io.to(`user_${t.createdBy}`).emit("bedTaskUpdated", { task: t });

    return res.json({ ok:true, task: t });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

// mark complete (force)
router.post("/tasks/:taskId/complete", auth, requireRole("employee","admin","offline"), async (req,res) => {
  try {
    const t = await BedTask.findByIdAndUpdate(req.params.taskId, { status: "completed", completedAt: new Date(), remainingSecs: 0 }, { new: true });
    if (!t) return res.status(404).json({ ok:false, msg:"task not found" });

    const io = req.app.get("io");
    const bed = await Bed.findById(t.bed).populate("employees", "_id").lean();
    if (bed && bed.employees) {
      for (const emp of bed.employees) io.to(`user_${emp._id}`).emit("bedTaskUpdated", { task: t });
    }
    io.to(`user_${t.createdBy}`).emit("bedTaskUpdated", { task: t });

    return res.json({ ok:true, task: t });
  } catch(err){ console.error(err); return res.status(500).json({ ok:false }); }
});

module.exports = router;

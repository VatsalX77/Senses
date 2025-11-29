// backend/routes/clinics.js
const express = require("express");
const router = express.Router();
const Clinic = require("../models/Clinic");
const User = require("../models/User");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const { makeUploader } = require("../config/multer");

const uploadImages = makeUploader({ types: ["image"], maxSize: 5 * 1024 * 1024 }); // 5MB per image

// Admin-only
router.use(auth, requireRole("admin"));

/**
 * POST /api/clinics
 * Form-data: name, address fields as JSON or fields; files: images[]
 * Example: use JSON body without files, or multipart/form-data with files.
 */
router.post("/", uploadImages.array("images", 6), async (req, res) => {
  try {
    // address can be sent as JSON in `address` field or individual fields
    let address = {};
    if (req.body.address) {
      try { address = JSON.parse(req.body.address); } catch (e) { address = {}; }
    }
    // fallback to individual fields
    address.line1 = address.line1 || req.body.line1 || req.body.addressLine1 || req.body.line_1;

    if (!req.body.name || !address.line1) {
      return res.status(400).json({ ok: false, msg: "name and address.line1 required" });
    }

    const images = (req.files || []).map(f => `/uploads/${f.filename}`);

    const clinic = new Clinic({
      name: req.body.name,
      address,
      images,
      employees: []
    });

    await clinic.save();
    return res.status(201).json({ ok: true, clinic });
  } catch (err) {
    console.error("create clinic err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * GET /api/clinics
 * List clinics (public to admin)
 */
router.get("/", async (req, res) => {
  try {
    const clinics = await Clinic.find({}).populate("employees", "name email role");
    return res.json({ ok: true, clinics });
  } catch (err) {
    console.error("list clinics err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * GET /api/clinics/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id).populate("employees", "name email role clinic");
    if (!clinic) return res.status(404).json({ ok: false, msg: "clinic not found" });
    return res.json({ ok: true, clinic });
  } catch (err) {
    console.error("get clinic err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * PUT /api/clinics/:id
 * Update clinic info. To update images, re-upload and pass `images` files.
 */
router.put("/:id", uploadImages.array("images", 6), async (req, res) => {
  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;

    let address = null;
    if (req.body.address) {
      try { address = JSON.parse(req.body.address); } catch (e) { address = null; }
    }
    if (address) updates.address = address;

    // if new images uploaded -> append them to existing images
    const clinic = await Clinic.findById(req.params.id);
    if (!clinic) return res.status(404).json({ ok: false, msg: "clinic not found" });

    if (req.files && req.files.length) {
      const newImgs = req.files.map(f => `/uploads/${f.filename}`);
      clinic.images = (clinic.images || []).concat(newImgs);
    }

    // apply updates
    if (updates.name) clinic.name = updates.name;
    if (updates.address) clinic.address = updates.address;

    await clinic.save();
    return res.json({ ok: true, clinic });
  } catch (err) {
    console.error("update clinic err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * DELETE /api/clinics/:id
 * Removes clinic. NOTE: employees' `clinic` field will be unset.
 */
router.delete("/:id", async (req, res) => {
  try {
    const clinic = await Clinic.findByIdAndDelete(req.params.id);
    if (!clinic) return res.status(404).json({ ok: false, msg: "clinic not found" });

    // unset clinic on users who were assigned
    await User.updateMany({ clinic: clinic._id }, { $set: { clinic: null } });
    // optionally delete images from disk (not done here)
    return res.json({ ok: true, msg: "clinic deleted", clinic });
  } catch (err) {
    console.error("delete clinic err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * POST /api/clinics/:id/assign
 * body: { employeeId }
 * Assign employee to this clinic (adds to clinic.employees and updates user.clinic)
 */
router.post("/:id/assign", async (req, res) => {
  try {
    const clinicId = req.params.id;
    const { employeeId } = req.body;
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) return res.status(404).json({ ok: false, msg: "clinic not found" });

    const emp = await User.findById(employeeId);
    if (!emp || emp.role !== "employee") return res.status(400).json({ ok: false, msg: "employee not found" });

    // prevent duplicates
    if (clinic.employees.map(e => e.toString()).includes(employeeId)) {
      return res.status(400).json({ ok: false, msg: "employee already assigned to clinic" });
    }

    clinic.employees.push(emp._id);
    await clinic.save();

    // set employee clinic
    emp.clinic = clinic._id;
    await emp.save();

    return res.json({ ok: true, clinic });
  } catch (err) {
    console.error("assign employee err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * POST /api/clinics/:id/unassign
 * body: { employeeId }
 * Remove employee from clinic and unset user.clinic
 */
// POST /api/clinics/:id/assign  (auto-move behaviour)
router.post("/:id/assign", async (req, res) => {
  try {
    const clinicId = req.params.id;
    const { employeeId } = req.body;
    if (!employeeId) return res.status(400).json({ ok: false, msg: "employeeId required" });

    const clinic = await Clinic.findById(clinicId);
    if (!clinic) return res.status(404).json({ ok: false, msg: "clinic not found" });

    const emp = await User.findById(employeeId);
    if (!emp || emp.role !== "employee") return res.status(400).json({ ok: false, msg: "employee not found" });

    // If employee already assigned to this clinic -> noop
    if (emp.clinic && emp.clinic.toString() === clinic._id.toString()) {
      return res.status(200).json({ ok: true, msg: "employee already assigned to this clinic", clinic });
    }

    // If employee assigned to another clinic -> remove them from that clinic first
    if (emp.clinic) {
      const prevClinic = await Clinic.findById(emp.clinic);
      if (prevClinic) {
        prevClinic.employees = prevClinic.employees.filter(e => e.toString() !== emp._id.toString());
        await prevClinic.save();
      }
    }

    // Now add to new clinic
    // Prevent duplicates just in case
    if (!clinic.employees.map(e => e.toString()).includes(emp._id.toString())) {
      clinic.employees.push(emp._id);
      await clinic.save();
    }

    // update user.clinic
    emp.clinic = clinic._id;
    await emp.save();

    return res.json({ ok: true, msg: "employee assigned to clinic", clinic });
  } catch (err) {
    console.error("assign employee err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});


/**
 * GET /api/clinics/:id/employees
 * returns list of employees at clinic
 */
router.get("/:id/employees", async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id).populate("employees", "name email role clinic services profilePic");
    if (!clinic) return res.status(404).json({ ok: false, msg: "clinic not found" });
    return res.json({ ok: true, employees: clinic.employees });
  } catch (err) {
    console.error("clinic employees err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

module.exports = router;

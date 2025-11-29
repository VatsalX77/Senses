// backend/routes/employeeMedia.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const { makeUploader } = require("../config/multer");
const uploadImage = makeUploader({ types: ["image"], maxSize: 2 * 1024 * 1024 }); // 2MB profile
const uploadAnyCert = makeUploader({ types: ["image", "application/pdf"], maxSize: 8 * 1024 * 1024 }); // 8MB cert

// All routes require admin
router.use(auth, requireRole("admin"));

/**
 * POST /api/employee-media/:employeeId/profile-pic
 * Form-data: file => profile pic (image)
 */
router.post("/:employeeId/profile-pic", uploadImage.single("file"), async (req, res) => {
  try {
    const empId = req.params.employeeId;
    const emp = await User.findById(empId);
    if (!emp || emp.role !== "employee") return res.status(404).json({ ok: false, msg: "employee not found" });

    if (!req.file) return res.status(400).json({ ok: false, msg: "file required" });

    // file url path
    const fileUrl = `/uploads/${req.file.filename}`;

    emp.profilePic = fileUrl;
    await emp.save();

    return res.json({ ok: true, profilePic: fileUrl });
  } catch (err) {
    console.error("upload profile pic err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * POST /api/employee-media/:employeeId/certifications
 * Form-data:
 *   file => certification file (image or pdf)
 *   title => string
 *   issuedBy => string (optional)
 *   issuedAt => date string (optional)
 */
router.post("/:employeeId/certifications", uploadAnyCert.single("file"), async (req, res) => {
  try {
    const empId = req.params.employeeId;
    const emp = await User.findById(empId);
    if (!emp || emp.role !== "employee") return res.status(404).json({ ok: false, msg: "employee not found" });

    if (!req.file) return res.status(400).json({ ok: false, msg: "file required" });

    const { title, issuedBy, issuedAt } = req.body;
    if (!title) return res.status(400).json({ ok: false, msg: "title required" });

    const fileUrl = `/uploads/${req.file.filename}`;
    const cert = {
      title,
      fileUrl,
      issuedBy: issuedBy || null,
      issuedAt: issuedAt ? new Date(issuedAt) : null,
      uploadedAt: new Date()
    };

    emp.certifications = emp.certifications || [];
    emp.certifications.push(cert);
    await emp.save();

    return res.status(201).json({ ok: true, certification: cert, certifications: emp.certifications });
  } catch (err) {
    console.error("upload certification err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * DELETE /api/employee-media/:employeeId/certifications/:indexOrId
 * - Accepts certification _id (if you add _id on subdocs) or numeric index in array
 * We used array of plain subdocs without _id above; use index removal for simplicity.
 */
router.delete("/:employeeId/certifications/:idx", async (req, res) => {
  try {
    const empId = req.params.employeeId;
    const idx = parseInt(req.params.idx, 10);
    const emp = await User.findById(empId);
    if (!emp || emp.role !== "employee") return res.status(404).json({ ok: false, msg: "employee not found" });

    if (!Array.isArray(emp.certifications) || emp.certifications.length <= idx || idx < 0) {
      return res.status(400).json({ ok: false, msg: "invalid certification index" });
    }

    const removed = emp.certifications.splice(idx, 1)[0];
    await emp.save();

    // optionally delete file from disk (not implemented here)
    return res.json({ ok: true, removed, certifications: emp.certifications });
  } catch (err) {
    console.error("delete certification err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

/**
 * GET /api/employee-media/:employeeId
 * returns profilePic and certifications (admin)
 */
router.get("/:employeeId", async (req, res) => {
  try {
    const empId = req.params.employeeId;
    const emp = await User.findById(empId).select("profilePic certifications");
    if (!emp) return res.status(404).json({ ok: false, msg: "employee not found" });
    return res.json({ ok: true, profilePic: emp.profilePic, certifications: emp.certifications || [] });
  } catch (err) {
    console.error("get employee media err:", err);
    return res.status(500).json({ ok: false, msg: "server error" });
  }
});

module.exports = router;

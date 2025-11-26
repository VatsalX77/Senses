// backend/middleware/role.js

// accepts one or more roles: requireRole("admin") or requireRole("admin","employee")
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ ok: false, msg: "Not authenticated" });
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ ok: false, msg: "Forbidden: insufficient role" });
  }
  next();
};

module.exports = requireRole;

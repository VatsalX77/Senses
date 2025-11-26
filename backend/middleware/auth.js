// backend/middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, msg: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    // decoded should contain { userId, role }
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ ok: false, msg: "Invalid token" });
    }

    // attach a minimal user object to req (avoid sending password)
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) return res.status(401).json({ ok: false, msg: "User not found" });

    req.user = { id: user._id, name: user.name, email: user.email, role: user.role };
    next();
  } catch (err) {
    console.error("auth middleware error:", err.message);
    return res.status(401).json({ ok: false, msg: "Token verification failed" });
  }
};

module.exports = auth;

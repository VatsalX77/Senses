// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db"); // your DB connector
const TimerManager = require("./timers/TimerManager"); // your timer manager

const app = express();
app.use(cors());
app.use(express.json());

// optional dev logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} -> ${req.method} ${req.path}`);
  next();
});

// static uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// mount REST routes (ensure these files exist)
app.use("/api/auth", require("./routes/auth"));
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/therapies", require("./routes/therapies"));
app.use("/api/employee-services", require("./routes/employeeServices"));
app.use("/api/employee-media", require("./routes/employeeMedia"));
app.use("/api/clinics", require("./routes/clinics"));
app.use("/api/calendar", require("./routes/calendar"));
app.use("/api/beds", require("./routes/beds"));

// small health route
app.get("/health", (req, res) => res.json({ ok: true, msg: "server running" }));

const PORT = process.env.PORT || 5000;

// create http server and attach socket.io
const server = http.createServer(app);
const { Server } = require("socket.io");

// configure CORS for socket.io (adjust origin for production)
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

// initialize timer manager with io
const timerManager = new TimerManager(io);

// expose io and timerManager to express (so routes can use req.app.get("io") / get("timerManager"))
app.set("io", io);
app.set("timerManager", timerManager);

// ===== Socket authentication middleware (handshake) =====
// Client should send token in handshake.auth.token (recommended) or query token fallback
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token
      ? socket.handshake.auth.token
      : socket.handshake.query && socket.handshake.query.token
        ? socket.handshake.query.token
        : null;

    if (!token) {
      const err = new Error("Authentication error: token required");
      err.data = { reason: "No token provided" };
      return next(err);
    }

    const secret = process.env.JWT_SECRET || "devsecret";
    jwt.verify(token.replace(/^Bearer\s+/i, ""), secret, (err, decoded) => {
      if (err) {
        const e = new Error("Authentication error: token invalid");
        e.data = { reason: err.message };
        return next(e);
      }
      // decoded expected to have { userId, role } based on your auth code
      socket.user = { id: decoded.userId || decoded.user || decoded.id, role: decoded.role || null };
      return next();
    });
  } catch (err) {
    return next(err);
  }
});

// connection handler
io.on("connection", (socket) => {
  // join a personal room for this user so we can emit directly
  if (socket.user && socket.user.id) {
    const room = `user_${socket.user.id}`;
    socket.join(room);
    console.log(`Socket ${socket.id} authenticated -> joined ${room}`);
  } else {
    console.log("Socket connected without user info", socket.id);
  }

  // useful events (optional):
  socket.on("ping-server", (payload) => {
    socket.emit("pong", { ok: true, ts: Date.now(), you: socket.user || null, payload });
  });

  // you can allow clients to request joining other rooms (careful with security)
  socket.on("joinRoom", ({ room }) => {
    // example: only allow joining admin rooms if socket.user.role === 'admin'
    socket.join(room);
  });

  socket.on("disconnect", (reason) => {
    console.log(`Socket ${socket.id} disconnected:`, reason);
  });
});

// ===== start server after DB connect =====
const start = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`✅ Server + Sockets running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Could not start server:", err && err.message ? err.message : err);
    process.exit(1);
  }
};
start();

// graceful shutdown & global error handlers
const gracefulShutdown = async () => {
  console.log("⚠️ Graceful shutdown: closing server, sockets and timers...");

  try {
    // stop timers (clear intervals)
    if (timerManager && typeof timerManager.shutdown === "function") {
      await timerManager.shutdown();
      console.log("✅ TimerManager shutdown complete");
    }

    // close socket.io (disconnect clients)
    if (io) {
      io.emit("serverShutdown", { msg: "server is shutting down" });
      await io.disconnectSockets(true);
      io.close();
      console.log("✅ Socket.IO closed");
    }

    // close http server
    server.close(() => {
      console.log("✅ HTTP server closed");
      process.exit(0);
    });

    // fallback: force exit after timeout
    setTimeout(() => {
      console.error("Forcing exit after timeout");
      process.exit(1);
    }, 5000);
  } catch (err) {
    console.error("Error during gracefulShutdown:", err);
    process.exit(1);
  }
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  gracefulShutdown();
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  gracefulShutdown();
});

// scripts/backfill-appointments.js
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db"); // adjust path if needed
const User = require("./models/User");
const Appointment = require("./models/Appointment");

const run = async () => {
  try {
    await connectDB();

    const emps = await User.find({ role: "employee" }).lean();

    const appts = await Appointment.find({ therapy: { $exists: false } });
    console.log("Appointments to consider:", appts.length);

    for (const ap of appts) {
      const emp = emps.find(e => e._id.toString() === ap.employee.toString());
      if (!emp) continue;
      if (emp.services && emp.services.length) {
        // pick first service as fallback
        const s = emp.services[0];
        ap.therapy = s.therapy;
        ap.price = s.price;
        ap.durationMins = s.durationMins || ap.durationMins;
        await ap.save();
        console.log("Backfilled appt", ap._id.toString());
      }
    }

    console.log("Backfill done");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();

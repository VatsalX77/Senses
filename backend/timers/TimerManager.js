// backend/timers/TimerManager.js
const BedTask = require("../models/BedTask");

class TimerManager {
  constructor(io) {
    this.io = io; // socket.io instance
    this.timers = new Map(); // key: taskId -> intervalId & metadata
  }

  // start a timer (task must exist in DB)
  async startTask(taskId, employeeRoom) {
    if (this.timers.has(taskId)) return; // already running

    const task = await BedTask.findById(taskId);
    if (!task) throw new Error("task not found");

    // initialize remainingSecs
    let remaining = task.remainingSecs;
    if (remaining == null) remaining = task.durationMins * 60;

    task.status = "running";
    task.startedAt = new Date();
    task.pausedAt = null;
    task.remainingSecs = remaining;
    await task.save();

    // emit initial start event
    this.io.to(employeeRoom).emit("taskStarted", { taskId, remainingSecs: remaining });

    const tick = async () => {
      remaining -= 1;
      // emit tick every second to that employee room
      this.io.to(employeeRoom).emit("taskTick", { taskId, remainingSecs: remaining });

      // persist remaining every N seconds (reduce DB load)
      if (remaining % 5 === 0) {
        await BedTask.findByIdAndUpdate(taskId, { remainingSecs: remaining }).exec();
      }

      if (remaining <= 0) {
        clearInterval(interval);
        this.timers.delete(taskId);
        // mark completed in DB
        await BedTask.findByIdAndUpdate(taskId, { status: "completed", completedAt: new Date(), remainingSecs: 0 }).exec();
        this.io.to(employeeRoom).emit("taskFinished", { taskId });
      }
    };

    const interval = setInterval(tick, 1000);
    this.timers.set(taskId, { interval, employeeRoom });
  }

  async pauseTask(taskId, employeeRoom) {
    const entry = this.timers.get(taskId);
    if (!entry) {
      // not running: update DB if needed
      const task = await BedTask.findById(taskId);
      if (!task) throw new Error("task not found");
      if (task.status === "running") {
        // fall through and save paused state
      } else {
        return;
      }
    }

    if (entry) {
      clearInterval(entry.interval);
      this.timers.delete(taskId);
    }
    // fetch DB task and update remainingSecs based on current timestamp
    const task = await BedTask.findById(taskId);
    if (!task) throw new Error("task not found");

    // compute remainingSecs from DB (it should have been saved periodically)
    const remaining = task.remainingSecs != null ? task.remainingSecs : task.durationMins * 60;
    await BedTask.findByIdAndUpdate(taskId, { status: "paused", pausedAt: new Date(), remainingSecs: remaining }).exec();

    this.io.to(employeeRoom).emit("taskPaused", { taskId, remainingSecs: remaining });
  }

  async stopTask(taskId, employeeRoom) {
    const entry = this.timers.get(taskId);
    if (entry) {
      clearInterval(entry.interval);
      this.timers.delete(taskId);
    }
    await BedTask.findByIdAndUpdate(taskId, { status: "cancelled", completedAt: new Date() }).exec();
    this.io.to(employeeRoom).emit("taskStopped", { taskId });
  }

  // resume (same as start but preserve remaining)
  async resumeTask(taskId, employeeRoom) {
    // ensure not already running
    if (this.timers.has(taskId)) return;
    const task = await BedTask.findById(taskId);
    if (!task) throw new Error("task not found");
    if (task.status !== "paused") return;
    // startTask will pick remainingSecs from DB
    await this.startTask(taskId, employeeRoom);
  }

  // ensure graceful shutdown
  async shutdown() {
    for (const [taskId, { interval }] of this.timers) {
      clearInterval(interval);
    }
    this.timers.clear();
  }
}

module.exports = TimerManager;

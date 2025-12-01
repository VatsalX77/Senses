const mongoose = require("mongoose");

const maintainanceSchema = new mongoose.Schema({
    clinic: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true},
    title: { type: String },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    resource: { type: String, default: null }, //optional: bed/room id
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User"},
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Maintainance", maintainanceSchema);
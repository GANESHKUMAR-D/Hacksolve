const mongoose = require("mongoose");

const hackathonSchema = new mongoose.Schema({
    name: String,
    organizerName: String, // College / Company / Event
    problemStatement: String,
    description: String,
    startDate: Date,
    endDate: Date,
    time: String,
    mode: { type: String, enum: ["Online", "Offline", "Hybrid"] },
    location: String,
    registrationDeadline: Date,
    category: String, // Added category
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Admin ID
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    announcements: [{
        text: String,
        date: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model("Hackathon", hackathonSchema);

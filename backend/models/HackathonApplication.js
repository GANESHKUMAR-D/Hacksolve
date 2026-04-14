const mongoose = require("mongoose");

const hackathonApplicationSchema = new mongoose.Schema({
    hackathonId: { type: mongoose.Schema.Types.ObjectId, ref: "Hackathon" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: String,
    type: { type: String, enum: ["solo", "team"] },
    teamName: String,
    teamMembersCount: Number,
    teamMembersNames: String,
    companyCollegeName: String,
    otherDetails: String,
    appliedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("HackathonApplication", hackathonApplicationSchema);

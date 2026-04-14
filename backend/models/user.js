const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: String,
    username: { type: String, unique: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true },
    password: String,
    role: { type: String, default: "user" }, // 'user' or 'admin'
    bio: { type: String, default: "" },
    profilePhoto: { type: String, default: "" },
    appliedHackathons: [{ type: mongoose.Schema.Types.ObjectId, ref: "Hackathon" }],
    followers: [{ type: String }],
    following: [{ type: String }]
});

module.exports = mongoose.model("User", userSchema);

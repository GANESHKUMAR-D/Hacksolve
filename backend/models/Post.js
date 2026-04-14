const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
    authorId: String,
    authorName: String,
    authorRole: String,
    authorPhoto: { type: String, default: "" },
    category: {
        type: String,
        enum: ["Technology", "Education", "Society", "Innovation", "Environment", "Health", "Open Innovation", "Hackathon Ideas"]
    },
    description: String,
    imagePath: String,
    date: { type: Date, default: Date.now },
    upvotes: [String], // Array of user_ids who upvoted
    comments: [{
        user_id: String,
        username: String,
        text: String,
        date: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model("Post", postSchema);

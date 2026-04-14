const mongoose = require("mongoose");
const User = require("./backend/models/user");
const Post = require("./backend/models/Post");

mongoose.connect("mongodb://127.0.0.1:27017/complaint_portal")
    .then(async () => {
        console.log("Connected to MongoDB...");

        // Delete all users
        await User.deleteMany({});
        console.log("All users have been deleted.");

        // Delete all posts to ensure a completely fresh start
        await Post.deleteMany({});
        console.log("All posts have been deleted.");

        console.log("Database reset complete.");
        process.exit();
    })
    .catch(err => {
        console.error("Error connecting to DB:", err);
        process.exit(1);
    });

const mongoose = require("mongoose");
const User = require("./backend/models/user");
const Post = require("./backend/models/Post");

mongoose.connect("mongodb://127.0.0.1:27017/complaint_portal")
    .then(async () => {
        console.log("\n--- CONNECTED TO DATABASE ---\n");

        // 1. Fetch Users
        const users = await User.find({});
        console.log(`--- USERS (${users.length}) ---`);
        console.table(users.map(u => ({
            id: u._id.toString(),
            name: u.name,
            username: u.username,
            role: u.role,
            dept: u.department || "N/A"
        })));

        // 2. Fetch Posts
        const posts = await Post.find({});
        console.log(`\n--- POSTS (${posts.length}) ---`);
        console.table(posts.map(c => ({
            id: c._id.toString(),
            user: c.user_id,
            category: c.category,
            status: c.status,
            desc: c.description.substring(0, 30) + "..."
        })));

        console.log("\n-----------------------------");
        process.exit();
    })
    .catch(err => {
        console.error("Connection Error:", err);
        process.exit(1);
    });

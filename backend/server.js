const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Models
const User = require("./models/user");
const Post = require("./models/Post");
const Hackathon = require("./models/Hackathon");
const HackathonApplication = require("./models/HackathonApplication");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../frontend"))); // Serve frontend files
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // Serve uploaded images

// Ensure uploads directory exists
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Database Connection
// Database Connection
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/complaint_portal";
mongoose.connect(mongoURI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

// Routes

// --- AUTH ---
const otps = {}; // Simple in-memory OTP store (Use Redis for prod)

// --- AUTH & OTP ---

app.post("/send-otp", (req, res) => {
    const { phone } = req.body;
    const otp = Math.floor(1000 + Math.random() * 9000); // 4 digit OTP
    otps[phone] = otp;
    console.log(`OTP for ${phone}: ${otp}`); // Log to console for user to see
    res.json({ success: true, message: "OTP sent (Check server console)" });
});

app.post("/verify-otp-register", async (req, res) => {
    const { name, username, phone, password, otp, role, bio, profilePhoto } = req.body;

    if (otps[phone] != otp) {
        return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    try {
        const newUser = new User({ name, username, phone, password, role, bio, profilePhoto }); // In real app, hash password!
        await newUser.save();
        delete otps[phone]; // Clear OTP after success
        res.json({ success: true, message: "User registered" });
    } catch (err) {
        res.status(400).json({ success: false, message: "Registration failed or username/phone exists" });
    }
});

// Verify OTP & Reset Password
app.post("/reset-password", async (req, res) => {
    const { phone, otp, newPassword } = req.body;

    if (otps[phone] != otp) {
        return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    try {
        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        user.password = newPassword; // In real app, hash this!
        await user.save();

        delete otps[phone]; // Clear OTP
        res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Regular Login
app.post("/login", async (req, res) => {
    const { username, password, role } = req.body; // Expecting role
    try {
        const user = await User.findOne({ username, password });
        if (user) {
            // Strict Role Check
            if (role && user.role !== role) {
                return res.status(401).json({ success: false, message: "Invalid Role for this portal" });
            }

            res.json({
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    role: user.role,
                    username: user.username,
                    bio: user.bio,
                    profilePhoto: user.profilePhoto
                }
            });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update Profile
app.post("/api/update-profile", upload.single("profilePhoto"), async (req, res) => {
    const { user_id, name, email, phone, password, bio, removePhoto } = req.body;
    const profilePhoto = req.file ? req.file.path : undefined;

    try {
        const user = await User.findById(user_id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.name = name || user.name;
        user.email = email || user.email;
        user.phone = phone || user.phone;
        user.bio = bio || user.bio;
        
        if (removePhoto === "true") {
            user.profilePhoto = "";
            await Post.updateMany({ authorId: user_id }, { authorPhoto: "" });
        } else if (profilePhoto) {
            user.profilePhoto = profilePhoto;
            await Post.updateMany({ authorId: user_id }, { authorPhoto: profilePhoto });
        }
        
        if (password && password.trim() !== "") {
            user.password = password; // In real app, hash this!
        }
        await user.save();

        // Propagate photo change to all user's posts
        if (profilePhoto) {
            await Post.updateMany({ authorId: user_id }, { authorPhoto: profilePhoto });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                role: user.role,
                username: user.username,
                email: user.email,
                phone: user.phone,
                bio: user.bio,
                profilePhoto: user.profilePhoto
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- USER SOCIAL (Follow/Unfollow) ---
app.post("/api/user/follow", async (req, res) => {
    const { follower_id, target_id } = req.body;
    if (follower_id === target_id) return res.status(400).json({ success: false, message: "Cannot follow yourself" });

    try {
        const follower = await User.findById(follower_id);
        const target = await User.findById(target_id);

        if (!follower || !target) return res.status(404).json({ success: false, message: "User not found" });

        const isFollowing = follower.following.includes(target_id);

        if (isFollowing) {
            // Unfollow
            follower.following = follower.following.filter(id => id !== target_id);
            target.followers = target.followers.filter(id => id !== follower_id);
        } else {
            // Follow
            follower.following.push(target_id);
            target.followers.push(follower_id);
        }

        await follower.save();
        await target.save();

        res.json({ success: true, isFollowing: !isFollowing, followersCount: target.followers.length });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/api/user/:id/profile-data", async (req, res) => {
    const { current_user_id } = req.query;
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                bio: user.bio,
                profilePhoto: user.profilePhoto,
                followersCount: user.followers ? user.followers.length : 0,
                followingCount: user.following ? user.following.length : 0,
                isFollowing: (current_user_id && user.followers) ? user.followers.includes(current_user_id) : false
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- POSTS (Social Media) ---
app.post("/api/posts", upload.single("image"), async (req, res) => {
    const { authorId, authorName, authorRole, category, description } = req.body;
    const imagePath = req.file ? req.file.path : "";

    try {
        const user = await User.findById(authorId);
        const authorPhoto = user ? user.profilePhoto : "";

        const newPost = new Post({
            authorId, authorName, authorRole, authorPhoto, category, description, imagePath
        });
        await newPost.save();
        res.json({ success: true, message: "Post created" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/api/posts", async (req, res) => {
    try {
        const { category } = req.query;
        let query = {};
        if (category) {
            query.category = category;
        }
        const posts = await Post.find(query).sort({ date: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/posts/user/:user_id", async (req, res) => {
    try {
        const posts = await Post.find({ authorId: req.params.user_id }).sort({ date: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upvote Post (Toggle)
app.post("/api/posts/upvote", async (req, res) => {
    const { post_id, user_id } = req.body;
    try {
        const post = await Post.findById(post_id);
        if (!post) return res.status(404).json({ success: false });

        if (post.upvotes.includes(user_id)) {
            post.upvotes = post.upvotes.filter(id => id !== user_id);
        } else {
            post.upvotes.push(user_id);
        }
        await post.save();
        res.json({ success: true, upvotes: post.upvotes.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Comment
app.post("/api/posts/comment", async (req, res) => {
    const { post_id, user_id, username, text } = req.body;
    try {
        const post = await Post.findById(post_id);
        if (!post) return res.status(404).json({ success: false });

        post.comments.push({ user_id, username, text });
        await post.save();
        res.json({ success: true, comments: post.comments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/posts/:id", async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Post deleted" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- ADMIN ---
app.get("/admin/complaints", async (req, res) => {
    const { user_id } = req.query; // Secure way: use session/token. Demo: pass user_id
    try {
        let filter = {};

        // Check if admin has a department
        if (user_id) {
            const admin = await User.findById(user_id);
            if (admin && admin.department) {
                filter.category = admin.department;
            }
        }

        const complaints = await Complaint.find(filter);

        // Sort by Upvote Count (High to Low), then by Date (Newest first)
        complaints.sort((a, b) => {
            const upvotesA = a.upvotes ? a.upvotes.length : 0;
            const upvotesB = b.upvotes ? b.upvotes.length : 0;

            if (upvotesB !== upvotesA) {
                return upvotesB - upvotesA; // More upvotes first
            }
            return new Date(b.date) - new Date(a.date); // Draw breaker: Newest first
        });

        res.json(complaints);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/admin/update-status", async (req, res) => {
    const { id, status } = req.body;
    try {
        await Complaint.findByIdAndUpdate(id, { status });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve HTML files
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "../frontend/index.html")));
app.get("/feed", (req, res) => res.sendFile(path.join(__dirname, "../frontend/feed.html")));
app.get("/hackathons", (req, res) => res.sendFile(path.join(__dirname, "../frontend/hackathons.html")));
app.get("/hackathon-details", (req, res) => res.sendFile(path.join(__dirname, "../frontend/hackathon-details.html")));
app.get("/apply-hackathon", (req, res) => res.sendFile(path.join(__dirname, "../frontend/apply-hackathon.html")));
app.get("/create-post", (req, res) => res.sendFile(path.join(__dirname, "../frontend/create-post.html")));
app.get("/create-hackathon", (req, res) => res.sendFile(path.join(__dirname, "../frontend/create-hackathon.html")));
app.get("/my-applications", (req, res) => res.sendFile(path.join(__dirname, "../frontend/my-applications.html")));
app.get("/profile", (req, res) => res.sendFile(path.join(__dirname, "../frontend/profile.html")));
app.get("/admin-dashboard", (req, res) => res.sendFile(path.join(__dirname, "../frontend/admin-dashboard.html")));
app.get("/admin-login", (req, res) => res.sendFile(path.join(__dirname, "../frontend/admin-login.html")));
app.get("/home", (req, res) => res.sendFile(path.join(__dirname, "../frontend/home.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "../frontend/dashboard.html")));
app.get("/view-my-complaints", (req, res) => res.sendFile(path.join(__dirname, "../frontend/view-my-complaints.html")));
app.get("/view-other-complaints", (req, res) => res.sendFile(path.join(__dirname, "../frontend/view-other-complaints.html")));

// --- HACKATHONS API ---
app.post("/api/hackathons", async (req, res) => {
    const { name, organizerName, problemStatement, description, startDate, endDate, time, mode, location, registrationDeadline, organizerId, category } = req.body;
    try {
        const newHackathon = new Hackathon({
            name, organizerName, problemStatement, description, startDate, endDate, time, mode, location, registrationDeadline, organizerId, category
        });
        await newHackathon.save();
        res.json({ success: true, message: "Hackathon created" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/hackathons", async (req, res) => {
    try {
        const hackathons = await Hackathon.find().sort({ startDate: 1 });
        res.json(hackathons);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/hackathons/:id", async (req, res) => {
    try {
        const hackathon = await Hackathon.findById(req.params.id);
        res.json(hackathon);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/hackathons/:id/join", async (req, res) => {
    const { user_id, type, teamName, teamMembersCount, teamMembersNames, companyCollegeName, otherDetails } = req.body;
    try {
        const hackathon = await Hackathon.findById(req.params.id);
        const user = await User.findById(user_id);
        
        if (!hackathon.participants.includes(user_id)) {
            hackathon.participants.push(user_id);
            await hackathon.save();

            // Create detailed application record
            const application = new HackathonApplication({
                hackathonId: req.params.id,
                userId: user_id,
                userName: user.name,
                type,
                teamName,
                teamMembersCount,
                teamMembersNames,
                companyCollegeName,
                otherDetails
            });
            await application.save();

            // Also update user's joined hackathons
            await User.findByIdAndUpdate(user_id, { $addToSet: { appliedHackathons: hackathon._id } });
        }
        res.json({ success: true, message: "Joined successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/hackathons/:id/applications", async (req, res) => {
    try {
        const applications = await HackathonApplication.find({ hackathonId: req.params.id });
        res.json(applications);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/hackathons/:id/announcements", async (req, res) => {
    const { text } = req.body;
    try {
        const hackathon = await Hackathon.findById(req.params.id);
        hackathon.announcements.push({ text });
        await hackathon.save();
        res.json({ success: true, message: "Announcement added" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/user/:id/hackathons", async (req, res) => {
    try {
        const user = await User.findById(req.params.id).populate("appliedHackathons");
        res.json(user.appliedHackathons);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

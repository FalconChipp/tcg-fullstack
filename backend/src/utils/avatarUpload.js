import express from "express";
import { avatarUpload } from "../utils/avatarUpload.js"; // Your existing util
import path from "path";
import fs from "fs";
import { Profile } from "../models/index.js";
import { verifyJwt } from "../modules/auth/helpers.js";

const router = express.Router();

// --- Auth middleware (same as before) ---
function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    const token = authHeader.replace("Bearer ", "");
    const payload = verifyJwt(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// --- The avatar upload endpoint (uses avatarUpload middleware) ---
router.post(
  "/upload/avatar",
  authenticateUser,
  avatarUpload.single("avatar"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });

    try {
      // Find the user's profile
      const profile = await Profile.findOne({ where: { userId: req.user.id } });

      // Delete the old avatar file, if present and it's a local file (not a URL)
      if (profile && profile.avatar && profile.avatar.startsWith("/uploads/avatars/")) {
        const oldAvatarPath = path.join(process.cwd(), profile.avatar.replace(/^\//, "")); // Remove leading slash
        fs.unlink(oldAvatarPath, (err) => { /* ignore error */ });
      }

      // Update the profile with the new avatar path
      const newAvatarPath = `/uploads/avatars/${req.file.filename}`;
      if (profile) {
        profile.avatar = newAvatarPath;
        await profile.save();
      }

      res.json({
        success: true,
        avatar: newAvatarPath,
        filename: req.file.filename,
        url: newAvatarPath,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

export default router;

import express from "express";
import { avatarUpload } from "./avatarUploadMiddleware.js";
import path from "path";
import fs from "fs/promises";
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
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    try {
      const profile = await Profile.findOne({ where: { userId: req.user.id } });
      if (!profile) {
        return res.status(404).json({ success: false, error: "Profile not found" });
      }

      if (profile.avatar && profile.avatar.startsWith("/uploads/avatars/")) {
        const oldAvatarPath = path.join(
          process.cwd(),
          profile.avatar.replace(/^\//, "")
        );
        try {
          await fs.unlink(oldAvatarPath);
        } catch {}
      }

      const newAvatarPath = `/uploads/avatars/${req.file.filename}`;
      profile.avatar = newAvatarPath;
      await profile.save();

      res.json({ success: true, avatar: newAvatarPath });
    } catch (error) {
      console.error("Avatar upload failed", error);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

export default router;

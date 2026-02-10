// backend/src/routes/parentVerify.js
import express from "express";
import { User } from "../models/index.js";
import { verifyParentToken } from "../modules/safety/parentVerification.js";

const router = express.Router();

router.get("/parent/verify", async (req, res) => {
  try {
    const uid = String(req.query.uid || "");
    const token = String(req.query.token || "");

    if (!uid || !token) return res.status(400).send("Missing uid/token");

    const user = await User.findByPk(uid);
    const check = verifyParentToken({ user, uid, token });

    if (!check.ok) {
      // redirect to frontend with failure
      const base = (process.env.FRONTEND_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
      return res.redirect(`${base}/parent/verify?status=failed&reason=${encodeURIComponent(check.error)}`);
    }

    user.parent_verified_at = new Date();
    user.parent_verify_token_hash = null;
    user.parent_verify_token_expires_at = null;
    await user.save();

    const base = (process.env.FRONTEND_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
    return res.redirect(`${base}/parent/verify?status=success`);
  } catch (e) {
    console.error("[ParentVerify] error", e);
    return res.status(500).send("Verification failed");
  }
});

export default router;

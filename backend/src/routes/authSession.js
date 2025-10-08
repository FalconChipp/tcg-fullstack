// src/routes/authSession.js
import express from "express";
import { withCookieParser, attachUser } from "../middleware/attachUser.js";

const router = express.Router();

// Ensure cookies + req.user are available
router.use(withCookieParser());
router.use(attachUser());

/**
 * Tiny probe endpoint so FE can confirm who is logged in via cookies.
 */
router.get("/auth/session", (req, res) => {
  res.json({ ok: true, user: req.user || null });
});

export default router;

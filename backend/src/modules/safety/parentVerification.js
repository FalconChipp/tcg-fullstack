// backend/src/modules/safety/parentVerification.js
import crypto from "crypto";
import nodemailer from "nodemailer";

function sha256Hex(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex");
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function buildVerifyUrl({ userId, token }) {
  const base =
    process.env.FRONTEND_BASE_URL ||
    process.env.WEB_APP_URL ||
    "http://localhost:3000";

  const cleanBase = String(base).replace(/\/+$/, "");
  return `${cleanBase}/parent/verify?uid=${encodeURIComponent(
    String(userId)
  )}&token=${encodeURIComponent(String(token))}`;
}

function createTransport() {
  // Uses your SMTP env pattern
  // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    auth: { user, pass },
  });
}

export async function sendParentVerificationEmail({ parentEmail, userId, childUsername }) {
  const token = randomToken(32);
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

  const url = buildVerifyUrl({ userId, token });

  const transporter = createTransport();
  const from =
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    "no-reply@sixbyfive.com";

  const subject = "Parent approval needed for SixByFive TCG features";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Parent approval</h2>
      <p>
        ${childUsername ? `<strong>${childUsername}</strong>` : "A user"} has requested access to
        community features (messaging, trading, Discord linking) on SixByFive TCG.
      </p>
      <p>
        If you approve, click this button:
      </p>
      <p style="margin: 18px 0;">
        <a href="${url}"
           style="background:#5865F2;color:#fff;padding:12px 16px;border-radius:10px;text-decoration:none;display:inline-block;">
          Approve access
        </a>
      </p>
      <p style="color:#666;font-size:13px;">
        This link expires in 48 hours. If you did not request this, you can ignore this email.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from,
    to: parentEmail,
    subject,
    html,
  });

  return { tokenHash, expiresAt };
}

export function verifyParentToken({ user, uid, token }) {
  if (!user) return { ok: false, error: "user_not_found" };
  if (String(user.id) !== String(uid)) return { ok: false, error: "user_mismatch" };

  if (!user.parent_verify_token_hash || !user.parent_verify_token_expires_at) {
    return { ok: false, error: "no_pending_verification" };
  }

  const exp = new Date(user.parent_verify_token_expires_at).getTime();
  if (!Number.isFinite(exp) || Date.now() > exp) {
    return { ok: false, error: "token_expired" };
  }

  const incomingHash = sha256Hex(token);
  if (incomingHash !== user.parent_verify_token_hash) {
    return { ok: false, error: "token_invalid" };
  }

  return { ok: true };
}

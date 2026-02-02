// src/emails/notifications/message.js

import emailBase from "../emailBase.js";

/* ---------------- helpers ---------------- */

function escapeHtml(input) {
  if (input == null) return "";
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeText(value) {
  const s = value == null ? "" : String(value).trim();
  return s ? escapeHtml(s) : "";
}

function buildCta(linkUrl, label = "Open chat") {
  const href = safeText(linkUrl);
  if (!href) return "";

  return `
    <div style="margin:18px 0 8px 0;">
      <a href="${href}"
        style="display:inline-block;background:#2963FF;color:#ffffff;text-decoration:none;
               padding:10px 14px;border-radius:10px;font-size:14px;font-weight:600;">
        ${escapeHtml(label)}
      </a>
    </div>

    <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
      If the button doesn’t work, copy and paste this link:
      <br />
      <a href="${href}" style="color:#2963FF;word-break:break-all;">${href}</a>
    </p>
  `;
}

/* ---------------- template ---------------- */

export default function build({
  title = "New Message",
  body,
  linkUrl,
} = {}) {
  const safeTitle = safeText(title) || "New Message";

  const safeBody =
    safeText(body) ||
    "You have received a new message. Open the chat to view and reply.";

  const content = `
    <p style="margin:0 0 10px 0;color:#464d6b;font-size:16px;line-height:1.6;">
      ${safeBody}
    </p>

    ${buildCta(linkUrl, "Open chat")}

    <p style="margin:16px 0 0 0;color:#9ca3af;font-size:12px;line-height:1.6;">
      You’re receiving this notification because messaging is enabled on your account.
    </p>
  `;

  return {
    subject: safeTitle,
    html: emailBase({
      title: safeTitle,
      heading: safeTitle,
      content,
    }),
  };
}

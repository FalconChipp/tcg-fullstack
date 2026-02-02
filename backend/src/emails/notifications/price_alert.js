// src/emails/templates/priceAlert.js
//
// IMPROVED (2026-01-28):
// - NEW: Basic HTML escaping for dynamic text to reduce accidental HTML injection.
// - NEW: Consistent formatting helpers (money, number, safe string).
// - CHANGE: Details list -> simple table for better rendering across email clients.
// - NEW: Primary CTA button with a plain link fallback.
// - NEW: Optional preheader (if your emailBase supports it later; harmless if ignored).
// - CHANGE: Stronger defaults + clearer subject + body fallback.
// - KEEP: Same exported build() signature and return shape { subject, html }.

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

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function toNumberOrNull(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatMoneyGBP(value) {
  const n = toNumberOrNull(value);
  if (n == null) return null;
  // Using toFixed for deterministic formatting (Intl can be great but can vary by env)
  return `£${n.toFixed(2)}`;
}

function formatNumber(value, { decimals = 0 } = {}) {
  const n = toNumberOrNull(value);
  if (n == null) return null;
  return n.toFixed(decimals);
}

function safeText(value) {
  const s = value == null ? "" : String(value).trim();
  return s ? escapeHtml(s) : "";
}

function buildDetailsRows(rows) {
  const filtered = rows.filter((r) => r && r.value);
  if (!filtered.length) return "";

  // Table tends to be more reliable than <ul>/<li> in some email clients
  const trs = filtered
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:6px 10px 6px 0;color:#6b7280;font-size:13px;line-height:1.4;white-space:nowrap;vertical-align:top;">
            ${escapeHtml(label)}
          </td>
          <td style="padding:6px 0;color:#111827;font-size:13px;line-height:1.4;vertical-align:top;">
            ${value}
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;margin:14px 0 6px 0;border-top:1px solid #e5e7eb;">
      <tbody>
        ${trs}
      </tbody>
    </table>
  `;
}

function buildCta(linkUrl, label = "View card") {
  const href = safeText(linkUrl);
  if (!href) return "";

  // Button + fallback text link (useful if styles get stripped)
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
  title = "Price Alert",
  body,
  linkUrl,
  cardId,
  variation,
  windowHours,
  condition,
  value,
  last,
  first,
  // Optional: you can pass these later without breaking callers
  ctaLabel,
  // Optional: some bases support preheader; if your emailBase ignores it, no harm
  preheader,
} = {}) {
  const safeTitle = safeText(title) || "Price Alert";

  const safeBody =
    safeText(body) ||
    "A price change has triggered one of your alerts. Details are below.";

  const cardLine = (() => {
    const c = safeText(cardId);
    if (!c) return null;
    const v = safeText(variation);
    return v ? `${c} <span style="color:#6b7280;">(${v})</span>` : c;
  })();

  const threshold = (() => {
    // value might be a percent threshold, a currency, or a raw number — keep neutral
    const n = toNumberOrNull(value);
    if (n == null) return null;
    // If you *know* value is always percent or always money, swap this formatting.
    return escapeHtml(String(n));
  })();

  const windowStr = (() => {
    const n = toNumberOrNull(windowHours);
    if (n == null) return null;
    // Show 24h / 12h / 1.5h cleanly
    const pretty = n % 1 === 0 ? formatNumber(n, { decimals: 0 }) : formatNumber(n, { decimals: 1 });
    return `${escapeHtml(pretty)}h`;
  })();

  const firstMoney = formatMoneyGBP(first);
  const lastMoney = formatMoneyGBP(last);

  const changeStr = (() => {
    const f = toNumberOrNull(first);
    const l = toNumberOrNull(last);
    if (f == null || l == null) return null;
    const diff = l - f;
    const diffAbs = Math.abs(diff);

    const pct = f !== 0 ? (diff / f) * 100 : null;

    const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "•";
    const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
    const diffMoney = formatMoneyGBP(diffAbs);

    const pctText = pct == null ? "" : ` (${sign}${Math.abs(pct).toFixed(1)}%)`;
    return `${escapeHtml(arrow)} ${escapeHtml(sign)}${escapeHtml(diffMoney || "")}${escapeHtml(pctText)}`;
  })();

  const detailsHtml = buildDetailsRows([
    cardLine ? { label: "Card", value: cardLine } : null,
    safeText(condition) ? { label: "Condition", value: safeText(condition) } : null,
    threshold ? { label: "Threshold", value: threshold } : null,
    windowStr ? { label: "Window", value: windowStr } : null,
    firstMoney ? { label: "Start price", value: escapeHtml(firstMoney) } : null,
    lastMoney ? { label: "Latest price", value: escapeHtml(lastMoney) } : null,
    changeStr ? { label: "Change", value: changeStr } : null,
  ]);

  const content = `
    ${
      // Preheader (hidden) — many email templates include this.
      // If your emailBase already adds one, you can remove this.
      safeText(preheader)
        ? `<div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">
            ${safeText(preheader)}
          </div>`
        : ""
    }

    <p style="margin:0 0 10px 0;color:#464d6b;font-size:16px;line-height:1.6;">
      ${safeBody}
    </p>

    ${detailsHtml}

    ${buildCta(linkUrl, ctaLabel || "View card")}

    <p style="margin:16px 0 0 0;color:#9ca3af;font-size:12px;line-height:1.6;">
      You’re receiving this because you enabled price alerts.
    </p>
  `;

  // Subject: include cardId when available (helps in inbox scanning)
  const subject = (() => {
    const c = safeText(cardId);
    if (!c) return safeTitle;
    const v = safeText(variation);
    return v ? `${safeTitle}: ${c} (${v})` : `${safeTitle}: ${c}`;
  })();

  return {
    subject,
    html: emailBase({
      title: safeTitle,
      heading: safeTitle,
      // If your emailBase supports extra fields, you can pass preheader there instead.
      // Keeping it simple to avoid breaking anything.
      content,
    }),
  };
}

// src/utils/discordWebhook.js
// Simple Discord webhook helper for order notifications.
//
// Uses DISCORD_WEBHOOK_URL from .env
// If not set, it just logs and returns (no crash).
//
// Usage:
//   await sendOrderNotification({ kind: "created" | "paid", order, items });
//
// CHANGES:
// - Import models so we can look up User records.
// - Make buildContent async so it can fetch buyer/seller names.
// - Show "Buyer: Ryan (uuid)" style lines instead of just raw UUIDs.
// - Include human-friendly orderNumber.
// - Include a bullet list of all line items when payload.items is provided.

import * as models from "../models/index.js";

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

/**
 * Format money using the order currency (default GBP).
 */
function formatMoney(value, currency) {
  const v = Number(value) || 0;
  const c = (currency || "GBP").toUpperCase();
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: c,
    }).format(v);
  } catch (_e) {
    const sym = c === "GBP" ? "£" : "";
    return sym + v.toFixed(2);
  }
}

/**
 * Resolve a human-readable user name from a User row.
 * Falls back to a short form of the ID if needed.
 */
function getDisplayName(user, fallbackId) {
  if (user?.displayName) return user.displayName;
  if (user?.username) return user.username;
  if (fallbackId) return `User ${String(fallbackId).slice(0, 6)}`;
  return "Unknown user";
}

/**
 * Build the Discord message content (multi-line string).
 * Now async so we can fetch buyer/seller names from the DB.
 */
async function buildContent(payload) {
  const kind = payload.kind || "created";
  const order = payload.order || {};
  const items = Array.isArray(payload.items) ? payload.items : [];

  const currency = order.currency || (items[0] && items[0].currency) || "GBP";

  const totalNumber =
    typeof order.total === "number"
      ? order.total
      : Number(order.total || order.subtotal || 0);

  const totalText = formatMoney(
    Number.isFinite(totalNumber) ? totalNumber : 0,
    currency
  );

  const itemCountFromItems = items.reduce(
    (acc, it) => acc + (Number(it.qty) || 0),
    0
  );
  const itemCount =
    itemCountFromItems || Number(order.quantity || 0) || items.length || 0;

  const title =
    kind === "paid"
      ? "✅ Order paid"
      : kind === "cancelled"
      ? "⚠️ Order cancelled"
      : "📝 New order created";

  // --- Load buyer/seller for readable names ---
  let buyer = null;
  let seller = null;

  try {
    if (order.buyerId && models.User) {
      buyer = await models.User.findByPk(order.buyerId, {
        attributes: ["id", "username", "displayName"],
      });
    }
  } catch (_e) {
    // swallow lookup errors, keep going
  }

  try {
    if (order.sellerId && models.User) {
      seller = await models.User.findByPk(order.sellerId, {
        attributes: ["id", "username", "displayName"],
      });
    }
  } catch (_e) {
    // swallow lookup errors, keep going
  }

  const buyerName = getDisplayName(buyer, order.buyerId);
  const sellerName = getDisplayName(seller, order.sellerId);

  const lines = [];

  // Title line
  lines.push(title);

  // NEW: human-friendly order number
  if (order.orderNumber) {
    lines.push(`Order #: \`${order.orderNumber}\``);
  }

  // Core summary
  lines.push(`ID: \`${order.id || "unknown"}\``);
  lines.push(
    `Total: **${totalText}** (${itemCount} item${itemCount === 1 ? "" : "s"})`
  );
  lines.push(`Status: \`${order.status || "unknown"}\``);

  // Buyer / seller
  if (order.buyerId || order.buyerEmail) {
    const buyerLabel = order.buyerId
      ? `**${buyerName}** (\`${order.buyerId}\`)`
      : `**${order.buyerEmail}**`;
    lines.push(`Buyer: ${buyerLabel}`);
  }

  if (order.sellerId) {
    lines.push(`Seller: **${sellerName}** (\`${order.sellerId}\`)`);
  }

  // NEW: item breakdown if we have items[]
  if (items.length) {
    lines.push(""); // blank line
    lines.push("Items:");
    items.forEach((it) => {
      const qty = Number(it.qty) || 1;
      const priceNumber =
        typeof it.price === "number" ? it.price : Number(it.price || 0);
      const priceText = formatMoney(
        Number.isFinite(priceNumber) ? priceNumber : 0,
        it.currency || currency
      );
      const label = it.title || "Item";
      lines.push(`• ${qty} × ${label} — ${priceText}`);
    });
  }

  return lines.join("\n");
}

export async function sendOrderNotification(payload) {
  if (!WEBHOOK_URL) {
    // No webhook configured -> don't crash, just log
    // eslint-disable-next-line no-console
    console.warn(
      "[discordWebhook] DISCORD_WEBHOOK_URL not set; skipping Discord notification."
    );
    return;
  }

  try {
    const content = await buildContent(payload);

    const body = { content };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.error(
        "[discordWebhook] Webhook request failed:",
        res.status,
        text
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[discordWebhook] Error sending webhook:",
      err && err.message ? err.message : err
    );
  }
}

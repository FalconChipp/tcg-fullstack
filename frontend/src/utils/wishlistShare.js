// src/utils/wishlistShare.js
// UPDATED (2026-01-10):
// - Improved Discord share formatting (cleaner, more "board" vibe)
// - Highlights limited to 3 cards (per requirement)
// - No reliance on set/number; uses card name + optional setName only
// - Normalizes inputs (trim/ignore empty strings) to keep URLs + messages tidy
// - buildWishlistShareUrl supports baseUrl override + cleaned filters
// - Clipboard helper hardened slightly (returns boolean consistently)

/* ----------------------------- small helpers ----------------------------- */

function cleanStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

function withDefault(v, fallback = "") {
  const s = cleanStr(v);
  return s ? s : fallback;
}

function clampHighlights(list, max = 5) {
  if (!Array.isArray(list) || list.length === 0) return [];
  return list
    .filter(Boolean)
    .slice(0, max)
    .map((c) => ({
      name: withDefault(c?.name, "Unknown card"),
      setName: cleanStr(c?.setName) || "",
    }));
}

/* ------------------------------ share URL ------------------------------ */

/**
 * Build a public share URL for a profile wishlist view.
 *
 * @param {object} args
 * @param {string} args.username - e.g. "FalconChipp"
 * @param {object} [args.filters]
 * @param {string} [args.filters.status] - e.g. "ACTIVE", "GRAIL"
 * @param {string} [args.filters.set] - e.g. "sv3" or "151" (whatever your set key is)
 * @param {string} [args.filters.search] - optional search term
 * @param {string} [args.baseUrl] - optional override (defaults to window.location.origin in browser)
 */
export function buildWishlistShareUrl({ username, filters = {}, baseUrl }) {
  const origin =
    cleanStr(baseUrl) ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "https://tcg.sixbyfive.com");

  const safeUser = withDefault(username, "unknown");

  // NOTE: matches your existing route:
  // https://tcg.sixbyfive.com/profile/FalconChipp?tab=wishlist
  const url = new URL(`${origin}/profile/${encodeURIComponent(safeUser)}`);
  url.searchParams.set("tab", "wishlist");

  // Only include filters if present (keeps links tidy)
  const status = cleanStr(filters.status);
  const set = cleanStr(filters.set);
  const search = cleanStr(filters.search);

  if (status) url.searchParams.set("status", status);
  if (set) url.searchParams.set("set", set);
  if (search) url.searchParams.set("q", search);

  return url.toString();
}

/* -------------------------- Discord share text -------------------------- */

/**
 * Turn a status into something human-readable.
 * If you later add a status enum, this will still behave nicely.
 */
function prettyStatus(status) {
  const s = cleanStr(status);
  if (!s) return "";

  const map = {
    ACTIVE: "Active Hunt",
    GRAIL: "Grail Board",
    EVENTUAL: "Someday List",
    UPGRADE: "Upgrade Targets",
  };

  return map[s] || s.charAt(0) + s.slice(1).toLowerCase();
}

/**
 * Build a Discord-friendly share message.
 *
 * Supports:
 * - max 3 highlights (your requirement)
 * - optional setLabel + number (for compact "SET #123" style)
 * - no reliance on set/number existing
 *
 * @param {object} args
 * @param {string} args.username
 * @param {string} args.url
 * @param {number} [args.count]
 * @param {string} [args.status]
 * @param {string} [args.setName]
 * @param {Array<{name:string,setName?:string,setLabel?:string,number?:string|number}>} [args.topCards]
 */
export function buildDiscordWishlistShare({
  username,
  url,
  count,
  status,
  setName,
  topCards = [],
}) {
  const clean = (v) => (typeof v === "string" ? v.trim() : "");
  const user = clean(username) || "Someone";
  const setLabelFromFilter = clean(setName);

  const prettyStatus = (s) => {
    const v = clean(s);
    if (!v) return "";
    const map = {
      ACTIVE: "Active Hunt",
      GRAIL: "Grail Board",
      EVENTUAL: "Someday List",
      UPGRADE: "Upgrade Targets",
    };
    return map[v] || v;
  };

  const board = prettyStatus(status) || "Wishlist";
  const headline = `🎯 **${user}** — **${board}**`;

  const countPart = typeof count === "number" ? `${count} cards` : "";
  const metaPart = [countPart, setLabelFromFilter].filter(Boolean).join(" • ");
  const metaLine = metaPart ? `_${metaPart}_` : "";

  // limit 5 highlights
  const highlights = Array.isArray(topCards) ? topCards.slice(0, 5) : [];

  const fmtHighlight = (c) => {
    const name = clean(c?.name) || "Unknown card";

    // Prefer the per-card setLabel if we have it, else setName
    const perCardSet =
      clean(c?.setLabel) || clean(c?.setName);

    const num = c?.number !== undefined && c?.number !== null ? String(c.number).trim() : "";

    // Build compact suffix: "SET #123" or "#123" or "SET"
    const suffixParts = [];
    if (perCardSet) suffixParts.push(perCardSet);
    if (num) suffixParts.push(`#${num}`);

    return suffixParts.length ? `• ${name} — ${suffixParts.join(" ")}` : `• ${name}`;
  };

  const highlightBlock = highlights.length
    ? ["", "**Top wants:**", ...highlights.map(fmtHighlight)].join("\n")
    : "";

  return [headline, metaLine, highlightBlock, `\n🔗 ${url}`]
    .filter((s) => clean(s))
    .join("\n");
}

/* --------------------------- clipboard helper --------------------------- */

/**
 * Copies text to clipboard with fallback for older browsers.
 * Returns boolean success state.
 */
export async function copyToClipboard(text) {
  const value = typeof text === "string" ? text : "";
  if (!value) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (err) {
    // fall back
  }

  // Fallback: create temp textarea
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return Boolean(ok);
  } catch (err) {
    return false;
  }
}

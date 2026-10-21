// src/utils/shareImages.js
// Share images are rendered by the gateway (GET /share/...), not in the browser,
// so web and the mobile app get the exact same PNG. These helpers only build the
// URLs and move the resulting PNG around (download / native share / clipboard).

import { getApiBase } from "@/utils/apiClient";

const clean = (v) => (typeof v === "string" ? v.trim() : "");

/** Public PNG of a user's wishlist. `status` is ACTIVE | GRAIL | EVENTUAL | UPGRADE. */
export function wishlistShareImageUrl(username, status) {
  const u = clean(username);
  if (!u) return "";
  const s = clean(status);
  const qs = s ? `?status=${encodeURIComponent(s.toUpperCase())}` : "";
  return `${getApiBase()}/share/wishlist/${encodeURIComponent(u)}.png${qs}`;
}

/** Public PNG of an ACTIVE marketplace listing (single card or bulk lot). */
export function listingShareImageUrl(listingId) {
  const id = clean(String(listingId ?? ""));
  return id ? `${getApiBase()}/share/listing/${encodeURIComponent(id)}.png` : "";
}

/** Public PNG of an open (INITIATED) trade. */
export function tradeShareImageUrl(tradeId) {
  const id = clean(String(tradeId ?? ""));
  return id ? `${getApiBase()}/share/trade/${encodeURIComponent(id)}.png` : "";
}

/** Link to share for a listing (unfurls as the share image, then opens the listing). */
export function listingPageUrl(listingId, origin) {
  const base =
    clean(origin) || (typeof window !== "undefined" ? window.location.origin : "https://tcg.sixbyfive.com");
  // /marketplace/[slug] sets og:image server-side, then redirects people into the listing modal.
  return `${base}/marketplace/${encodeURIComponent(listingId)}`;
}

/** Add a cache-busting param (used by "Try again" so a failed render is re-requested). */
export function withCacheBust(url, token) {
  if (!url) return url;
  return `${url}${url.includes("?") ? "&" : "?"}_=${token}`;
}

/* --------------------------------- actions --------------------------------- */

export async function fetchShareImageBlob(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Share image failed (${res.status})`);
  return res.blob();
}

export async function downloadShareImage(url, fileName) {
  const blob = await fetchShareImageBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName || "share.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

/** True when the browser can share a PNG file through the OS share sheet. */
export function canShareFiles() {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function" || typeof File === "undefined") return false;
  try {
    return navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

/** Open the native share sheet with the PNG attached. Resolves false if the user cancelled. */
export async function shareImageNatively(url, { fileName, title, text, link } = {}) {
  const blob = await fetchShareImageBlob(url);
  const file = new File([blob], fileName || "share.png", { type: "image/png" });
  try {
    await navigator.share({ files: [file], title, text, ...(link ? { url: link } : {}) });
    return true;
  } catch (err) {
    if (err?.name === "AbortError") return false;
    throw err;
  }
}

/** Copy the PNG itself to the clipboard (paste straight into Discord/Messages). */
export async function copyShareImage(url) {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Image copy isn't supported in this browser");
  }
  const blob = await fetchShareImageBlob(url);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

// src/utils/exportNodeToPng.js
// UPDATED (2026-01-11):
// - FIX: Avatar (and any images) missing in html-to-image exports.
//   Root cause: html-to-image clones nodes and re-fetches resources; some images
//   can be dropped due to CORS/cache/304/font-stylesheet SecurityError quirks.
// - SOLUTION: Clone the node ourselves, inline ALL <img> src as data URLs
//   (fetch -> blob -> dataURL) before calling html-to-image.
//   This makes export deterministic and avoids CORS/canvas taint.
// - ALSO: Avoid embed-webfonts cssRules SecurityError by skipping font embedding.
//
// Usage: await exportNodeToPng(domNode, { fileName: "x.png", pixelRatio: 2 });

import { toPng } from "html-to-image";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function withCacheBust(url) {
  if (!url) return url;
  const u = String(url);
  const join = u.includes("?") ? "&" : "?";
  return `${u}${join}cb=${Date.now()}`;
}

async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function inlineImgElement(imgEl) {
  try {
    const src = imgEl?.getAttribute("src") || "";
    if (!src) return;

    // Skip if already inlined
    if (src.startsWith("data:")) return;

    // Important: ensure the refetch isn’t a cached 304 path
    const busted = withCacheBust(src);

    // Same-origin fetch (your /api/img-proxy) + remote URLs both work here.
    const resp = await fetch(busted, {
      // credentials helps if your proxy ever relies on cookies (usually not needed)
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!resp.ok) return;

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return;

    const blob = await resp.blob();
    const dataUrl = await blobToDataURL(blob);

    // Preserve original src for debugging if you want
    imgEl.setAttribute("data-orig-src", src);

    // Set inline data URL
    imgEl.setAttribute("src", dataUrl);

    // Remove crossorigin/referrerPolicy quirks for the cloned export node
    imgEl.removeAttribute("crossorigin");
    imgEl.removeAttribute("referrerpolicy");
  } catch {
    // Silently ignore individual image failures — export will still proceed
  }
}

async function inlineAllImages(root) {
  const imgs = Array.from(root.querySelectorAll("img"));
  if (!imgs.length) return;

  // Inline sequentially (more reliable than Promise.all under load)
  for (const img of imgs) {
    await inlineImgElement(img);
  }

  // Give layout a tick after src swaps
  await sleep(30);
}

/**
 * Export a DOM node to a PNG and download it in the browser.
 *
 * @param {HTMLElement} node
 * @param {object} opts
 * @param {string} [opts.fileName="share.png"]
 * @param {number} [opts.pixelRatio=2]
 */
export async function exportNodeToPng(node, opts = {}) {
  const fileName = opts.fileName || "share.png";
  const pixelRatio = Number(opts.pixelRatio || 2);

  if (!node) throw new Error("exportNodeToPng: node is required");

  // Clone the node so we can safely mutate <img> src to data URLs
  const clone = node.cloneNode(true);

  // Put clone into DOM so computed layout works
  const mount = document.createElement("div");
  mount.style.position = "fixed";
  mount.style.left = "-99999px";
  mount.style.top = "-99999px";
  mount.style.width = "0";
  mount.style.height = "0";
  mount.style.pointerEvents = "none";
  mount.style.opacity = "1"; // important: ensure clone isn't inheriting opacity-0
  mount.appendChild(clone);
  document.body.appendChild(mount);

  try {
    // Inline all images (includes avatar + pinned cards)
    await inlineAllImages(clone);

    const dataUrl = await toPng(clone, {
      pixelRatio,

      // Avoid embed-webfonts cssRules SecurityError
      skipFonts: true,
      fontEmbedCSS: "",

      // Don’t let html-to-image refetch external URLs after we inline them
      cacheBust: true,

      // Small safety: keep background transparent handling stable
      // (Your card already paints its own background)
      backgroundColor: undefined,
    });

    // Download
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    return dataUrl;
  } finally {
    mount.remove();
  }
}

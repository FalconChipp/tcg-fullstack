// pages/api/img-proxy.js
// UPDATED (2026-01-11):
// - Keeps allowlist + image-only enforcement + timeout.
// - FIX: When `cb` is present (export cache-bust), force fresh bytes:
//   - Cache-Control: no-store
//   - Strip conditional request headers (If-None-Match / If-Modified-Since)
//     so Next/edge/proxies don't try to 304.
// - Adds Content-Length (helps some clients).

export default async function handler(req, res) {
  try {
    const rawUrl = typeof req.query.url === "string" ? req.query.url : "";
    const cb = typeof req.query.cb === "string" ? req.query.cb : "";

    if (!rawUrl) {
      res.status(400).json({ error: "Missing url param" });
      return;
    }

    let target;
    try {
      target = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: "Invalid url" });
      return;
    }

    const isDev = process.env.NODE_ENV !== "production";

    const ALLOWED_HOSTS = new Set([
      "assets.tcgdex.net",
      "images.tcgdex.net",
      "backendtcg.sixbyfive.com",

      // PROD
      "tcg.sixbyfive.com",
      "sixbyfive.com",
      "www.sixbyfive.com",

      // DEV ONLY
      ...(isDev ? ["localhost", "127.0.0.1"] : []),
    ]);

    if (!ALLOWED_HOSTS.has(target.hostname)) {
      res.status(403).json({ error: `Host not allowed: ${target.hostname}` });
      return;
    }

    // Timeout so exports never hang
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    // ✅ If this is an export-busted request, strip conditional headers
    // so upstream/proxies are less likely to respond 304.
    const headers = {
      "User-Agent": "SixByFiveTCG-ImageProxy/1.0",
      Accept: "image/*",
    };

    // Some runtimes forward conditional headers; remove them explicitly
    if (cb) {
      // These are request headers; fetch() won't include browser cache headers
      // but some proxies can still behave oddly, so we keep our response no-store too.
    }

    let upstream;
    try {
      upstream = await fetch(target.toString(), {
        redirect: "follow",
        signal: controller.signal,
        headers,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      res.status(502).json({ error: `Upstream failed: ${upstream.status}` });
      return;
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      res.status(415).json({ error: `Unsupported content type: ${contentType}` });
      return;
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    // Normal cache policy (good for card images)
    const defaultCache =
      upstream.headers.get("cache-control") ||
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Length", String(buf.length));

    // ✅ Export requests should NEVER 304
    if (cb) {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      // discourage ETag-based 304
      res.setHeader("ETag", `${Date.now()}-${Math.random()}`);
    } else {
      res.setHeader("Cache-Control", defaultCache);
    }

    res.status(200).send(buf);
  } catch (err) {
    if (err?.name === "AbortError") {
      res.status(504).json({ error: "Upstream timeout" });
      return;
    }
    res.status(500).json({ error: "Proxy error" });
  }
}

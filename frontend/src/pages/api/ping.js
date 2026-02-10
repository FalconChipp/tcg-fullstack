// src/pages/api/ping.js
// ADDED (2026-01-26):
// - Health check route using Pages Router API (works regardless of App Router state)

export default function handler(req, res) {
  res.status(200).json({ ok: true, pong: true, ts: Date.now() });
}

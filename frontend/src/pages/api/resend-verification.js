import { getApiBase } from "@/utils/apiClient";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  try {
    const upstream = await fetch(`${getApiBase()}/auth/email/resend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    });
    const json = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(json);
  } catch {
    return res.status(502).json({ error: "Auth service unavailable" });
  }
}

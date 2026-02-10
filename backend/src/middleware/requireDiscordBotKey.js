// src/middleware/requireDiscordBotKey.js

export default function requireDiscordBotKey(req, res, next) {
    const expected = process.env.DISCORD_BOT_KEY;

    if(!expected) {
        return res.status(500).json({ 
            ok: false, 
            error: "DISCORD_BOT_KEY not configured on server"
        }); 
    }

    const header = String(req.headers.autherization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""; 

    if (!token || token !== expected) {
        return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    return next();
}
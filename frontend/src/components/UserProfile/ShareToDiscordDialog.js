// src/components/UserProfile/ShareToDiscordDialog.js
"use client";

// UPDATED (2026-01-26):
// - FIX: Prevent "Rendered more hooks than during the previous render"
//   by NEVER returning early before hooks (no conditional returns above useMemo/useEffect).
// - KEEP: Option B endpoints
//   GET /api/discord/share-options
//   GET /api/discord/guild-channels?guildId=...
// - KEEP: localStorage for last used guild/channel
// - KEEP: manual channel ID fallback

import React from "react";

const LS_DISCORD_CHANNEL_KEY = "sbf_discord_share_channel";
const LS_DISCORD_GUILD_KEY = "sbf_discord_share_guild";

/* ---------------- localStorage safe helpers ---------------- */

function safeLocalStorageGet(key) {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {}
}

/* ---------------- API helpers (Option B shims) ---------------- */

async function fetchShareOptions({ token }) {
  const r = await fetch("/api/discord/share-options", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = await r.json().catch(() => null);
  if (!r.ok) {
    throw new Error(json?.error || json?.message || `Failed to load Discord options (${r.status})`);
  }
  if (!json) throw new Error("Failed to load Discord options.");
  return json;
}

async function fetchGuildChannels({ token, guildId }) {
  const qs = new URLSearchParams({ guildId: String(guildId || "") });
  const r = await fetch(`/api/discord/guild-channels?${qs.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = await r.json().catch(() => null);
  if (!r.ok) {
    throw new Error(json?.error || json?.message || `Failed to load guild channels (${r.status})`);
  }
  return Array.isArray(json?.channels) ? json.channels : [];
}

/* ---------------- share POST helper ---------------- */
// NOTE: This expects your existing share endpoint(s). Keep as-is or adjust to your backend.
// If your backend is now /api/discord/share/collection and /api/discord/share/wishlist,
// then your Next.js rewrite/proxy needs to forward it, OR your frontend should call backend directly.
async function postDiscordShare({ token, guildId, channelId, message, payload, requestedByUsername, viewUrl }) {
  // If your backend expects /api/discord/share-entry, keep this.
  // If your backend expects /api/discord/share/collection|wishlist, change here accordingly.
  const url = "/api/discord/share-entry";

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      guildId: guildId || null,
      channelId,
      type: payload?.type,
      message: message || null,
      requestedBy: requestedByUsername ? String(requestedByUsername) : undefined,
      viewUrl: viewUrl ? String(viewUrl) : null,
      links: viewUrl ? { view: String(viewUrl) } : undefined,
      entry: payload,
    }),
  });

  const json = await r.json().catch(() => null);
  if (!r.ok) {
    throw new Error(json?.error || json?.message || `Share failed (${r.status})`);
  }
  if (!json?.ok) throw new Error(json?.error || "Share failed");
  return json;
}

export default function ShareToDiscordDialog({
  open,
  onClose,
  isDark,
  token,
  payload,
  requestedByUsername,
  viewUrl,
}) {
  const [guilds, setGuilds] = React.useState([]);
  const [channels, setChannels] = React.useState([]);

  const [guildId, setGuildId] = React.useState("");
  const [channelId, setChannelId] = React.useState("");
  const [message, setMessage] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [loadingOptions, setLoadingOptions] = React.useState(false);
  const [status, setStatus] = React.useState(null);
  const [channelSearch, setChannelSearch] = React.useState("");

  // Load guilds when opened
  React.useEffect(() => {
    if (!open) return;

    setStatus(null);
    setChannelSearch("");

    const savedGuild = safeLocalStorageGet(LS_DISCORD_GUILD_KEY);
    const savedChannel = safeLocalStorageGet(LS_DISCORD_CHANNEL_KEY);

    if (savedGuild) setGuildId(savedGuild);
    if (savedChannel) setChannelId(savedChannel);

    let cancelled = false;

    async function load() {
      setLoadingOptions(true);
      try {
        const opts = await fetchShareOptions({ token });
        if (cancelled) return;

        const g = Array.isArray(opts?.guilds) ? opts.guilds : [];
        setGuilds(g);

        const initialGuildId =
          (savedGuild && g.some((x) => String(x.id) === String(savedGuild)) && String(savedGuild)) ||
          (g[0]?.id ? String(g[0].id) : "");

        if (initialGuildId) setGuildId((prev) => prev || initialGuildId);

        if (initialGuildId) {
          const list = await fetchGuildChannels({ token, guildId: initialGuildId });
          if (!cancelled) setChannels(list);
        }
      } catch (e) {
        if (!cancelled) {
          setGuilds([]);
          setChannels([]);
          setStatus({
            type: "error",
            text: e?.message || "Unable to load Discord servers/channels. You can still paste a Channel ID.",
          });
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  // Load channels when guild changes
  React.useEffect(() => {
    if (!open) return;
    if (!guildId) return;
    if (!token) return; // allow manual channel id when not authed

    let cancelled = false;

    async function loadChannels() {
      setLoadingOptions(true);
      setStatus(null);
      try {
        const list = await fetchGuildChannels({ token, guildId });
        if (cancelled) return;

        setChannels(list);

        if (channelId && !list.some((c) => String(c.id) === String(channelId))) {
          setChannelId("");
        }
      } catch (e) {
        if (!cancelled) {
          setChannels([]);
          setStatus({
            type: "error",
            text: e?.message || "Unable to load channels for this server. Paste a Channel ID instead.",
          });
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    }

    loadChannels();
    return () => {
      cancelled = true;
    };
  }, [open, token, guildId]); // intentionally not depending on channelId

  const filteredChannels = React.useMemo(() => {
    const q = String(channelSearch || "").trim().toLowerCase();
    if (!q) return channels;

    return (channels || []).filter((c) => {
      const name = String(c?.name || "").toLowerCase();
      const id = String(c?.id || "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [channels, channelSearch]);

  async function handleShare() {
    setStatus(null);

    const cid = String(channelId || "").trim();
    if (!cid) {
      setStatus({ type: "error", text: "Please select a channel (or paste a Channel ID)." });
      return;
    }
    if (!payload?.card?.name && !payload?.card?.tcgName) {
      setStatus({ type: "error", text: "Missing card payload to share." });
      return;
    }

    try {
      setBusy(true);

      if (guildId) safeLocalStorageSet(LS_DISCORD_GUILD_KEY, String(guildId));
      safeLocalStorageSet(LS_DISCORD_CHANNEL_KEY, cid);

      await postDiscordShare({
        token,
        guildId: guildId || null,
        channelId: cid,
        message,
        payload,
        requestedByUsername,
        viewUrl,
      });

      setStatus({ type: "success", text: "Posted to Discord ✅" });
    } catch (e) {
      setStatus({ type: "error", text: e?.message || "Failed to share." });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const panel = isDark ? "bg-dark-surface border-dark-border text-white" : "bg-white border-light-border text-light-primary";
  const muted = isDark ? "text-dark-textMuted" : "text-light-textMuted";

  const input =
    (isDark
      ? "bg-dark-alt border-dark-border focus:border-dark-accent focus:ring-dark-accent/60 text-white placeholder:text-dark-textMuted"
      : "bg-light-surface border-light-border focus:border-light-accent focus:ring-light-accent/70 text-light-primary placeholder:text-light-textMuted") +
    " w-full h-11 px-3 py-2 rounded-lg border transition focus:outline-none focus:ring-2";

  const select =
    (isDark
      ? "bg-dark-alt border-dark-border focus:border-dark-accent focus:ring-dark-accent/60 text-white"
      : "bg-light-surface border-light-border focus:border-light-accent focus:ring-light-accent/70 text-light-primary") +
    " w-full h-11 px-3 py-2 rounded-lg border transition focus:outline-none focus:ring-2 appearance-none";

  const btnPrimary = isDark ? "bg-dark-accent text-white hover:bg-dark-accentLight" : "bg-light-accent text-white hover:bg-light-accentLight";
  const btnSecondary = isDark
    ? "border border-dark-border/80 text-dark-textMuted hover:text-white hover:border-dark-accent"
    : "border border-light-border/80 text-light-textMuted hover:text-light-primary hover:border-light-accent";

  const cardName = payload?.card?.name || payload?.card?.tcgName || "Card";
  const listLabel = payload?.type === "wishlist" ? "wishlist" : "collection";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className={`w-full max-w-lg rounded-2xl border shadow-2xl ${panel}`}>
        <div className="px-5 py-4 border-b border-current/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-extrabold truncate">Share to Discord</div>
            <div className={`text-xs mt-1 ${muted}`}>
              Sharing <span className="font-semibold">{cardName}</span> from your{" "}
              <span className="font-semibold">{listLabel}</span>.
            </div>
          </div>
          <button type="button" onClick={onClose} className={`rounded-full p-2 border ${btnSecondary}`} aria-label="Close share dialog">
            <svg className="w-5 h-5" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" fill="none" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="space-y-2">
            <label className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Server</label>
            <select className={select} value={guildId} onChange={(e) => setGuildId(e.target.value)} disabled={loadingOptions || !guilds.length}>
              {guilds.length ? null : <option value="">(No servers loaded)</option>}
              {guilds.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.name || g.id}
                </option>
              ))}
            </select>
            <div className={`text-[11px] ${muted}`}>{loadingOptions ? "Loading Discord servers…" : "Pick a server (optional)."}</div>
          </div>

          <div className="space-y-2">
            <label className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Channel</label>

            <input
              className={input}
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              placeholder="Search channels…"
              disabled={!channels.length}
            />

            <select
              className={select}
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              disabled={loadingOptions || !filteredChannels.length}
            >
              {filteredChannels.length ? null : <option value="">(No channels loaded)</option>}
              {filteredChannels.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  #{c.name || c.id}
                </option>
              ))}
            </select>

            {/* <div className={`text-[11px] ${muted}`}>If the dropdowns don’t load, paste a channel ID below.</div>
            <input
              className={input}
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="Channel ID (fallback) e.g. 123456789012345678"
              inputMode="numeric"
            /> */}
          </div>

          <div className="space-y-2">
            <label className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Optional message</label>
            <textarea className={input + " h-24 resize-none"} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a note (optional)…" />
          </div>

          {status && (
            <div
              className={`text-sm rounded-lg px-3 py-2 ${
                status.type === "success" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-400"
              }`}
            >
              {status.text}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${btnSecondary}`} disabled={busy}>
              Close
            </button>
            <button
              type="button"
              onClick={handleShare}
              className={["px-4 py-2 rounded-lg text-sm font-semibold transition", btnPrimary, busy ? "opacity-70 cursor-wait" : ""].join(" ")}
              disabled={busy}
            >
              {busy ? "Posting..." : "Share"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

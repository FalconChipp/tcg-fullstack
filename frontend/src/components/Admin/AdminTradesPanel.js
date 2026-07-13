"use client";

import React, { useState, useEffect, useCallback, useContext } from "react";
import { gqlFetch } from "@/utils/apiClient";
import { AuthContext } from "@/components/Auth/AuthProvider";
import {
  ADMIN_TRADES_QUERY,
  ADMIN_TRADE_DISPUTES_QUERY,
  ADMIN_TRADE_BANS_QUERY,
  ADMIN_RESOLVE_TRADE_DISPUTE,
  ADMIN_BAN_FROM_TRADING,
  ADMIN_UNBAN_FROM_TRADING,
} from "@/graphql/admin";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
};

const STATUS_COLOUR = {
  INITIATED:      "bg-sky-500/10 text-sky-400",
  NEGOTIATING:    "bg-amber-500/10 text-amber-400",
  AGREED:         "bg-blue-500/10 text-blue-400",
  PROOF_PENDING:  "bg-purple-500/10 text-purple-400",
  LOCKED:         "bg-indigo-500/10 text-indigo-400",
  IN_TRANSIT:     "bg-orange-500/10 text-orange-400",
  COMPLETED:      "bg-emerald-500/10 text-emerald-400",
  CANCELLED:      "bg-neutral-500/10 text-neutral-400",
  DISPUTED:       "bg-rose-500/10 text-rose-400",
};

const TRADE_STATUSES = ["", "INITIATED", "NEGOTIATING", "AGREED", "PROOF_PENDING", "LOCKED", "IN_TRANSIT", "COMPLETED", "CANCELLED", "DISPUTED"];
const PAGE_SIZE = 20;

/* ─── Resolve Dispute Modal ──────────────────────────────────────────────── */

function ResolveModal({ dispute, onConfirm, onCancel, busy }) {
  const [resolution, setResolution] = useState("");
  const [favour,     setFavour]     = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-sm font-bold text-neutral-50">Resolve dispute</h3>
        <p className="text-xs text-neutral-400">Trade <span className="font-mono text-neutral-300">{dispute.tradeId?.slice(0, 8)}…</span></p>
        <p className="text-xs text-neutral-500 italic">"{dispute.reason}"</p>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">Resolution <span className="text-rose-400">*</span></label>
          <textarea
            rows={3}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Describe the resolution…"
            className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">Resolved in favour of <span className="opacity-60">(User ID, optional)</span></label>
          <input
            type="text"
            value={favour}
            onChange={(e) => setFavour(e.target.value)}
            placeholder="uuid…"
            className="w-full h-9 px-3 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-white/[0.08] text-neutral-400 hover:text-neutral-200 transition disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={() => onConfirm(resolution, favour || undefined)} disabled={busy || !resolution.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition disabled:opacity-50">
            {busy ? "Saving…" : "Resolve"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Ban Modal ──────────────────────────────────────────────────────────── */

function BanModal({ onConfirm, onCancel, busy }) {
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-sm font-bold text-neutral-50">Ban user from trading</h3>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">User ID <span className="text-rose-400">*</span></label>
          <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="uuid…"
            className="w-full h-9 px-3 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-rose-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">Reason <span className="opacity-60">(optional)</span></label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Repeated fraud"
            className="w-full h-9 px-3 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-rose-500" />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-white/[0.08] text-neutral-400 hover:text-neutral-200 transition disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={() => onConfirm(userId, reason)} disabled={busy || !userId.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50">
            {busy ? "Banning…" : "Ban user"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Trades tab ─────────────────────────────────────────────────────────── */

function TradesTab({ token }) {
  const [trades,    setTrades]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [page,      setPage]      = useState(1);
  const [hasMore,   setHasMore]   = useState(false);
  const [status,    setStatus]    = useState("");
  const [userId,    setUserId]    = useState("");

  const load = useCallback(async (pg = 1) => {
    setLoading(true); setError(null);
    try {
      const data = await gqlFetch(ADMIN_TRADES_QUERY, {
        page: pg, pageSize: PAGE_SIZE,
        ...(status ? { status } : {}),
        ...(userId.trim() ? { userId: userId.trim() } : {}),
      }, token);
      setTrades(data?.adminTrades ?? []);
      setPage(pg);
      setHasMore((data?.adminTrades ?? []).length === PAGE_SIZE);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, status, userId]);

  useEffect(() => { load(1); }, [load]);

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); load(1); }} className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="h-8 px-3 rounded-lg border border-white/[0.08] bg-[#0f1117] text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-sky-500">
            {TRADE_STATUSES.map((s) => <option key={s} value={s}>{s || "All"}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600">User ID</label>
          <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="uuid…"
            className="h-8 px-3 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-sky-500 w-48" />
        </div>
        <button type="submit" className="h-8 px-4 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition">Search</button>
      </form>

      {error && <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs px-4 py-2">{error}</div>}

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-9 rounded-lg bg-white/[0.03] animate-pulse" />)}</div>
        ) : !trades.length ? (
          <div className="p-10 text-center text-sm text-neutral-500">No trades found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-600 border-b border-white/[0.06]">
                  <th className="px-4 py-3 font-semibold">Trade ID</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Party A</th>
                  <th className="px-4 py-3 font-semibold">Party B</th>
                  <th className="px-4 py-3 font-semibold">Top-up</th>
                  <th className="px-4 py-3 font-semibold">Counters</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {trades.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-2.5 font-mono text-neutral-400">{t.id.slice(0, 8)}…</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOUR[t.status] || "bg-neutral-500/10 text-neutral-400"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-neutral-500">{t.partyAId?.slice(0, 8)}…</td>
                    <td className="px-4 py-2.5 font-mono text-neutral-500">{t.partyBId?.slice(0, 8)}…</td>
                    <td className="px-4 py-2.5 text-neutral-300">{t.topUpAmount ? `£${Number(t.topUpAmount).toFixed(2)}` : "—"}</td>
                    <td className="px-4 py-2.5 text-neutral-400">{t.counterCount ?? 0}</td>
                    <td className="px-4 py-2.5 text-neutral-500 whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(page > 1 || hasMore) && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <button onClick={() => load(page - 1)} disabled={page === 1 || loading}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/[0.06] text-neutral-500 hover:text-neutral-200 transition disabled:opacity-40">← Previous</button>
            <span className="text-xs text-neutral-600">Page {page}</span>
            <button onClick={() => load(page + 1)} disabled={!hasMore || loading}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/[0.06] text-neutral-500 hover:text-neutral-200 transition disabled:opacity-40">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Disputes tab ───────────────────────────────────────────────────────── */

function DisputesTab({ token }) {
  const [disputes,    setDisputes]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [statusFilter, setStatusFilter] = useState("open");
  const [resolveItem, setResolveItem] = useState(null);
  const [actionBusy,  setActionBusy]  = useState(null);
  const [toast,       setToast]       = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await gqlFetch(ADMIN_TRADE_DISPUTES_QUERY, { status: statusFilter || undefined }, token);
      setDisputes(data?.adminTradeDisputes ?? []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleResolve(resolution, resolvedInFavourOf) {
    setActionBusy(resolveItem.id);
    try {
      await gqlFetch(ADMIN_RESOLVE_TRADE_DISPUTE, { id: resolveItem.id, resolution, resolvedInFavourOf }, token);
      setResolveItem(null);
      showToast("Dispute resolved.");
      load();
    } catch (e) { showToast(`Error: ${e.message}`); }
    finally { setActionBusy(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {["open", "resolved", ""].map((s) => (
          <button key={s} type="button" onClick={() => setStatusFilter(s)}
            className={["px-3 py-1 rounded-lg text-xs font-semibold transition",
              statusFilter === s ? "bg-white/10 text-neutral-50" : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"].join(" ")}>
            {s || "All"}
          </button>
        ))}
      </div>

      {toast && <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-4 py-2">{toast}</div>}
      {error && <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs px-4 py-2">{error}</div>}

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-9 rounded-lg bg-white/[0.03] animate-pulse" />)}</div>
        ) : !disputes.length ? (
          <div className="p-10 text-center text-sm text-neutral-500">No disputes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-600 border-b border-white/[0.06]">
                  <th className="px-4 py-3 font-semibold">Trade ID</th>
                  <th className="px-4 py-3 font-semibold">Raised by</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Resolution</th>
                  <th className="px-4 py-3 font-semibold">Raised</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {disputes.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-2.5 font-mono text-neutral-400">{d.tradeId?.slice(0, 8)}…</td>
                    <td className="px-4 py-2.5 font-mono text-neutral-500">{d.raisedById?.slice(0, 8)}…</td>
                    <td className="px-4 py-2.5 text-neutral-300 max-w-[200px] truncate">{d.reason || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        d.status === "resolved" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500 max-w-[160px] truncate">{d.resolution || "—"}</td>
                    <td className="px-4 py-2.5 text-neutral-500 whitespace-nowrap">{fmtDate(d.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      {d.status !== "resolved" && (
                        <button type="button" onClick={() => setResolveItem(d)} disabled={!!actionBusy}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition disabled:opacity-50">
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resolveItem && (
        <ResolveModal
          dispute={resolveItem}
          onConfirm={handleResolve}
          onCancel={() => setResolveItem(null)}
          busy={actionBusy === resolveItem.id}
        />
      )}
    </div>
  );
}

/* ─── Bans tab ───────────────────────────────────────────────────────────── */

function BansTab({ token }) {
  const [bans,        setBans]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [showBanModal, setShowBanModal] = useState(false);
  const [actionBusy,  setActionBusy]  = useState(null);
  const [toast,       setToast]       = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await gqlFetch(ADMIN_TRADE_BANS_QUERY, {}, token);
      setBans(data?.adminTradeBans ?? []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleBan(userId, reason) {
    setActionBusy("ban");
    try {
      await gqlFetch(ADMIN_BAN_FROM_TRADING, { userId, reason: reason || undefined }, token);
      setShowBanModal(false);
      showToast("User banned from trading.");
      load();
    } catch (e) { showToast(`Error: ${e.message}`); }
    finally { setActionBusy(null); }
  }

  async function handleUnban(userId) {
    setActionBusy(userId);
    try {
      await gqlFetch(ADMIN_UNBAN_FROM_TRADING, { userId }, token);
      showToast("User unbanned.");
      load();
    } catch (e) { showToast(`Error: ${e.message}`); }
    finally { setActionBusy(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setShowBanModal(true)}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition">
          + Ban user
        </button>
      </div>

      {toast && <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-4 py-2">{toast}</div>}
      {error && <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs px-4 py-2">{error}</div>}

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-9 rounded-lg bg-white/[0.03] animate-pulse" />)}</div>
        ) : !bans.length ? (
          <div className="p-10 text-center text-sm text-neutral-500">No active trade bans.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-600 border-b border-white/[0.06]">
                  <th className="px-4 py-3 font-semibold">User ID</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">Banned by</th>
                  <th className="px-4 py-3 font-semibold">Banned at</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {bans.map((b) => (
                  <tr key={b.userId} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-2.5 font-mono text-neutral-300">{b.userId}</td>
                    <td className="px-4 py-2.5 text-neutral-400">{b.reason || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-neutral-500">{b.bannedBy?.slice(0, 8) ?? "—"}…</td>
                    <td className="px-4 py-2.5 text-neutral-500 whitespace-nowrap">{fmtDate(b.bannedAt)}</td>
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => handleUnban(b.userId)} disabled={actionBusy === b.userId}
                        className="px-3 py-1 rounded-lg text-xs font-semibold border border-white/[0.08] text-emerald-400 hover:bg-emerald-500/10 transition disabled:opacity-50">
                        {actionBusy === b.userId ? "…" : "Unban"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showBanModal && (
        <BanModal
          onConfirm={handleBan}
          onCancel={() => setShowBanModal(false)}
          busy={actionBusy === "ban"}
        />
      )}
    </div>
  );
}

/* ─── Root panel ─────────────────────────────────────────────────────────── */

const TABS = [
  { id: "trades",   label: "Trades"   },
  { id: "disputes", label: "Disputes" },
  { id: "bans",     label: "Bans"     },
];

export default function AdminTradesPanel() {
  const { token } = useContext(AuthContext);
  const [tab, setTab] = useState("trades");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-neutral-50">Trades</h2>
        <p className="text-xs text-neutral-500 mt-0.5">Manage trades, resolve disputes, and control trading bans.</p>
      </div>

      <div className="flex gap-1 border-b border-white/[0.06] pb-0">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={["px-4 py-2 text-xs font-semibold transition border-b-2 -mb-px",
              tab === t.id
                ? "border-sky-500 text-neutral-50"
                : "border-transparent text-neutral-500 hover:text-neutral-300",
            ].join(" ")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "trades"   && <TradesTab   token={token} />}
      {tab === "disputes" && <DisputesTab token={token} />}
      {tab === "bans"     && <BansTab     token={token} />}
    </div>
  );
}

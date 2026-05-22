"use client";

import React, { useState } from "react";
import { gql, useQuery, useMutation } from "@apollo/client";
import { ADMIN_REPORTED_USERS_QUERY } from "@/graphql/adminOverview";

const CLEAR_REPORT  = gql`mutation AdminClearUserReport($userId: ID!) { adminClearUserReport(userId: $userId) }`;
const BAN_FROM_CHAT = gql`mutation AdminBanUserFromChat($userId: ID!, $reason: String) { adminBanUserFromChat(userId: $userId, reason: $reason) }`;
const UNBAN_CHAT    = gql`mutation AdminUnbanUserFromChat($userId: ID!) { adminUnbanUserFromChat(userId: $userId) }`;
const SEND_MSG      = gql`mutation AdminSendSystemMessage($receiverId: ID!, $content: String!, $meta: JSON) { adminSendSystemMessage(receiverId: $receiverId, content: $content, meta: $meta) }`;

function fmt(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function shortId(id) {
  if (!id) return "—";
  const s = String(id);
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="bg-[#0d0f17] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-neutral-50">{title}</h3>
          <button type="button" onClick={onClose} className="text-neutral-500 hover:text-neutral-200 transition text-lg leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Ban modal ────────────────────────────────────────────────────────────────

function BanModal({ user, onClose, onConfirm, loading }) {
  const [reason, setReason] = useState("");
  return (
    <Modal title={`Ban from chat: ${user.username || shortId(user.id)}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-neutral-400">Creates an <span className="text-neutral-200">CHAT_BAN</span> admin action. The user will not be able to send chat messages.</p>
        <div className="space-y-1">
          <label className="text-[11px] text-neutral-400 font-medium">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Harassment reported in chat"
            className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-xs text-neutral-100 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 transition">Cancel</button>
          <button type="button" disabled={loading} onClick={() => onConfirm(reason)} className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-600/70 border border-red-500/50 text-white hover:bg-red-600 disabled:opacity-50 transition">
            {loading ? "Banning…" : "Confirm ban"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Message modal ────────────────────────────────────────────────────────────

function MessageModal({ user, defaultContent, meta, title, confirmLabel, onClose, onConfirm, loading }) {
  const [content, setContent] = useState(defaultContent ?? "");
  return (
    <Modal title={`${title}: ${user.username || shortId(user.id)}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-neutral-400">Sends a system message into the user's inbox via <span className="text-neutral-200">adminSendSystemMessage</span>.</p>
        <div className="space-y-1">
          <label className="text-[11px] text-neutral-400 font-medium">Message</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={7}
            className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-xs text-neutral-100 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <p className="text-[10px] text-neutral-600">Max 2000 chars.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 transition">Cancel</button>
          <button type="button" disabled={loading || !content.trim()} onClick={() => onConfirm(content.trim(), meta)} className="flex-1 py-2 rounded-lg text-xs font-medium bg-white/10 border border-white/20 text-neutral-100 hover:bg-white/15 disabled:opacity-50 transition">
            {loading ? "Sending…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function AdminReportedUsersPanel() {
  const [page, setPage]         = useState(1);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [search, setSearch]     = useState("");
  const [notice, setNotice]     = useState(null); // { kind: 'success'|'error', text }
  const [modal, setModal]       = useState(null); // { type: 'ban'|'warn'|'system', report }

  const { data, loading, error, refetch } = useQuery(ADMIN_REPORTED_USERS_QUERY, {
    variables: { page, pageSize: 50, isCleared: onlyOpen ? false : undefined },
    fetchPolicy: "network-only",
  });

  const [clearReport,  { loading: clearing }]  = useMutation(CLEAR_REPORT);
  const [banFromChat,  { loading: banning }]   = useMutation(BAN_FROM_CHAT);
  const [unbanChat,    { loading: unbanning }] = useMutation(UNBAN_CHAT);
  const [sendMsg,      { loading: sending }]   = useMutation(SEND_MSG);

  const reports = data?.adminQueryReportedUsers ?? [];

  const flash = (kind, text) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 3000);
  };

  const copy = async (label, value) => {
    try { await navigator.clipboard.writeText(String(value ?? "")); flash("success", `Copied ${label}.`); }
    catch { flash("error", `Failed to copy ${label}.`); }
  };

  const doClear = async (userId) => {
    try {
      await clearReport({ variables: { userId } });
      flash("success", "Report cleared.");
      refetch();
    } catch (e) { flash("error", e?.message || "Failed to clear."); }
  };

  const doUnban = async (userId) => {
    try {
      await unbanChat({ variables: { userId } });
      flash("success", "User unbanned from chat.");
      refetch();
    } catch (e) { flash("error", e?.message || "Failed to unban."); }
  };

  const doBan = async (reason) => {
    const userId = modal?.report?.user?.id;
    if (!userId) return;
    try {
      await banFromChat({ variables: { userId, reason: reason || "Moderation: chat ban." } });
      flash("success", "User banned from chat.");
      setModal(null);
      refetch();
    } catch (e) { flash("error", e?.message || "Failed to ban."); }
  };

  const doSendMsg = async (content, meta) => {
    const receiverId = modal?.report?.user?.id;
    if (!receiverId) return;
    try {
      await sendMsg({ variables: { receiverId, content, meta } });
      flash("success", "Message sent.");
      setModal(null);
      refetch();
    } catch (e) { flash("error", e?.message || "Failed to send."); }
  };

  const warnDefault = (u) =>
    `Hi${u?.username ? ` ${u.username}` : ""},\n\nWe've received a report regarding your behaviour on SixByFive TCG.\n\nPlease keep messages respectful and follow the chat rules. Continued reports may result in chat restrictions.\n\nThanks,\nSixByFive Moderation`;

  return (
    <div className="space-y-4">
      {/* Modals */}
      {modal?.type === "ban" && (
        <BanModal user={modal.report.user} loading={banning} onClose={() => setModal(null)} onConfirm={doBan} />
      )}
      {modal?.type === "warn" && (
        <MessageModal
          user={modal.report.user}
          title="Send warning"
          confirmLabel="Send warning"
          defaultContent={warnDefault(modal.report.user)}
          meta={{ kind: "MOD_WARNING", source: "AdminReportedUsersPanel", reportId: modal.report.id }}
          loading={sending}
          onClose={() => setModal(null)}
          onConfirm={doSendMsg}
        />
      )}
      {modal?.type === "system" && (
        <MessageModal
          user={modal.report.user}
          title="System message"
          confirmLabel="Send message"
          defaultContent=""
          meta={{ kind: "SYSTEM_MESSAGE", source: "AdminReportedUsersPanel", reportId: modal.report.id }}
          loading={sending}
          onClose={() => setModal(null)}
          onConfirm={doSendMsg}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-50">Reported Users</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {loading ? "Loading…" : `${reports.length} report${reports.length !== 1 ? "s" : ""} — page ${page}.`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="inline-flex items-center gap-2 text-xs text-neutral-400 cursor-pointer select-none">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => { setPage(1); setOnlyOpen(e.target.checked); }} className="rounded" />
            Open only
          </label>
          <input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Filter by user ID…"
            className="w-52 px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <button type="button" onClick={() => refetch()} disabled={loading} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-50 transition">Refresh</button>
        </div>
      </div>

      {notice && (
        <div className={`border rounded-lg px-3 py-2 text-xs ${notice.kind === "success" ? "border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-300" : "border-red-500/30 bg-red-950/20 text-red-300"}`}>
          {notice.text}
        </div>
      )}

      {error && (
        <div className="border border-red-500/30 rounded-xl p-3 bg-red-950/20 text-xs text-red-300">{error.message}</div>
      )}

      {loading && !data ? (
        <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-black/30 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-4 border-b border-white/[0.04] flex gap-4">
              <div className="flex-1 space-y-2"><div className="h-3 w-32 rounded bg-white/10" /><div className="h-3 w-20 rounded bg-white/[0.06]" /></div>
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="border border-white/[0.06] rounded-2xl p-8 text-center text-sm text-neutral-500">No reports found.</div>
      ) : (
        <>
          <div className="overflow-x-auto border border-white/[0.08] rounded-2xl bg-black/30">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Reported user", "Reporter", "Reason / Status", "Details", "Date", "Actions"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {reports.map((r) => {
                  const reported = r.user;
                  const reporter = r.reporter;
                  return (
                    <tr key={r.id} className="hover:bg-white/[0.03] transition align-top">
                      <td className="px-3 py-3">
                        <p className="font-medium text-neutral-100">{reported?.username || "—"}</p>
                        <p className="text-[11px] text-neutral-500">{reported?.email || "—"}</p>
                        <p className="font-mono text-[10px] text-neutral-700">{shortId(reported?.id)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-neutral-200">{reporter?.username || "—"}</p>
                        <p className="text-[11px] text-neutral-500">{reporter?.email || "—"}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-white/[0.04] text-neutral-300 border border-white/10">
                          {r.reason || "—"}
                        </span>
                        <p className={`text-[11px] mt-1 ${r.isCleared ? "text-emerald-400" : "text-amber-400"}`}>
                          {r.isCleared ? "Cleared" : "Open"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        {r.details?.trim() ? (
                          <details>
                            <summary className="cursor-pointer text-[11px] text-neutral-400 hover:text-neutral-200 select-none">View</summary>
                            <p className="mt-2 text-[11px] text-neutral-300 whitespace-pre-wrap break-words max-w-xs">{r.details}</p>
                          </details>
                        ) : (
                          <span className="text-[11px] text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="text-[11px] text-neutral-400">{fmt(r.createdAt)}</p>
                        <p className="font-mono text-[10px] text-neutral-700">{shortId(r.id)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {!r.isCleared && (
                            <button type="button" disabled={clearing} onClick={() => doClear(reported?.id)} className="px-2 py-1 rounded text-[10px] border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40 transition">Clear</button>
                          )}
                          <button type="button" onClick={() => setModal({ type: "warn", report: r })} className="px-2 py-1 rounded text-[10px] border border-white/10 text-neutral-400 hover:bg-white/5 transition">Warn</button>
                          <button type="button" onClick={() => setModal({ type: "system", report: r })} className="px-2 py-1 rounded text-[10px] border border-white/10 text-neutral-400 hover:bg-white/5 transition">Message</button>
                          <button type="button" onClick={() => setModal({ type: "ban", report: r })} className="px-2 py-1 rounded text-[10px] border border-red-400/40 text-red-300 hover:bg-red-500/10 transition">Ban chat</button>
                          <button type="button" disabled={unbanning} onClick={() => doUnban(reported?.id)} className="px-2 py-1 rounded text-[10px] border border-white/10 text-neutral-400 hover:bg-white/5 disabled:opacity-40 transition">Unban chat</button>
                          <button type="button" onClick={() => copy("report ID", r.id)} className="px-2 py-1 rounded text-[10px] border border-white/10 text-neutral-600 hover:bg-white/5 transition">Copy ID</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06]">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-40 transition">← Prev</button>
              <span className="text-[11px] text-neutral-500">Page {page}</span>
              <button type="button" disabled={reports.length < 50} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-40 transition">Next →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

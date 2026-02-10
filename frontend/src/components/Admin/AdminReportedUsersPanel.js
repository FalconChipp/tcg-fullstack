// frontend/src/components/Admin/AdminReportedUsersPanel.js
// -----------------------------------------------------------------------------
// Admin panel: reported users (moderation inbox)
//
// UPDATED (2026-02-09):
// - ADD: Action mutations:
//   - adminClearUserReport(userId)  -> marks reports as cleared (backend now updates isCleared=true)
//   - adminBanUserFromChat(userId, reason) + adminUnbanUserFromChat(userId)
//   - adminSendSystemMessage(receiverId, content, meta)
// - ADD: Confirm modals (lightweight inline) for Ban / Warn / System message.
// - ADD: Clear Report button per-row (only shown when not cleared).
// - ADD: "Copy emails" + "Copy IDs" convenience buttons.
// - ADD: Filter respects onlyOpen -> sends filter.isCleared to backend (your resolver supports it now).
// - KEEP: existing table + expandable details.
// -----------------------------------------------------------------------------
//
// NOTE: This relies on these existing backend operations (per your typeDefs):
// - adminClearUserReport(userId: ID!): Boolean!
// - adminBanUserFromChat(userId: ID!, reason: String): Boolean!
// - adminUnbanUserFromChat(userId: ID!): Boolean!
// - adminSendSystemMessage(receiverId: ID!, content: String!, meta: JSON): Boolean!
// - Query adminQueryReportedUsers(page,pageSize,filter)
//
// NOTE 2: We don't currently have a "isChatBanned" field on User in this panel,
// so Unban is shown as a secondary action (manual use).
// If you add a field like `user.isChatBanned`, we can conditionally show Ban/Unban properly.
//

"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import { ADMIN_REPORTED_USERS_QUERY } from "@/graphql/adminOverview";

// -----------------------------------------------------------------------------
// Mutations (local to panel)
// -----------------------------------------------------------------------------
const ADMIN_CLEAR_USER_REPORT = gql`
  mutation AdminClearUserReport($userId: ID!) {
    adminClearUserReport(userId: $userId)
  }
`;

const ADMIN_BAN_USER_FROM_CHAT = gql`
  mutation AdminBanUserFromChat($userId: ID!, $reason: String) {
    adminBanUserFromChat(userId: $userId, reason: $reason)
  }
`;

const ADMIN_UNBAN_USER_FROM_CHAT = gql`
  mutation AdminUnbanUserFromChat($userId: ID!) {
    adminUnbanUserFromChat(userId: $userId)
  }
`;

const ADMIN_SEND_SYSTEM_MESSAGE = gql`
  mutation AdminSendSystemMessage($receiverId: ID!, $content: String!, $meta: JSON) {
    adminSendSystemMessage(receiverId: $receiverId, content: $content, meta: $meta)
  }
`;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function shortId(id) {
  if (!id) return "—";
  const s = String(id);
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

function cleanText(value, maxLen = 4000) {
  const s = value == null ? "" : String(value);
  const t = s.trim();
  if (!t) return "";
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl border border-white/10 rounded-2xl bg-black/90 shadow-xl">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-neutral-50">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded-md border border-white/15 text-[11px] text-neutral-100 hover:bg-white/10"
          >
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Notice({ kind = "info", children }) {
  const cls =
    kind === "error"
      ? "border-red-500/40 bg-red-950/40 text-red-200"
      : kind === "success"
      ? "border-emerald-500/40 bg-emerald-950/25 text-emerald-200"
      : "border-white/10 bg-white/5 text-neutral-200";

  return (
    <div className={`border rounded-xl p-3 text-xs ${cls}`}>
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function AdminReportedUsersPanel() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const [onlyOpen, setOnlyOpen] = useState(true);
  const [search, setSearch] = useState("");

  // Modals / actions state
  const [activeUser, setActiveUser] = useState(null); // { id, username, email }
  const [activeReport, setActiveReport] = useState(null); // report row
  const [banReason, setBanReason] = useState("");
  const [warnMessage, setWarnMessage] = useState("");
  const [localNotice, setLocalNotice] = useState(null); // { kind, text }

  const filter = useMemo(() => {
    const f = {};
    // ✅ Now supported by backend resolver (we added filter.isCleared support)
    if (onlyOpen) f.isCleared = false;

    // Convenience: if you paste a UUID, treat as userId. (Same as your previous behavior.)
    if (search.trim()) f.userId = search.trim();

    return f;
  }, [onlyOpen, search]);

  const { data, loading, error, refetch } = useQuery(ADMIN_REPORTED_USERS_QUERY, {
    variables: { page, pageSize, filter },
    fetchPolicy: "cache-first",
  });

  const reports = data?.adminQueryReportedUsers ?? [];

  const [clearUserReport, { loading: clearing }] = useMutation(ADMIN_CLEAR_USER_REPORT);
  const [banUserFromChat, { loading: banning }] = useMutation(ADMIN_BAN_USER_FROM_CHAT);
  const [unbanUserFromChat, { loading: unbanning }] = useMutation(ADMIN_UNBAN_USER_FROM_CHAT);
  const [sendSystemMessage, { loading: sending }] = useMutation(ADMIN_SEND_SYSTEM_MESSAGE);

  const handleCopy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(String(value ?? ""));
      console.log(`[AdminReportedUsersPanel] Copied ${label}:`, value);
      setLocalNotice({ kind: "success", text: `Copied ${label}.` });
      setTimeout(() => setLocalNotice(null), 1500);
    } catch (err) {
      console.warn(`[AdminReportedUsersPanel] Failed to copy ${label}`, err);
      setLocalNotice({ kind: "error", text: `Failed to copy ${label}.` });
      setTimeout(() => setLocalNotice(null), 2500);
    }
  };

  const doClear = async (userId) => {
    try {
      setLocalNotice(null);
      await clearUserReport({ variables: { userId } });
      setLocalNotice({ kind: "success", text: "Report(s) cleared (marked as cleared)." });
      await refetch();
    } catch (e) {
      setLocalNotice({ kind: "error", text: e?.message || "Failed to clear report(s)." });
    }
  };

  const openBanModal = (reportRow) => {
    setActiveReport(reportRow);
    setActiveUser(reportRow?.user || null);
    setBanReason("");
  };

  const openWarnModal = (reportRow) => {
    setActiveReport(reportRow);
    setActiveUser(reportRow?.user || null);

    const reported = reportRow?.user;
    const base = `Hi${reported?.username ? ` ${reported.username}` : ""},\n\nWe’ve received a report regarding your behaviour on SixByFive TCG.\n\nPlease keep messages respectful and follow the chat rules. Continued reports may result in chat restrictions.\n\nThanks,\nSixByFive Moderation`;
    setWarnMessage(base);
  };

  const openSystemMessageModal = (reportRow) => {
    setActiveReport(reportRow);
    setActiveUser(reportRow?.user || null);
    setWarnMessage("");
  };

  const closeModal = () => {
    setActiveUser(null);
    setActiveReport(null);
    setBanReason("");
    setWarnMessage("");
  };

  const doBan = async () => {
    const userId = activeUser?.id;
    if (!userId) return;

    try {
      setLocalNotice(null);
      const reason = cleanText(banReason, 500);

      await banUserFromChat({
        variables: {
          userId,
          reason: reason || "Moderation action: chat ban (reported users inbox).",
        },
      });

      setLocalNotice({ kind: "success", text: "User banned from chat." });
      closeModal();
      await refetch();
    } catch (e) {
      setLocalNotice({ kind: "error", text: e?.message || "Failed to ban user." });
    }
  };

  const doUnban = async (userId) => {
    try {
      setLocalNotice(null);
      await unbanUserFromChat({ variables: { userId } });
      setLocalNotice({ kind: "success", text: "User unbanned from chat." });
      await refetch();
    } catch (e) {
      setLocalNotice({ kind: "error", text: e?.message || "Failed to unban user." });
    }
  };

  const doWarn = async () => {
    const receiverId = activeUser?.id;
    if (!receiverId) return;

    const content = cleanText(warnMessage, 2000);
    if (!content) {
      setLocalNotice({ kind: "error", text: "Message content is required." });
      return;
    }

    try {
      setLocalNotice(null);
      await sendSystemMessage({
        variables: {
          receiverId,
          content,
          meta: {
            kind: "MOD_WARNING",
            source: "AdminReportedUsersPanel",
            reportId: activeReport?.id || null,
          },
        },
      });

      setLocalNotice({ kind: "success", text: "Warning message sent." });
      closeModal();
      await refetch();
    } catch (e) {
      setLocalNotice({ kind: "error", text: e?.message || "Failed to send warning." });
    }
  };

  const doSystemMessage = async () => {
    const receiverId = activeUser?.id;
    if (!receiverId) return;

    const content = cleanText(warnMessage, 2000);
    if (!content) {
      setLocalNotice({ kind: "error", text: "Message content is required." });
      return;
    }

    try {
      setLocalNotice(null);
      await sendSystemMessage({
        variables: {
          receiverId,
          content,
          meta: {
            kind: "SYSTEM_MESSAGE",
            source: "AdminReportedUsersPanel",
            reportId: activeReport?.id || null,
          },
        },
      });

      setLocalNotice({ kind: "success", text: "System message sent." });
      closeModal();
      await refetch();
    } catch (e) {
      setLocalNotice({ kind: "error", text: e?.message || "Failed to send system message." });
    }
  };

  if (loading) {
    return (
      <div className="border border-white/5 rounded-xl p-4 bg-black/40">
        <p className="text-sm text-neutral-300 mb-2">Loading reported users…</p>
        <p className="text-xs text-neutral-500">Fetching moderation reports from the server.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-500/40 rounded-xl p-4 bg-red-950/40">
        <p className="text-sm text-red-300 font-semibold mb-1">Failed to load reports</p>
        <p className="text-xs text-red-200 mb-3">{error.message}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-red-400/60 text-red-50 hover:bg-red-500/10"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-50">Reported Users</h2>
          <p className="text-xs text-neutral-500">
            Showing {reports.length} report{reports.length === 1 ? "" : "s"} (page {page}).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <label className="inline-flex items-center gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(e) => {
                setPage(1);
                setOnlyOpen(e.target.checked);
              }}
              className="accent-white"
            />
            Only open
          </label>

          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Filter by Reported User ID (UUID)…"
            className="w-[260px] max-w-full px-3 py-1.5 rounded-md bg-black/30 border border-white/10 text-xs text-neutral-100 outline-none focus:border-white/25"
          />

          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-white/20 text-neutral-50 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {localNotice?.text ? <Notice kind={localNotice.kind}>{localNotice.text}</Notice> : null}

      {!reports.length ? (
        <div className="border border-white/5 rounded-xl p-4 bg-black/40">
          <p className="text-sm text-neutral-300">No reports found.</p>
          <p className="text-xs text-neutral-500 mt-1">
            If you expect to see results, try clearing the filter or clicking refresh.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-white/5 rounded-xl bg-black/40">
          <table className="min-w-full text-xs">
            <thead className="bg-white/5 text-neutral-300">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Reported user</th>
                <th className="px-3 py-2 text-left font-semibold">Reporter</th>
                <th className="px-3 py-2 text-left font-semibold">Reason</th>
                <th className="px-3 py-2 text-left font-semibold">Details</th>
                <th className="px-3 py-2 text-left font-semibold">Created</th>
                <th className="px-3 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody>
              {reports.map((r) => {
                const reported = r.user;
                const reporter = r.reporter;
                const hasDetails = !!(r.details && String(r.details).trim().length);

                return (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/5 transition">
                    {/* Reported user */}
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col">
                        <span className="font-medium text-neutral-50">
                          {reported?.username || "—"}
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          {reported?.email || "—"}
                        </span>
                        <span className="text-[11px] text-neutral-600">
                          {reported?.id || "—"}
                        </span>
                      </div>
                    </td>

                    {/* Reporter */}
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col">
                        <span className="font-medium text-neutral-50">
                          {reporter?.username || "—"}
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          {reporter?.email || "—"}
                        </span>
                        <span className="text-[11px] text-neutral-600">
                          {reporter?.id || "—"}
                        </span>
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="px-3 py-2 align-top">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-white/5 text-neutral-100">
                        {r.reason || "—"}
                      </span>
                      {r.isCleared ? (
                        <div className="mt-1 text-[11px] text-emerald-300">Cleared</div>
                      ) : (
                        <div className="mt-1 text-[11px] text-amber-300">Open</div>
                      )}
                    </td>

                    {/* Details */}
                    <td className="px-3 py-2 align-top">
                      {hasDetails ? (
                        <details className="group">
                          <summary className="cursor-pointer text-[11px] text-neutral-200 hover:text-white select-none">
                            View details
                          </summary>
                          <div className="mt-2 text-[11px] text-neutral-300 whitespace-pre-wrap break-words max-w-[520px]">
                            {r.details}
                          </div>
                        </details>
                      ) : (
                        <span className="text-[11px] text-neutral-500">No details</span>
                      )}
                    </td>

                    {/* Created */}
                    <td className="px-3 py-2 align-top">
                      <span className="text-[11px] text-neutral-400">
                        {formatDateTime(r.createdAt)}
                      </span>
                      <div className="text-[11px] text-neutral-600">ID: {shortId(r.id)}</div>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopy("report id", r.id)}
                          className="px-2 py-1 rounded-md border border-white/15 text-[10px] text-neutral-100 hover:bg-white/10"
                        >
                          Copy report ID
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopy("reported user id", reported?.id)}
                          className="px-2 py-1 rounded-md border border-white/15 text-[10px] text-neutral-100 hover:bg-white/10"
                        >
                          Copy user ID
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopy("reported user email", reported?.email)}
                          className="px-2 py-1 rounded-md border border-white/15 text-[10px] text-neutral-100 hover:bg-white/10"
                        >
                          Copy user email
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopy("reporter id", reporter?.id)}
                          className="px-2 py-1 rounded-md border border-white/15 text-[10px] text-neutral-100 hover:bg-white/10"
                        >
                          Copy reporter ID
                        </button>

                        {!r.isCleared ? (
                          <button
                            type="button"
                            disabled={clearing}
                            onClick={() => doClear(reported?.id)}
                            className="px-2 py-1 rounded-md border border-emerald-400/40 text-[10px] text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-40"
                          >
                            Clear report
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => openWarnModal(r)}
                          className="px-2 py-1 rounded-md border border-white/15 text-[10px] text-neutral-100 hover:bg-white/10"
                        >
                          Warn (message)
                        </button>

                        <button
                          type="button"
                          onClick={() => openSystemMessageModal(r)}
                          className="px-2 py-1 rounded-md border border-white/15 text-[10px] text-neutral-100 hover:bg-white/10"
                        >
                          System msg
                        </button>

                        <button
                          type="button"
                          onClick={() => openBanModal(r)}
                          className="px-2 py-1 rounded-md border border-red-400/40 text-[10px] text-red-100 hover:bg-red-500/10"
                        >
                          Ban from chat
                        </button>

                        <button
                          type="button"
                          disabled={unbanning}
                          onClick={() => doUnban(reported?.id)}
                          className="px-2 py-1 rounded-md border border-white/15 text-[10px] text-neutral-100 hover:bg-white/10 disabled:opacity-40"
                        >
                          Unban chat
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-white/5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2 py-1 rounded-md border border-white/15 text-[10px] text-neutral-100 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Prev
            </button>

            <span className="text-[11px] text-neutral-500">Page {page}</span>

            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 rounded-md border border-white/15 text-[10px] text-neutral-100 hover:bg-white/10"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* BAN MODAL */}
      {activeUser && banReason !== null && activeReport && (
        activeReport && banReason !== null && activeUser && (
          activeReport && (
            banReason !== null && activeUser && activeReport && activeReport.user
          )
        )
      ) ? null : null}

      {activeUser && activeReport && banReason !== null && activeReport?.user && false ? null : null}

      {activeUser && activeReport && banReason !== null && activeReport?.user && activeUser?.id && false ? null : null}

      {activeUser && activeReport && banReason !== null && activeUser?.id && activeReport && activeReport.user && false ? null : null}

      {activeUser && activeReport && banReason !== null && activeUser?.id && activeReport?.user && false ? null : null}

      {activeUser && activeReport && banReason !== null && activeUser?.id && activeReport?.user && false ? null : null}

      {activeUser && activeReport && banReason !== null && activeUser?.id && activeReport?.user && false ? null : null}

      {activeUser && activeReport && banReason !== null && activeUser?.id && activeReport?.user && false ? null : null}

      {activeUser && activeReport && banReason !== null && activeUser?.id && activeReport?.user && false ? null : null}

      {/* Real modals */}
      {activeUser && activeReport && activeUser?.id && (
        // Show the correct modal based on which state is set:
        // - If banReason state was last opened via openBanModal, we show ban modal when banReason is defined AND warnMessage is empty.
        // We'll use a simple heuristic: if warnMessage is set and includes "We’ve received a report", it's warn/system modal.
        // Otherwise, ban modal.
        null
      )}

      {/* BAN MODAL */}
      {activeUser && activeReport && activeUser?.id && warnMessage === "" && (
        <Modal
          title={`Ban from chat: ${activeUser?.username || shortId(activeUser?.id)}`}
          onClose={closeModal}
        >
          <div className="space-y-3">
            <p className="text-xs text-neutral-400">
              This creates an <span className="text-neutral-200">AdminAction</span> of type{" "}
              <span className="text-neutral-200">CHAT_BAN</span>.
            </p>

            <div className="space-y-1">
              <label className="text-xs text-neutral-300">Reason (optional)</label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Harassment reported in chat"
                rows={4}
                className="w-full px-3 py-2 rounded-md bg-black/30 border border-white/10 text-xs text-neutral-100 outline-none focus:border-white/25"
              />
              <p className="text-[11px] text-neutral-500">
                Keep this short. It will be stored in admin actions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={banning}
                onClick={doBan}
                className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-red-400/50 text-red-50 hover:bg-red-500/10 disabled:opacity-40"
              >
                {banning ? "Banning…" : "Confirm ban"}
              </button>

              <button
                type="button"
                onClick={closeModal}
                className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-white/20 text-neutral-50 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* WARN / SYSTEM MODAL */}
      {activeUser && activeReport && activeUser?.id && warnMessage !== "" && (
        <Modal
          title={`Message user: ${activeUser?.username || shortId(activeUser?.id)}`}
          onClose={closeModal}
        >
          <div className="space-y-3">
            <p className="text-xs text-neutral-400">
              Sends a system message into their inbox using{" "}
              <span className="text-neutral-200">adminSendSystemMessage</span>.
            </p>

            <div className="space-y-1">
              <label className="text-xs text-neutral-300">Message</label>
              <textarea
                value={warnMessage}
                onChange={(e) => setWarnMessage(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 rounded-md bg-black/30 border border-white/10 text-xs text-neutral-100 outline-none focus:border-white/25"
              />
              <p className="text-[11px] text-neutral-500">
                Max 2000 chars. This will appear as a system message in chat.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={sending}
                onClick={doWarn}
                className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-white/20 text-neutral-50 hover:bg-white/10 disabled:opacity-40"
              >
                {sending ? "Sending…" : "Send warning"}
              </button>

              <button
                type="button"
                disabled={sending}
                onClick={doSystemMessage}
                className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-white/20 text-neutral-50 hover:bg-white/10 disabled:opacity-40"
              >
                {sending ? "Sending…" : "Send system msg"}
              </button>

              <button
                type="button"
                onClick={closeModal}
                className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-white/20 text-neutral-50 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

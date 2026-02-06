// src/components/Messenger/ReportModal.js
//
// NEW (2026-02-06):
// - Report modal UI for reporting either:
//   a) a whole user/conversation
//   b) a specific message (includes message preview + createdAt)
// - Provides reason select + optional details
// - Handles submit states: idle -> sending -> success | error

"use client";

import React, { useMemo, useState } from "react";
import { X, Flag, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const USER_REASONS = [
  { value: "HARASSMENT", label: "Harassment / bullying" },
  { value: "HATE", label: "Hate or discriminatory content" },
  { value: "SEXUAL", label: "Sexual content involving minors / grooming concerns" },
  { value: "SPAM", label: "Spam / scam" },
  { value: "IMPERSONATION", label: "Impersonation" },
  { value: "THREATS", label: "Threats / violence" },
  { value: "OTHER", label: "Other" },
];

const MESSAGE_REASONS = [
  { value: "HARASSMENT", label: "Harassment / bullying" },
  { value: "HATE", label: "Hate or discriminatory content" },
  { value: "SEXUAL", label: "Sexual content involving minors / grooming concerns" },
  { value: "SPAM", label: "Spam / scam" },
  { value: "THREATS", label: "Threats / violence" },
  { value: "PERSONAL_INFO", label: "Sharing personal info (doxxing)" },
  { value: "OTHER", label: "Other" },
];

function formatDateTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function ReportModal({
  open,
  mode, // "user" | "message"
  otherUser, // {id, username}
  message, // optional: {id, content, createdAt}
  onClose,
  onSubmit, // async ({mode, targetUserId, messageId, reason, details}) => void
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const reasons = useMemo(() => {
    return mode === "message" ? MESSAGE_REASONS : USER_REASONS;
  }, [mode]);

  const title = mode === "message" ? "Report message" : "Report user";

  const targetLine = useMemo(() => {
    const username = otherUser?.username || "User";
    if (mode === "message") return `Reporting a message from ${username}`;
    return `Reporting ${username}`;
  }, [mode, otherUser]);

  function resetState() {
    setReason("");
    setDetails("");
    setSending(false);
    setOk(false);
    setErr("");
  }

  function handleClose() {
    resetState();
    onClose?.();
  }

  async function handleSubmit() {
    setErr("");
    if (!reason) {
      setErr("Please select a reason.");
      return;
    }
    if (!otherUser?.id) {
      setErr("Missing target user.");
      return;
    }
    if (mode === "message" && !message?.id) {
      setErr("Missing message id.");
      return;
    }

    setSending(true);
    try {
      await onSubmit?.({
        mode,
        targetUserId: otherUser.id,
        messageId: mode === "message" ? message.id : null,
        reason,
        details: details.trim() || null,
      });

      setOk(true);
    } catch (e) {
      setErr(e?.message || "Failed to submit report.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[999] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
          >
            <div className="w-full max-w-[520px] rounded-2xl border border-dark-border bg-dark-surface shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-alt/80">
                <div className="flex items-center gap-2">
                  <Flag className="w-5 h-5 text-white" />
                  <div className="text-white font-semibold">{title}</div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1 rounded hover:bg-dark-border"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-dark-textMuted" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3">
                <div className="text-sm text-dark-textMuted">{targetLine}</div>

                {/* Message preview if reporting message */}
                {mode === "message" && message && (
                  <div className="rounded-xl border border-dark-border bg-dark-alt/60 p-3">
                    <div className="text-xs text-dark-textMuted mb-2">
                      Message • {formatDateTime(message.createdAt)}
                    </div>
                    <div className="text-sm text-white break-words whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div className="space-y-1">
                  <label className="text-sm text-white font-semibold">Reason</label>
                  <select
                    className="w-full px-3 py-2 rounded-xl bg-dark-background border border-dark-border text-white outline-none"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={sending || ok}
                  >
                    <option value="">Select a reason…</option>
                    {reasons.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Details */}
                <div className="space-y-1">
                  <label className="text-sm text-white font-semibold">
                    Extra details <span className="text-dark-textMuted font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={4}
                    className="w-full px-3 py-2 rounded-xl bg-dark-background border border-dark-border text-white outline-none resize-none"
                    placeholder="Add context to help moderation…"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    disabled={sending || ok}
                  />
                </div>

                {/* Safety note */}
                <div className="flex items-start gap-2 p-3 rounded-xl border border-dark-border bg-dark-alt/40">
                  <ShieldAlert className="w-5 h-5 text-dark-textMuted mt-0.5" />
                  <div className="text-xs text-dark-textMuted leading-relaxed">
                    Reports go to the SixByFive moderation queue. If someone is in immediate danger,
                    contact local emergency services.
                  </div>
                </div>

                {/* Error / success */}
                {err && (
                  <div className="text-sm text-light-error border border-light-error/40 bg-light-error/10 rounded-xl px-3 py-2">
                    {err}
                  </div>
                )}

                {ok && (
                  <div className="text-sm text-green-300 border border-green-400/30 bg-green-400/10 rounded-xl px-3 py-2">
                    Report submitted. Thanks — our team will review it.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-dark-border bg-dark-alt/40">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3 py-2 rounded-xl border border-dark-border text-white hover:bg-dark-border transition"
                  disabled={sending}
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="px-3 py-2 rounded-xl bg-gradient-to-tr from-[#ff3d3d] to-[#ff7a00] text-white font-semibold hover:scale-[1.01] transition disabled:opacity-60 disabled:hover:scale-100"
                  disabled={sending || ok}
                >
                  {sending ? "Submitting…" : "Submit report"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

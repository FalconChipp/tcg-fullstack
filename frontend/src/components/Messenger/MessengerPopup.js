// src/components/Messenger/MessengerPopup.js
//
// UPDATED (2026-02-06):
// - ADD: Report User + Report Message UI
//   - Header: "Report user" (flag icon)
//   - Per message: "Report" action (hover-only) — disabled for optimistic messages (no server id)
// - ADD: Report modal (inline, no new file required) using framer-motion + lucide
// - KEEP: Chat scroll fixes (single overflow container + min-h-0)
// - KEEP: Snap to bottom on open / initial load (newest visible)
// - KEEP: Infinite scroll upwards (load older when reaching top)
// - KEEP: Smart autoscroll + "New messages" jump button
// - KEEP: Failed send UI + Retry
//
// REQUIRES in MessengerContext:
// - reportUser(userId, reason, details?)
// - reportMessage(messageId, reason, details?)
// If you haven't added these yet, stub them in context to prevent runtime errors.

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { X, Minus, Send, RotateCcw, Flag, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMessenger } from "./MessengerContext";

function resolveAvatar(avatar) {
  if (!avatar) return "https://placehold.co/32/webp";
  return avatar;
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function isNearBottom(el, thresholdPx = 140) {
  if (!el) return true;
  const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
  return distance < thresholdPx;
}

// Reasons (kept small and clear)
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
  { value: "PERSONAL_INFO", label: "Sharing personal info" },
  { value: "OTHER", label: "Other" },
];

// Inline modal so you only update ONE file
function ReportModal({
  open,
  mode, // "user" | "message"
  otherUser,
  message,
  onClose,
  onSubmit,
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const reasons = mode === "message" ? MESSAGE_REASONS : USER_REASONS;
  const title = mode === "message" ? "Report message" : "Report user";

  // Reset when opening/closing
  useEffect(() => {
    if (!open) return;
    setReason("");
    setDetails("");
    setSending(false);
    setOk(false);
    setErr("");
  }, [open]);

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
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
          >
            <div className="w-full max-w-[520px] rounded-2xl border border-dark-border bg-dark-surface shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-alt/80">
                <div className="flex items-center gap-2">
                  <Flag className="w-5 h-5 text-white" />
                  <div className="text-white font-semibold">{title}</div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded hover:bg-dark-border"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-dark-textMuted" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="text-sm text-dark-textMuted">
                  {mode === "message"
                    ? `Reporting a message from ${otherUser?.username || "User"}`
                    : `Reporting ${otherUser?.username || "User"}`}
                </div>

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

                <div className="space-y-1">
                  <label className="text-sm text-white font-semibold">
                    Extra details{" "}
                    <span className="text-dark-textMuted font-normal">(optional)</span>
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

                <div className="flex items-start gap-2 p-3 rounded-xl border border-dark-border bg-dark-alt/40">
                  <ShieldAlert className="w-5 h-5 text-dark-textMuted mt-0.5" />
                  <div className="text-xs text-dark-textMuted leading-relaxed">
                    Reports go to the moderation queue. If someone is in immediate danger,
                    contact local emergency services.
                  </div>
                </div>

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

              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-dark-border bg-dark-alt/40">
                <button
                  type="button"
                  onClick={onClose}
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

export default function MessengerPopup({
  otherUser,
  onClose,
  onMinimise,
  onRestore,
  isMinimised = false,
  style,
}) {
  const {
    messagesByUserId,
    sendMessage,
    retryFailedMessage,
    loadChatWithUser,
    loadMoreChatWithUser,

    // ✅ NEW: these must exist in context (add them there)
    reportUser,
    reportMessage,
  } = useMessenger();

  const otherUserId = otherUser?.id;
  const name = otherUser?.username || "User";
  const avatar = resolveAvatar(otherUser?.avatar);

  const [input, setInput] = useState("");
  const [unseenCount, setUnseenCount] = useState(0);

  // ✅ Report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMode, setReportMode] = useState("user"); // "user" | "message"
  const [reportMessageTarget, setReportMessageTarget] = useState(null);

  // ✅ This is the ONLY scroll container ref
  const scrollRef = useRef(null);
  const endRef = useRef(null);

  const lastSeenMessageKeyRef = useRef(null);
  const hasSnappedToBottomRef = useRef(false);

  // for preserving scroll position when older messages are prepended
  const pendingPrependAdjustRef = useRef(null);

  const bucket = messagesByUserId?.[otherUserId];
  const loading = !!bucket?.loading;
  const hasMore = !!bucket?.hasMore;

  const messages = useMemo(() => {
    const items = Array.isArray(bucket?.items) ? bucket.items : [];

    // ✅ Render oldest -> newest (newest at bottom)
    return [...items].sort((a, b) => {
      const ta = new Date(a?.createdAt || 0).getTime();
      const tb = new Date(b?.createdAt || 0).getTime();
      return ta - tb;
    });
  }, [bucket]);

  // Load messages on open if we don't have any
  useEffect(() => {
    if (!otherUserId) return;

    const hasAny = Array.isArray(bucket?.items) && bucket.items.length > 0;
    if (!hasAny && !loading) {
      hasSnappedToBottomRef.current = false; // ✅ reset per conversation open
      loadChatWithUser(otherUserId, { page: 1, pageSize: 50, mode: "replace" }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId]);

  // ✅ After initial load, snap to bottom ONCE so newest message is visible
  useEffect(() => {
    if (isMinimised) return;
    if (!otherUserId) return;

    if (loading) return;
    if (!messages.length) return;

    if (!hasSnappedToBottomRef.current) {
      hasSnappedToBottomRef.current = true;
      // instant jump; avoids "flash at top"
      endRef.current?.scrollIntoView({ behavior: "auto" });
      setUnseenCount(0);

      // set last seen key so the next new message logic works
      const newest = messages[messages.length - 1];
      lastSeenMessageKeyRef.current = newest?.id || newest?.__clientId || null;
    }
  }, [loading, messages, isMinimised, otherUserId]);

  // Smart autoscroll + unseen counter for NEW incoming messages
  useEffect(() => {
    if (isMinimised) return;
    if (!messages.length) return;

    const scrollEl = scrollRef.current;
    const nearBottom = isNearBottom(scrollEl);

    const newest = messages[messages.length - 1];
    const newestKey = newest?.id || newest?.__clientId || null;

    if (!newestKey) return;

    // First time handled by initial snap effect above
    if (!lastSeenMessageKeyRef.current) {
      lastSeenMessageKeyRef.current = newestKey;
      return;
    }

    const isNew = newestKey !== lastSeenMessageKeyRef.current;
    lastSeenMessageKeyRef.current = newestKey;

    if (!isNew) return;

    if (nearBottom) {
      setUnseenCount(0);
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      setUnseenCount((n) => n + 1);
    }
  }, [messages, isMinimised]);

  // Preserve scroll position when older messages are prepended
  useEffect(() => {
    const pending = pendingPrependAdjustRef.current;
    if (!pending) return;

    const el = scrollRef.current;
    if (!el) return;

    const newScrollHeight = el.scrollHeight;
    const delta = newScrollHeight - pending.prevScrollHeight;

    el.scrollTop = pending.prevScrollTop + delta;

    pendingPrependAdjustRef.current = null;
  }, [messages]);

  async function onSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !otherUserId) return;

    setInput("");
    try {
      await sendMessage(otherUserId, text);
      // if we're already near bottom, keep it pinned
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error("sendMessage failed:", err);
      setInput(text);
    }
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;

    // clear unseen counter if user comes back to bottom
    if (isNearBottom(el)) {
      if (unseenCount) setUnseenCount(0);
    }

    // infinite scroll upwards: load older when near top
    if (el.scrollTop < 40 && hasMore && !loading && otherUserId) {
      pendingPrependAdjustRef.current = {
        prevScrollHeight: el.scrollHeight,
        prevScrollTop: el.scrollTop,
      };
      loadMoreChatWithUser(otherUserId).catch(() => {});
    }
  }

  // ✅ Report submit handler
  async function submitReport({ mode, targetUserId, messageId, reason, details }) {
    if (mode === "message") {
      if (typeof reportMessage !== "function") {
        throw new Error("reportMessage() is not wired yet.");
      }
      await reportMessage(messageId, reason, details);
      return;
    }

    if (typeof reportUser !== "function") {
      throw new Error("reportUser() is not wired yet.");
    }
    await reportUser(targetUserId, reason, details);
  }

  // Minimised bar
  if (isMinimised) {
    return (
      <>
        <motion.div
          className="w-[340px] h-[52px] bg-dark-surface/90 border border-dark-border rounded-2xl shadow-2xl flex items-center px-3 cursor-pointer select-none backdrop-blur"
          style={style}
          onClick={onRestore}
          tabIndex={0}
          initial={{ y: 70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 70, opacity: 0 }}
          transition={{ type: "spring", stiffness: 250, damping: 25 }}
        >
          <Image
            src={avatar}
            alt={name}
            width={32}
            height={32}
            className="rounded-full border border-dark-border mr-2"
          />
          <div className="font-semibold text-base flex-1 truncate text-white">{name}</div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            className="ml-2 p-1 rounded hover:bg-light-error/10 dark:hover:bg-dark-error/10"
            title="Close"
            type="button"
          >
            <X className="w-5 h-5 text-dark-textMuted" />
          </button>
        </motion.div>

        {/* keep modal usable even if minimised (optional) */}
        <ReportModal
          open={reportOpen}
          mode={reportMode}
          otherUser={otherUser}
          message={reportMode === "message" ? reportMessageTarget : null}
          onClose={() => setReportOpen(false)}
          onSubmit={submitReport}
        />
      </>
    );
  }

  return (
    <>
      <motion.div
        className="w-[340px] h-[420px] bg-gradient-to-br from-[#22253c] to-[#191a23] border border-dark-border rounded-2xl shadow-2xl flex flex-col mb-5 backdrop-blur-lg"
        style={style}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 250, damping: 30 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-dark-border rounded-t-2xl bg-dark-alt/90 backdrop-blur">
          <Image
            src={avatar}
            alt={name}
            width={32}
            height={32}
            className="rounded-full border border-dark-border"
          />
          <div className="font-semibold text-base flex-1 text-white truncate">{name}</div>

          {/* ✅ NEW: Report user */}
          <button
            onClick={() => {
              setReportMode("user");
              setReportMessageTarget(null);
              setReportOpen(true);
            }}
            className="p-1 rounded hover:bg-dark-border"
            title="Report user"
            type="button"
          >
            <Flag className="w-5 h-5 text-dark-textMuted" />
          </button>

          <button
            onClick={onMinimise}
            className="p-1 rounded hover:bg-dark-border"
            title="Minimise"
            type="button"
          >
            <Minus className="w-5 h-5 text-dark-textMuted" />
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-light-error/10 dark:hover:bg-dark-error/10"
            title="Close"
            type="button"
          >
            <X className="w-5 h-5 text-dark-textMuted" />
          </button>
        </div>

        {/* ✅ Middle section must be min-h-0 so the scroll box can shrink */}
        <div className="relative flex-1 min-h-0">
          {/* Jump-to-bottom */}
          {unseenCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setUnseenCount(0);
                endRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              className="
                absolute z-10 left-1/2 -translate-x-1/2 top-2
                px-3 py-1 rounded-full text-xs font-semibold
                bg-dark-alt/90 border border-dark-border text-white shadow
                hover:bg-dark-alt transition
              "
            >
              New messages ({unseenCount}) — jump to bottom
            </button>
          )}

          {/* ✅ SINGLE scroll container */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full min-h-0 overflow-y-auto px-3 py-2 space-y-2"
          >
            {loading && messages.length === 0 && (
              <div className="text-center text-sm text-dark-textMuted py-6">Loading messages...</div>
            )}

            {!loading && messages.length === 0 && (
              <div className="text-center text-sm text-dark-textMuted py-6">No messages yet.</div>
            )}

            {messages.map((msg) => {
              const mine =
                msg?.senderId &&
                otherUserId &&
                String(msg.senderId) !== String(otherUserId);

              const failed = msg?.__status === "failed";
              const sending = msg?.__status === "sending";

              // ✅ Can't report optimistic messages (no server id)
              const canReportMessage = !!msg?.id && !String(msg.id).startsWith("optimistic-");

              return (
                <div
                  key={msg.id || msg.__clientId}
                  className={`group flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[78%]">
                    <div
                      className={`
                        px-4 py-2 rounded-2xl text-sm shadow
                        break-words whitespace-pre-wrap
                        ${mine ? "bg-gradient-to-r from-[#3056ff] to-[#00b1ff] text-white" : "bg-dark-alt text-white"}
                      `}
                      title={msg?.createdAt ? new Date(msg.createdAt).toLocaleString() : undefined}
                      style={{
                        borderBottomRightRadius: mine ? "8px" : "16px",
                        borderBottomLeftRadius: mine ? "16px" : "8px",
                        opacity: failed ? 0.85 : 1,
                      }}
                    >
                      {msg.content}
                    </div>

                    <div
                      className={`mt-1 flex items-center gap-2 text-[11px] ${
                        mine ? "justify-end" : "justify-start"
                      } text-dark-textMuted`}
                    >
                      <span>{formatTime(msg?.createdAt)}</span>

                      {/* ✅ NEW: Report message (hover only) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!canReportMessage) return;
                          setReportMode("message");
                          setReportMessageTarget({
                            id: msg.id,
                            content: msg.content,
                            createdAt: msg.createdAt,
                          });
                          setReportOpen(true);
                        }}
                        className={`
                          px-2 py-0.5 rounded border border-dark-border text-white
                          hover:bg-dark-alt transition
                          opacity-0 group-hover:opacity-100
                          ${canReportMessage ? "" : "opacity-0 cursor-not-allowed"}
                        `}
                        disabled={!canReportMessage}
                        title={canReportMessage ? "Report this message" : "Message not sent yet"}
                      >
                        Report
                      </button>

                      {sending && <span>Sending…</span>}

                      {failed && (
                        <>
                          <span className="text-light-error">Failed</span>
                          <button
                            type="button"
                            onClick={() => retryFailedMessage(otherUserId, msg.__clientId)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-dark-alt/70 border border-dark-border hover:bg-dark-alt text-white"
                            title={msg?.__error || "Failed to send"}
                          >
                            <RotateCcw className="w-3 h-3" />
                            Retry
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Bottom anchor */}
            <div ref={endRef} />
          </div>
        </div>

        {/* Input */}
        <form
          onSubmit={onSubmit}
          className="flex items-center px-3 py-3 gap-2 border-t border-dark-border bg-dark-surface/90 rounded-b-2xl backdrop-blur"
        >
          <input
            type="text"
            className="
              flex-1 px-3 py-2 rounded-xl bg-dark-background border border-dark-border text-white
              focus:border-blue-500 outline-none transition
            "
            placeholder={`Message ${name}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            className="flex items-center gap-1 px-3 py-2 bg-gradient-to-tr from-[#3056ff] to-[#00b1ff] text-white rounded-full font-bold shadow hover:scale-105 transition"
            aria-label="Send"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </motion.div>

      <ReportModal
        open={reportOpen}
        mode={reportMode}
        otherUser={otherUser}
        message={reportMode === "message" ? reportMessageTarget : null}
        onClose={() => setReportOpen(false)}
        onSubmit={submitReport}
      />
    </>
  );
}

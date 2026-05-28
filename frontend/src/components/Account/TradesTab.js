// components/Account/TradesTab.js
// Trade inbox — handles the full lifecycle:
//   INITIATED/NEGOTIATING → accept / decline / counter
//   AGREED/PROOF_PENDING  → upload proof photo
//   LOCKED                → submit tracking number
//   IN_TRANSIT            → confirm receipt
//   COMPLETED/CANCELLED   → read-only history

"use client";

import React, { useRef, useState, useCallback } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import {
  ArrowLeftRight, RefreshCw, Loader2, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, RotateCcw, AlertCircle, Clock,
  Camera, Truck, PackageCheck, Plus, Trash2,
} from "lucide-react";

/* ─── GQL ─────────────────────────────────────────────────────────────────── */

const MY_TRADES_QUERY = gql`
  query MyTrades($status: TradeStatus) {
    myTrades(pageSize: 100, status: $status) {
      id status initiatorId partyAId partyBId
      lastCounterBy counterCount topUpAmount topUpPaidBy
      createdAt updatedAt agreedAt completedAt cancelledAt cancelledReason
      cards { id tradeId userId cardId quantity condition variation }
    }
  }
`;

const RESPOND_TO_TRADE = gql`
  mutation RespondToTrade($id: ID!, $accept: Boolean!, $counterCards: [TradeCardInput!], $reason: String) {
    respondToTrade(id: $id, accept: $accept, counterCards: $counterCards, reason: $reason) {
      id status
    }
  }
`;

const CANCEL_TRADE = gql`
  mutation CancelTrade($id: ID!, $reason: String) {
    cancelTrade(id: $id, reason: $reason) {
      id status
    }
  }
`;

const UPLOAD_TRADE_PROOF = gql`
  mutation UploadTradeProof($id: ID!, $proofImage: String!, $proofCode: String) {
    uploadTradeProof(id: $id, proofImage: $proofImage, proofCode: $proofCode) {
      trade { id status }
    }
  }
`;

const SUBMIT_TRADE_TRACKING = gql`
  mutation SubmitTradeTracking($id: ID!, $trackingNumber: String!) {
    submitTradeTracking(id: $id, trackingNumber: $trackingNumber) {
      id status
    }
  }
`;

const CONFIRM_TRADE_RECEIVED = gql`
  mutation ConfirmTradeReceived($id: ID!) {
    confirmTradeReceived(id: $id) {
      id status completedAt
    }
  }
`;

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const STATUS_META = {
  INITIATED:     { label: "Pending response", color: "text-amber-500",   bg: "bg-amber-50 dark:bg-amber-950/30",      border: "border-amber-200 dark:border-amber-800" },
  NEGOTIATING:   { label: "Negotiating",      color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-950/30",        border: "border-blue-200 dark:border-blue-800" },
  AGREED:        { label: "Agreed",           color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30",  border: "border-emerald-200 dark:border-emerald-800" },
  PROOF_PENDING: { label: "Proof pending",    color: "text-purple-500",  bg: "bg-purple-50 dark:bg-purple-950/30",    border: "border-purple-200 dark:border-purple-800" },
  LOCKED:        { label: "Locked — ship now",color: "text-indigo-500",  bg: "bg-indigo-50 dark:bg-indigo-950/30",   border: "border-indigo-200 dark:border-indigo-800" },
  IN_TRANSIT:    { label: "In transit",       color: "text-sky-500",     bg: "bg-sky-50 dark:bg-sky-950/30",         border: "border-sky-200 dark:border-sky-800" },
  COMPLETED:     { label: "Completed",        color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800" },
  CANCELLED:     { label: "Cancelled",        color: "text-light-textMuted dark:text-dark-textMuted", bg: "bg-light-alt dark:bg-dark-alt", border: "border-light-border dark:border-dark-border" },
  DISPUTED:      { label: "Disputed",         color: "text-red-500",     bg: "bg-red-50 dark:bg-red-950/30",         border: "border-red-200 dark:border-red-800" },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.INITIATED;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.color} ${meta.bg} border ${meta.border}`}>
      {meta.label}
    </span>
  );
}

function fmt(date) {
  if (!date) return "—";
  try { return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return date; }
}

/** Convert a File to a base64 data URL string */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ─── Trade row ───────────────────────────────────────────────────────────── */

function TradeRow({ trade, myId, onRefresh }) {
  const [open,         setOpen]         = useState(false);
  const [busy,         setBusy]         = useState(false);
  const [err,          setErr]          = useState("");
  const [done,         setDone]         = useState("");

  // Accept/decline
  const [declineReason,  setDeclineReason]  = useState("");
  const [showDecline,    setShowDecline]    = useState(false);

  // Counter offer
  const [showCounter,    setShowCounter]    = useState(false);
  const [counterCards,   setCounterCards]   = useState([]);   // [{cardId,quantity,condition}]

  // Proof upload
  const [proofFile,      setProofFile]      = useState(null);
  const [proofPreview,   setProofPreview]   = useState(null);
  const proofRef = useRef(null);

  // Tracking
  const [trackingNum,    setTrackingNum]    = useState("");
  const [showTracking,   setShowTracking]   = useState(false);

  const [respondToTrade]      = useMutation(RESPOND_TO_TRADE);
  const [cancelTrade]         = useMutation(CANCEL_TRADE);
  const [uploadTradeProof]    = useMutation(UPLOAD_TRADE_PROOF);
  const [submitTradeTracking] = useMutation(SUBMIT_TRADE_TRACKING);
  const [confirmTradeReceived]= useMutation(CONFIRM_TRADE_RECEIVED);

  const isInitiator   = trade.initiatorId === myId;
  const myCards       = (trade.cards || []).filter((c) => c.userId === myId);
  const theirCards    = (trade.cards || []).filter((c) => c.userId !== myId);

  const needsMyResponse =
    (trade.status === "INITIATED"   && !isInitiator) ||
    (trade.status === "NEGOTIATING" && trade.lastCounterBy !== myId);

  const canCancel = !["COMPLETED", "CANCELLED", "DISPUTED"].includes(trade.status) && isInitiator;

  const isActive = !["COMPLETED", "CANCELLED", "DISPUTED"].includes(trade.status);

  /* ── helpers ── */
  async function run(fn, successMsg) {
    setBusy(true); setErr(""); setDone("");
    try {
      await fn();
      setDone(successMsg);
      onRefresh();
    } catch (ex) { setErr(ex.message || "Something went wrong"); }
    finally { setBusy(false); }
  }

  /* ── accept ── */
  async function handleAccept() {
    await run(
      () => respondToTrade({ variables: { id: trade.id, accept: true } }),
      "Trade accepted — both parties agreed!",
    );
  }

  /* ── decline ── */
  async function handleDecline() {
    await run(
      () => respondToTrade({ variables: { id: trade.id, accept: false, reason: declineReason || undefined } }),
      "Trade declined.",
    );
    setShowDecline(false);
  }

  /* ── counter ── */
  function openCounter() {
    // Pre-populate with the user's current cards in the trade
    setCounterCards(
      myCards.length > 0
        ? myCards.map((c) => ({ cardId: c.cardId, quantity: c.quantity || 1, condition: c.condition || "NM" }))
        : [{ cardId: "", quantity: 1, condition: "NM" }],
    );
    setShowCounter(true);
  }

  async function handleCounter() {
    const valid = counterCards.filter((c) => c.cardId.trim());
    if (!valid.length) { setErr("Add at least one card to your counter offer."); return; }
    await run(
      () => respondToTrade({ variables: { id: trade.id, accept: false, counterCards: valid } }),
      "Counter offer sent.",
    );
    setShowCounter(false);
  }

  /* ── cancel ── */
  async function handleCancel() {
    if (!confirm("Cancel this trade?")) return;
    await run(
      () => cancelTrade({ variables: { id: trade.id } }),
      "Trade cancelled.",
    );
  }

  /* ── proof upload ── */
  async function handleProofUpload() {
    if (!proofFile) { setErr("Please select a photo first."); return; }
    const base64 = await fileToBase64(proofFile);
    await run(
      () => uploadTradeProof({ variables: { id: trade.id, proofImage: base64 } }),
      "Proof photo submitted — waiting for the other party.",
    );
    setProofFile(null);
    setProofPreview(null);
  }

  /* ── tracking ── */
  async function handleTracking() {
    if (!trackingNum.trim()) { setErr("Enter a tracking number."); return; }
    await run(
      () => submitTradeTracking({ variables: { id: trade.id, trackingNumber: trackingNum.trim() } }),
      "Tracking number submitted — the other party has been notified.",
    );
    setShowTracking(false);
    setTrackingNum("");
  }

  /* ── confirm receipt ── */
  async function handleConfirmReceived() {
    if (!confirm("Confirm you have received the cards?")) return;
    await run(
      () => confirmTradeReceived({ variables: { id: trade.id } }),
      "Receipt confirmed!",
    );
  }

  const cardCls   = "rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface overflow-hidden";
  const headerCls = "flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-light-alt dark:hover:bg-dark-alt transition-colors";
  const inputCls  = "w-full rounded-xl border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-3 py-2 text-sm text-light-strong dark:text-dark-strong focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent";
  const btnPrimary   = "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-colors";
  const btnDanger    = "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium border border-red-300 dark:border-red-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors";
  const btnSecondary = "px-4 rounded-xl border border-light-border dark:border-dark-border text-sm text-light-textMuted dark:text-dark-textMuted hover:bg-light-alt dark:hover:bg-dark-alt transition-colors";
  const btnBlue      = "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 transition-colors";
  const btnIndigo    = "flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 transition-colors";
  const btnSky       = "flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 disabled:opacity-50 transition-colors";
  const infoBox      = (col) => `flex items-center gap-2 rounded-xl ${col} px-3 py-2`;

  return (
    <div className={cardCls}>
      {/* Header */}
      <div className={headerCls} onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-3 min-w-0">
          <ArrowLeftRight className="w-4 h-4 text-light-textMuted dark:text-dark-textMuted flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-light-strong dark:text-dark-strong truncate">
              Trade {isInitiator ? "you proposed" : "incoming"}
              {needsMyResponse && (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                  Action needed
                </span>
              )}
            </p>
            <p className="text-xs text-light-textMuted dark:text-dark-textMuted">
              {myCards.length} card{myCards.length !== 1 ? "s" : ""} offered ·{" "}
              {theirCards.length} card{theirCards.length !== 1 ? "s" : ""} requested ·{" "}
              {fmt(trade.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={trade.status} />
          {open
            ? <ChevronUp   className="w-4 h-4 text-light-textMuted dark:text-dark-textMuted" />
            : <ChevronDown className="w-4 h-4 text-light-textMuted dark:text-dark-textMuted" />
          }
        </div>
      </div>

      {/* Expanded */}
      {open && (
        <div className="border-t border-light-border dark:border-dark-border px-4 py-4 flex flex-col gap-4">

          {/* Cards side-by-side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted mb-2">You offer</p>
              {myCards.length === 0
                ? <p className="text-xs text-light-textMuted dark:text-dark-textMuted italic">None</p>
                : <div className="flex flex-col gap-1.5">
                    {myCards.map((c) => (
                      <div key={c.id} className="rounded-lg bg-light-alt dark:bg-dark-alt px-3 py-2">
                        <p className="text-xs font-medium text-light-strong dark:text-dark-strong">{c.cardId}</p>
                        <p className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                          {[c.condition, c.variation, c.quantity > 1 ? `×${c.quantity}` : null].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
              }
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted mb-2">They offer</p>
              {theirCards.length === 0
                ? <p className="text-xs text-light-textMuted dark:text-dark-textMuted italic">None</p>
                : <div className="flex flex-col gap-1.5">
                    {theirCards.map((c) => (
                      <div key={c.id} className="rounded-lg bg-light-alt dark:bg-dark-alt px-3 py-2">
                        <p className="text-xs font-medium text-light-strong dark:text-dark-strong">{c.cardId}</p>
                        <p className="text-[10px] text-light-textMuted dark:text-dark-textMuted">
                          {[c.condition, c.variation, c.quantity > 1 ? `×${c.quantity}` : null].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>

          {/* Top-up */}
          {trade.topUpAmount > 0 && (
            <div className="rounded-xl bg-light-alt dark:bg-dark-alt px-3 py-2 text-xs">
              <span className="text-light-textMuted dark:text-dark-textMuted">Cash top-up: </span>
              <span className="font-semibold text-light-strong dark:text-dark-strong">£{Number(trade.topUpAmount).toFixed(2)}</span>
              <span className="text-light-textMuted dark:text-dark-textMuted ml-1">
                paid by {trade.topUpPaidBy === myId ? "you" : "them"}
              </span>
            </div>
          )}

          {trade.counterCount > 0 && (
            <p className="text-xs text-light-textMuted dark:text-dark-textMuted">
              {trade.counterCount} counter{trade.counterCount !== 1 ? "s" : ""} so far
            </p>
          )}

          {/* Feedback messages */}
          {done && (
            <div className={infoBox("bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800")}>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400">{done}</p>
            </div>
          )}
          {err && (
            <div className={infoBox("bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800")}>
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
            </div>
          )}

          {/* ── ACCEPT / DECLINE / COUNTER (INITIATED or NEGOTIATING, ball in my court) ── */}
          {needsMyResponse && !showDecline && !showCounter && (
            <div className="flex gap-2">
              <button onClick={handleAccept} disabled={busy} className={btnPrimary}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Accept
              </button>
              <button onClick={openCounter} disabled={busy} className={btnBlue}>
                <RotateCcw className="w-4 h-4" />
                Counter
              </button>
              <button onClick={() => setShowDecline(true)} disabled={busy} className={btnDanger}>
                <XCircle className="w-4 h-4" />
                Decline
              </button>
            </div>
          )}

          {/* ── DECLINE FORM ── */}
          {showDecline && (
            <div className="flex flex-col gap-2">
              <input value={declineReason} onChange={(e) => setDeclineReason(e.target.value)}
                className={inputCls} placeholder="Reason for declining (optional)" />
              <div className="flex gap-2">
                <button onClick={handleDecline} disabled={busy}
                  className="flex-1 rounded-xl py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Confirm decline"}
                </button>
                <button onClick={() => setShowDecline(false)} className={btnSecondary}>Back</button>
              </div>
            </div>
          )}

          {/* ── COUNTER FORM ── */}
          {showCounter && (
            <div className="flex flex-col gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Your counter offer — what are you offering?</p>
              {counterCards.map((row, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder="Card ID"
                    value={row.cardId}
                    onChange={(e) => setCounterCards((prev) => prev.map((r, j) => j === i ? { ...r, cardId: e.target.value } : r))}
                  />
                  <select
                    className="rounded-xl border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-2 py-2 text-xs text-light-strong dark:text-dark-strong"
                    value={row.condition}
                    onChange={(e) => setCounterCards((prev) => prev.map((r, j) => j === i ? { ...r, condition: e.target.value } : r))}
                  >
                    {["M", "NM", "LP", "MP", "HP", "D"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <input
                    type="number" min="1" max="99"
                    className="w-14 rounded-xl border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-2 py-2 text-xs text-center text-light-strong dark:text-dark-strong"
                    value={row.quantity}
                    onChange={(e) => setCounterCards((prev) => prev.map((r, j) => j === i ? { ...r, quantity: Number(e.target.value) || 1 } : r))}
                  />
                  {counterCards.length > 1 && (
                    <button type="button" onClick={() => setCounterCards((prev) => prev.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button"
                onClick={() => setCounterCards((prev) => [...prev, { cardId: "", quantity: 1, condition: "NM" }])}
                className="self-start flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors">
                <Plus className="w-3 h-3" /> Add card
              </button>
              <div className="flex gap-2">
                <button onClick={handleCounter} disabled={busy} className={btnBlue}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Send counter
                </button>
                <button onClick={() => setShowCounter(false)} className={btnSecondary}>Cancel</button>
              </div>
            </div>
          )}

          {/* ── PROOF UPLOAD (AGREED or PROOF_PENDING) ── */}
          {["AGREED", "PROOF_PENDING"].includes(trade.status) && !done && (
            <div className="flex flex-col gap-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-3">
              <div className="flex items-start gap-2">
                <Camera className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                    {trade.status === "AGREED" ? "Upload proof photo to continue" : "Waiting for the other party's proof — submit yours if you haven't yet"}
                  </p>
                  <p className="text-[10px] text-purple-600/70 dark:text-purple-400/70 mt-0.5">
                    Photo should clearly show the card(s) you're sending.
                  </p>
                </div>
              </div>

              <input
                ref={proofRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setProofFile(f);
                  setProofPreview(URL.createObjectURL(f));
                }}
              />

              {proofPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proofPreview} alt="Proof preview" className="w-full max-h-48 object-contain rounded-lg border border-light-border dark:border-dark-border" />
              )}

              <div className="flex gap-2">
                <button type="button" onClick={() => proofRef.current?.click()} disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-950/40 transition-colors">
                  <Camera className="w-3.5 h-3.5" />
                  {proofFile ? "Change photo" : "Choose photo"}
                </button>
                {proofFile && (
                  <button onClick={handleProofUpload} disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white bg-purple-500 hover:bg-purple-600 disabled:opacity-50 transition-colors">
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Submit proof
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── SUBMIT TRACKING NUMBER (LOCKED) ── */}
          {trade.status === "LOCKED" && !done && (
            <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 p-3">
              <div className="flex items-start gap-2">
                <Truck className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Ship your cards and enter your tracking number</p>
                  <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">
                    Both parties must ship. Enter your tracking number once dispatched.
                  </p>
                </div>
              </div>
              {!showTracking ? (
                <button onClick={() => setShowTracking(true)} className={btnIndigo} disabled={busy}>
                  <Truck className="w-4 h-4" /> Enter tracking number
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder="e.g. JD123456789GB"
                    value={trackingNum}
                    onChange={(e) => setTrackingNum(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleTracking()}
                  />
                  <button onClick={handleTracking} disabled={busy || !trackingNum.trim()} className={btnIndigo}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
                  </button>
                  <button onClick={() => { setShowTracking(false); setTrackingNum(""); }} className={btnSecondary}>Cancel</button>
                </div>
              )}
            </div>
          )}

          {/* ── CONFIRM RECEIPT (IN_TRANSIT) ── */}
          {trade.status === "IN_TRANSIT" && !done && (
            <div className="flex flex-col gap-3 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20 p-3">
              <div className="flex items-start gap-2">
                <PackageCheck className="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">Cards are on their way</p>
                  <p className="text-[10px] text-sky-600/70 dark:text-sky-400/70 mt-0.5">
                    Confirm receipt once your cards arrive. The trade completes when both parties confirm.
                  </p>
                </div>
              </div>
              <button onClick={handleConfirmReceived} disabled={busy} className={btnSky}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                I've received my cards
              </button>
            </div>
          )}

          {/* ── CANCEL (initiator, not terminal) ── */}
          {canCancel && !needsMyResponse && isActive && !["AGREED","PROOF_PENDING","LOCKED","IN_TRANSIT"].includes(trade.status) && (
            <button onClick={handleCancel} disabled={busy}
              className="self-start flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium border border-light-border dark:border-dark-border text-light-textMuted dark:text-dark-textMuted hover:bg-light-alt dark:hover:bg-dark-alt disabled:opacity-50 transition-colors">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              Cancel trade
            </button>
          )}

          {/* ── Completion / cancellation notes ── */}
          {trade.status === "COMPLETED" && (
            <div className={infoBox("bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800")}>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Trade completed {fmt(trade.completedAt)}
              </p>
            </div>
          )}
          {trade.status === "CANCELLED" && trade.cancelledReason && (
            <p className="text-xs text-light-textMuted dark:text-dark-textMuted">
              Reason: {trade.cancelledReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export default function TradesTab({ token, embedded = false, myId }) {
  const [view, setView] = useState("incoming");

  const { data, loading, error, refetch } = useQuery(MY_TRADES_QUERY, {
    variables: {},
    skip: !token,
    fetchPolicy: "cache-and-network",
  });

  const trades   = data?.myTrades ?? [];
  const incoming = trades.filter(
    (t) =>
      (t.status === "INITIATED"   && t.initiatorId !== myId) ||
      (t.status === "NEGOTIATING" && t.lastCounterBy !== myId),
  );
  const active   = trades.filter((t) => !["COMPLETED", "CANCELLED"].includes(t.status));
  const displayed = view === "incoming" ? incoming : trades;

  const handleRefresh = useCallback(() => { refetch(); }, [refetch]);

  const pillBase     = "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border";
  const pillActive   = "bg-light-accent dark:bg-dark-accent text-white border-transparent";
  const pillInactive = "bg-transparent border-light-border dark:border-dark-border text-light-textMuted dark:text-dark-textMuted hover:bg-light-alt dark:hover:bg-dark-alt";

  return (
    <div className={`space-y-4 ${embedded ? "p-6" : ""}`}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-light-strong dark:text-dark-strong">Trades</h2>
          <button onClick={handleRefresh}
            className="p-2 rounded-xl border border-light-border dark:border-dark-border hover:bg-light-alt dark:hover:bg-dark-alt transition-colors"
            title="Refresh">
            <RefreshCw className="w-4 h-4 text-light-textMuted dark:text-dark-textMuted" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={() => setView("incoming")} className={`${pillBase} ${view === "incoming" ? pillActive : pillInactive}`}>
          Incoming
          {incoming.length > 0 && (
            <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${view === "incoming" ? "bg-white/20 text-white" : "bg-amber-500 text-white"}`}>
              {incoming.length}
            </span>
          )}
        </button>
        <button onClick={() => setView("all")} className={`${pillBase} ${view === "all" ? pillActive : pillInactive}`}>
          All trades
          {active.length > 0 && (
            <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${view === "all" ? "bg-white/20 text-white" : "bg-light-textMuted dark:bg-dark-textMuted text-white"}`}>
              {trades.length}
            </span>
          )}
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-light-textMuted dark:text-dark-textMuted" />
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
        </div>
      )}
      {!loading && !error && displayed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <ArrowLeftRight className="w-8 h-8 text-light-textMuted dark:text-dark-textMuted" />
          <p className="text-sm text-light-textMuted dark:text-dark-textMuted">
            {view === "incoming" ? "No trades waiting for your response" : "No trades yet"}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {displayed.map((trade) => (
          <TradeRow key={trade.id} trade={trade} myId={myId} onRefresh={handleRefresh} />
        ))}
      </div>
    </div>
  );
}

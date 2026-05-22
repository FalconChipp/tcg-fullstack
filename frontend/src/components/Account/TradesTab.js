// components/Account/TradesTab.js
// Trade inbox for the dashboard — shows incoming trades needing a response
// and all active/historical trades.
// Mutations: respondToTrade, cancelTrade

"use client";

import React, { useState, useCallback } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import {
  ArrowLeftRight, RefreshCw, Loader2, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, RotateCcw, AlertCircle, Clock,
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
  mutation RespondToTrade($id: ID!, $accept: Boolean!, $reason: String) {
    respondToTrade(id: $id, accept: $accept, reason: $reason) {
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

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const STATUS_META = {
  INITIATED:     { label: "Pending response", color: "text-amber-500",   bg: "bg-amber-50 dark:bg-amber-950/30",  border: "border-amber-200 dark:border-amber-800" },
  NEGOTIATING:   { label: "Negotiating",      color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-950/30",    border: "border-blue-200 dark:border-blue-800" },
  AGREED:        { label: "Agreed",           color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800" },
  PROOF_PENDING: { label: "Proof pending",    color: "text-purple-500",  bg: "bg-purple-50 dark:bg-purple-950/30",  border: "border-purple-200 dark:border-purple-800" },
  LOCKED:        { label: "Locked",           color: "text-indigo-500",  bg: "bg-indigo-50 dark:bg-indigo-950/30",  border: "border-indigo-200 dark:border-indigo-800" },
  IN_TRANSIT:    { label: "In transit",       color: "text-sky-500",     bg: "bg-sky-50 dark:bg-sky-950/30",        border: "border-sky-200 dark:border-sky-800" },
  COMPLETED:     { label: "Completed",        color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800" },
  CANCELLED:     { label: "Cancelled",        color: "text-light-textMuted dark:text-dark-textMuted", bg: "bg-light-alt dark:bg-dark-alt", border: "border-light-border dark:border-dark-border" },
  DISPUTED:      { label: "Disputed",         color: "text-red-500",     bg: "bg-red-50 dark:bg-red-950/30",       border: "border-red-200 dark:border-red-800" },
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

/* ─── Trade row ───────────────────────────────────────────────────────────── */

function TradeRow({ trade, myId, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [showDecline, setShowDecline] = useState(false);

  const [respondToTrade] = useMutation(RESPOND_TO_TRADE);
  const [cancelTrade] = useMutation(CANCEL_TRADE);

  const isInitiator = trade.initiatorId === myId;
  const otherPartyId = trade.partyAId === myId ? trade.partyBId : trade.partyAId;

  // Cards I'm offering vs. what they're offering
  const myCards    = (trade.cards || []).filter((c) => c.userId === myId);
  const theirCards = (trade.cards || []).filter((c) => c.userId !== myId);

  // Whether I need to respond (ball is in my court)
  const needsMyResponse =
    (trade.status === "INITIATED" && !isInitiator) ||
    (trade.status === "NEGOTIATING" && trade.lastCounterBy !== myId);

  const canCancel =
    !["COMPLETED", "CANCELLED", "DISPUTED"].includes(trade.status) && isInitiator;

  async function handleAccept() {
    setBusy(true); setErr("");
    try {
      await respondToTrade({ variables: { id: trade.id, accept: true } });
      onRefresh();
    } catch (ex) { setErr(ex.message || "Failed to accept"); }
    finally { setBusy(false); }
  }

  async function handleDecline() {
    setBusy(true); setErr("");
    try {
      await respondToTrade({ variables: { id: trade.id, accept: false, reason: declineReason || undefined } });
      onRefresh();
    } catch (ex) { setErr(ex.message || "Failed to decline"); }
    finally { setBusy(false); setShowDecline(false); }
  }

  async function handleCancel() {
    if (!confirm("Cancel this trade?")) return;
    setBusy(true); setErr("");
    try {
      await cancelTrade({ variables: { id: trade.id } });
      onRefresh();
    } catch (ex) { setErr(ex.message || "Failed to cancel"); }
    finally { setBusy(false); }
  }

  const cardCls = "rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface overflow-hidden";
  const headerCls = "flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-light-alt dark:hover:bg-dark-alt transition-colors";
  const inputCls = "w-full rounded-xl border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-3 py-2 text-sm text-light-strong dark:text-dark-strong focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent";

  return (
    <div className={cardCls}>
      {/* Header row */}
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
            ? <ChevronUp className="w-4 h-4 text-light-textMuted dark:text-dark-textMuted" />
            : <ChevronDown className="w-4 h-4 text-light-textMuted dark:text-dark-textMuted" />
          }
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-light-border dark:border-dark-border px-4 py-4 flex flex-col gap-4">

          {/* Cards side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted mb-2">
                You offer
              </p>
              {myCards.length === 0 ? (
                <p className="text-xs text-light-textMuted dark:text-dark-textMuted italic">None</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {myCards.map((c) => (
                    <div key={c.id} className="rounded-lg bg-light-alt dark:bg-dark-alt px-3 py-2">
                      <p className="text-xs font-medium text-light-strong dark:text-dark-strong">{c.cardId}</p>
                      <p className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
                        {[c.condition, c.variation, c.quantity > 1 ? `×${c.quantity}` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted mb-2">
                They offer
              </p>
              {theirCards.length === 0 ? (
                <p className="text-xs text-light-textMuted dark:text-dark-textMuted italic">None</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {theirCards.map((c) => (
                    <div key={c.id} className="rounded-lg bg-light-alt dark:bg-dark-alt px-3 py-2">
                      <p className="text-xs font-medium text-light-strong dark:text-dark-strong">{c.cardId}</p>
                      <p className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
                        {[c.condition, c.variation, c.quantity > 1 ? `×${c.quantity}` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top-up */}
          {trade.topUpAmount > 0 && (
            <div className="rounded-xl bg-light-alt dark:bg-dark-alt px-3 py-2 text-xs">
              <span className="text-light-textMuted dark:text-dark-textMuted">Cash top-up: </span>
              <span className="font-semibold text-light-strong dark:text-dark-strong">
                £{Number(trade.topUpAmount).toFixed(2)}
              </span>
              <span className="text-light-textMuted dark:text-dark-textMuted ml-1">
                paid by {trade.topUpPaidBy === myId ? "you" : "them"}
              </span>
            </div>
          )}

          {/* Counter count */}
          {trade.counterCount > 0 && (
            <p className="text-xs text-light-textMuted dark:text-dark-textMuted">
              {trade.counterCount} counter{trade.counterCount !== 1 ? "s" : ""} so far
            </p>
          )}

          {/* Error */}
          {err && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
            </div>
          )}

          {/* Actions */}
          {needsMyResponse && (
            <div className="flex flex-col gap-2">
              {showDecline ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    className={inputCls}
                    placeholder="Reason for declining (optional)"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDecline}
                      disabled={busy}
                      className="flex-1 rounded-xl py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Confirm decline"}
                    </button>
                    <button
                      onClick={() => setShowDecline(false)}
                      className="px-4 rounded-xl border border-light-border dark:border-dark-border text-sm text-light-textMuted dark:text-dark-textMuted hover:bg-light-alt dark:hover:bg-dark-alt transition-colors"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleAccept}
                    disabled={busy}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Accept
                  </button>
                  <button
                    onClick={() => setShowDecline(true)}
                    disabled={busy}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium border border-red-300 dark:border-red-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Decline
                  </button>
                </div>
              )}
            </div>
          )}

          {canCancel && !needsMyResponse && (
            <button
              onClick={handleCancel}
              disabled={busy}
              className="self-start flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium border border-light-border dark:border-dark-border text-light-textMuted dark:text-dark-textMuted hover:bg-light-alt dark:hover:bg-dark-alt disabled:opacity-50 transition-colors"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              Cancel trade
            </button>
          )}

          {trade.status === "AGREED" && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Both parties agreed — submit proof to lock the trade.
              </p>
            </div>
          )}

          {trade.status === "IN_TRANSIT" && (
            <div className="flex items-center gap-2 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 px-3 py-2">
              <Clock className="w-4 h-4 text-sky-500 flex-shrink-0" />
              <p className="text-xs text-sky-700 dark:text-sky-400">
                Cards are on their way. Confirm receipt when yours arrives.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export default function TradesTab({ token, embedded = false, myId }) {
  const [view, setView] = useState("incoming"); // 'incoming' | 'all'

  const { data, loading, error, refetch } = useQuery(MY_TRADES_QUERY, {
    variables: {},
    skip: !token,
    fetchPolicy: "cache-and-network",
  });

  const trades = data?.myTrades ?? [];

  const incoming = trades.filter(
    (t) =>
      (t.status === "INITIATED" && t.initiatorId !== myId) ||
      (t.status === "NEGOTIATING" && t.lastCounterBy !== myId)
  );
  const active = trades.filter(
    (t) => !["COMPLETED", "CANCELLED"].includes(t.status)
  );
  const all = trades;

  const displayed = view === "incoming" ? incoming : all;

  const handleRefresh = useCallback(() => { refetch(); }, [refetch]);

  const pillBase = "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border";
  const pillActive = "bg-light-accent dark:bg-dark-accent text-white border-transparent";
  const pillInactive = "bg-transparent border-light-border dark:border-dark-border text-light-textMuted dark:text-dark-textMuted hover:bg-light-alt dark:hover:bg-dark-alt";

  return (
    <div className={`space-y-4 ${embedded ? "p-6" : ""}`}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-light-strong dark:text-dark-strong">Trades</h2>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl border border-light-border dark:border-dark-border hover:bg-light-alt dark:hover:bg-dark-alt transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-light-textMuted dark:text-dark-textMuted" />
          </button>
        </div>
      )}

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView("incoming")}
          className={`${pillBase} ${view === "incoming" ? pillActive : pillInactive}`}
        >
          Incoming
          {incoming.length > 0 && (
            <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${view === "incoming" ? "bg-white/20 text-white" : "bg-amber-500 text-white"}`}>
              {incoming.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setView("all")}
          className={`${pillBase} ${view === "all" ? pillActive : pillInactive}`}
        >
          All trades
          {active.length > 0 && (
            <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${view === "all" ? "bg-white/20 text-white" : "bg-light-textMuted dark:bg-dark-textMuted text-white"}`}>
              {trades.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
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
          <TradeRow
            key={trade.id}
            trade={trade}
            myId={myId}
            onRefresh={handleRefresh}
          />
        ))}
      </div>
    </div>
  );
}

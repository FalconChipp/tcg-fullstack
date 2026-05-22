// src/components/Account/OffersTab.js
"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Tag, ChevronDown, ChevronUp, Check, X, RotateCcw,
  RefreshCw, AlertCircle, Loader2, Package,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/* ─── GraphQL helper ─────────────────────────────────────────────────────────── */

import { gqlFetch } from "@/utils/apiClient";
const gql = (token, query, variables = {}) => gqlFetch(query, variables, token);

/* ─── Queries / Mutations ────────────────────────────────────────────────────── */

const OFFER_FIELDS = `
  id listingId buyerId amount message status
  expiresAt respondedAt counterAmount counterMessage
  createdAt updatedAt
  buyer { id username avatar }
  listing {
    id title price cardId
    cardInfo { name imageSmall setName }
  }
`;

const MY_INCOMING_OFFERS_QUERY = `
  query MyIncomingOffers {
    myIncomingOffers { ${OFFER_FIELDS} }
  }
`;

const MY_OFFERS_QUERY = `
  query MyOffers {
    myOffers { ${OFFER_FIELDS} }
  }
`;

const RESPOND_TO_OFFER = `
  mutation RespondToOffer(
    $offerId: ID!
    $action: String!
    $counterAmount: Float
    $counterMessage: String
    $buyerAddress: JSON
  ) {
    respondToOffer(
      offerId: $offerId
      action: $action
      counterAmount: $counterAmount
      counterMessage: $counterMessage
      buyerAddress: $buyerAddress
    ) {
      ok status orderId clientSecret totalAmount counterAmount
    }
  }
`;

const WITHDRAW_OFFER = `
  mutation WithdrawOffer($offerId: ID!) {
    withdrawOffer(offerId: $offerId)
  }
`;

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function fmt(n) {
  return typeof n === "number"
    ? `£${n.toFixed(2)}`
    : n != null
    ? `£${Number(n).toFixed(2)}`
    : "—";
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function expiresIn(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `< 1h left`;
  if (h < 24) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

const STATUS_META = {
  pending:   { label: "Pending",   cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  accepted:  { label: "Accepted",  cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  declined:  { label: "Declined",  cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  countered: { label: "Countered", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  withdrawn: { label: "Withdrawn", cls: "bg-light-border/60 text-light-textMuted dark:bg-dark-border/60 dark:text-dark-textMuted" },
  expired:   { label: "Expired",   cls: "bg-light-border/60 text-light-textMuted dark:bg-dark-border/60 dark:text-dark-textMuted" },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? { label: status, cls: "bg-light-border/60 text-light-textMuted" };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>
      {m.label}
    </span>
  );
}

/* ─── Card thumbnail ──────────────────────────────────────────────────────────── */

function CardThumb({ src, alt }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="w-10 h-14 rounded bg-light-alt dark:bg-dark-alt flex items-center justify-center shrink-0">
        <Package className="w-4 h-4 text-light-textMuted dark:text-dark-textMuted" />
      </div>
    );
  }
  return (
    <div className="relative w-10 h-14 rounded overflow-hidden shrink-0">
      <Image src={src} alt={alt || "card"} fill className="object-cover" sizes="40px" onError={() => setErr(true)} />
    </div>
  );
}

/* ─── Counter form ────────────────────────────────────────────────────────────── */

function CounterForm({ onSubmit, onCancel, loading }) {
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");

  return (
    <div className="mt-3 p-3 rounded-xl bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border space-y-2">
      <p className="text-xs font-semibold text-light-textSecondary dark:text-dark-textSecondary">Counter offer</p>
      <input
        type="number"
        min="0.01"
        step="0.01"
        placeholder="Counter amount (£)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full px-3 py-1.5 rounded-lg border border-light-border dark:border-dark-border bg-light-background dark:bg-dark-background text-sm"
      />
      <textarea
        rows={2}
        placeholder="Optional message…"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        className="w-full px-3 py-1.5 rounded-lg border border-light-border dark:border-dark-border bg-light-background dark:bg-dark-background text-sm resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(Number(amount), msg || null)}
          disabled={!amount || Number(amount) <= 0 || loading}
          className="flex-1 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold transition"
        >
          {loading ? "Sending…" : "Send counter"}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-1.5 rounded-lg border border-light-border dark:border-dark-border text-sm hover:bg-light-alt dark:hover:bg-dark-alt transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── Incoming offer row (seller view) ──────────────────────────────────────── */

function IncomingOfferRow({ offer, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isPending = offer.status === "pending";
  const img = offer.listing?.cardInfo?.imageSmall;
  const title = offer.listing?.title ?? offer.listing?.cardInfo?.name ?? "Listing";
  const exp = expiresIn(offer.expiresAt);

  const act = useCallback(
    async (action, extra = {}) => {
      setBusy(true);
      setError(null);
      try {
        await onAction(offer.id, action, extra);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
        setShowCounter(false);
      }
    },
    [offer.id, onAction]
  );

  return (
    <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-light-alt dark:hover:bg-dark-alt transition text-left"
      >
        <CardThumb src={img} alt={title} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{title}</p>
          <p className="text-xs text-light-textMuted dark:text-dark-textMuted">
            From{" "}
            <span className="font-medium text-light-text dark:text-dark-text">
              {offer.buyer?.username ?? "buyer"}
            </span>
            {" · "}{timeAgo(offer.createdAt)}
            {exp && isPending && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">· {exp}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold">{fmt(offer.amount)}</span>
          <StatusBadge status={offer.status} />
          {expanded ? <ChevronUp className="w-4 h-4 text-light-textMuted" /> : <ChevronDown className="w-4 h-4 text-light-textMuted" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-light-border dark:border-dark-border pt-3 space-y-3">
          {offer.message && (
            <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary italic">
              "{offer.message}"
            </p>
          )}

          {offer.listing && (
            <p className="text-xs text-light-textMuted dark:text-dark-textMuted">
              Listed at{" "}
              <span className="font-semibold">{fmt(offer.listing.price)}</span>
              {" · "}
              <Link
                href={`/marketplace/listing/${offer.listingId}`}
                className="underline hover:no-underline"
              >
                View listing ↗
              </Link>
            </p>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          {isPending && !showCounter && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => act("accept")}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Accept
              </button>
              <button
                onClick={() => setShowCounter(true)}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Counter
              </button>
              <button
                onClick={() => act("decline")}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-light-border dark:border-dark-border hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-semibold transition disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> Decline
              </button>
            </div>
          )}

          {isPending && showCounter && (
            <CounterForm
              loading={busy}
              onCancel={() => setShowCounter(false)}
              onSubmit={(counterAmount, counterMessage) =>
                act("counter", { counterAmount, counterMessage })
              }
            />
          )}

          {offer.status === "accepted" && offer.listing && (
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              ✓ Accepted — order created
            </p>
          )}

          {offer.status === "countered" && (
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              Counter sent at {fmt(offer.counterAmount)}
              {offer.counterMessage && ` — "${offer.counterMessage}"`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Sent offer row (buyer view) ────────────────────────────────────────────── */

function SentOfferRow({ offer, onWithdraw }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const canWithdraw = ["pending", "countered"].includes(offer.status);
  const img = offer.listing?.cardInfo?.imageSmall;
  const title = offer.listing?.title ?? offer.listing?.cardInfo?.name ?? "Listing";
  const exp = expiresIn(offer.expiresAt);

  const handleWithdraw = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await onWithdraw(offer.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [offer.id, onWithdraw]);

  return (
    <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-light-alt dark:hover:bg-dark-alt transition text-left"
      >
        <CardThumb src={img} alt={title} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{title}</p>
          <p className="text-xs text-light-textMuted dark:text-dark-textMuted">
            {timeAgo(offer.createdAt)}
            {exp && offer.status === "pending" && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">· {exp}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold">{fmt(offer.amount)}</span>
          <StatusBadge status={offer.status} />
          {expanded ? <ChevronUp className="w-4 h-4 text-light-textMuted" /> : <ChevronDown className="w-4 h-4 text-light-textMuted" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-light-border dark:border-dark-border pt-3 space-y-3">
          {offer.message && (
            <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary italic">
              Your note: "{offer.message}"
            </p>
          )}

          {offer.status === "countered" && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                Seller countered at {fmt(offer.counterAmount)}
              </p>
              {offer.counterMessage && (
                <p className="text-xs mt-1 text-blue-700 dark:text-blue-400 italic">
                  "{offer.counterMessage}"
                </p>
              )}
              <p className="text-xs mt-2 text-blue-600 dark:text-blue-400">
                To accept, visit the{" "}
                <Link
                  href={`/marketplace/listing/${offer.listingId}`}
                  className="underline hover:no-underline"
                >
                  listing page
                </Link>{" "}
                and make a new offer at that price.
              </p>
            </div>
          )}

          {offer.listing && (
            <p className="text-xs text-light-textMuted dark:text-dark-textMuted">
              Listed at <span className="font-semibold">{fmt(offer.listing.price)}</span>
              {" · "}
              <Link
                href={`/marketplace/listing/${offer.listingId}`}
                className="underline hover:no-underline"
              >
                View listing ↗
              </Link>
            </p>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          {canWithdraw && (
            <button
              onClick={handleWithdraw}
              disabled={busy}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-light-border dark:border-dark-border hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-semibold transition disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              Withdraw offer
            </button>
          )}

          {offer.status === "accepted" && (
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              ✓ Offer accepted — check your Orders tab to complete payment
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────────── */

function Empty({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <Tag className="w-10 h-10 text-light-border dark:text-dark-border" />
      <p className="text-light-textMuted dark:text-dark-textMuted text-sm">{message}</p>
    </div>
  );
}

/* ─── Main tab ───────────────────────────────────────────────────────────────── */

export default function OffersTab({ token, embedded = false }) {
  const [view, setView] = useState("incoming"); // "incoming" | "sent"
  const [incomingOffers, setIncomingOffers] = useState([]);
  const [sentOffers, setSentOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ── Fetch ── */
  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [incData, sentData] = await Promise.all([
        gql(token, MY_INCOMING_OFFERS_QUERY),
        gql(token, MY_OFFERS_QUERY),
      ]);
      setIncomingOffers(incData?.myIncomingOffers ?? []);
      setSentOffers(sentData?.myOffers ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Actions ── */
  const handleRespond = useCallback(
    async (offerId, action, extra = {}) => {
      await gql(token, RESPOND_TO_OFFER, { offerId, action, ...extra });
      await fetchAll();
    },
    [token, fetchAll]
  );

  const handleWithdraw = useCallback(
    async (offerId) => {
      await gql(token, WITHDRAW_OFFER, { offerId });
      await fetchAll();
    },
    [token, fetchAll]
  );

  /* ── Counts for badges ── */
  const pendingIncoming = incomingOffers.filter((o) => o.status === "pending").length;
  const activeSent = sentOffers.filter((o) => ["pending", "countered"].includes(o.status)).length;

  /* ── Render ── */
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-light-textMuted dark:text-dark-textMuted">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading offers…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 text-sm mb-3">{error}</p>
        <button
          onClick={fetchAll}
          className="px-4 py-2 rounded-lg bg-light-accent text-white text-sm font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header — hidden when embedded in Dashboard */}
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold">Offers</h2>
            <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary mt-0.5">
              Manage offers you've received and sent
            </p>
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-light-border dark:border-dark-border hover:bg-light-alt dark:hover:bg-dark-alt text-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      )}

      {/* View toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-light-alt dark:bg-dark-alt w-fit">
        {[
          { key: "incoming", label: "Incoming", count: pendingIncoming },
          { key: "sent",     label: "Sent",     count: activeSent },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`
              relative px-4 py-1.5 rounded-lg text-sm font-semibold transition
              ${view === key
                ? "bg-light-surface dark:bg-dark-surface shadow text-light-text dark:text-dark-text"
                : "text-light-textMuted dark:text-dark-textMuted hover:text-light-text dark:hover:text-dark-text"}
            `}
          >
            {label}
            {count > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-light-accent dark:bg-dark-accent text-white text-[10px] font-bold">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {view === "incoming" && (
        <div className="space-y-3">
          {incomingOffers.length === 0 ? (
            <Empty message="No offers on your listings yet" />
          ) : (
            <>
              {/* Pending first, then rest */}
              {[
                ...incomingOffers.filter((o) => o.status === "pending"),
                ...incomingOffers.filter((o) => o.status !== "pending"),
              ].map((offer) => (
                <IncomingOfferRow key={offer.id} offer={offer} onAction={handleRespond} />
              ))}
            </>
          )}
        </div>
      )}

      {view === "sent" && (
        <div className="space-y-3">
          {sentOffers.length === 0 ? (
            <Empty message="You haven't made any offers yet" />
          ) : (
            <>
              {/* Active first */}
              {[
                ...sentOffers.filter((o) => ["pending", "countered"].includes(o.status)),
                ...sentOffers.filter((o) => !["pending", "countered"].includes(o.status)),
              ].map((offer) => (
                <SentOfferRow key={offer.id} offer={offer} onWithdraw={handleWithdraw} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

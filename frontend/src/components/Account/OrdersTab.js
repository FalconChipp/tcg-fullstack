// src/components/Account/OrdersTab.js
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

/* ─── GraphQL ─────────────────────────────────────────────────────────────────── */

import { gqlFetch } from "@/utils/apiClient";
const gql = (token, query, variables = {}) => gqlFetch(query, variables, token);

const MY_ORDERS_QUERY = `
  query MyOrders($role: String, $limit: Int) {
    myOrders(role: $role, limit: $limit) {
      id orderNumber totalAmount salePrice shippingCost currency
      paymentStatus fulfilmentStatus walletAmountPence clientSecret
      trackingNumber trackingCarrier
      buyerId sellerId
      createdAt shippedAt completedAt cancelledAt
      buyer  { id username avatar }
      seller { id username avatar }
      listing {
        ... on CardListing {
          id title rating
          cardInfo { name imageSmall setName }
        }
      }
    }
  }
`;

const GET_WALLET_BALANCE = `
  query MyWalletBalance { myWallet(limit: 0) { balancePence currency } }
`;

const APPLY_WALLET_TO_ORDER = `
  mutation ApplyWalletToOrder($orderId: ID!, $walletAmountPence: Int!) {
    applyWalletToOrder(orderId: $orderId, walletAmountPence: $walletAmountPence) {
      ok clientSecret walletAmountPence cardTotal
    }
  }
`;

const SHIP_ORDER = `
  mutation ShipOrder($id: ID!) {
    shipOrder(id: $id) {
      ok trackingNumber trackingUrl labelUrl labelBase64 carrier service labelCost
    }
  }
`;

const CONFIRM_RECEIVED = `
  mutation ConfirmOrderReceived($id: ID!) {
    confirmOrderReceived(id: $id) {
      id fulfilmentStatus paymentStatus completedAt
    }
  }
`;

const RAISE_DISPUTE = `
  mutation RaiseOrderDispute($id: ID!, $reason: String!) {
    raiseOrderDispute(id: $id, reason: $reason) {
      id fulfilmentStatus
    }
  }
`;

const CANCEL_ORDER = `
  mutation CancelOrder($id: ID!, $reason: String) {
    cancelOrder(id: $id, reason: $reason) {
      id fulfilmentStatus paymentStatus cancelledAt
    }
  }
`;

const LEAVE_FEEDBACK = `
  mutation LeaveOrderFeedback($id: ID!, $rating: Int!, $review: String) {
    leaveOrderFeedback(id: $id, rating: $rating, review: $review)
  }
`;

const DISPUTE_REVIEW = `
  mutation DisputeOrderReview($id: ID!, $reason: String) {
    disputeOrderReview(id: $id, reason: $reason)
  }
`;

/* ─── Status helpers ──────────────────────────────────────────────────────────── */

const FULFILMENT_META = {
  pending:           { label: "Pending",          cls: "bg-vault-textTertiary/15 text-vault-textTertiary" },
  awaiting_shipment: { label: "Awaiting shipment", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  shipped:           { label: "Shipped",           cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  completed:         { label: "Completed",         cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  cancelled:         { label: "Cancelled",         cls: "bg-red-500/15 text-red-500" },
  disputed:          { label: "Disputed",          cls: "bg-orange-500/15 text-orange-500" },
};

function StatusBadge({ status }) {
  const m = FULFILMENT_META[status] || { label: status, cls: "bg-vault-raised text-vault-textTertiary" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[6px] text-xs font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}

function fmt(amount, currency = "GBP") {
  const sym = String(currency).toUpperCase() === "GBP" ? "£" : "$";
  return `${sym}${Number(amount || 0).toFixed(2)}`;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/* ─── Stripe ──────────────────────────────────────────────────────────────────── */

let _stripePromise = null;
function getStripe() {
  if (!_stripePromise)
    _stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");
  return _stripePromise;
}

/* ─── PendingPaymentPanel — for buyer on an accepted-offer order ──────────────── */

function ConfirmCardForm({ clientSecret, onSuccess, onError }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function handlePay(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: elements.getElement(CardElement) },
    });
    setBusy(false);
    if (error) { onError(error.message); return; }
    if (paymentIntent?.status === "requires_capture" || paymentIntent?.status === "succeeded") {
      onSuccess();
    } else {
      onError(`Unexpected status: ${paymentIntent?.status}`);
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-3">
      <div className="rounded-[10px] border border-vault-border bg-vault-raised px-4 py-3">
        <CardElement options={{ hidePostalCode: true }} />
      </div>
      <button type="submit" disabled={busy || !stripe}
        className="w-full py-2.5 rounded-[10px] text-sm font-semibold text-white bg-vault-accent hover:bg-vault-accentHover disabled:opacity-50 transition">
        {busy ? "Processing…" : "Pay by card"}
      </button>
    </form>
  );
}

function PendingPaymentPanel({ order, token, onPaid }) {
  const [walletBalance, setWalletBalance]   = useState(0);
  const [walletCurrency, setWalletCurrency] = useState("GBP");
  const [useWallet, setUseWallet]           = useState(false);
  const [walletInput, setWalletInput]       = useState(0);
  const [stage, setStage]                   = useState("idle"); // idle | applying | card | done
  const [clientSecret, setClientSecret]     = useState(order.clientSecret || null);
  const [busy, setBusy]                     = useState(false);
  const [err, setErr]                       = useState(null);

  const totalPence = Math.round(Number(order.totalAmount) * 100);

  useEffect(() => {
    if (!token) return;
    gql(token, GET_WALLET_BALANCE)
      .then(d => {
        const p = d?.myWallet?.balancePence ?? 0;
        setWalletBalance(p);
        if (d?.myWallet?.currency) setWalletCurrency(d.myWallet.currency);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (useWallet) setWalletInput(Math.min(walletBalance, totalPence));
  }, [useWallet, walletBalance, totalPence]);

  const walletApplied = useWallet ? Math.min(walletInput, walletBalance, totalPence) : 0;
  const cardPence     = totalPence - walletApplied;

  async function handleApplyAndPay() {
    setErr(null);
    setBusy(true);
    try {
      if (walletApplied > 0) {
        const data = await gql(token, APPLY_WALLET_TO_ORDER, {
          orderId: order.id,
          walletAmountPence: walletApplied,
        });
        const result = data.applyWalletToOrder;
        if (!result.clientSecret) {
          // Fully wallet-paid — already authorised
          onPaid();
          return;
        }
        setClientSecret(result.clientSecret);
      }
      setStage("card");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (stage === "card" && clientSecret) {
    return (
      <div className="p-4 rounded-[10px] border border-vault-accent/30 bg-vault-accent/5 dark:bg-vault-accent/5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-vault-accent">
          Complete card payment
        </p>
        {walletApplied > 0 && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Wallet: −£{(walletApplied / 100).toFixed(2)} · Card: £{(cardPence / 100).toFixed(2)}
          </p>
        )}
        {err && <p className="text-xs text-red-500">{err}</p>}
        <Elements stripe={getStripe()}>
          <ConfirmCardForm
            clientSecret={clientSecret}
            onSuccess={onPaid}
            onError={setErr}
          />
        </Elements>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-[10px] border border-amber-400/30 bg-amber-500/5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
        Payment required · £{Number(order.totalAmount).toFixed(2)}
      </p>
      <p className="text-xs text-vault-textTertiary">
        The seller accepted your offer. Authorise payment to confirm the order.
      </p>

      {walletBalance > 0 && (
        <div className="space-y-2">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={useWallet}
                onChange={e => setUseWallet(e.target.checked)} />
              <div className={`w-8 h-5 rounded-[6px] transition-colors ${useWallet ? "bg-vault-accent" : "bg-vault-border dark:bg-vault-border"}`} />
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-[6px] bg-white  transition-transform ${useWallet ? "translate-x-3" : ""}`} />
            </div>
            <span className="text-xs text-vault-text">
              Use wallet (£{(walletBalance / 100).toFixed(2)} available)
            </span>
          </label>

          {useWallet && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-vault-textTertiary w-16">Amount (£)</span>
              <input type="number" min="0.01" max={(walletBalance / 100).toFixed(2)} step="0.01"
                value={(walletInput / 100).toFixed(2)}
                onChange={e => setWalletInput(Math.min(Math.round(parseFloat(e.target.value || "0") * 100), walletBalance))}
                className="flex-1 px-2 py-1 rounded-[6px] border border-vault-border bg-vault-bg text-xs" />
            </div>
          )}

          {useWallet && walletApplied > 0 && (
            <p className="text-xs">
              <span className="text-emerald-600 dark:text-emerald-400">Wallet: −£{(walletApplied / 100).toFixed(2)}</span>
              {cardPence > 0
                ? <span className="text-vault-textTertiary"> · Card: £{(cardPence / 100).toFixed(2)}</span>
                : <span className="text-emerald-600 dark:text-emerald-400"> · No card payment needed</span>}
            </p>
          )}
        </div>
      )}

      {err && <p className="text-xs text-red-500">{err}</p>}

      {useWallet && walletApplied >= totalPence ? (
        <button onClick={handleApplyAndPay} disabled={busy}
          className="w-full py-2 rounded-[10px] text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition">
          {busy ? "Processing…" : "Confirm order (wallet only)"}
        </button>
      ) : (
        <button onClick={useWallet && walletApplied > 0 ? handleApplyAndPay : () => setStage("card")}
          disabled={busy}
          className="w-full py-2 rounded-[10px] text-xs font-semibold text-white bg-vault-accent hover:bg-vault-accentHover disabled:opacity-50 transition">
          {busy ? "Processing…" : `Continue to card payment · £${(cardPence / 100).toFixed(2)}`}
        </button>
      )}
    </div>
  );
}

/* ─── Star rating ─────────────────────────────────────────────────────────────── */

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className={`text-2xl transition ${(hover || value) >= n ? "text-amber-400" : "text-vault-border dark:text-vault-border"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/* ─── Order detail panel ──────────────────────────────────────────────────────── */

function OrderDetail({ order, token, isBuyer, onUpdated }) {
  const [disputeReason, setDispute]     = useState("");
  const [cancelReason, setCancel]       = useState("");
  const [flagReason, setFlagReason]     = useState("");
  const [rating, setRating]             = useState(0);
  const [review, setReview]             = useState("");
  const [activeForm, setActiveForm]     = useState(null); // 'dispute'|'cancel'|'feedback'|'flag'
  const [busy, setBusy]               = useState(false);
  const [err, setErr]                 = useState(null);
  const [done, setDone]               = useState(null);
  const [labelResult, setLabelResult] = useState(null);

  const fs = order.fulfilmentStatus;

  async function act(mutation, variables, successMsg) {
    setBusy(true); setErr(null);
    try {
      const data = await gql(token, mutation, variables);
      const updated = Object.values(data)[0];
      onUpdated(order.id, updated);
      setDone(successMsg);
      setActiveForm(null);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="px-4 pb-4 pt-1 space-y-4">
      {/* Order meta */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-xs text-vault-textTertiary mb-0.5">Order</div>
          <div className="font-mono font-semibold text-xs">{order.id.slice(0, 8).toUpperCase()}</div>
        </div>
        <div>
          <div className="text-xs text-vault-textTertiary mb-0.5">Placed</div>
          <div className="font-semibold">{fmtDate(order.createdAt)}</div>
        </div>
        <div>
          <div className="text-xs text-vault-textTertiary mb-0.5">
            {isBuyer ? "Seller" : "Buyer"}
          </div>
          <div className="font-semibold">
            {isBuyer ? (order.seller?.username || "—") : (order.buyer?.username || "—")}
          </div>
        </div>
        <div>
          <div className="text-xs text-vault-textTertiary mb-0.5">Total</div>
          <div className="font-bold">{fmt(order.totalAmount, order.currency)}</div>
        </div>
      </div>

      {/* Tracking info */}
      {order.trackingNumber && (
        <div className="flex items-center gap-3 p-3 rounded-[10px] bg-blue-500/5 border border-blue-500/20 text-sm">
          <span className="text-xl">📦</span>
          <div>
            <div className="font-semibold text-blue-600 dark:text-blue-400">Tracking: {order.trackingNumber}</div>
            {order.trackingCarrier && <div className="text-xs text-vault-textTertiary">via {order.trackingCarrier}</div>}
            {order.shippedAt && <div className="text-xs text-vault-textTertiary">Shipped {fmtDate(order.shippedAt)}</div>}
          </div>
        </div>
      )}

      {done && (
        <div className="p-3 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
          ✅ {done}
        </div>
      )}
      {err && <div className="p-3 rounded-[10px] bg-red-500/5 border border-red-400/30 text-sm text-red-500">{err}</div>}

      {/* Label result */}
      {labelResult && (
        <div className="p-4 rounded-[10px] bg-emerald-500/5 border border-emerald-500/30 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Label created</p>
          {labelResult.trackingNumber && (
            <p className="text-sm">
              <span className="font-semibold">Tracking:</span>{" "}
              {labelResult.trackingUrl
                ? <a href={labelResult.trackingUrl} target="_blank" rel="noreferrer" className="underline text-blue-600 dark:text-blue-400">{labelResult.trackingNumber}</a>
                : labelResult.trackingNumber}
              {labelResult.carrier && <span className="text-vault-textTertiary"> via {labelResult.carrier}</span>}
            </p>
          )}
          {labelResult.service && (
            <p className="text-xs text-vault-textTertiary">Service: {labelResult.service}</p>
          )}
          {labelResult.labelCost != null && (
            <p className="text-xs text-vault-textTertiary">Label cost: £{Number(labelResult.labelCost).toFixed(2)}</p>
          )}
          {labelResult.labelUrl && (
            <a href={labelResult.labelUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-semibold bg-vault-accent text-white hover:opacity-90 transition">
              🖨 Print label
            </a>
          )}
          {labelResult.labelBase64 && !labelResult.labelUrl && (
            <button type="button"
              onClick={() => {
                const byteStr = atob(labelResult.labelBase64);
                const arr = new Uint8Array(byteStr.length);
                for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
                const blob = new Blob([arr], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-semibold bg-vault-accent text-white hover:opacity-90 transition">
              🖨 Print label (PDF)
            </button>
          )}
        </div>
      )}

      {/* Pending payment — buyer must pay for an accepted-offer order */}
      {isBuyer && order.paymentStatus === "pending" && (
        <PendingPaymentPanel
          order={order}
          token={token}
          onPaid={() => {
            onUpdated(order.id, { paymentStatus: "authorised", fulfilmentStatus: "awaiting_shipment" });
            setDone("Payment confirmed — the seller will be notified to ship.");
          }}
        />
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Seller: create shipping label */}
        {!isBuyer && fs === "awaiting_shipment" && !labelResult && (
          <button type="button" disabled={busy}
            onClick={async () => {
              setBusy(true); setErr(null);
              try {
                const data = await gql(token, SHIP_ORDER, { id: order.id });
                const result = data?.shipOrder;
                setLabelResult(result);
                onUpdated(order.id, { fulfilmentStatus: "shipped", trackingNumber: result?.trackingNumber, trackingCarrier: result?.carrier, shippedAt: new Date().toISOString() });
                setDone("Shipping label created — order marked as shipped.");
              } catch (e) { setErr(e.message); }
              finally { setBusy(false); }
            }}
            className="px-3 py-1.5 rounded-[6px] text-xs font-semibold bg-vault-accent text-white hover:bg-vault-accentHover transition disabled:opacity-50">
            {busy ? "Creating label…" : "🏷 Create shipping label"}
          </button>
        )}
        {/* Buyer: confirm received */}
        {isBuyer && fs === "shipped" && (
          <button type="button" disabled={busy}
            onClick={() => act(CONFIRM_RECEIVED, { id: order.id }, "Receipt confirmed — payment released to seller.")}
            className="px-3 py-1.5 rounded-[6px] text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition disabled:opacity-50">
            {busy ? "…" : "Confirm received"}
          </button>
        )}
        {/* Buyer: raise dispute */}
        {isBuyer && ["shipped", "awaiting_shipment"].includes(fs) && (
          <button type="button" onClick={() => setActiveForm(f => f === "dispute" ? null : "dispute")}
            className="px-3 py-1.5 rounded-[6px] text-xs font-semibold border border-orange-400/40 text-orange-500 hover:bg-orange-500/10 transition">
            Raise dispute
          </button>
        )}
        {/* Both: cancel */}
        {["pending", "awaiting_shipment"].includes(fs) && (
          <button type="button" onClick={() => setActiveForm(f => f === "cancel" ? null : "cancel")}
            className="px-3 py-1.5 rounded-[6px] text-xs font-semibold border border-red-400/40 text-red-500 hover:bg-red-500/10 transition">
            Cancel order
          </button>
        )}
        {/* Seller: flag a review they've received */}
        {!isBuyer && fs === "completed" && order.listing?.rating && (
          <button type="button" onClick={() => setActiveForm(f => f === "flag" ? null : "flag")}
            className="px-3 py-1.5 rounded-[6px] text-xs font-semibold border border-red-400/40 text-red-500 hover:bg-red-500/10 transition">
            Flag review
          </button>
        )}

        {/* Buyer: leave feedback */}
        {isBuyer && fs === "completed" && (
          order.listing?.rating ? (
            <span className="px-3 py-1.5 rounded-[6px] text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1">
              {"★".repeat(order.listing.rating)} Feedback given
            </span>
          ) : (
            <button type="button" onClick={() => setActiveForm(f => f === "feedback" ? null : "feedback")}
              className="px-3 py-1.5 rounded-[6px] text-xs font-semibold border border-amber-400/40 text-amber-600 hover:bg-amber-500/10 transition">
              Leave feedback
            </button>
          )
        )}
      </div>

      {/* Inline forms */}
      {activeForm === "dispute" && (
        <div className="p-4 rounded-[10px] border border-orange-400/30 bg-orange-500/5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">Raise a dispute</p>
          <textarea value={disputeReason} onChange={e => setDispute(e.target.value)} rows={3}
            placeholder="Describe the issue — item not received, not as described, etc."
            className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          <button type="button" disabled={!disputeReason.trim() || busy}
            onClick={() => act(RAISE_DISPUTE, { id: order.id, reason: disputeReason }, "Dispute raised — our team will review it.")}
            className="px-4 py-1.5 rounded-[6px] text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition disabled:opacity-50">
            {busy ? "Submitting…" : "Submit dispute"}
          </button>
        </div>
      )}

      {activeForm === "cancel" && (
        <div className="p-4 rounded-[10px] border border-red-400/30 bg-red-500/5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Cancel order</p>
          <textarea value={cancelReason} onChange={e => setCancel(e.target.value)} rows={2}
            placeholder="Reason (optional)"
            className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
          <button type="button" disabled={busy}
            onClick={() => act(CANCEL_ORDER, { id: order.id, reason: cancelReason || null }, "Order cancelled.")}
            className="px-4 py-1.5 rounded-[6px] text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50">
            {busy ? "Cancelling…" : "Confirm cancel"}
          </button>
        </div>
      )}

      {activeForm === "flag" && (
        <div className="p-4 rounded-[10px] border border-red-400/30 bg-red-500/5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Flag review as suspicious</p>
          <p className="text-xs text-vault-textTertiary">
            This sends the review to our moderation team. It will be held from your reputation score while under review.
          </p>
          <textarea value={flagReason} onChange={e => setFlagReason(e.target.value)} rows={2}
            placeholder="Why do you think this review is unfair or fraudulent? (optional)"
            className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
          <button type="button" disabled={busy}
            onClick={() => act(DISPUTE_REVIEW, { id: order.id, reason: flagReason || null }, "Review flagged — our team will investigate.")}
            className="px-4 py-1.5 rounded-[6px] text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50">
            {busy ? "Submitting…" : "Submit flag"}
          </button>
        </div>
      )}

      {activeForm === "feedback" && (
        <div className="p-4 rounded-[10px] border border-amber-400/30 bg-amber-500/5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Leave feedback</p>
          <StarPicker value={rating} onChange={setRating} />
          <textarea value={review} onChange={e => setReview(e.target.value)} rows={2}
            placeholder="Optional review…"
            className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          <button type="button" disabled={!rating || busy}
            onClick={() => act(LEAVE_FEEDBACK, { id: order.id, rating, review: review || null }, "Feedback submitted — thank you!")}
            className="px-4 py-1.5 rounded-[6px] text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-50">
            {busy ? "Submitting…" : "Submit feedback"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Order row ───────────────────────────────────────────────────────────────── */

function OrderRow({ order: initial, token, myId }) {
  const [order, setOrder]     = useState(initial);
  const [expanded, setExpanded] = useState(false);

  const isBuyer   = order.buyerId === myId;
  const cardName  = order.listing?.cardInfo?.name || order.listing?.title || null;
  const cardImg   = order.listing?.cardInfo?.imageSmall || null;
  const setName   = order.listing?.cardInfo?.setName || null;
  const counterparty = isBuyer ? order.seller?.username : order.buyer?.username;

  function handleUpdated(id, patch) {
    setOrder(o => ({ ...o, ...patch }));
  }

  return (
    <li className="rounded-[10px] border border-vault-border bg-vault-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-vault-raised/50 dark:hover:bg-vault-raised/50 transition"
      >
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-10 h-[58px] rounded-[6px] overflow-hidden bg-black/20 dark:bg-white/5 border border-vault-border">
          {cardImg
            ? <img src={cardImg} alt={cardName} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-base">🃏</div>}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="font-bold text-sm text-vault-accent dark:text-vault-accent truncate">
              {cardName || `Order ${order.id.slice(0, 8).toUpperCase()}`}
            </span>
            <StatusBadge status={order.fulfilmentStatus} />
            <span className={`text-xs px-2 py-0.5 rounded-[6px] font-semibold ${isBuyer ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-purple-500/10 text-purple-600 dark:text-purple-400"}`}>
              {isBuyer ? "Buying" : "Selling"}
            </span>
          </div>
          <div className="text-xs text-vault-textTertiary">
            {[setName, counterparty ? (isBuyer ? `from ${counterparty}` : `to ${counterparty}`) : null, fmtDate(order.createdAt)].filter(Boolean).join(" • ")}
          </div>
        </div>

        {/* Price + chevron */}
        <div className="flex-shrink-0 flex items-center gap-3">
          <span className="font-extrabold text-base text-vault-accent dark:text-vault-accent">
            {fmt(order.totalAmount, order.currency)}
          </span>
          <span className={`text-vault-textTertiary transition-transform ${expanded ? "rotate-180" : ""}`}>
            ▾
          </span>
        </div>
      </button>

      {expanded && (
        <OrderDetail
          order={order}
          token={token}
          isBuyer={isBuyer}
          onUpdated={handleUpdated}
        />
      )}
    </li>
  );
}

/* ─── Role filter ─────────────────────────────────────────────────────────────── */

const ROLES = [
  { value: null,     label: "All orders" },
  { value: "buyer",  label: "Buying" },
  { value: "seller", label: "Selling" },
];

/* ─── Main tab ────────────────────────────────────────────────────────────────── */

export default function OrdersTab({ token, embedded = false }) {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [role, setRole]       = useState(null);
  const [myId, setMyId]       = useState(null);

  // derive myId from first order
  useEffect(() => {
    if (!myId && orders.length) {
      // We can't easily get myId without a `me` query — derive from token claim
      // Fall back: mark all orders and compare buyer/seller against known IDs
    }
  }, [orders, myId]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await gql(token, MY_ORDERS_QUERY, { ...(role ? { role } : {}), limit: 100 });
      const list = data?.myOrders ?? [];
      setOrders(list);
      // Derive myId from JWT claim (decode without verify — just for display)
      if (!myId && token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setMyId(payload.sub ?? payload.id ?? null);
        } catch {}
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, role, myId]);

  useEffect(() => { load(); }, [load]);

  const counts = {
    null:     orders.length,
    buyer:    orders.filter(o => o.buyerId === myId).length,
    seller:   orders.filter(o => o.sellerId === myId).length,
  };

  return (
    <div className={`space-y-5 ${embedded ? "p-6" : ""}`}>
      {/* Header — hidden when embedded in Dashboard */}
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-extrabold text-vault-accent dark:text-vault-accent">Orders</h3>
            <p className="text-sm text-vault-textTertiary mt-0.5">
              Your buying and selling history.
            </p>
          </div>
          <button type="button" onClick={load}
            className="px-3 py-2 rounded-[10px] text-sm border border-vault-border bg-vault-raised hover:bg-vault-surface dark:hover:bg-vault-surface transition">
            ↺ Refresh
          </button>
        </div>
      )}

      {/* Role filter */}
      <div className="flex gap-2">
        {ROLES.map(r => {
          const active = role === r.value;
          const count  = role === null ? orders.length : (r.value === "buyer" ? counts.buyer : counts.seller);
          return (
            <button key={String(r.value)} type="button" onClick={() => setRole(r.value)}
              className={`px-3 py-1.5 rounded-[6px] text-sm font-semibold border transition flex items-center gap-1.5
                ${active
                  ? "bg-vault-accent text-white border-vault-accent dark:border-vault-accent"
                  : "border-vault-border bg-vault-raised text-vault-text hover:bg-vault-surface dark:hover:bg-vault-surface"}`}>
              {r.label}
              <span className={`text-xs px-1.5 rounded-[6px] ${active ? "bg-white/20" : "bg-vault-border dark:bg-vault-border"}`}>
                {r.value === null ? orders.length : (r.value === "buyer" ? counts.buyer : counts.seller)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-[10px] border border-vault-border bg-vault-surface p-4 animate-pulse">
              <div className="flex gap-4 items-center">
                <div className="w-10 h-[58px] rounded-[6px] bg-vault-border/60 dark:bg-vault-border/60 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-vault-border/60 dark:bg-vault-border/60 rounded" />
                  <div className="h-3 w-32 bg-vault-border/40 dark:bg-vault-border/40 rounded" />
                </div>
                <div className="h-5 w-16 bg-vault-border/40 dark:bg-vault-border/40 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-[10px] border border-red-400/30 bg-red-500/5 p-4 text-sm text-red-500">
          Failed to load orders: {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && orders.length === 0 && (
        <div className="rounded-[10px] border border-vault-border bg-vault-surface p-10 text-center">
          <div className="text-4xl mb-3">🛍️</div>
          <div className="font-bold text-vault-accent dark:text-vault-accent mb-1">No orders yet</div>
          <p className="text-sm text-vault-textTertiary">
            Orders from the marketplace will appear here.
          </p>
        </div>
      )}

      {/* List */}
      {!loading && !error && orders.length > 0 && (
        <ul className="space-y-3">
          {orders.map(o => (
            <OrderRow key={o.id} order={o} token={token} myId={myId} />
          ))}
        </ul>
      )}
    </div>
  );
}

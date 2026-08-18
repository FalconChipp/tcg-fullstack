// src/components/Account/WalletTab.js
"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { getGraphqlUrl } from "@/utils/apiClient";

/* ─── Stripe singleton ───────────────────────────────────────────────────── */
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

/* ─── Constants ──────────────────────────────────────────────────────────── */
const GBP = "£";
const PAGE_SIZE = 10;

const PRESET_AMOUNTS = [
  { label: `${GBP}5`,  pence: 500  },
  { label: `${GBP}10`, pence: 1000 },
  { label: `${GBP}20`, pence: 2000 },
  { label: `${GBP}50`, pence: 5000 },
];

const TX_LABELS = {
  topup:           "Top-up",
  trade_hold:      "Trade hold",
  trade_refund:    "Trade refund",
  trade_credit:    "Trade received",
  trade_debit:     "Trade payment",
  purchase_spend:  "Purchase",
  purchase_refund: "Purchase refund",
  sale_credit:     "Sale received",
  withdrawal:      "Withdrawal",
  adjustment:      "Adjustment",
};

const TX_COLOUR = {
  topup:           "text-emerald-500",
  trade_credit:    "text-emerald-500",
  trade_refund:    "text-emerald-500",
  purchase_refund: "text-emerald-500",
  sale_credit:     "text-emerald-500",
  trade_hold:      "text-amber-500",
  trade_debit:     "text-rose-500",
  purchase_spend:  "text-rose-500",
  withdrawal:      "text-rose-500",
  adjustment:      "text-sky-500",
};

/* ─── GQL helpers ────────────────────────────────────────────────────────── */
async function gqlFetch(query, variables, token) {
  const res = await fetch(getGraphqlUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

const MY_WALLET_QUERY = `
  query MyWallet($limit: Int, $offset: Int) {
    myWallet(limit: $limit, offset: $offset) {
      balance balancePence held heldPence currency total
      transactions {
        id type amount amountPence currency status description relatedTradeId stripePaymentIntentId createdAt
      }
    }
  }
`;

const CREATE_TOPUP_MUTATION = `
  mutation CreateTopupIntent($amountPence: Int!) {
    createTopupIntent(amountPence: $amountPence) {
      clientSecret
      paymentIntentId
    }
  }
`;

const CONFIRM_TOPUP_MUTATION = `
  mutation ConfirmTopup($paymentIntentId: String!) {
    confirmTopup(paymentIntentId: $paymentIntentId) {
      balance balancePence held heldPence currency total
      transactions {
        id type amount amountPence currency status description relatedTradeId stripePaymentIntentId createdAt
      }
    }
  }
`;

const REQUEST_WITHDRAWAL_MUTATION = `
  mutation RequestWithdrawal($amountPence: Int!, $sortCode: String!, $accountNumber: String!, $accountName: String) {
    requestWithdrawal(amountPence: $amountPence, sortCode: $sortCode, accountNumber: $accountNumber, accountName: $accountName) {
      id amountPence amount status description createdAt
    }
  }
`;

async function confirmTopup(paymentIntentId, token) {
  const data = await gqlFetch(CONFIRM_TOPUP_MUTATION, { paymentIntentId }, token);
  return { wallet: data.confirmTopup };
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmt  = (n) => (n == null ? "—" : `${GBP}${Number(n).toFixed(2)}`);
const sign = (type) =>
  ["topup","trade_credit","trade_refund","purchase_refund","sale_credit","adjustment"].includes(type) ? "+" :
  ["trade_hold","trade_debit","purchase_spend","withdrawal"].includes(type) ? "-" : "";

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/* ─── CardElement style builder ─────────────────────────────────────────── */
function cardStyle(dark) {
  return {
    style: {
      base: {
        color:           dark ? "#f1f5f9" : "#111827",
        fontFamily:      "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize:        "15px",
        fontSmoothing:   "antialiased",
        lineHeight:      "1.5",
        iconColor:       dark ? "#94a3b8" : "#6b7280",
        "::placeholder": { color: dark ? "#475569" : "#9ca3af" },
      },
      invalid: {
        color:     "#ef4444",
        iconColor: "#ef4444",
      },
    },
  };
}

/* ─── Payment form ───────────────────────────────────────────────────────── */
function TopupPaymentForm({ amountPence, clientSecret, paymentIntentId, token, onSuccess, onCancel, dark }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [focused, setFocused] = useState(false);
  const [cardErr, setCardErr] = useState(null);
  const [paying,  setPaying]  = useState(false);
  const [err,     setErr]     = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setErr(null);
    setPaying(true);
    try {
      const { error: stripeErr, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });
      if (stripeErr) {
        setErr(stripeErr.message);
      } else if (paymentIntent?.status === "succeeded") {
        try {
          const result = await confirmTopup(paymentIntentId, token);
          onSuccess(result.wallet);
        } catch (confirmErr) {
          setErr(`Payment succeeded but wallet credit failed: ${confirmErr.message}`);
          setPaying(false);
          return;
        }
      } else {
        setErr(`Unexpected status: ${paymentIntent?.status}`);
      }
    } catch (ex) {
      setErr(ex.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  const borderColour = cardErr
    ? (dark ? "border-rose-500"   : "border-rose-500")
    : focused
    ? (dark ? "border-sky-400"    : "border-vault-accent")
    : (dark ? "border-vault-border": "border-vault-border");

  const bgColour = dark ? "bg-vault-bg" : "bg-white";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Amount label */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-vault-textTertiary">
          Card details
        </span>
        <span className="text-sm font-bold text-vault-accent dark:text-white tabular-nums">
          {fmt(amountPence / 100)}
        </span>
      </div>

      {/* Card input wrapper — styled to match our other inputs */}
      <div
        className={[
          "rounded-[10px] border px-4 py-3 transition-colors",
          bgColour,
          borderColour,
        ].join(" ")}
      >
        <CardElement
          options={{ ...cardStyle(dark), hidePostalCode: true }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => setCardErr(e.error?.message || null)}
        />
      </div>

      {/* Inline card error */}
      {cardErr && (
        <p className="text-xs text-rose-500">{cardErr}</p>
      )}

      {/* Server / stripe error */}
      {err && (
        <p className="text-sm text-rose-500 bg-rose-500/10 rounded-[6px] px-3 py-2">{err}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!stripe || paying}
          className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold bg-vault-accent hover:bg-vault-accentHover dark:bg-vault-accent dark:hover:bg-vault-accentHover text-white transition disabled:opacity-60 disabled:cursor-wait"
        >
          {paying ? "Processing…" : `Pay ${fmt(amountPence / 100)}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={paying}
          className="px-4 py-2.5 rounded-[10px] text-sm font-semibold border border-vault-border text-vault-textTertiary hover:text-vault-accent dark:hover:text-white transition disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ─── Main WalletTab ─────────────────────────────────────────────────────── */
export default function WalletTab({ token }) {
  const dark = useDark();

  /* wallet data */
  const [wallet,  setWallet]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState(null);
  const [page,    setPage]    = useState(0);

  /* top-up flow */
  const [selectedPence, setSelectedPence] = useState(null);
  const [customGBP,     setCustomGBP]     = useState("");
  const [topupBusy,     setTopupBusy]     = useState(false);
  const [topupError,    setTopupError]    = useState(null);
  const [clientSecret,   setClientSecret]   = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [successMsg,    setSuccessMsg]    = useState(null);
  const [retryingId,    setRetryingId]    = useState(null);

  /* withdrawal flow */
  const [withdrawPence,   setWithdrawPence]   = useState("");
  const [sortCode,        setSortCode]        = useState("");
  const [accountNumber,   setAccountNumber]   = useState("");
  const [accountName,     setAccountName]     = useState("");
  const [withdrawBusy,    setWithdrawBusy]    = useState(false);
  const [withdrawError,   setWithdrawError]   = useState(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(null);

  const payFormRef = useRef(null);

  /* ── fetch wallet ── */
  const fetchWallet = useCallback(async (pg = 0) => {
    if (!token) return;
    setLoading(true);
    setFetchErr(null);
    try {
      const data = await gqlFetch(MY_WALLET_QUERY, { limit: PAGE_SIZE, offset: pg * PAGE_SIZE }, token);
      setWallet(data.myWallet);
      setPage(pg);
    } catch (e) {
      setFetchErr(e.message || "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchWallet(0); }, [fetchWallet]);

  /* ── derived ── */
  const topupPence = useMemo(() => {
    if (selectedPence === "custom") {
      const n = parseFloat(customGBP);
      return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
    }
    return selectedPence;
  }, [selectedPence, customGBP]);

  const totalPages = wallet ? Math.ceil(wallet.total / PAGE_SIZE) : 0;

  /* ── initiate top-up ── */
  async function handleStartTopup() {
    if (!topupPence) return;
    setTopupBusy(true);
    setTopupError(null);
    setClientSecret(null);
    try {
      const data = await gqlFetch(CREATE_TOPUP_MUTATION, { amountPence: topupPence }, token);
      setClientSecret(data.createTopupIntent.clientSecret);
      setPaymentIntentId(data.createTopupIntent.paymentIntentId);
      setTimeout(() => payFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    } catch (e) {
      setTopupError(e.message || "Failed to start top-up");
    } finally {
      setTopupBusy(false);
    }
  }

  async function handlePaymentSuccess(updatedWallet) {
    setClientSecret(null);
    setPaymentIntentId(null);
    setSelectedPence(null);
    setCustomGBP("");
    if (updatedWallet) setWallet(updatedWallet);
    else await fetchWallet(0);
    setSuccessMsg("Top-up successful!");
    setTimeout(() => setSuccessMsg(null), 6000);
  }

  async function handleRetry(tx) {
    if (!tx.stripePaymentIntentId || retryingId) return;
    setRetryingId(tx.id);
    try {
      const result = await confirmTopup(tx.stripePaymentIntentId, token);
      if (result.wallet) setWallet(result.wallet);
      setSuccessMsg("Transaction completed successfully.");
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (e) {
      setTopupError(`Retry failed: ${e.message}`);
    } finally {
      setRetryingId(null);
    }
  }

  function handleCancelPayment() {
    setClientSecret(null);
    setPaymentIntentId(null);
    setTopupError(null);
  }

  function selectPreset(pence) {
    setSelectedPence((prev) => (prev === pence ? null : pence));
    setCustomGBP("");
    setClientSecret(null);
    setTopupError(null);
  }

  async function handleWithdraw() {
    const pence = Math.round(parseFloat(withdrawPence) * 100);
    if (!pence || pence < 1000) { setWithdrawError("Minimum withdrawal is £10.00"); return; }
    if (wallet && pence > wallet.balancePence) { setWithdrawError(`Insufficient balance. Available: ${fmt(wallet.balance)}`); return; }
    const sortDigits = sortCode.replace(/\D/g, "");
    if (sortDigits.length !== 6) { setWithdrawError("Sort code must be 6 digits (e.g. 12-34-56)"); return; }
    if (!/^\d{8}$/.test(accountNumber.trim())) { setWithdrawError("Account number must be 8 digits"); return; }

    setWithdrawBusy(true);
    setWithdrawError(null);
    setWithdrawSuccess(null);
    try {
      await gqlFetch(REQUEST_WITHDRAWAL_MUTATION, {
        amountPence: pence,
        sortCode: sortDigits,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      }, token);
      setWithdrawSuccess(`Withdrawal of ${fmt(pence / 100)} requested — funds will arrive within 1–3 business days.`);
      setWithdrawPence(""); setSortCode(""); setAccountNumber(""); setAccountName("");
      await fetchWallet(0);
    } catch (e) {
      setWithdrawError(e.message || "Withdrawal failed");
    } finally {
      setWithdrawBusy(false);
    }
  }

  /* ─── shared style tokens ────────────────────────────────────────────────── */
  const card  = "rounded-[10px] border border-vault-border bg-vault-surface";
  const muted = "text-vault-textTertiary";
  const main  = "text-vault-accent dark:text-white";
  const btn   = {
    active:   "bg-vault-accent text-white border-vault-accent dark:bg-vault-accent dark:border-vault-accent",
    inactive: `border-vault-border ${main} hover:border-vault-borderStrong`,
  };

  /* ─── render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-xl font-extrabold ${main}`}>Wallet</h2>
        <p className={`text-sm mt-0.5 ${muted}`}>
          Top up your balance and use it as a cash sweetener in trades.
        </p>
      </div>

      {/* ── Balance cards ── */}
      {loading && !wallet ? (
        <div className={`${card} p-6 animate-pulse space-y-3`}>
          <div className="h-4 w-24 bg-vault-border/60 dark:bg-vault-border/60 rounded" />
          <div className="h-10 w-36 bg-vault-border/60 dark:bg-vault-border/60 rounded" />
        </div>
      ) : fetchErr ? (
        <div className="rounded-[10px] border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-500">
          {fetchErr}
        </div>
      ) : wallet && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={`${card} p-5`}>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${muted}`}>
              Available balance
            </p>
            <p className="text-3xl font-extrabold text-emerald-500 tabular-nums">
              {fmt(wallet.balance)}
            </p>
            <p className={`text-xs mt-1 ${muted}`}>{wallet.currency}</p>
          </div>
          <div className={`${card} p-5`}>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${muted}`}>
              Held in trades
            </p>
            <p className="text-3xl font-extrabold text-amber-500 tabular-nums">
              {fmt(wallet.held)}
            </p>
            <p className={`text-xs mt-1 ${muted}`}>Released when trades complete or cancel</p>
          </div>
        </div>
      )}

      {/* ── Success banner ── */}
      {successMsg && (
        <div className="rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm px-4 py-3">
          {successMsg}
        </div>
      )}

      {/* ── Top-up section ── */}
      <div className={`${card} p-5 space-y-4`}>
        <h3 className={`text-sm font-bold ${main}`}>Top up wallet</h3>

        {/* Amount picker */}
        <div className="flex flex-wrap gap-2">
          {PRESET_AMOUNTS.map(({ label, pence }) => (
            <button
              key={pence}
              type="button"
              onClick={() => selectPreset(pence)}
              className={[
                "px-4 py-2 rounded-[10px] text-sm font-semibold border transition",
                selectedPence === pence ? btn.active : btn.inactive,
              ].join(" ")}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setSelectedPence("custom"); setClientSecret(null); setTopupError(null); }}
            className={[
              "px-4 py-2 rounded-[10px] text-sm font-semibold border transition",
              selectedPence === "custom" ? btn.active : btn.inactive,
            ].join(" ")}
          >
            Custom
          </button>
        </div>

        {/* Custom amount */}
        {selectedPence === "custom" && (
          <div className="flex items-center gap-2 max-w-[14rem]">
            <span className={`font-semibold ${muted}`}>{GBP}</span>
            <input
              type="number"
              min="5"
              max="200"
              step="0.01"
              placeholder="10.00"
              value={customGBP}
              onChange={(e) => { setCustomGBP(e.target.value); setClientSecret(null); }}
              className={[
                "flex-1 h-10 px-3 rounded-[10px] border text-sm transition",
                "bg-vault-bg",
                "border-vault-border",
                `${main} placeholder:text-vault-textTertiary dark:placeholder:text-vault-textTertiary`,
                "focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent",
              ].join(" ")}
            />
          </div>
        )}

        <p className={`text-xs ${muted}`}>
          Minimum {GBP}5 · Maximum {GBP}200 per transaction
        </p>

        {topupError && (
          <p className="text-sm text-rose-500 bg-rose-500/10 rounded-[6px] px-3 py-2">{topupError}</p>
        )}

        {/* Top-up button */}
        {!clientSecret && (
          <button
            type="button"
            onClick={handleStartTopup}
            disabled={!topupPence || topupBusy}
            className="px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-vault-accent hover:bg-vault-accentHover dark:bg-vault-accent dark:hover:bg-vault-accentHover text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {topupBusy ? "Preparing…" : topupPence ? `Top up ${fmt(topupPence / 100)}` : "Select an amount"}
          </button>
        )}

        {/* Card payment form */}
        {clientSecret && (
          <div
            ref={payFormRef}
            className={[
              "mt-1 rounded-[10px] border p-5 space-y-4",
              "border-vault-border",
              "bg-vault-bg",
            ].join(" ")}
          >
            <Elements stripe={stripePromise}>
              <TopupPaymentForm
                amountPence={topupPence}
                clientSecret={clientSecret}
                paymentIntentId={paymentIntentId}
                token={token}
                dark={dark}
                onSuccess={handlePaymentSuccess}
                onCancel={handleCancelPayment}
              />
            </Elements>
          </div>
        )}
      </div>

      {/* ── Withdraw section ── */}
      <div className={`${card} p-5 space-y-4`}>
        <div>
          <h3 className={`text-sm font-bold ${main}`}>Withdraw funds</h3>
          <p className={`text-xs mt-0.5 ${muted}`}>
            Funds arrive within 1–3 business days via UK bank transfer.
          </p>
        </div>

        {withdrawSuccess ? (
          <div className="rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm px-4 py-3">
            {withdrawSuccess}
            <button
              type="button"
              onClick={() => setWithdrawSuccess(null)}
              className="ml-3 underline text-xs opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 max-w-[16rem]">
              <span className={`font-semibold ${muted}`}>{GBP}</span>
              <input
                type="number"
                min="10"
                step="0.01"
                placeholder="10.00"
                value={withdrawPence}
                onChange={(e) => { setWithdrawPence(e.target.value); setWithdrawError(null); }}
                className={[
                  "flex-1 h-10 px-3 rounded-[10px] border text-sm transition",
                  "bg-vault-bg",
                  "border-vault-border",
                  `${main} placeholder:text-vault-textTertiary dark:placeholder:text-vault-textTertiary`,
                  "focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent",
                ].join(" ")}
              />
            </div>

            {wallet && (
              <p className={`text-xs ${muted}`}>
                Available: <span className="font-semibold text-emerald-500">{fmt(wallet.balance)}</span>
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 max-w-xs">
              <div className="col-span-1">
                <label className={`block text-xs font-medium ${muted} mb-1`}>Sort code</label>
                <input
                  type="text"
                  placeholder="12-34-56"
                  value={sortCode}
                  onChange={(e) => { setSortCode(e.target.value); setWithdrawError(null); }}
                  maxLength={8}
                  className={[
                    "w-full h-10 px-3 rounded-[10px] border text-sm transition",
                    "bg-vault-bg",
                    "border-vault-border",
                    `${main} placeholder:text-vault-textTertiary dark:placeholder:text-vault-textTertiary`,
                    "focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent",
                  ].join(" ")}
                />
              </div>
              <div className="col-span-1">
                <label className={`block text-xs font-medium ${muted} mb-1`}>Account number</label>
                <input
                  type="text"
                  placeholder="12345678"
                  value={accountNumber}
                  onChange={(e) => { setAccountNumber(e.target.value); setWithdrawError(null); }}
                  maxLength={8}
                  className={[
                    "w-full h-10 px-3 rounded-[10px] border text-sm transition",
                    "bg-vault-bg",
                    "border-vault-border",
                    `${main} placeholder:text-vault-textTertiary dark:placeholder:text-vault-textTertiary`,
                    "focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent",
                  ].join(" ")}
                />
              </div>
              <div className="col-span-2">
                <label className={`block text-xs font-medium ${muted} mb-1`}>Account name <span className="opacity-60">(optional)</span></label>
                <input
                  type="text"
                  placeholder="J Smith"
                  value={accountName}
                  onChange={(e) => { setAccountName(e.target.value); setWithdrawError(null); }}
                  maxLength={80}
                  className={[
                    "w-full h-10 px-3 rounded-[10px] border text-sm transition",
                    "bg-vault-bg",
                    "border-vault-border",
                    `${main} placeholder:text-vault-textTertiary dark:placeholder:text-vault-textTertiary`,
                    "focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent",
                  ].join(" ")}
                />
              </div>
            </div>

            {withdrawError && (
              <p className="text-sm text-rose-500 bg-rose-500/10 rounded-[6px] px-3 py-2">{withdrawError}</p>
            )}

            <button
              type="button"
              onClick={handleWithdraw}
              disabled={withdrawBusy}
              className="px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-vault-accent hover:bg-vault-accentHover dark:bg-vault-accent dark:hover:bg-vault-accentHover text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {withdrawBusy ? "Requesting…" : "Request withdrawal"}
            </button>
          </>
        )}
      </div>

      {/* ── Transaction history ── */}
      <div className={`${card} overflow-hidden`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b border-vault-border`}>
          <h3 className={`text-sm font-bold ${main}`}>Transaction history</h3>
          {wallet && <span className={`text-xs ${muted}`}>{wallet.total} total</span>}
        </div>

        {loading && wallet ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 rounded-[6px] bg-vault-border/40 dark:bg-vault-border/40 animate-pulse" />
            ))}
          </div>
        ) : !wallet?.transactions?.length ? (
          <div className={`p-10 text-center text-sm ${muted}`}>No transactions yet.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-left text-xs uppercase tracking-wide ${muted} border-b border-vault-border`}>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 font-semibold">Description</th>
                    <th className="px-5 py-3 font-semibold text-right">Amount</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold whitespace-nowrap">Date</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-vault-border dark:divide-vault-border">
                  {wallet.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-vault-raised/50 dark:hover:bg-vault-raised/50 transition">
                      <td className={`px-5 py-3.5 font-medium ${main} whitespace-nowrap`}>
                        {TX_LABELS[tx.type] || tx.type}
                      </td>
                      <td className={`px-5 py-3.5 ${muted} max-w-[180px] truncate`}>
                        {tx.description || "—"}
                      </td>
                      <td className={`px-5 py-3.5 font-semibold tabular-nums text-right whitespace-nowrap ${TX_COLOUR[tx.type] || main}`}>
                        {sign(tx.type)}{fmt(tx.amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={[
                          "text-xs font-semibold px-2.5 py-0.5 rounded-[6px]",
                          tx.status === "completed" ? "bg-emerald-500/10 text-emerald-500" :
                          tx.status === "pending"   ? "bg-amber-500/10  text-amber-500"   :
                                                      "bg-rose-500/10   text-rose-500",
                        ].join(" ")}>
                          {tx.status}
                        </span>
                      </td>
                      <td className={`px-5 py-3.5 text-xs ${muted} whitespace-nowrap`}>
                        {fmtDate(tx.createdAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        {tx.status === "pending" && tx.type === "topup" && tx.stripePaymentIntentId && (
                          <button
                            type="button"
                            onClick={() => handleRetry(tx)}
                            disabled={retryingId === tx.id}
                            className="text-xs font-semibold px-2.5 py-1 rounded-[6px] bg-vault-accent/10 hover:bg-vault-accent/20 dark:bg-vault-accent/10 dark:hover:bg-vault-accent/20 text-vault-accent transition disabled:opacity-50"
                          >
                            {retryingId === tx.id ? "Retrying…" : "Retry"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className={`flex items-center justify-between px-5 py-3 border-t border-vault-border`}>
                <button
                  type="button"
                  onClick={() => fetchWallet(page - 1)}
                  disabled={page === 0 || loading}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-[6px] border border-vault-border ${muted} hover:${main} transition disabled:opacity-40`}
                >
                  ← Previous
                </button>
                <span className={`text-xs ${muted}`}>Page {page + 1} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => fetchWallet(page + 1)}
                  disabled={page >= totalPages - 1 || loading}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-[6px] border border-vault-border ${muted} hover:${main} transition disabled:opacity-40`}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

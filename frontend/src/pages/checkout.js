// pages/checkout.js — Marketplace card checkout
// Two steps: (1) items + delivery address + wallet, (2) Stripe card payment (skipped if fully wallet-paid)

"use client";

import React, { useContext, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import Layout from "@/components/Layout/Layout";
import { AuthContext } from "@/components/Auth/AuthProvider";
import { getApiBase, getGraphqlUrl } from "@/utils/apiClient";
import {
  ShoppingBag, ArrowLeft, Package, CheckCircle2, AlertCircle, Loader2, Lock, Wallet,
} from "lucide-react";

let stripePromise = null;
function getStripe() {
  if (!stripePromise)
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");
  return stripePromise;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function fmt(amount, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
      Number(amount) || 0
    );
  } catch {
    return `£${Number(amount || 0).toFixed(2)}`;
  }
}

function fmtPence(pence, currency = "GBP") {
  return fmt(pence / 100, currency);
}

function readCart() {
  try {
    const raw = localStorage.getItem("sbf_cart");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function clearCart() {
  try {
    localStorage.setItem("sbf_cart", "[]");
    window.dispatchEvent(new StorageEvent("storage", { key: "sbf_cart", newValue: "[]" }));
  } catch { /* ignore */ }
}

async function gql(token, query, variables = {}) {
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

const GET_WALLET_BALANCE = `
  query MyWalletBalance {
    myWallet(limit: 0) { balancePence balance currency }
  }
`;

const CREATE_CART_ORDERS = `
  mutation CreateCartOrders($items: [CartItemInput!]!, $walletAmountPence: Int) {
    createCartOrders(items: $items, walletAmountPence: $walletAmountPence) {
      orders { id clientSecret salePrice totalAmount currency walletAmountPence }
      errors { listingId error }
    }
  }
`;

/* ─── useDark ─────────────────────────────────────────────────────────────── */

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

/* ─── PaymentForm ─────────────────────────────────────────────────────────── */

function PaymentForm({ orders, currency, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const dark = useDark();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState("");

  // Only process orders that need card payment
  const cardOrders = orders.filter((o) => o.clientSecret);

  const cardTotal = cardOrders.reduce(
    (sum, o) => sum + Number(o.totalAmount ?? o.salePrice ?? 0) - (o.walletAmountPence ?? 0) / 100,
    0
  );

  const cardStyle = {
    style: {
      base: {
        color: dark ? "#e2e8f0" : "#1a202c",
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        "::placeholder": { color: dark ? "#718096" : "#a0aec0" },
      },
      invalid: { color: "#fc8181" },
    },
    hidePostalCode: true,
  };

  async function handlePay(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setErr("");

    try {
      let paymentMethodId = null;

      for (let i = 0; i < cardOrders.length; i++) {
        const order = cardOrders[i];
        setProgress(
          cardOrders.length > 1
            ? `Processing payment ${i + 1} of ${cardOrders.length}…`
            : "Processing payment…"
        );

        const confirmArgs =
          i === 0
            ? { payment_method: { card: elements.getElement(CardElement) } }
            : { payment_method: paymentMethodId };

        const { paymentIntent, error } = await stripe.confirmCardPayment(
          order.clientSecret,
          confirmArgs
        );

        if (error) {
          setErr(
            cardOrders.length > 1
              ? `Payment failed for item ${i + 1}: ${error.message}`
              : error.message
          );
          return;
        }

        // With manual capture, status is requires_capture (not succeeded)
        if (
          paymentIntent?.status !== "requires_capture" &&
          paymentIntent?.status !== "succeeded"
        ) {
          setErr(`Unexpected payment status: ${paymentIntent?.status}`);
          return;
        }

        if (i === 0 && paymentIntent?.payment_method) {
          paymentMethodId =
            typeof paymentIntent.payment_method === "string"
              ? paymentIntent.payment_method
              : paymentIntent.payment_method?.id;
        }
      }

      onSuccess();
    } catch (ex) {
      setErr(ex.message || "Payment failed. Please try again.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <form onSubmit={handlePay} className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted mb-2 block">
          Card details
        </label>
        <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-4 py-3.5">
          <CardElement options={cardStyle} />
        </div>
      </div>

      {err && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
        </div>
      )}

      {busy && progress && (
        <p className="text-sm text-center text-light-textMuted dark:text-dark-textMuted">
          {progress}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !stripe}
        className="w-full rounded-xl py-3.5 text-sm font-semibold text-white bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight disabled:opacity-50 transition-colors"
      >
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {progress || "Processing…"}
          </span>
        ) : (
          `Pay ${fmt(cardTotal, currency)} by card`
        )}
      </button>
    </form>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */

export default function CheckoutPage() {
  const auth = useContext(AuthContext) || {};
  const token = auth.accessToken || auth.token || null;
  const isAuthenticated = !!(auth.isAuthenticated || token);
  const router = useRouter();

  // 'summary' → 'payment' → 'success'
  const [step, setStep] = useState("summary");
  const [cart, setCart] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  // After createCartOrders
  const [orders, setOrders] = useState([]);
  const [orderErrors, setOrderErrors] = useState([]);

  // Address form
  const [address, setAddress] = useState({
    line1: "", line2: "", city: "", postcode: "", country: "United Kingdom",
  });
  const [addrErrors, setAddrErrors] = useState({});

  // Wallet
  const [walletBalancePence, setWalletBalancePence] = useState(0);
  const [walletCurrency, setWalletCurrency] = useState("GBP");
  const [useWallet, setUseWallet] = useState(false);
  const [walletInputPence, setWalletInputPence] = useState(0);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setCart(readCart().filter((item) => item.listingId));
    setHydrated(true);
  }, []);

  // Fetch wallet balance when authenticated
  useEffect(() => {
    if (!token) return;
    gql(token, GET_WALLET_BALANCE)
      .then((data) => {
        const pence = data?.myWallet?.balancePence ?? 0;
        setWalletBalancePence(pence);
        if (data?.myWallet?.currency) setWalletCurrency(data.myWallet.currency);
      })
      .catch(() => {});
  }, [token]);

  // When wallet is toggled on, default input to min(balance, subtotal)
  useEffect(() => {
    if (useWallet) {
      const subtotalPence = Math.round(
        cart.reduce((s, i) => s + Number(i.price || 0) * (Number(i.qty) || 1), 0) * 100
      );
      setWalletInputPence(Math.min(walletBalancePence, subtotalPence));
    }
  }, [useWallet, walletBalancePence, cart]);

  function validateAddress() {
    const errs = {};
    if (!address.line1.trim()) errs.line1 = "Required";
    if (!address.city.trim()) errs.city = "Required";
    if (!address.postcode.trim()) errs.postcode = "Required";
    return errs;
  }

  async function handleContinue(e) {
    e.preventDefault();
    const errs = validateAddress();
    if (Object.keys(errs).length) { setAddrErrors(errs); return; }
    setAddrErrors({});
    if (!cart.length) return;

    setBusy(true);
    setErr("");
    try {
      const items = cart.map((item) => ({
        listingId: item.listingId,
        buyerAddress: {
          line1:   address.line1,
          line2:   address.line2 || undefined,
          city:    address.city,
          postcode: address.postcode,
          country: address.country,
        },
      }));

      const walletAmountPence = useWallet ? Math.max(0, walletInputPence) : 0;

      const data = await gql(token, CREATE_CART_ORDERS, { items, walletAmountPence });
      const result = data.createCartOrders;

      if (!result.orders?.length) {
        setErr(result.errors?.map((e) => e.error).join("; ") || "Failed to create orders");
        return;
      }

      setOrders(result.orders);
      setOrderErrors(result.errors || []);

      // If no orders need card payment, skip straight to success
      const needsCard = result.orders.some((o) => o.clientSecret);
      if (!needsCard) {
        clearCart();
        setStep("success");
      } else {
        setStep("payment");
      }
    } catch (ex) {
      setErr(ex.message || "Failed to prepare orders");
    } finally {
      setBusy(false);
    }
  }

  function handlePaymentSuccess() {
    clearCart();
    setStep("success");
  }

  const subtotal = cart.reduce(
    (s, i) => s + Number(i.price || 0) * (Number(i.qty) || 1),
    0
  );
  const subtotalPence = Math.round(subtotal * 100);
  const currency = cart[0]?.currency || walletCurrency || "GBP";

  // Approximate card vs wallet split for display in step 1
  const walletAppliedPence = useWallet
    ? Math.min(walletInputPence, walletBalancePence, subtotalPence)
    : 0;
  const cardDisplayPence = subtotalPence - walletAppliedPence;

  // Totals from actual orders (step 2+)
  const orderWalletPence = orders.reduce((s, o) => s + (o.walletAmountPence || 0), 0);
  const orderCardTotal   = orders
    .filter((o) => o.clientSecret)
    .reduce((s, o) => s + Number(o.totalAmount ?? o.salePrice ?? 0) - (o.walletAmountPence ?? 0) / 100, 0);

  const inputCls = (hasErr) =>
    `w-full rounded-xl border px-3 py-2.5 text-sm ` +
    `text-light-strong dark:text-dark-strong ` +
    `bg-light-alt dark:bg-dark-alt ` +
    `focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent ` +
    (hasErr
      ? "border-red-400 dark:border-red-600"
      : "border-light-border dark:border-dark-border");

  /* ── Not logged in ──────────────────────────────────────────────────────── */
  if (hydrated && !isAuthenticated) {
    return (
      <Layout>
        <Head><title>Checkout · Six by Five</title></Head>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <ShoppingBag className="w-12 h-12 text-light-textMuted dark:text-dark-textMuted" />
          <div>
            <h1 className="text-xl font-bold text-light-strong dark:text-dark-strong mb-1">Sign in to checkout</h1>
            <p className="text-sm text-light-textMuted dark:text-dark-textMuted">You need an account to place marketplace orders.</p>
          </div>
          <Link
            href="/login?next=/checkout"
            className="px-5 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-semibold"
          >
            Sign in
          </Link>
        </div>
      </Layout>
    );
  }

  /* ── Success ────────────────────────────────────────────────────────────── */
  if (step === "success") {
    return (
      <Layout>
        <Head><title>Order confirmed · Six by Five</title></Head>
        <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-light-strong dark:text-dark-strong mb-2">
              Order{orders.length !== 1 ? "s" : ""} confirmed!
            </h1>
            <p className="text-light-textMuted dark:text-dark-textMuted">
              {orders.every((o) => !o.clientSecret)
                ? "Payment taken from your wallet. "
                : "Your payment is authorised and held securely. "}
              {orders.length === 1 ? "The seller" : "Each seller"} will ship your item
              {orders.length !== 1 ? "s" : ""} and update the tracking details.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <Link
              href="/dashboard?tab=orders"
              className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-light-accent dark:bg-dark-accent hover:bg-light-accentLight dark:hover:bg-dark-accentLight text-center"
            >
              View my orders
            </Link>
            <Link
              href="/marketplace"
              className="w-full rounded-xl py-3 text-sm font-medium text-center border border-light-border dark:border-dark-border text-light-textMuted dark:text-dark-textMuted hover:text-light-strong dark:hover:text-dark-strong transition-colors"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  /* ── Empty cart ─────────────────────────────────────────────────────────── */
  if (hydrated && cart.length === 0 && step === "summary") {
    return (
      <Layout>
        <Head><title>Checkout · Six by Five</title></Head>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <ShoppingBag className="w-12 h-12 text-light-textMuted dark:text-dark-textMuted" />
          <div>
            <h1 className="text-xl font-bold text-light-strong dark:text-dark-strong mb-1">Your cart is empty</h1>
            <p className="text-sm text-light-textMuted dark:text-dark-textMuted">Browse the marketplace to find cards to buy.</p>
          </div>
          <Link
            href="/marketplace"
            className="px-5 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-semibold"
          >
            Browse marketplace
          </Link>
        </div>
      </Layout>
    );
  }

  const isFullyWallet = useWallet && walletAppliedPence >= subtotalPence && subtotalPence > 0;

  /* ── Main layout ────────────────────────────────────────────────────────── */
  return (
    <Layout>
      <Head><title>Checkout · Six by Five</title></Head>
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          {step === "payment" ? (
            <button
              type="button"
              onClick={() => setStep("summary")}
              className="p-2 rounded-xl border border-light-border dark:border-dark-border hover:bg-light-alt dark:hover:bg-dark-alt transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-light-textMuted dark:text-dark-textMuted" />
            </button>
          ) : (
            <Link
              href="/marketplace"
              className="p-2 rounded-xl border border-light-border dark:border-dark-border hover:bg-light-alt dark:hover:bg-dark-alt transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-light-textMuted dark:text-dark-textMuted" />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold text-light-strong dark:text-dark-strong">
              {step === "payment" ? "Payment" : "Checkout"}
            </h1>
            <p className="text-sm text-light-textMuted dark:text-dark-textMuted">
              {step === "payment"
                ? "Enter your card details to authorise payment"
                : "Review your items and enter a delivery address"}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {["summary", "payment"].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 text-sm font-medium ${step === s ? "text-light-accent dark:text-dark-accent" : "text-light-textMuted dark:text-dark-textMuted"}`}>
                <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold
                  ${step === s ? "bg-light-accent dark:bg-dark-accent text-white" :
                    (s === "summary" && step === "payment") ? "bg-emerald-500 text-white" :
                    "bg-light-alt dark:bg-dark-alt"}`}
                >
                  {s === "summary" && step === "payment" ? "✓" : i + 1}
                </span>
                {s === "summary" ? "Details" : "Payment"}
              </div>
              {i < 1 && <div className="flex-1 h-px bg-light-border dark:bg-dark-border" />}
            </React.Fragment>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

          {/* ── LEFT column ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Cart items */}
            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted mb-4">
                Items ({cart.length})
              </h2>
              <div className="flex flex-col divide-y divide-light-border dark:divide-dark-border">
                {cart.map((item) => (
                  <div
                    key={item.listingId || item.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-12 h-16 object-contain rounded-lg bg-light-alt dark:bg-dark-alt flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-16 rounded-lg bg-light-alt dark:bg-dark-alt flex-shrink-0 flex items-center justify-center">
                        <Package className="w-5 h-5 text-light-textMuted dark:text-dark-textMuted" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-light-strong dark:text-dark-strong truncate">
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="text-xs text-light-textMuted dark:text-dark-textMuted">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-light-strong dark:text-dark-strong flex-shrink-0">
                      {fmt(Number(item.price) * (Number(item.qty) || 1), item.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Partial order errors */}
            {orderErrors.length > 0 && (
              <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">
                  Some items could not be ordered
                </p>
                {orderErrors.map((e) => (
                  <p key={e.listingId} className="text-xs text-amber-600 dark:text-amber-500">
                    • {e.error}
                  </p>
                ))}
              </div>
            )}

            {/* Step 1: Delivery address + wallet */}
            {step === "summary" && (
              <>
                <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted mb-4">
                    Delivery address
                  </h2>
                  <form id="checkout-form" onSubmit={handleContinue} className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs font-medium text-light-textMuted dark:text-dark-textMuted mb-1 block">
                        Address line 1 *
                      </label>
                      <input
                        value={address.line1}
                        onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                        className={inputCls(addrErrors.line1)}
                        placeholder="Street address"
                      />
                      {addrErrors.line1 && (
                        <p className="text-xs text-red-500 mt-1">{addrErrors.line1}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-light-textMuted dark:text-dark-textMuted mb-1 block">
                        Address line 2
                      </label>
                      <input
                        value={address.line2}
                        onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))}
                        className={inputCls(false)}
                        placeholder="Apartment, flat, etc. (optional)"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-light-textMuted dark:text-dark-textMuted mb-1 block">
                          City *
                        </label>
                        <input
                          value={address.city}
                          onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                          className={inputCls(addrErrors.city)}
                          placeholder="City"
                        />
                        {addrErrors.city && (
                          <p className="text-xs text-red-500 mt-1">{addrErrors.city}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-light-textMuted dark:text-dark-textMuted mb-1 block">
                          Postcode *
                        </label>
                        <input
                          value={address.postcode}
                          onChange={(e) => setAddress((a) => ({ ...a, postcode: e.target.value }))}
                          className={inputCls(addrErrors.postcode)}
                          placeholder="SW1A 1AA"
                        />
                        {addrErrors.postcode && (
                          <p className="text-xs text-red-500 mt-1">{addrErrors.postcode}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-light-textMuted dark:text-dark-textMuted mb-1 block">
                        Country
                      </label>
                      <input
                        value={address.country}
                        onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value }))}
                        className={inputCls(false)}
                      />
                    </div>
                  </form>
                </div>

                {/* Wallet section */}
                {walletBalancePence > 0 && (
                  <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                        <h2 className="text-sm font-semibold text-light-strong dark:text-dark-strong">
                          Wallet balance
                        </h2>
                      </div>
                      <span className="text-sm font-semibold text-light-strong dark:text-dark-strong">
                        {fmtPence(walletBalancePence, walletCurrency)}
                      </span>
                    </div>
                    <p className="text-xs text-light-textMuted dark:text-dark-textMuted mb-3">
                      Apply wallet credit to reduce your card payment.
                    </p>

                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={useWallet}
                          onChange={(e) => setUseWallet(e.target.checked)}
                        />
                        <div className={`w-10 h-6 rounded-full transition-colors ${useWallet ? "bg-light-accent dark:bg-dark-accent" : "bg-light-border dark:bg-dark-border"}`} />
                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${useWallet ? "translate-x-4" : ""}`} />
                      </div>
                      <span className="text-sm text-light-strong dark:text-dark-strong">
                        Use wallet balance
                      </span>
                    </label>

                    {useWallet && (
                      <div className="mt-3 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-light-textMuted dark:text-dark-textMuted w-24">Amount (£)</span>
                          <input
                            type="number"
                            min="0"
                            max={(walletBalancePence / 100).toFixed(2)}
                            step="0.01"
                            value={(walletInputPence / 100).toFixed(2)}
                            onChange={(e) => {
                              const v = Math.round(parseFloat(e.target.value || "0") * 100);
                              setWalletInputPence(Math.min(v, walletBalancePence));
                            }}
                            className={inputCls(false) + " flex-1"}
                          />
                        </div>
                        {walletAppliedPence > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Wallet: −{fmtPence(walletAppliedPence, walletCurrency)}
                            </span>
                            <span className="text-light-textMuted dark:text-dark-textMuted">
                              {cardDisplayPence > 0
                                ? `Card: ${fmtPence(cardDisplayPence, currency)}`
                                : "No card payment needed"}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Step 2: Payment */}
            {step === "payment" && orders.some((o) => o.clientSecret) && (
              <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted mb-4">
                  Card payment
                </h2>
                {orderWalletPence > 0 && (
                  <div className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2.5 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      {fmtPence(orderWalletPence, walletCurrency)} applied from your wallet.
                      Remaining {fmtPence(Math.round(orderCardTotal * 100), currency)} by card.
                    </p>
                  </div>
                )}
                <Elements stripe={getStripe()}>
                  <PaymentForm
                    orders={orders}
                    currency={currency}
                    onSuccess={handlePaymentSuccess}
                  />
                </Elements>
              </div>
            )}
          </div>

          {/* ── RIGHT column — order summary ─────────────────────────────── */}
          <div>
            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-5 sticky top-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted mb-4">
                Order summary
              </h2>

              <div className="flex flex-col gap-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-light-textMuted dark:text-dark-textMuted">
                    Subtotal ({cart.length} item{cart.length !== 1 ? "s" : ""})
                  </span>
                  <span className="font-medium text-light-strong dark:text-dark-strong">
                    {fmt(subtotal, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-light-textMuted dark:text-dark-textMuted">Shipping</span>
                  <span className="text-light-textMuted dark:text-dark-textMuted text-xs">
                    Set by seller
                  </span>
                </div>

                {/* Wallet line (step 1 preview) */}
                {step === "summary" && useWallet && walletAppliedPence > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Wallet credit</span>
                    <span>−{fmtPence(walletAppliedPence, walletCurrency)}</span>
                  </div>
                )}

                {/* Wallet line (step 2 actual) */}
                {step === "payment" && orderWalletPence > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Wallet credit</span>
                    <span>−{fmtPence(orderWalletPence, walletCurrency)}</span>
                  </div>
                )}

                <div className="border-t border-light-border dark:border-dark-border pt-2.5 mt-0.5 flex justify-between font-semibold text-base">
                  <span className="text-light-strong dark:text-dark-strong">
                    {step === "payment" && orderWalletPence > 0 ? "Card total" : "Total"}
                  </span>
                  <span className="text-light-strong dark:text-dark-strong">
                    {step === "payment"
                      ? fmtPence(Math.round(orderCardTotal * 100), currency)
                      : fmt(cardDisplayPence / 100, currency)}
                  </span>
                </div>
              </div>

              {/* How payment works callout */}
              <div className="mt-4 rounded-xl bg-light-alt dark:bg-dark-alt px-3 py-2.5 text-xs text-light-textMuted dark:text-dark-textMuted leading-relaxed">
                {isFullyWallet
                  ? "This order will be paid entirely from your wallet balance. The seller will ship once it's confirmed."
                  : "Payment is "}
                {!isFullyWallet && (
                  <>
                    <strong className="text-light-strong dark:text-dark-strong">authorised now</strong>
                    {" and only released to the seller when you confirm receipt. Raise a dispute if there's a problem."}
                  </>
                )}
              </div>

              {err && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
                </div>
              )}

              {step === "summary" && (
                <button
                  form="checkout-form"
                  type="submit"
                  disabled={busy || !cart.length}
                  className="mt-4 w-full rounded-xl py-3.5 text-sm font-semibold text-white bg-light-accent dark:bg-dark-accent hover:bg-light-accentLight dark:hover:bg-dark-accentLight disabled:opacity-50 transition-colors"
                >
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Preparing orders…
                    </span>
                  ) : isFullyWallet ? (
                    `Confirm order · ${fmtPence(subtotalPence, currency)}`
                  ) : (
                    `Continue to payment · ${fmt(cardDisplayPence / 100, currency)}`
                  )}
                </button>
              )}

              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-light-textMuted dark:text-dark-textMuted">
                <Lock className="w-3 h-3" />
                Secured by Stripe
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

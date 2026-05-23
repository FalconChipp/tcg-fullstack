// frontend/src/components/Marketplace/ListingDetailModal.js
"use client";

import React, { useContext, useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { gql } from "@apollo/client";
import { AuthContext } from "@/components/Auth/AuthProvider";
import ProposeTradeModal from "./ProposeTradeModal";

// ─── Stripe ──────────────────────────────────────────────────────────────────

let stripePromise = null;
function getStripe() {
  if (!stripePromise)
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");
  return stripePromise;
}

// ─── GQL ─────────────────────────────────────────────────────────────────────

const CREATE_ORDER_MUTATION = gql`
  mutation CreateOrderFromListing($input: CreateOrderFromListingInput!) {
    createOrderFromListing(input: $input) {
      id orderNumber status paymentStatus clientSecret total currency createdAt
    }
  }
`;

const CREATE_OFFER_MUTATION = gql`
  mutation CreateOffer($listingId: ID!, $amount: Float!, $message: String) {
    createOffer(listingId: $listingId, amount: $amount, message: $message) {
      id amount status createdAt
    }
  }
`;

import { gqlFetch } from "@/utils/apiClient";

function fmt(amount, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(Number(amount) || 0);
  } catch {
    return `£${Number(amount || 0).toFixed(2)}`;
  }
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

// ─── Cart helper ─────────────────────────────────────────────────────────────

function addToCart(listing, info) {
  try {
    const raw = localStorage.getItem("sbf_cart");
    const cart = raw ? JSON.parse(raw) : [];
    const existing = cart.find((i) => i.listingId === listing.id);
    if (existing) {
      existing.qty = (existing.qty || 1) + 1;
    } else {
      cart.push({
        listingId: listing.id,
        id: listing.id,
        title: info?.name || listing.cardId || "Card",
        subtitle: [listing.condition, listing.variation].filter(Boolean).join(" · "),
        price: Number(listing.price) || 0,
        currency: listing.currency || "GBP",
        imageUrl: info?.imageSmall || null,
        qty: 1,
      });
    }
    localStorage.setItem("sbf_cart", JSON.stringify(cart));
    window.dispatchEvent(new StorageEvent("storage", { key: "sbf_cart" }));
    return true;
  } catch {
    return false;
  }
}

// ─── Condition colours ────────────────────────────────────────────────────────

const COND = {
  NM: { bg: "bg-emerald-500", text: "text-white",   label: "Near Mint" },
  LP: { bg: "bg-yellow-400",  text: "text-gray-900", label: "Lightly Played" },
  MP: { bg: "bg-orange-500",  text: "text-white",   label: "Moderately Played" },
  PL: { bg: "bg-red-500",     text: "text-white",   label: "Played" },
};

// ─── Stripe payment form ──────────────────────────────────────────────────────

function PaymentForm({ clientSecret, price, currency, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const dark = useDark();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handlePay(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true); setErr("");
    try {
      const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });
      if (error) setErr(error.message || "Payment failed");
      else if (paymentIntent?.status === "succeeded") onSuccess(paymentIntent);
      else setErr(`Unexpected status: ${paymentIntent?.status}`);
    } catch (ex) {
      setErr(ex.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <form onSubmit={handlePay} className="flex flex-col gap-3">
      <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-4 py-3">
        <CardElement options={cardStyle} />
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <button type="submit" disabled={busy || !stripe}
        className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight disabled:opacity-50 transition-colors">
        {busy ? "Processing…" : `Confirm payment · ${fmt(price, currency)}`}
      </button>
      <button type="button" onClick={onCancel}
        className="w-full rounded-xl py-2 text-sm text-light-muted dark:text-dark-muted hover:text-light-strong dark:hover:text-dark-strong transition-colors">
        Cancel
      </button>
    </form>
  );
}

// ─── Make an offer form ───────────────────────────────────────────────────────

function OfferForm({ listing, token, onDone, onCancel }) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const listPrice = Number(listing.price) || 0;
  const offerNum  = parseFloat(amount) || 0;
  const pctOff    = listPrice > 0 && offerNum > 0
    ? Math.round(((listPrice - offerNum) / listPrice) * 100)
    : null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!offerNum || offerNum <= 0) { setErr("Enter a valid amount."); return; }
    if (offerNum >= listPrice) { setErr("Your offer must be below the listing price."); return; }
    setBusy(true); setErr("");
    try {
      await gqlFetch(CREATE_OFFER_MUTATION, {
        listingId: listing.id,
        amount: offerNum,
        message: message.trim() || undefined,
      }, token);
      onDone();
    } catch (ex) {
      setErr(ex.message || "Failed to send offer");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-light-border dark:border-dark-border " +
    "bg-light-alt dark:bg-dark-alt px-3 py-2 text-sm text-light-strong dark:text-dark-strong " +
    "focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-light-muted dark:text-dark-muted mb-1 block">
          Your offer
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-light-muted dark:text-dark-muted">£</span>
          <input
            type="number" min="0.01" step="0.01"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder={`Max ${fmt(listPrice - 0.01)}`}
            className={inputCls + " pl-7"}
          />
        </div>
        {pctOff !== null && pctOff > 0 && (
          <p className="text-xs text-light-muted dark:text-dark-muted mt-1">
            {pctOff}% below asking price
          </p>
        )}
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-light-muted dark:text-dark-muted mb-1 block">
          Message (optional)
        </label>
        <textarea
          value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a note to the seller…"
          rows={2}
          className={inputCls + " resize-none"}
        />
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <button type="submit" disabled={busy}
        className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight disabled:opacity-50 transition-colors">
        {busy ? "Sending…" : "Send offer"}
      </button>
      <button type="button" onClick={onCancel}
        className="w-full rounded-xl py-2 text-sm text-light-muted dark:text-dark-muted hover:text-light-strong dark:hover:text-dark-strong transition-colors">
        Cancel
      </button>
    </form>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function ListingDetailModal({ listing, onClose }) {
  const auth = useContext(AuthContext) || {};
  const token = auth.accessToken || auth.token || null;
  const isLoggedIn = !!(auth.isAuthenticated || token);

  // phase: "detail" | "paying" | "offer" | "done" | "offered" | "carted"
  const [phase, setPhase] = useState("detail");
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showTrade, setShowTrade] = useState(false);

  if (!listing) return null;

  const info     = listing.cardInfo || {};
  const price    = Number(listing.price) || 0;
  const currency = listing.currency || "GBP";
  const seller   = listing.seller || {};
  const cond     = COND[listing.condition] || null;
  const imageUrl = info.imageLarge || info.imageSmall || null;

  async function handleBuy() {
    if (!isLoggedIn) { setErr("Please sign in to purchase."); return; }
    setBusy(true); setErr("");
    try {
      const data = await gqlFetch(CREATE_ORDER_MUTATION, { input: { listingId: listing.id } }, token);
      setOrder(data.createOrderFromListing);
      setPhase("paying");
    } catch (ex) {
      setErr(ex.message || "Failed to start checkout");
    } finally {
      setBusy(false);
    }
  }

  function handleAddToCart() {
    const ok = addToCart(listing, info);
    if (ok) setPhase("carted");
  }

  // ── success banners
  const successPhase = phase === "done" || phase === "offered" || phase === "carted";

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden bg-light-surface dark:bg-dark-surface shadow-2xl flex flex-col max-h-[92vh]">

        <button type="button" onClick={onClose}
          className="absolute top-3 right-4 z-10 rounded-full bg-black/30 backdrop-blur-sm text-white px-3 py-1 text-xs font-medium hover:bg-black/50 transition">
          Close
        </button>

        {/* ── Success banners ── */}
        {successPhase && (
          <div className="flex flex-col items-center gap-4 p-10">
            <div className="text-5xl">
              {phase === "done" ? "🎉" : phase === "offered" ? "📨" : "🛒"}
            </div>
            <h2 className="text-xl font-bold text-light-strong dark:text-dark-strong">
              {phase === "done"    ? "Payment successful!"   :
               phase === "offered" ? "Offer sent!"           :
                                     "Added to cart!"}
            </h2>
            <p className="text-sm text-center text-light-muted dark:text-dark-muted">
              {phase === "done"
                ? `Order #${order?.orderNumber || order?.id} confirmed. The seller will be notified to ship.`
                : phase === "offered"
                ? "The seller will be notified and can accept, counter, or decline your offer."
                : `${info.name || "Card"} has been added to your cart.`}
            </p>
            <button onClick={onClose}
              className="mt-2 rounded-xl px-8 py-3 text-sm font-semibold text-white bg-light-accent dark:bg-dark-accent hover:opacity-90 transition">
              {phase === "carted" ? "Continue browsing" : "Done"}
            </button>
          </div>
        )}

        {!successPhase && (
          <div className="flex flex-col sm:flex-row overflow-y-auto">

            {/* ── LEFT: card hero ── */}
            <div className="relative sm:w-56 flex-shrink-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6 sm:p-8 min-h-[220px] sm:min-h-0">
              {imageUrl ? (
                <>
                  <img src={imageUrl} alt={info.name || "Card"}
                    className="relative z-10 w-full max-w-[160px] sm:max-w-none rounded-xl shadow-2xl"
                    style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.6))" }}
                  />
                  <div className="absolute inset-0 opacity-20 blur-2xl scale-75"
                    style={{ backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
                  />
                </>
              ) : (
                <div className="w-32 h-44 rounded-xl bg-white/10 flex items-center justify-center text-xs text-white/50">No image</div>
              )}
            </div>

            {/* ── RIGHT: details + actions ── */}
            <div className="flex flex-col gap-4 p-5 flex-1 overflow-y-auto">

              {/* Name + meta */}
              <div>
                <h2 className="text-xl font-bold text-light-strong dark:text-dark-strong leading-tight">
                  {info.name || listing.cardId || "Card"}
                </h2>
                {(info.setName || info.number) && (
                  <p className="text-sm text-light-muted dark:text-dark-muted mt-0.5">
                    {[info.setName, info.number ? `#${info.number}` : null].filter(Boolean).join(" · ")}
                  </p>
                )}
                {info.rarity && (
                  <p className="text-xs text-light-muted dark:text-dark-muted mt-0.5">{info.rarity}</p>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {listing.condition && cond && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${cond.bg} ${cond.text}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                    {listing.condition} · {cond.label}
                  </span>
                )}
                {listing.variation && listing.variation !== "Standard" && (
                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border border-light-border dark:border-dark-border text-light-muted dark:text-dark-muted">
                    {listing.variation}
                  </span>
                )}
                {listing.moderationResult === "approved" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-600/20 border border-emerald-500/40 text-emerald-400">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    Photo verified
                  </span>
                )}
                {listing.willTrade && (
                  <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-violet-600 text-white">
                    ⇄ Will Trade
                  </span>
                )}
              </div>

              {/* Price + seller */}
              <div className="rounded-2xl bg-light-elevated dark:bg-dark-elevated border border-light-border dark:border-dark-border p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-light-muted dark:text-dark-muted mb-1">Listed price</div>
                  <div className="text-3xl font-extrabold text-light-strong dark:text-dark-strong tracking-tight">
                    {fmt(price, currency)}
                  </div>
                </div>
                {seller.username && (
                  <div className="flex items-center gap-2.5">
                    {seller.avatar ? (
                      <img src={seller.avatar} alt={seller.username} className="w-10 h-10 rounded-full object-cover border-2 border-light-border dark:border-dark-border" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-light-accent/20 dark:bg-dark-accent/20 border-2 border-light-border dark:border-dark-border flex items-center justify-center text-sm font-bold text-light-accent dark:text-dark-accent">
                        {seller.username[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-light-strong dark:text-dark-strong">{seller.username}</div>
                      <div className="text-[10px] text-light-muted dark:text-dark-muted">Seller</div>
                    </div>
                  </div>
                )}
              </div>

              {err && <p className="text-xs text-red-400">{err}</p>}

              {/* ── Action buttons ── */}
              {phase === "detail" && (
                <div className="flex flex-col gap-2 mt-auto">
                  {/* Primary: buy now */}
                  <button type="button" onClick={handleBuy} disabled={busy || !isLoggedIn}
                    className="w-full rounded-xl py-3.5 text-sm font-bold text-white bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight disabled:opacity-50 transition-colors shadow-lg shadow-light-accent/20 dark:shadow-dark-accent/20">
                    {busy ? "Preparing checkout…" : !isLoggedIn ? "Sign in to buy" : `Buy now · ${fmt(price, currency)}`}
                  </button>

                  {/* Secondary row: Add to cart + Make an offer */}
                  <div className="grid gap-2" style={{ gridTemplateColumns: listing.allowOffers ? "1fr 1fr" : "1fr" }}>
                    <button type="button" onClick={handleAddToCart} disabled={!isLoggedIn}
                      className="rounded-xl py-2.5 text-sm font-semibold border-2 border-light-border dark:border-dark-border text-light-strong dark:text-dark-strong hover:border-light-accent dark:hover:border-dark-accent hover:text-light-accent dark:hover:text-dark-accent disabled:opacity-50 transition-colors">
                      🛒 Add to cart
                    </button>
                    {listing.allowOffers && (
                      <button type="button" onClick={() => setPhase("offer")} disabled={!isLoggedIn}
                        className="rounded-xl py-2.5 text-sm font-semibold border-2 border-light-border dark:border-dark-border text-light-strong dark:text-dark-strong hover:border-amber-500 hover:text-amber-500 disabled:opacity-50 transition-colors">
                        💬 Make an offer
                      </button>
                    )}
                  </div>

                  {/* Trade button */}
                  {listing.willTrade && isLoggedIn && (
                    <button type="button"
                      onClick={() => setShowTrade(true)}
                      className="w-full rounded-xl py-2.5 text-sm font-semibold border-2 border-violet-600 text-violet-600 dark:text-violet-400 dark:border-violet-500 hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 dark:hover:text-white transition-colors">
                      ⇄ Propose a trade
                    </button>
                  )}

                  {!isLoggedIn && (
                    <p className="text-xs text-center text-light-muted dark:text-dark-muted">
                      Sign in to buy, add to cart, or make an offer.
                    </p>
                  )}
                </div>
              )}

              {/* ── Stripe payment ── */}
              {phase === "paying" && order?.clientSecret && (
                <Elements stripe={getStripe()}>
                  <PaymentForm
                    clientSecret={order.clientSecret}
                    price={price} currency={currency}
                    onSuccess={() => setPhase("done")}
                    onCancel={() => setPhase("detail")}
                  />
                </Elements>
              )}

              {/* ── Offer form ── */}
              {phase === "offer" && (
                <OfferForm
                  listing={listing} token={token}
                  onDone={() => setPhase("offered")}
                  onCancel={() => setPhase("detail")}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {showTrade && (
      <ProposeTradeModal
        listing={listing}
        onClose={() => setShowTrade(false)}
      />
    )}
    </>
  );
}

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

import { gqlFetch, getApiBase } from "@/utils/apiClient";
import SellerReviewsDrawer from "./SellerReviewsDrawer";
import SellerTierBadge from "./SellerTierBadge";

const SELLER_REPUTATION_QUERY = `
  query SellerReputationBadge($userId: ID!) {
    sellerReputation(userId: $userId) {
      score positive negative neutral completedMarketplace
    }
  }
`;

const CARD_MARKET_PRICE_QUERY = `
  query CardMarketPrice($id: ID!) {
    cardsearchCard(id: $id) {
      latestPrices { variation currency gbp market }
    }
  }
`;

const MY_DELIVERY_ADDRESS_QUERY = `
  query MyDeliveryAddress {
    myDeliveryAddress { address1 address2 city postcode country }
  }
`;

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
      <div className="rounded-[10px] border border-vault-border bg-vault-raised px-4 py-3">
        <CardElement options={cardStyle} />
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <button type="submit" disabled={busy || !stripe}
        className="w-full rounded-[10px] py-3 text-sm font-semibold text-white bg-vault-accent hover:bg-vault-accentHover dark:bg-vault-accent dark:hover:bg-vault-accentHover disabled:opacity-50 transition-colors">
        {busy ? "Processing…" : `Confirm payment · ${fmt(price, currency)}`}
      </button>
      <button type="button" onClick={onCancel}
        className="w-full rounded-[10px] py-2 text-sm text-vault-textTertiary hover:text-vault-text dark:hover:text-vault-text transition-colors">
        Cancel
      </button>
    </form>
  );
}

// ─── Make an offer form ───────────────────────────────────────────────────────

function OfferForm({ listing, token, onDone, onCancel, marketPrice }) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState(null);

  useEffect(() => {
    if (!token) return;
    gqlFetch(MY_DELIVERY_ADDRESS_QUERY, {}, token)
      .then((d) => setDeliveryAddress(d?.myDeliveryAddress ?? null))
      .catch(() => {});
  }, [token]);

  const listPrice = Number(listing.price) || 0;
  const offerNum  = parseFloat(amount) || 0;
  const pctOff    = listPrice > 0 && offerNum > 0
    ? Math.round(((listPrice - offerNum) / listPrice) * 100)
    : null;
  // Market value deviation
  const marketPctOff = marketPrice && offerNum > 0
    ? Math.round(((marketPrice - offerNum) / marketPrice) * 100)
    : null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!offerNum || offerNum <= 0) { setErr("Enter a valid amount."); return; }
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
    "w-full rounded-[10px] border border-vault-border " +
    "bg-vault-raised px-3 py-2 text-sm text-vault-text " +
    "focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-vault-textTertiary mb-1 block">
          Your offer
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-vault-textTertiary">£</span>
          <input
            type="number" min="0.01" step="0.01"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 4.99"
            className={inputCls + " pl-7"}
          />
        </div>
        {/* Market value context */}
        {marketPrice && (
          <p className="text-xs text-vault-textTertiary mt-1">
            Market value: {fmt(marketPrice)}
            {marketPctOff !== null && marketPctOff > 10 && (
              <span className={marketPctOff > 30 ? " text-amber-400 font-medium" : ""}>
                {" "}· this offer is {marketPctOff}% below market value
              </span>
            )}
            {marketPctOff !== null && marketPctOff <= 0 && (
              <span className=" text-emerald-500 font-medium"> · at or above market value</span>
            )}
          </p>
        )}
        {!marketPrice && pctOff !== null && pctOff > 0 && (
          <p className="text-xs text-vault-textTertiary mt-1">
            {pctOff}% below asking price
          </p>
        )}
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-vault-textTertiary mb-1 block">
          Message (optional)
        </label>
        <textarea
          value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a note to the seller…"
          rows={2}
          className={inputCls + " resize-none"}
        />
      </div>
      {/* Delivery address notice */}
      <div className="rounded-[10px] border border-vault-border bg-vault-raised dark:bg-vault-raised px-3 py-2.5 text-xs text-vault-textTertiary">
        <p className="font-semibold uppercase tracking-wide mb-1">Ship to</p>
        {deliveryAddress?.address1 ? (
          <p className="leading-5">
            {[deliveryAddress.address1, deliveryAddress.address2, deliveryAddress.city, deliveryAddress.postcode]
              .filter(Boolean).join(", ")}
            {" · "}
            <a href="/account?tab=marketplace" className="underline hover:text-vault-text dark:hover:text-vault-text">
              Change
            </a>
          </p>
        ) : (
          <p>
            No delivery address saved.{" "}
            <a href="/account?tab=marketplace" className="underline hover:text-vault-text dark:hover:text-vault-text">
              Add one in account settings
            </a>
            {" "}before making an offer.
          </p>
        )}
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <button type="submit" disabled={busy || !deliveryAddress?.address1}
        className="w-full rounded-[10px] py-3 text-sm font-semibold text-white bg-vault-accent hover:bg-vault-accentHover dark:bg-vault-accent dark:hover:bg-vault-accentHover disabled:opacity-50 transition-colors">
        {busy ? "Sending…" : "Send offer"}
      </button>
      <button type="button" onClick={onCancel}
        className="w-full rounded-[10px] py-2 text-sm text-vault-textTertiary hover:text-vault-text dark:hover:text-vault-text transition-colors">
        Cancel
      </button>
    </form>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function ListingDetailModal({ listing, onClose }) {
  const auth = useContext(AuthContext) || {};
  const token = auth.token || null;
  const isLoggedIn = !!(auth.user || token);

  // phase: "detail" | "paying" | "offer" | "done" | "offered" | "carted" | "carted_guest"
  const [phase, setPhase] = useState("detail");
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showTrade, setShowTrade] = useState(false);
  const [reputation, setReputation] = useState(null);
  const [showReviews, setShowReviews] = useState(false);
  const [marketPrice, setMarketPrice] = useState(null);
  const [imgSlide, setImgSlide] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const sellerId = listing?.seller?.id ?? null;

  useEffect(() => {
    if (!sellerId) return;
    setReputation(null);
    gqlFetch(SELLER_REPUTATION_QUERY, { userId: sellerId })
      .then((d) => setReputation(d?.sellerReputation ?? null))
      .catch(() => {});
  }, [sellerId]);

  useEffect(() => {
    if (!listing?.cardId) return;
    setMarketPrice(null);
    gqlFetch(CARD_MARKET_PRICE_QUERY, { id: listing.cardId })
      .then((d) => {
        const prices = d?.cardsearchCard?.latestPrices;
        if (!prices?.length) return;
        const match = prices.find((p) => !p.variation || p.variation === listing.variation) ?? prices[0];
        const val = Number(match?.market) || Number(match?.gbp) || null;
        setMarketPrice(val);
      })
      .catch(() => {});
  }, [listing?.cardId, listing?.variation]);

  if (!listing) return null;

  const info        = listing.cardInfo || {};
  const isTradeOnly = listing.willTrade && (listing.price == null || listing.price === 0);
  const price       = Number(listing.price) || 0;
  const currency    = listing.currency || "GBP";
  const seller      = listing.seller || {};
  const cond        = COND[listing.condition] || null;
  const imageUrl    = info.imageLarge || info.imageSmall || null;
  const proofImgSrc = listing.proofImageUrl ? `${getApiBase()}${listing.proofImageUrl}` : null;

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
    if (ok) setPhase(isLoggedIn ? "carted" : "carted_guest");
  }

  // ── success banners
  const successPhase = phase === "done" || phase === "offered" || phase === "carted" || phase === "carted_guest";

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full sm:max-w-2xl rounded-t-3xl sm:rounded-[14px] overflow-hidden bg-vault-surface  flex flex-col max-h-[92vh]">

        <button type="button" onClick={onClose}
          className="absolute top-3 right-4 z-10 rounded-[6px] bg-black/30 backdrop-blur-sm text-white px-3 py-1 text-xs font-medium hover:bg-black/50 transition">
          Close
        </button>

        {/* ── Success banners ── */}
        {successPhase && (
          <div className="flex flex-col items-center gap-4 p-10">
            <div className="text-5xl">
              {phase === "done" ? "🎉" : phase === "offered" ? "📨" : "🛒"}
            </div>
            <h2 className="text-xl font-bold text-vault-text">
              {phase === "done"         ? "Payment successful!" :
               phase === "offered"      ? "Offer sent!"         :
                                          "Added to cart!"}
            </h2>
            <p className="text-sm text-center text-vault-textTertiary">
              {phase === "done"
                ? `Order #${order?.orderNumber || order?.id} confirmed. The seller will be notified to ship.`
                : phase === "offered"
                ? "The seller will be notified and can accept, counter, or decline your offer."
                : `${info.name || "Card"} has been added to your cart.`}
            </p>

            {/* Guest nudge — sign in to complete purchase */}
            {phase === "carted_guest" && (
              <div className="w-full rounded-[10px] bg-vault-raised dark:bg-vault-raised border border-vault-border p-4 flex flex-col gap-3 text-center">
                <p className="text-xs text-vault-textTertiary">
                  Sign in to complete your purchase. Your cart will be waiting.
                </p>
                <div className="flex gap-2 justify-center">
                  <a
                    href="/login?redirect=/marketplace"
                    className="rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white bg-vault-accent hover:opacity-90 transition"
                  >
                    Sign in
                  </a>
                  <a
                    href="/register?redirect=/marketplace"
                    className="rounded-[10px] px-5 py-2.5 text-sm font-semibold border border-vault-border text-vault-text hover:bg-vault-surface dark:hover:bg-vault-surface transition"
                  >
                    Create account
                  </a>
                </div>
              </div>
            )}

            <button onClick={onClose}
              className="mt-2 rounded-[10px] px-8 py-3 text-sm font-semibold text-white bg-vault-accent hover:opacity-90 transition">
              {(phase === "carted" || phase === "carted_guest") ? "Continue browsing" : "Done"}
            </button>
          </div>
        )}

        {!successPhase && (
          <div className="flex flex-col sm:flex-row overflow-y-auto">

            {/* ── LEFT: card hero / proof photo carousel ── */}
            <div
              className={`relative sm:w-72 flex-shrink-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6 sm:p-10 min-h-[260px] sm:min-h-0 ${proofImgSrc ? "cursor-pointer select-none" : ""}`}
              onClick={() => proofImgSrc && setImgSlide(s => s === 0 ? 1 : 0)}
            >
              {proofImgSrc && imgSlide === 1 ? (
                <div className="relative z-10 w-full group" onClick={(e) => { e.stopPropagation(); setLightbox(true); }}>
                  <img
                    src={proofImgSrc}
                    alt="Proof photo"
                    className="w-full rounded-[10px]  object-contain max-h-[240px] sm:max-h-none cursor-zoom-in"
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-[10px] opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <span className="bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-[6px]">Click to enlarge</span>
                  </div>
                </div>
              ) : imageUrl ? (
                <>
                  <img src={imageUrl} alt={info.name || "Card"}
                    className="relative z-10 w-full rounded-[10px] "
                    style={{ filter: "drop-(0 8px 24px rgba(0,0,0,0.6))" }}
                  />
                  <div className="absolute inset-0 opacity-20 blur-2xl scale-75"
                    style={{ backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
                  />
                </>
              ) : (
                <div className="w-32 h-44 rounded-[10px] bg-white/10 flex items-center justify-center text-xs text-white/50">No image</div>
              )}
              {/* Toggle label */}
              {proofImgSrc && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                  <span className="text-[10px] font-medium text-white/60 bg-black/40 backdrop-blur-sm rounded-[6px] px-3 py-1">
                    {imgSlide === 0 ? "Tap to view proof photo" : "Tap to view card"}
                  </span>
                </div>
              )}
            </div>

            {/* ── RIGHT: details + actions ── */}
            <div className="flex flex-col gap-4 p-5 flex-1 overflow-y-auto">

              {/* Name + meta */}
              <div>
                <h2 className="text-xl font-bold text-vault-text leading-tight">
                  {info.name || listing.cardId || "Card"}
                </h2>
                {(info.setName || info.number) && (
                  <p className="text-sm text-vault-textTertiary mt-0.5">
                    {[info.setName, info.number ? `#${info.number}` : null].filter(Boolean).join(" · ")}
                  </p>
                )}
                {info.rarity && (
                  <p className="text-xs text-vault-textTertiary mt-0.5">{info.rarity}</p>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {listing.condition && cond && (
                  <span className={`inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1 text-xs font-bold ${cond.bg} ${cond.text}`}>
                    <span className="w-1.5 h-1.5 rounded-[6px] bg-current opacity-60" />
                    {listing.condition} · {cond.label}
                  </span>
                )}
                {listing.variation && listing.variation !== "Standard" && (
                  <span className="inline-flex items-center rounded-[6px] px-3 py-1 text-xs font-medium border border-vault-border text-vault-textTertiary">
                    {listing.variation}
                  </span>
                )}
                {listing.moderationResult === "approved" && (
                  <span className="inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1 text-xs font-semibold bg-emerald-600/20 border border-emerald-500/40 text-emerald-400">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    Card verified
                  </span>
                )}
                {listing.moderationResult === "approved" && listing.proofCode && (
                  <button
                    type="button"
                    title="Click to view proof photo — check this code appears written in the image"
                    onClick={() => proofImgSrc && setImgSlide(1)}
                    className="inline-flex items-center rounded-[6px] px-3 py-1 text-xs font-mono border border-vault-border text-vault-textTertiary hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
                  >
                    Code: {listing.proofCode}
                  </button>
                )}
              </div>
              {proofImgSrc && (
                <button
                  type="button"
                  onClick={() => setImgSlide(s => s === 0 ? 1 : 0)}
                  className="flex items-start gap-2 rounded-[10px] border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5 text-left hover:bg-emerald-500/10 transition-colors w-full"
                >
                  <svg className="mt-0.5 shrink-0 text-emerald-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className="text-[11px] text-emerald-300/80 leading-snug">
                    A proof photo has been submitted for this listing. Tap the card image (or here) to view it and verify the code above appears written in the photo.
                  </p>
                </button>
              )}
              <div className="flex flex-wrap gap-2">
                {listing.willTrade && (
                  <span className="inline-flex items-center gap-1 rounded-[6px] px-3 py-1 text-xs font-semibold bg-violet-600 text-white">
                    {isTradeOnly ? "⇄ Trade Only" : "⇄ Will Trade"}
                  </span>
                )}
                {listing.pendingOfferCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1 text-xs font-semibold bg-orange-500/20 border border-orange-400/40 text-orange-300">
                    <span className="w-1.5 h-1.5 rounded-[6px] bg-orange-400" />
                    Under Offer
                  </span>
                )}
              </div>

              {/* Seller notes */}
              {listing.description && (
                <div className="rounded-[10px] border border-vault-border bg-vault-raised dark:bg-vault-raised px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-vault-textTertiary mb-1.5">Seller notes</p>
                  <p className="text-sm text-vault-text whitespace-pre-wrap leading-relaxed">{listing.description}</p>
                </div>
              )}

              {/* Price + seller */}
              <div className="rounded-[10px] bg-vault-raised dark:bg-vault-raised border border-vault-border p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-vault-textTertiary mb-1">
                    {isTradeOnly ? "Listing type" : "Listed price"}
                  </div>
                  {isTradeOnly ? (
                    <div className="text-2xl font-extrabold text-violet-400 tracking-tight">Trade Only</div>
                  ) : (
                    <div className="text-3xl font-extrabold text-vault-text tracking-tight">
                      {fmt(price, currency)}
                    </div>
                  )}
                </div>
                {seller.username && (
                  <div className="flex items-center gap-2.5">
                    {seller.avatar ? (
                      <img src={seller.avatar} alt={seller.username} className="w-10 h-10 rounded-[6px] object-cover border-2 border-vault-border" />
                    ) : (
                      <div className="w-10 h-10 rounded-[6px] bg-vault-accent/20 dark:bg-vault-accent/20 border-2 border-vault-border flex items-center justify-center text-sm font-bold text-vault-accent">
                        {seller.username[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-vault-text">{seller.username}</div>
                      <div className="mt-1">
                        {reputation ? (
                          <SellerTierBadge
                            reputation={reputation}
                            size="sm"
                            onClick={() => setShowReviews(true)}
                          />
                        ) : (
                          <div className="text-[10px] text-vault-textTertiary">Seller</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {err && <p className="text-xs text-red-400">{err}</p>}

              {/* ── Action buttons ── */}
              {phase === "detail" && (
                <div className="flex flex-col gap-2 mt-auto">
                  {isTradeOnly ? (
                    /* Trade-only: no buy/cart/offer, just trade */
                    <>
                      {isLoggedIn ? (
                        <button type="button"
                          onClick={() => setShowTrade(true)}
                          className="w-full rounded-[10px] py-3.5 text-sm font-bold border-2 border-violet-600 text-violet-400 hover:bg-violet-600 hover:text-white transition-colors">
                          ⇄ Propose a trade
                        </button>
                      ) : (
                        <p className="text-xs text-center text-vault-textTertiary">
                          Sign in to propose a trade.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Primary: buy now */}
                      <button type="button" onClick={handleBuy} disabled={busy || !isLoggedIn}
                        className="w-full rounded-[10px] py-3.5 text-sm font-bold text-white bg-vault-accent hover:bg-vault-accentHover dark:bg-vault-accent dark:hover:bg-vault-accentHover disabled:opacity-50 transition-colors  -vault-accent/20 dark:-vault-accent/20">
                        {busy ? "Preparing checkout…" : !isLoggedIn ? "Sign in to buy" : `Buy now · ${fmt(price, currency)}`}
                      </button>

                      {/* Secondary row: Add to cart + Make an offer */}
                      <div className="grid gap-2" style={{ gridTemplateColumns: listing.allowOffers && isLoggedIn ? "1fr 1fr" : "1fr" }}>
                        <button type="button" onClick={handleAddToCart}
                          className="rounded-[10px] py-2.5 text-sm font-semibold border-2 border-vault-border text-vault-text hover:border-vault-borderStrong hover:text-vault-accent dark:hover:text-vault-accent transition-colors">
                          🛒 Add to cart
                        </button>
                        {listing.allowOffers && isLoggedIn && (
                          <button type="button" onClick={() => setPhase("offer")}
                            className="rounded-[10px] py-2.5 text-sm font-semibold border-2 border-vault-border text-vault-text hover:border-amber-500 hover:text-amber-500 transition-colors">
                            💬 Make an offer
                          </button>
                        )}
                      </div>

                      {/* Trade button */}
                      {listing.willTrade && isLoggedIn && (
                        <button type="button"
                          onClick={() => setShowTrade(true)}
                          className="w-full rounded-[10px] py-2.5 text-sm font-semibold border-2 border-violet-600 text-violet-600 dark:text-violet-400 dark:border-violet-500 hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 dark:hover:text-white transition-colors">
                          ⇄ Propose a trade
                        </button>
                      )}
                    </>
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
                  marketPrice={marketPrice}
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

    <SellerReviewsDrawer
      sellerId={seller.id}
      sellerUsername={seller.username}
      open={showReviews}
      onClose={() => setShowReviews(false)}
    />

    {lightbox && proofImgSrc && (
      <div
        className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4"
        onClick={() => setLightbox(false)}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => setLightbox(false)}
          className="absolute top-4 right-4 rounded-[6px] bg-white/10 hover:bg-white/20 text-white p-2 transition-colors"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        {/* Image */}
        <img
          src={proofImgSrc}
          alt="Proof photo"
          className="max-w-full max-h-[80vh] rounded-[10px]  object-contain"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Code + instruction */}
        <div className="mt-4 flex flex-col items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <p className="text-white/50 text-xs">Check the handwritten code matches the listing code</p>
          {listing.proofCode && (
            <span className="font-mono font-bold tracking-[0.25em] text-white text-lg bg-white/10 rounded-[10px] px-5 py-2">
              {listing.proofCode}
            </span>
          )}
        </div>
      </div>
    )}
    </>
  );
}

// frontend/src/components/Marketplace/ProposeTradeModal.js
// Propose a card trade from a marketplace listing.
//
// Flow:
//   - "They get"  → pre-filled from listing (cardId / condition / variation)
//   - "You offer" → multi-select from your collection
//   - Cash sweetener → optional top-up from wallet balance
//   - Submit → initiateTrade GQL mutation

"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/components/Auth/AuthProvider";
import { MY_COLLECTION_QUERY } from '@/graphql/collection';
import { MY_WALLET_QUERY, INITIATE_TRADE_MUTATION } from '@/graphql/trades';

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { gqlFetch } from "@/utils/apiClient";

import { CARD_MARKET_PRICE_QUERY } from '@/graphql/cards';

function fmt(amount, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
      Number(amount) || 0
    );
  } catch {
    return `£${Number(amount || 0).toFixed(2)}`;
  }
}

const COND_CLS = {
  NM: "bg-emerald-500 text-white",
  LP: "bg-yellow-400 text-gray-900",
  MP: "bg-orange-500 text-white",
  PL: "bg-red-500 text-white",
};

// ─── Collection card picker row ───────────────────────────────────────────────

function CollectionRow({ entry, selected, onToggle }) {
  const card = entry.card || {};
  const imgUrl = card.images?.small || null;
  const isSelected = selected.has(entry.id);

  return (
    <button
      type="button"
      onClick={() => onToggle(entry)}
      className={
        "flex items-center gap-3 w-full rounded-[10px] px-3 py-2.5 text-left transition-colors border " +
        (isSelected
          ? "border-vault-accent dark:border-vault-accent bg-vault-accent/5 dark:bg-vault-accent/5"
          : "border-transparent hover:bg-vault-raised dark:hover:bg-vault-raised")
      }
    >
      {/* Card thumbnail */}
      <div className="relative flex-shrink-0 w-8 h-11 rounded-md overflow-hidden bg-black">
        {imgUrl ? (
          <img src={imgUrl} alt={card.name} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full bg-vault-raised" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-vault-text truncate">
          {card.name || entry.cardId}
        </div>
        <div className="text-[11px] text-vault-textTertiary truncate">
          {[card.set?.name, card.number ? `#${card.number}` : null]
            .filter(Boolean)
            .join(" · ")}
          {entry.condition ? ` · ${entry.condition}` : ""}
          {entry.variation && entry.variation !== "Standard" ? ` · ${entry.variation}` : ""}
        </div>
      </div>

      {/* Qty badge */}
      {entry.quantity > 1 && (
        <span className="flex-shrink-0 text-[10px] font-semibold text-vault-textTertiary">
          ×{entry.quantity}
        </span>
      )}

      {/* Checkbox */}
      <div
        className={
          "flex-shrink-0 w-5 h-5 rounded-[6px] border-2 flex items-center justify-center transition-colors " +
          (isSelected
            ? "border-vault-accent dark:border-vault-accent bg-vault-accent"
            : "border-vault-border")
        }
      >
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </button>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function ProposeTradeModal({ listing, onClose }) {
  const auth = useContext(AuthContext) || {};
  const token = auth.token || null;

  const info    = listing?.cardInfo || {};
  const seller  = listing?.seller  || {};
  const imageUrl = info.imageSmall || info.imageLarge || null;

  // Data loading
  const [collection, setCollection] = useState([]);
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletCurrency, setWalletCurrency] = useState("GBP");
  const [loadingCollection, setLoadingCollection] = useState(true);

  // Market price of the wanted card (from listing)
  const [wantedMarketPrice, setWantedMarketPrice] = useState(null);

  // Market prices of the offered cards: cardId → price
  const [offeredPrices, setOfferedPrices] = useState(new Map());

  // Selection state
  const [selected, setSelected] = useState(new Map()); // entryId → entry
  const [search, setSearch] = useState("");
  const [topUp, setTopUp] = useState("");
  const [addingTopUp, setAddingTopUp] = useState(false);

  // Submit
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  // Load collection + wallet on mount
  useEffect(() => {
    if (!token) { setLoadingCollection(false); return; }
    Promise.all([
      gqlFetch(MY_COLLECTION_QUERY, {}, token).then((d) => {
        setCollection(d?.myCollection || []);
      }),
      gqlFetch(MY_WALLET_QUERY, {}, token).then((d) => {
        setWalletBalance(d?.myWallet?.balance ?? null);
        setWalletCurrency(d?.myWallet?.currency || "GBP");
      }),
    ])
      .catch(() => {})
      .finally(() => setLoadingCollection(false));
  }, [token]);

  // Fetch market price for the wanted card
  useEffect(() => {
    if (!listing?.cardId) return;
    gqlFetch(CARD_MARKET_PRICE_QUERY, { id: listing.cardId })
      .then((d) => {
        const prices = d?.cardsearchCard?.latestPrices;
        if (!prices?.length) return;
        const listingVariation = (listing.variation || "").toLowerCase();
        const match =
          prices.find((p) => p.variation?.toLowerCase() === listingVariation && (Number(p.market) || Number(p.gbp))) ??
          prices.find((p) => Number(p.market) || Number(p.gbp)) ??
          prices[0];
        const val = Number(match?.market) || Number(match?.gbp) || null;
        setWantedMarketPrice(val);
      })
      .catch(() => {});
  }, [listing?.cardId, listing?.variation]);

  // Fetch market prices for newly selected cards
  useEffect(() => {
    const entries = [...selected.values()];
    const missing = [...new Map(entries.map((e) => [e.cardId, e])).values()]
      .filter((e) => !offeredPrices.has(e.cardId));
    if (!missing.length) return;
    missing.forEach((entry) => {
      gqlFetch(CARD_MARKET_PRICE_QUERY, { id: entry.cardId })
        .then((d) => {
          const prices = d?.cardsearchCard?.latestPrices;
          if (!prices?.length) return;
          // Prefer matching variation, then first with a non-zero value
          const cardVariation = (entry.variation || "").toLowerCase();
          const match =
            prices.find((p) => p.variation?.toLowerCase() === cardVariation && (Number(p.market) || Number(p.gbp))) ??
            prices.find((p) => Number(p.market) || Number(p.gbp)) ??
            prices[0];
          const val = Number(match?.market) || Number(match?.gbp) || null;
          if (val) {
            setOfferedPrices((prev) => new Map(prev).set(entry.cardId, val));
          }
        })
        .catch(() => {});
    });
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered collection
  const filtered = useMemo(() => {
    if (!search.trim()) return collection;
    const q = search.toLowerCase();
    return collection.filter((e) => {
      const name = (e.card?.name || e.cardId || "").toLowerCase();
      const setName = (e.card?.set?.name || "").toLowerCase();
      return name.includes(q) || setName.includes(q);
    });
  }, [collection, search]);

  function toggleEntry(entry) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.set(entry.id, entry);
      return next;
    });
  }

  const topUpNum = parseFloat(topUp) || 0;
  const topUpExceedsBalance =
    walletBalance != null && topUpNum > 0 && topUpNum > walletBalance;

  const offeredCardTotal = useMemo(() =>
    [...selected.values()].reduce((sum, e) => sum + (offeredPrices.get(e.cardId) || 0), 0),
    [selected, offeredPrices]
  );

  // Total estimated value of offered cards + cash top-up
  const totalOfferedValue = offeredCardTotal + topUpNum;

  async function handleSubmit(e) {
    e.preventDefault();
    if (selected.size === 0) {
      setErr("Select at least one card to offer.");
      return;
    }
    if (topUpExceedsBalance) {
      setErr("Top-up amount exceeds your available wallet balance.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const offeredCards = [...selected.values()].map((e) => ({
        cardId:    e.cardId,
        quantity:  1,
        condition: e.condition || undefined,
        variation: e.variation || undefined,
      }));

      const wantedCards = [{
        cardId:    listing.cardId,
        quantity:  1,
        condition: listing.condition || undefined,
        variation: listing.variation || undefined,
      }];

      await gqlFetch(
        INITIATE_TRADE_MUTATION,
        {
          userId:      seller.id,
          offeredCards,
          wantedCards,
          topUpAmount: topUpNum > 0 ? topUpNum : null,
        },
        token
      );
      setDone(true);
    } catch (ex) {
      setErr(ex.message || "Failed to send trade proposal");
    } finally {
      setBusy(false);
    }
  }

  // ── Styles
  const overlay =
    "fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 " +
    "bg-black/60 backdrop-blur-sm";
  const modal =
    "relative w-full sm:max-w-2xl rounded-t-3xl sm:rounded-[14px] overflow-hidden " +
    "bg-vault-surface  flex flex-col max-h-[92vh]";
  const sectionLabel =
    "text-[10px] font-bold uppercase tracking-widest text-vault-textTertiary mb-2";
  const inputCls =
    "w-full rounded-[10px] border border-vault-border " +
    "bg-vault-raised px-3 py-2 text-sm text-vault-text " +
    "focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent";

  return (
    <div className={overlay} role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={modal}>

        {/* Header */}
        <div className="flex-shrink-0 border-b border-vault-border">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h2 className="text-base font-bold text-vault-text">
                Propose a trade
              </h2>
              {seller.username && (
                <p className="text-xs text-vault-textTertiary mt-0.5">
                  with <span className="font-medium text-vault-text">{seller.username}</span>
                </p>
              )}
            </div>
            <button type="button" onClick={onClose}
              className="rounded-[6px] bg-vault-raised px-3 py-1 text-xs font-medium text-vault-textTertiary hover:text-vault-text dark:hover:text-vault-text transition">
              Close
            </button>
          </div>

          {/* Wallet balance strip */}
          <div className="mx-5 mb-3 flex items-center justify-between rounded-[10px] bg-vault-raised dark:bg-vault-raised border border-vault-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">👛</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-vault-textTertiary">
                Wallet balance
              </span>
            </div>
            {walletBalance != null ? (
              <span className="text-sm font-bold text-vault-text">
                {fmt(walletBalance, walletCurrency)}
              </span>
            ) : (
              <span className="text-xs text-vault-textTertiary">
                {loadingCollection ? "Loading…" : "—"}
              </span>
            )}
          </div>
        </div>

        {/* Done state */}
        {done && (
          <div className="flex flex-col items-center gap-4 p-10">
            <div className="text-5xl">🤝</div>
            <h3 className="text-xl font-bold text-vault-text">Trade proposed!</h3>
            <p className="text-sm text-center text-vault-textTertiary">
              Your offer has been sent to <strong>{seller.username || "the seller"}</strong>.<br />
              They can accept, counter, or decline from their trades inbox.
            </p>
            <button onClick={onClose}
              className="mt-2 rounded-[10px] px-8 py-3 text-sm font-semibold text-white bg-vault-accent hover:opacity-90 transition">
              Done
            </button>
          </div>
        )}

        {!done && (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto">

              {/* ── Two-column trade summary ── */}
              <div className="grid grid-cols-2 gap-px bg-vault-border dark:bg-vault-border border-b border-vault-border">

                {/* They get (wanted) */}
                <div className="bg-vault-surface p-4">
                  <div className={sectionLabel}>They send you</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-14 rounded-[6px] overflow-hidden bg-black">
                      {imageUrl
                        ? <img src={imageUrl} alt={info.name} className="w-full h-full object-contain" />
                        : <div className="w-full h-full bg-vault-raised" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-vault-text truncate">
                        {info.name || listing?.cardId || "Card"}
                      </div>
                      {(info.setName || info.number) && (
                        <div className="text-[11px] text-vault-textTertiary">
                          {[info.setName, info.number ? `#${info.number}` : null].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      <div className="flex gap-1 mt-1">
                        {listing?.condition && (
                          <span className={`rounded-[6px] px-1.5 py-0.5 text-[9px] font-bold ${COND_CLS[listing.condition] || "bg-gray-500 text-white"}`}>
                            {listing.condition}
                          </span>
                        )}
                        {listing?.variation && listing.variation !== "Standard" && (
                          <span className="rounded-[6px] px-1.5 py-0.5 text-[9px] font-medium bg-vault-raised text-vault-textTertiary border border-vault-border">
                            {listing.variation}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* You offer */}
                <div className="bg-vault-surface p-4">
                  <div className={sectionLabel}>
                    You offer
                    {selected.size > 0 && (
                      <span className="ml-1.5 rounded-[6px] bg-vault-accent text-white px-1.5 py-0.5 text-[9px]">
                        {selected.size}
                      </span>
                    )}
                  </div>
                  {selected.size === 0 ? (
                    <p className="text-xs text-vault-textTertiary">
                      Select cards below ↓
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {[...selected.values()].map((e) => (
                        <div key={e.id} className="flex items-center gap-1 rounded-[6px] bg-vault-raised px-2 py-1">
                          {e.card?.images?.small && (
                            <img src={e.card.images.small} alt={e.card.name} className="w-5 h-7 object-contain rounded" />
                          )}
                          <span className="text-[11px] font-medium text-vault-text truncate max-w-[80px]">
                            {e.card?.name || e.cardId}
                          </span>
                          <button type="button" onClick={() => toggleEntry(e)}
                            className="text-vault-textTertiary hover:text-red-500 text-xs ml-0.5">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Collection picker ── */}
              <div className="p-4 border-b border-vault-border">
                <div className={sectionLabel}>Your collection — pick cards to offer</div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your collection…"
                  className={inputCls + " mb-3"}
                />
                {loadingCollection ? (
                  <p className="text-xs text-vault-textTertiary py-4 text-center">
                    Loading your collection…
                  </p>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-vault-textTertiary py-4 text-center">
                    {collection.length === 0
                      ? "Your collection is empty. Add cards to trade them."
                      : "No cards match your search."}
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 rounded-[10px] border border-vault-border p-1">
                    {filtered.map((entry) => (
                      <CollectionRow
                        key={entry.id}
                        entry={entry}
                        selected={selected}
                        onToggle={toggleEntry}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Cash sweetener ── */}
              <div className="p-4 border-b border-vault-border">
                <div className="mb-2">
                  <div className={sectionLabel + " mb-0"}>Cash sweetener (optional)</div>
                </div>

                {!addingTopUp ? (
                  <button type="button" onClick={() => setAddingTopUp(true)}
                    className="text-xs font-medium text-vault-accent hover:underline">
                    + Add cash to sweeten the deal
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-vault-textTertiary">£</span>
                      <input
                        type="number" min="0.01" step="0.01"
                        value={topUp}
                        onChange={(e) => setTopUp(e.target.value)}
                        placeholder="0.00"
                        className={inputCls + " pl-7"}
                        autoFocus
                      />
                    </div>
                    <button type="button" onClick={() => { setTopUp(""); setAddingTopUp(false); }}
                      className="text-xs text-vault-textTertiary hover:text-red-500">
                      Remove
                    </button>
                  </div>
                )}
                {topUpExceedsBalance && (
                  <p className="text-xs text-red-400 mt-1.5">
                    Exceeds your wallet balance of {fmt(walletBalance, walletCurrency)}.
                  </p>
                )}
                {topUpNum > 0 && !topUpExceedsBalance && (
                  <p className="text-xs text-vault-textTertiary mt-1.5">
                    {fmt(topUpNum)} will be held from your wallet when the seller accepts.
                  </p>
                )}
              </div>

            </div>

            {/* ── Footer ── */}
            <div className="p-4 flex flex-col gap-3 border-t border-vault-border flex-shrink-0">
              {err && <p className="text-xs text-red-400">{err}</p>}

              {/* Trade summary line */}
              {(selected.size > 0 || topUpNum > 0) && (
                <div className="rounded-[10px] bg-vault-raised dark:bg-vault-raised px-3 py-2 text-xs text-vault-textTertiary flex flex-wrap gap-1 items-center">
                  <span>You offer:</span>
                  {[...selected.values()].map((e) => (
                    <span key={e.id} className="font-medium text-vault-text">
                      {e.card?.name || e.cardId}
                    </span>
                  ))}
                  {topUpNum > 0 && (
                    <span className="font-medium text-emerald-500">+ {fmt(topUpNum)}</span>
                  )}
                  <span className="mx-1">→</span>
                  <span className="font-medium text-vault-text">
                    {info.name || listing?.cardId}
                  </span>
                </div>
              )}

              {/* Value context */}
              {(wantedMarketPrice || listing?.price > 0 || selected.size > 0) && (
                <div className="rounded-[10px] border border-vault-border px-3 py-2 text-xs text-vault-textTertiary space-y-0.5">
                  {/* Card they're sending */}
                  {listing?.price > 0 && (
                    <div className="flex justify-between">
                      <span>Listing price</span>
                      <span className="font-semibold text-vault-text">{fmt(listing.price, listing.currency)}</span>
                    </div>
                  )}
                  {wantedMarketPrice && (
                    <div className="flex justify-between">
                      <span>Their card market value</span>
                      <span className="font-semibold text-vault-text">{fmt(wantedMarketPrice)}</span>
                    </div>
                  )}

                  {/* Divider before your offer */}
                  {selected.size > 0 && (
                    <div className="border-t border-vault-border pt-1 mt-1 space-y-0.5">
                      {offeredCardTotal > 0 ? (
                        <div className="flex justify-between">
                          <span>Your cards value <span className="opacity-60">(est.)</span></span>
                          <span className="font-semibold text-vault-text">{fmt(offeredCardTotal)}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between">
                          <span>Your cards</span>
                          <span className="font-semibold text-vault-textTertiary">
                            {selected.size} card{selected.size !== 1 ? "s" : ""} — fetching value…
                          </span>
                        </div>
                      )}
                      {topUpNum > 0 && (
                        <div className="flex justify-between">
                          <span>Cash sweetener</span>
                          <span className="font-semibold text-emerald-500">+ {fmt(topUpNum)}</span>
                        </div>
                      )}
                      {totalOfferedValue > 0 && (topUpNum > 0 || offeredCardTotal > 0) && (
                        <div className="flex justify-between border-t border-vault-border pt-1 mt-1">
                          <span className="font-semibold text-vault-text">Your total offer value</span>
                          <span className={`font-bold ${wantedMarketPrice && totalOfferedValue < wantedMarketPrice * 0.7 ? "text-amber-400" : "text-emerald-500"}`}>
                            {fmt(totalOfferedValue)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || selected.size === 0 || topUpExceedsBalance}
                className="w-full rounded-[10px] py-3.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors  -violet-600/20"
              >
                {busy ? "Sending proposal…" : `Send trade proposal to ${seller.username || "seller"}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

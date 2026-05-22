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
import { gql } from "@apollo/client";
import { AuthContext } from "@/components/Auth/AuthProvider";

// ─── GQL ─────────────────────────────────────────────────────────────────────

const MY_COLLECTION_QUERY = gql`
  query MyCollectionForTrade {
    myCollection {
      id
      cardId
      quantity
      condition
      variation
      card {
        id
        name
        number
        rarity
        images { small large }
        set { name }
      }
    }
  }
`;

const MY_WALLET_QUERY = gql`
  query MyWalletForTrade {
    myWallet(limit: 1) {
      balance
      held
      currency
    }
  }
`;

const INITIATE_TRADE_MUTATION = gql`
  mutation InitiateTrade(
    $userId: ID!
    $offeredCards: [TradeCardInput!]
    $wantedCards: [TradeCardInput!]
    $topUpAmount: Float
  ) {
    initiateTrade(
      userId: $userId
      offeredCards: $offeredCards
      wantedCards: $wantedCards
      topUpAmount: $topUpAmount
    ) {
      id
      status
      createdAt
    }
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { gqlFetch } from "@/utils/apiClient";

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
        "flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-left transition-colors border " +
        (isSelected
          ? "border-light-accent dark:border-dark-accent bg-light-accent/5 dark:bg-dark-accent/5"
          : "border-transparent hover:bg-light-alt dark:hover:bg-dark-alt")
      }
    >
      {/* Card thumbnail */}
      <div className="relative flex-shrink-0 w-8 h-11 rounded-md overflow-hidden bg-black">
        {imgUrl ? (
          <img src={imgUrl} alt={card.name} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full bg-light-alt dark:bg-dark-alt" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-light-strong dark:text-dark-strong truncate">
          {card.name || entry.cardId}
        </div>
        <div className="text-[11px] text-light-muted dark:text-dark-muted truncate">
          {[card.set?.name, card.number ? `#${card.number}` : null]
            .filter(Boolean)
            .join(" · ")}
          {entry.condition ? ` · ${entry.condition}` : ""}
          {entry.variation && entry.variation !== "Standard" ? ` · ${entry.variation}` : ""}
        </div>
      </div>

      {/* Qty badge */}
      {entry.quantity > 1 && (
        <span className="flex-shrink-0 text-[10px] font-semibold text-light-muted dark:text-dark-muted">
          ×{entry.quantity}
        </span>
      )}

      {/* Checkbox */}
      <div
        className={
          "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors " +
          (isSelected
            ? "border-light-accent dark:border-dark-accent bg-light-accent dark:bg-dark-accent"
            : "border-light-border dark:border-dark-border")
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
  const token = auth.accessToken || auth.token || null;

  const info    = listing?.cardInfo || {};
  const seller  = listing?.seller  || {};
  const imageUrl = info.imageSmall || info.imageLarge || null;

  // Data loading
  const [collection, setCollection] = useState([]);
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletCurrency, setWalletCurrency] = useState("GBP");
  const [loadingCollection, setLoadingCollection] = useState(true);

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
    "relative w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden " +
    "bg-light-surface dark:bg-dark-surface shadow-2xl flex flex-col max-h-[92vh]";
  const sectionLabel =
    "text-[10px] font-bold uppercase tracking-widest text-light-muted dark:text-dark-muted mb-2";
  const inputCls =
    "w-full rounded-xl border border-light-border dark:border-dark-border " +
    "bg-light-alt dark:bg-dark-alt px-3 py-2 text-sm text-light-strong dark:text-dark-strong " +
    "focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent";

  return (
    <div className={overlay} role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={modal}>

        {/* Header */}
        <div className="flex-shrink-0 border-b border-light-border dark:border-dark-border">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h2 className="text-base font-bold text-light-strong dark:text-dark-strong">
                Propose a trade
              </h2>
              {seller.username && (
                <p className="text-xs text-light-muted dark:text-dark-muted mt-0.5">
                  with <span className="font-medium text-light-strong dark:text-dark-strong">{seller.username}</span>
                </p>
              )}
            </div>
            <button type="button" onClick={onClose}
              className="rounded-full bg-light-alt dark:bg-dark-alt px-3 py-1 text-xs font-medium text-light-muted dark:text-dark-muted hover:text-light-strong dark:hover:text-dark-strong transition">
              Close
            </button>
          </div>

          {/* Wallet balance strip */}
          <div className="mx-5 mb-3 flex items-center justify-between rounded-xl bg-light-elevated dark:bg-dark-elevated border border-light-border dark:border-dark-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">👛</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-light-muted dark:text-dark-muted">
                Wallet balance
              </span>
            </div>
            {walletBalance != null ? (
              <span className="text-sm font-bold text-light-strong dark:text-dark-strong">
                {fmt(walletBalance, walletCurrency)}
              </span>
            ) : (
              <span className="text-xs text-light-muted dark:text-dark-muted">
                {loadingCollection ? "Loading…" : "—"}
              </span>
            )}
          </div>
        </div>

        {/* Done state */}
        {done && (
          <div className="flex flex-col items-center gap-4 p-10">
            <div className="text-5xl">🤝</div>
            <h3 className="text-xl font-bold text-light-strong dark:text-dark-strong">Trade proposed!</h3>
            <p className="text-sm text-center text-light-muted dark:text-dark-muted">
              Your offer has been sent to <strong>{seller.username || "the seller"}</strong>.<br />
              They can accept, counter, or decline from their trades inbox.
            </p>
            <button onClick={onClose}
              className="mt-2 rounded-xl px-8 py-3 text-sm font-semibold text-white bg-light-accent dark:bg-dark-accent hover:opacity-90 transition">
              Done
            </button>
          </div>
        )}

        {!done && (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto">

              {/* ── Two-column trade summary ── */}
              <div className="grid grid-cols-2 gap-px bg-light-border dark:bg-dark-border border-b border-light-border dark:border-dark-border">

                {/* They get (wanted) */}
                <div className="bg-light-surface dark:bg-dark-surface p-4">
                  <div className={sectionLabel}>They send you</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-14 rounded-lg overflow-hidden bg-black">
                      {imageUrl
                        ? <img src={imageUrl} alt={info.name} className="w-full h-full object-contain" />
                        : <div className="w-full h-full bg-light-alt dark:bg-dark-alt" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-light-strong dark:text-dark-strong truncate">
                        {info.name || listing?.cardId || "Card"}
                      </div>
                      {(info.setName || info.number) && (
                        <div className="text-[11px] text-light-muted dark:text-dark-muted">
                          {[info.setName, info.number ? `#${info.number}` : null].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      <div className="flex gap-1 mt-1">
                        {listing?.condition && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${COND_CLS[listing.condition] || "bg-gray-500 text-white"}`}>
                            {listing.condition}
                          </span>
                        )}
                        {listing?.variation && listing.variation !== "Standard" && (
                          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-light-alt dark:bg-dark-alt text-light-muted dark:text-dark-muted border border-light-border dark:border-dark-border">
                            {listing.variation}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* You offer */}
                <div className="bg-light-surface dark:bg-dark-surface p-4">
                  <div className={sectionLabel}>
                    You offer
                    {selected.size > 0 && (
                      <span className="ml-1.5 rounded-full bg-light-accent dark:bg-dark-accent text-white px-1.5 py-0.5 text-[9px]">
                        {selected.size}
                      </span>
                    )}
                  </div>
                  {selected.size === 0 ? (
                    <p className="text-xs text-light-muted dark:text-dark-muted">
                      Select cards below ↓
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {[...selected.values()].map((e) => (
                        <div key={e.id} className="flex items-center gap-1 rounded-lg bg-light-alt dark:bg-dark-alt px-2 py-1">
                          {e.card?.images?.small && (
                            <img src={e.card.images.small} alt={e.card.name} className="w-5 h-7 object-contain rounded" />
                          )}
                          <span className="text-[11px] font-medium text-light-strong dark:text-dark-strong truncate max-w-[80px]">
                            {e.card?.name || e.cardId}
                          </span>
                          <button type="button" onClick={() => toggleEntry(e)}
                            className="text-light-muted dark:text-dark-muted hover:text-red-500 text-xs ml-0.5">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Collection picker ── */}
              <div className="p-4 border-b border-light-border dark:border-dark-border">
                <div className={sectionLabel}>Your collection — pick cards to offer</div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your collection…"
                  className={inputCls + " mb-3"}
                />
                {loadingCollection ? (
                  <p className="text-xs text-light-muted dark:text-dark-muted py-4 text-center">
                    Loading your collection…
                  </p>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-light-muted dark:text-dark-muted py-4 text-center">
                    {collection.length === 0
                      ? "Your collection is empty. Add cards to trade them."
                      : "No cards match your search."}
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 rounded-xl border border-light-border dark:border-dark-border p-1">
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
              <div className="p-4 border-b border-light-border dark:border-dark-border">
                <div className="mb-2">
                  <div className={sectionLabel + " mb-0"}>Cash sweetener (optional)</div>
                </div>

                {!addingTopUp ? (
                  <button type="button" onClick={() => setAddingTopUp(true)}
                    className="text-xs font-medium text-light-accent dark:text-dark-accent hover:underline">
                    + Add cash to sweeten the deal
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-light-muted dark:text-dark-muted">£</span>
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
                      className="text-xs text-light-muted dark:text-dark-muted hover:text-red-500">
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
                  <p className="text-xs text-light-muted dark:text-dark-muted mt-1.5">
                    {fmt(topUpNum)} will be held from your wallet when the seller accepts.
                  </p>
                )}
              </div>

            </div>

            {/* ── Footer ── */}
            <div className="p-4 flex flex-col gap-3 border-t border-light-border dark:border-dark-border flex-shrink-0">
              {err && <p className="text-xs text-red-400">{err}</p>}

              {/* Trade summary line */}
              {(selected.size > 0 || topUpNum > 0) && (
                <div className="rounded-xl bg-light-elevated dark:bg-dark-elevated px-3 py-2 text-xs text-light-muted dark:text-dark-muted flex flex-wrap gap-1 items-center">
                  <span>You offer:</span>
                  {[...selected.values()].map((e) => (
                    <span key={e.id} className="font-medium text-light-strong dark:text-dark-strong">
                      {e.card?.name || e.cardId}
                    </span>
                  ))}
                  {topUpNum > 0 && (
                    <span className="font-medium text-emerald-500">+ {fmt(topUpNum)}</span>
                  )}
                  <span className="mx-1">→</span>
                  <span className="font-medium text-light-strong dark:text-dark-strong">
                    {info.name || listing?.cardId}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy || selected.size === 0 || topUpExceedsBalance}
                className="w-full rounded-xl py-3.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-violet-600/20"
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

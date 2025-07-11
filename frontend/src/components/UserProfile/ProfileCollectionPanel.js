"use client";

import React, { useState, useMemo, useContext, useEffect } from "react";
import Image from "next/image";
import { getSetLogo } from "@/utils/setLogos";
import EditCollectionCardModal from "@/components/Collection/EditCollectionCardModal";
import CardDetailsModal from "@/components/UserProfile/CardDetailsModal";
import { formatCondition, getConditionClass } from "@/utils/formatCondition";
import { formatRelativeTime } from "@/utils/formatDate";
import { AuthContext } from "@/components/Auth/AuthProvider";
import QuantitySelectorModal from "@/components/UI/QuantitySelectorModal";
import { getCardImageUrl } from "@/utils/imageUtils";
import CardSkeleton from "@/components/UI/CardSkeleton";

// Use your custom collection hook:
import useProfileCollection from "@/hooks/useProfileCollection";
// Use your updated actions:
import useProfileCardActions from "@/hooks/useProfileCardActions";

// --- CONSTANTS & HELPERS ---
const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'set-asc', label: 'Set (A-Z)' },
  { value: 'set-desc', label: 'Set (Z-A)' },
  { value: 'price-asc', label: 'Price (Low to High)' },
  { value: 'price-desc', label: 'Price (High to Low)' },
  { value: 'date-asc', label: 'Date Added (Oldest First)' },
  { value: 'date-desc', label: 'Date Added (Newest First)' },
  { value: 'quantity-asc', label: 'Quantity (Low to High)' },
  { value: 'quantity-desc', label: 'Quantity (High to Low)' },
];

const formatCurrency = value =>
  new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(value);

const getCardAveragePrice = (card) => {
  if (!card || !Array.isArray(card.prices)) return null;
  const selectedVariation = card.variation || "normal";
  let priceObj = card.prices.find(
    (p) => p && (p.variation === selectedVariation)
  );
  if (!priceObj && card.prices.length) priceObj = card.prices[0];

  if (!priceObj) return null;

  const toNumber = v => (typeof v === "number" ? v : Number(v));
  const tcg = toNumber(priceObj.tcgplayer);
  const cmk = toNumber(priceObj.cardmarket);

  if (tcg == null && cmk == null) return null;
  if (tcg != null && cmk != null) return (tcg + cmk) / 2;
  return tcg != null ? tcg : cmk;
};

const getDate = (date) =>
  date ? new Date(typeof date === 'string' ? parseInt(date, 10) : date) : null;

function CollectionSkeletonGrid({ count = 10 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-6">
      {Array.from({ length: count }).map((_, idx) => (
        <CardSkeleton key={idx} />
      ))}
    </div>
  );
}

// --- MAIN PANEL COMPONENT ---
export default function ProfileCollectionPanel({
  userId,
  isOwnProfile,
  onAddToCollection,
  onCardUpdated,
  dark,
}) {
  const { token } = useContext(AuthContext);

  // 1. Server state and loading
  const { collection, loading } = useProfileCollection({ user: { id: userId }, token });

  // 2. Local display state for INSTANT updates
  const [displayCollection, setDisplayCollection] = useState(collection.value || []);
  useEffect(() => {
    setDisplayCollection(collection.value || []);
  }, [collection.value]);

  // UI state for modals etc.
  const [setFilter, setSetFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState("name-asc");
  const [selectedCard, setSelectedCard] = useState(null);
  const [editingCard, setEditingCard] = useState(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [removeCard, setRemoveCard] = useState(null);

  // 3. Actions (pass setDisplayCollection for INSTANT removal)
  const { handleRemoveCard } = useProfileCardActions({
    isOwnProfile,
    token,
    setCollection: setDisplayCollection, // key: UI updates local state, not just server
    collection: displayCollection
  });

  // --- Filtering/Sorting using local state ---
  const filteredCards = useMemo(() => {
    return (displayCollection || []).filter(card =>
      (!setFilter || card.setName === setFilter) &&
      (!rarityFilter || card.rarity === rarityFilter) &&
      (!search || (card.name || "").toLowerCase().includes(search.toLowerCase()))
    );
  }, [displayCollection, setFilter, rarityFilter, search]);

  const sortedCards = useMemo(() => {
    if (!filteredCards.length) return [];
    const collectionCopy = [...filteredCards];
    const [sortBy, direction] = sortOption.split('-');
    const multiplier = direction === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'name':
        return collectionCopy.sort((a, b) => multiplier * ((a.name || '').localeCompare(b.name || '')));
      case 'set':
        return collectionCopy.sort((a, b) => multiplier * ((a.setName || '').localeCompare(b.setName || '')));
      case 'price': {
        const priceA = getCardAveragePrice(a) ?? 0, priceB = getCardAveragePrice(b) ?? 0;
        if (priceA === 0 && priceB === 0) return (a.name || '').localeCompare(b.name || '');
        return multiplier * (priceA - priceB);
      }
      case 'quantity':
        return collectionCopy.sort((a, b) => multiplier * ((a.quantity || 0) - (b.quantity || 0)));
      case 'date':
        const getTime = c => c.createdAt ? new Date(typeof c.createdAt === 'string' ? parseInt(c.createdAt, 10) : c.createdAt).getTime() : 0;
        return collectionCopy.sort((a, b) => multiplier * (getTime(a) - getTime(b)));
      default:
        return collectionCopy;
    }
  }, [filteredCards, sortOption]);

  // Helper: fill row
  const fillFirstRowSkeletons = (cardCount) => {
    if (cardCount >= 5) return null;
    return Array.from({ length: 5 - cardCount }).map((_, idx) => (
      <CardSkeleton key={`skeleton-fill-${idx}`} />
    ));
  };

  // --- Removal logic: fully instant, never flickers ---
  const triggerRemove = (card) => {
    if (!isOwnProfile || !card || !card.id) return;
    if (card.quantity > 1) {
      setRemoveCard(card);
      setShowQuantityModal(true);
      setConfirmRemoveId(null);
    } else if (confirmRemoveId === card.id) {
      // INSTANT removal: update local state immediately
      setDisplayCollection(prev => prev.filter(x => String(x.id) !== String(card.id)));
      handleRemoveCard(card.id, 1, {
        onError: () => setDisplayCollection(collection.value || [])
      });
      setConfirmRemoveId(null);
    } else {
      setConfirmRemoveId(card.id);
    }
  };

  const confirmQuantityRemove = (quantity) => {
    if (removeCard) {
      setDisplayCollection(prev =>
        prev
          .map(x =>
            String(x.id) === String(removeCard.id)
              ? { ...x, quantity: x.quantity - quantity }
              : x
          )
          .filter(x => x.quantity > 0)
      );
      handleRemoveCard(removeCard.id, quantity, {
        onError: () => setDisplayCollection(collection.value || [])
      });
    }
    setShowQuantityModal(false);
    setRemoveCard(null);
  };

  // --- Rest as before, but use displayCollection ---
  if (loading.value) {
    return (
      <section className="w-full max-w-8xl mx-auto mt-6">
        <CollectionSkeletonGrid count={10} />
      </section>
    );
  }

  if ((displayCollection?.length ?? 0) === 0) {
    return (
      <section className="w-full max-w-8xl mx-auto mt-6">
        <div className="text-center py-8">
          <div className="flex flex-col items-center gap-2 mb-2">
            <span className="text-2xl font-bold text-light-accent dark:text-dark-accent">No cards in your collection yet.</span>
            <span className="text-base text-light-textSecondary dark:text-dark-textSecondary">Start adding cards to see them here!</span>
          </div>
        </div>
        <CollectionSkeletonGrid count={10} />
      </section>
    );
  }

  if (sortedCards.length === 0) {
    return (
      <section className="w-full max-w-8xl mx-auto mt-6">
        <div className="text-center py-8">
          <div className="flex flex-col items-center gap-2 mb-2">
            <svg width={44} height={44} viewBox="0 0 48 48" className="mb-2 text-light-accent dark:text-dark-accent" fill="none">
              <circle cx="24" cy="24" r="20" fill="#ede9fe" stroke="#a098d7" strokeWidth="2" />
              <path d="M31 31L39 39" stroke="#a098d7" strokeWidth="3" strokeLinecap="round" />
              <circle cx="24" cy="24" r="9" fill="#faf7ff" stroke="#a098d7" strokeWidth="1" />
            </svg>
            <span className="text-2xl font-bold text-light-accent dark:text-dark-accent">No cards match your filters.</span>
            <span className="text-base text-light-textSecondary dark:text-dark-textSecondary">Try adjusting your search or filters.</span>
          </div>
        </div>
        <CollectionSkeletonGrid count={10} />
      </section>
    );
  }

  // All sets/rarities for filters (unchanged)
  const allSets = Array.from(new Set((displayCollection || []).map(card => card.setName).filter(Boolean)));
  const allRarities = Array.from(new Set((displayCollection || []).map(card => card.rarity).filter(Boolean)));

  // -- Modals, handlers (same) --
  const openEditModal = (card) => {
    setEditingCard(card);
    setSelectedCard(null);
  };
  const handleCardDetailsEdit = card => openEditModal(card);
  const handleCardDetailsRemove = card => triggerRemove(card);
  const handleEditModalClose = () => setEditingCard(null);

  // --- MAIN RENDER ---
  return (
    <section className="w-full max-w-8xl mx-auto mt-6">
      {/* --- Filter/Search/Sort Bar --- */}
      <div className="max-w-3xl flex flex-wrap justify-start gap-2 items-center px-4 py-2 mb-6 transition-all">
        {/* ...search/filter/sort code as before... */}
        <div className="relative w-[250px]">
          <input
            type="text"
            placeholder="Search"
            className="w-full bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text rounded-md px-3 pl-8 py-1.5 border border-light-border dark:border-dark-border focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm transition h-9 font-semibold"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-light-textSecondary dark:text-dark-textSecondary pointer-events-none">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
        </div>
        <select
          value={setFilter}
          onChange={e => setSetFilter(e.target.value)}
          className="w-[110px] bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text rounded-md px-3 py-1.5 border border-light-border dark:border-dark-border focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm transition h-9 font-semibold"
        >
          <option value="">Set</option>
          {allSets.map(set => <option key={set} value={set}>{set}</option>)}
        </select>
        <select
          value={rarityFilter}
          onChange={e => setRarityFilter(e.target.value)}
          className="w-[110px] bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text rounded-md px-3 py-1.5 border border-light-border dark:border-dark-border focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm transition h-9 font-semibold"
        >
          <option value="">Rarity</option>
          {allRarities.map(rarity => <option key={rarity} value={rarity}>{rarity}</option>)}
        </select>
        <select
          value={sortOption}
          onChange={e => setSortOption(e.target.value)}
          className="w-[130px] bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text rounded-md px-3 py-1.5 border border-light-border dark:border-dark-border focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm transition h-9 font-semibold"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {isOwnProfile && (
          <button
            className="bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight text-white rounded-md px-3 py-1.5 text-sm shadow flex items-center h-9 ml-1 focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition font-semibold"
            onClick={onAddToCollection}
            title="Add Card"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="mr-1" aria-hidden="true">
              <path d="M10 4v12m6-6H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="hidden sm:inline">Add</span>
          </button>
        )}
      </div>
      {/* --- Card Grid --- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {sortedCards.map(card => (
          <div key={card.id} className="bg-light-surface dark:bg-dark-surface rounded-xl shadow p-3 flex flex-col items-center hover:shadow-xl transition group">
            <div className="relative w-full aspect-[245/337] bg-light-alt dark:bg-dark-alt rounded-lg mb-2 overflow-hidden cursor-pointer"
                 onClick={() => setSelectedCard(card)}>
              <Image
                src={getCardImageUrl(card.image)}
                alt={card.name}
                fill
                unoptimized
                className="object-contain rounded-lg group-hover:scale-105 transition-transform duration-300"
              />
              {card.quantity > 1 && (
                <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded-full text-xs font-bold">
                  x{card.quantity}
                </div>
              )}
              {card.condition && (
                <div className={`absolute bottom-2 left-2 px-2 py-1 rounded-full text-xs bg-black bg-opacity-70 ${getConditionClass(card.condition)}`}>
                  {formatCondition(card.condition)}
                </div>
              )}
            </div>
            <div className="w-full flex flex-col items-start mt-1">
              <div className="flex justify-between items-center w-full mb-1">
                <span className="text-base font-bold truncate text-light-text dark:text-dark-text" title={card.name}>{card.name}</span>
                {(card.setName) && (
                  <img
                    src={getSetLogo(card.setName)}
                    alt={card.setName}
                    className="w-6 h-4 rounded ml-2"
                  />
                )}
              </div>
              <span className="text-sm text-light-textMuted dark:text-dark-textMuted">#{card.number || card.cardId}</span>
              {getCardAveragePrice(card) !== null
                ? <span className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">
                    {formatCurrency(getCardAveragePrice(card))}
                  </span>
                : <span className="text-xs text-light-textMuted dark:text-dark-textMuted mt-1">
                    —
                  </span>
              }
              {(card.createdAt) && (
                <span className="text-xs text-light-textMuted dark:text-dark-textMuted mt-1">
                  Added: {formatRelativeTime(getDate(card.createdAt))}
                </span>
              )}
            </div>
            {isOwnProfile && (
              <div className="mt-3 w-full flex justify-center">
                <div className="flex flex-row flex-nowrap gap-2 items-center"
                  onMouseLeave={() => { if (confirmRemoveId === card.id) setConfirmRemoveId(null); }}
                >
                  <button
                    onClick={e => { e.stopPropagation(); openEditModal(card); }}
                    className="flex items-center gap-1 px-4 py-2 rounded-full text-xs font-semibold bg-light-secondary hover:bg-light-primary dark:bg-dark-secondary dark:hover:bg-dark-primary text-white shadow focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all duration-150 active:scale-95"
                    title="Edit card details"
                    tabIndex={0}
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="mr-1" aria-hidden="true">
                      <path d="M17.25 7.75L12.25 2.75C12.051 2.551 11.799 2.427 11.529 2.427C11.259 2.427 11.007 2.551 10.808 2.75L3.25 10.308V15.25H8.192L15.75 7.692C15.949 7.493 16.201 7.369 16.471 7.369C16.741 7.369 16.993 7.493 17.192 7.692C17.391 7.891 17.515 8.143 17.515 8.413C17.515 8.683 17.391 8.935 17.192 9.134L9.634 16.692C9.435 16.891 9.183 17.015 8.913 17.015C8.643 17.015 8.391 16.891 8.192 16.692C7.993 16.493 7.869 16.241 7.869 15.971C7.869 15.701 7.993 15.449 8.192 15.25L15.75 7.692L17.25 7.75Z"
                        fill="currentColor"
                      />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedCard(card); }}
                    className="flex items-center gap-1 px-4 py-2 rounded-full text-xs font-semibold bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight text-white shadow focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all duration-150 active:scale-95"
                    title="View card details"
                    tabIndex={0}
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="mr-1" aria-hidden="true">
                      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
                      <circle cx="10" cy="10" r="3" fill="currentColor" />
                    </svg>
                    View
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); triggerRemove(card); }}
                    className={`flex items-center gap-1 px-4 py-2 rounded-full text-xs font-semibold bg-light-error hover:bg-light-error dark:bg-dark-error dark:hover:bg-dark-error text-white shadow focus:outline-none focus:ring-2 focus:ring-light-error dark:focus:ring-dark-error transition-all duration-150 active:scale-95 ${confirmRemoveId === card.id ? "ring-2 ring-light-error dark:ring-dark-error scale-105" : ""}`}
                    title={confirmRemoveId === card.id ? "Click to confirm removal" : "Remove card"}
                    tabIndex={0}
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="mr-1" aria-hidden="true">
                      <path d="M5 6h10M8 9v4m4-4v4M3 6h14v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    {confirmRemoveId === card.id ? "Sure?" : "Remove"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {fillFirstRowSkeletons(sortedCards.length < 5 ? sortedCards.length : 5)}
      </div>

      {/* Modals */}
      {selectedCard && (
        <CardDetailsModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          dark={dark}
          onEdit={isOwnProfile ? handleCardDetailsEdit : undefined}
          onDelete={isOwnProfile ? handleCardDetailsRemove : undefined}
        />
      )}
      {editingCard && isOwnProfile && (
        <EditCollectionCardModal
          card={editingCard}
          token={token}
          onClose={handleEditModalClose}
          onUpdated={updatedCard => {
            setEditingCard(null);
            if (onCardUpdated) onCardUpdated(updatedCard);
            // You may also update displayCollection if desired.
          }}
          onRemoved={removedCardId => {
            setEditingCard(null);
            setDisplayCollection(prev => prev.filter(card => card.id !== removedCardId));
          }}
        />
      )}
      <QuantitySelectorModal
        isOpen={showQuantityModal}
        onClose={() => { setShowQuantityModal(false); setRemoveCard(null); }}
        maxQuantity={removeCard?.quantity || 1}
        onConfirm={confirmQuantityRemove}
        cardName={removeCard?.name || 'card'}
      />
    </section>
  );
}

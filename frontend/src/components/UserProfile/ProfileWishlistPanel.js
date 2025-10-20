"use client";
import React, { useState } from "react";
import Image from "next/image";
import { useTheme } from "@/hooks/ThemeProvider";
import { getCardImageUrl } from "@/utils/imageUtils";
import QuantitySelectorModal from "@/components/UI/QuantitySelectorModal";
import CardSkeleton from "@/components/UI/CardSkeleton";

export default function ProfileWishlistPanel({
  wishlist = [],
  isOwnProfile = false,
  onCardRemoved,
  onMoveToCollection,
  onViewCardDetail,
  setStatus,
  dark: darkProp,
}) {
  const { dark: themeDark } = useTheme?.() || {};
  const dark = darkProp ?? themeDark ?? false;
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  function handleRemoveClick(card) {
    if ((card.quantity || 1) > 1) {
      setSelectedCard(card);
      setShowQuantityModal(true);
      setConfirmRemoveId(null);
    } else if (confirmRemoveId === card.id) {
      onCardRemoved(card.cardId, card.variation || null, 1);
      setConfirmRemoveId(null);
    } else {
      setConfirmRemoveId(card.id);
    }
  }
  const handleQuantityConfirm = (quantity) => {
    if (selectedCard) {
      onCardRemoved(selectedCard.cardId, selectedCard.variation || null, quantity);
    }
    setShowQuantityModal(false);
    setSelectedCard(null);
  };

  // Fill skeletons for the first row
  const fillFirstRowSkeletons = (cardCount) => {
    if (cardCount >= 5) return null;
    return Array.from({ length: 5 - cardCount }).map((_, idx) => (
      <CardSkeleton key={`skeleton-fill-${idx}`} />
    ));
  };

  // Empty state
  if (wishlist.length === 0) {
    return (
      <section className="w-full max-w-8xl mx-auto mt-6">
        <div className={`text-center py-8 ${dark ? 'text-dark-text' : 'text-light-text'}`}>
          <div className="flex flex-col items-center gap-2 mb-2">
            <span className={`text-2xl font-bold ${dark ? 'text-dark-accent' : 'text-light-accent'}`}>
              {isOwnProfile
                ? "You haven't added any cards to your wishlist yet."
                : "No wishlist cards to display."}
            </span>
            <span className={`text-base ${dark ? 'text-dark-textSecondary' : 'text-light-textSecondary'}`}>
              {isOwnProfile
                ? "Search for cards and add them to your wishlist to keep track of what you want!"
                : "No cards found in this user's wishlist."}
            </span>
          </div>
        </div>
        {/* Skeleton grid: always 5 skeletons for consistency */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-6">
          {Array.from({ length: 5 }).map((_, idx) => (
            <CardSkeleton key={idx} />
          ))}
        </div>
      </section>
    );
  }

  // Main grid
  return (
    <section className="w-full max-w-8xl mx-auto mt-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {wishlist.map((entry) => {
          const card = entry.card || {};
          const img =
            card?.images?.large ??
            card?.images?.small ??
            card?.image ??
            card?.tcgImageUrl ??
            ""; // CHANGED
          const setLabel =
            card?.set?.name ??
            card?.setName ??
            (card?.setCode ? String(card.setCode).toUpperCase() : ""); // CHANGED
          return (
            <div
              key={entry.id}
              className={`
                rounded-2xl shadow-lg p-3 flex flex-col items-center min-h-[420px]
                hover:shadow-xl transition group
                border border-light-border dark:border-dark-border
                ${dark ? 'bg-dark-surface' : 'bg-light-surface'}
              `}
            >
              <div
                className={`
                  relative w-full aspect-[245/337] rounded-lg mb-2 overflow-hidden cursor-pointer
                  ${dark ? 'bg-dark-alt' : 'bg-light-alt'}
                `}
                onClick={() => onViewCardDetail && onViewCardDetail(entry)}
              >
                <Image
                  src={getCardImageUrl(img)}
                  alt={card.name || "Pokémon Card"}
                  fill
                  className="object-contain rounded-lg group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
                {entry.quantity > 1 && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-bold">
                    x{entry.quantity}
                  </div>
                )}
              </div>
              <div className="w-full flex flex-col items-start mt-1 flex-1">
                <h3 className={`text-base font-bold truncate mb-1 ${dark ? 'text-dark-text' : 'text-light-text'}`}>
                  {card.name || "(Unknown)"}
                </h3>
                <div className={`text-sm truncate ${dark ? 'text-dark-textSecondary' : 'text-light-textSecondary'}`}>
                  {setLabel || "(No set)"}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`${dark ? 'text-dark-textMuted' : 'text-light-textMuted'}`}>#{card.number}</span>
                </div>
                <div className="flex items-center gap-4 text-xs mt-1">
                  <span className={`${dark ? 'text-dark-textMuted' : 'text-light-textMuted'}`}>Qty: {entry.quantity || 1}</span>
                  <span className={`${dark ? 'text-dark-accent' : 'text-light-accent'}`}>{entry.condition || "mint"}</span>
                </div>
              </div>
              {isOwnProfile && (
                <div className="mt-4 flex items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => onMoveToCollection(entry)}
                    className={`
                      h-10 px-4 rounded-lg font-medium transition-colors flex-grow
                      bg-light-primary hover:bg-light-accent text-white
                      dark:bg-dark-primary dark:hover:bg-dark-accent
                    `}
                  >
                    Collect
                  </button>
                  <div className="relative" onMouseLeave={() => setConfirmRemoveId(null)}>
                    <button
                      type="button"
                      onClick={() => handleRemoveClick(entry)}
                      className={`
                        flex items-center justify-center
                        rounded-lg transition-all duration-200 h-10
                        ${confirmRemoveId === entry.id ? 'w-24' : 'w-10'}
                        bg-light-error hover:bg-light-error/90 text-white
                        dark:bg-dark-error dark:hover:bg-dark-error/90 dark:text-white
                      `}
                      title={confirmRemoveId === entry.id ? "Click to confirm removal" : "Remove from wishlist"}
                    >
                      {confirmRemoveId === entry.id ? (
                        <span className="text-xs font-semibold">Sure?</span>
                      ) : (
                        <span className="text-xl leading-none">×</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {fillFirstRowSkeletons(wishlist.length)}
      </div>
      {/* Quantity Selector Modal */}
      <QuantitySelectorModal
        isOpen={showQuantityModal}
        onClose={() => {
          setShowQuantityModal(false);
          setSelectedCard(null);
        }}
        maxQuantity={selectedCard?.quantity || 1}
        onConfirm={handleQuantityConfirm}
        cardName={selectedCard?.card?.name || "card"}
      />
    </section>
  );
}

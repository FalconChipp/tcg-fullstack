"use client";

import React, { useMemo, useCallback, useState } from "react";
import { getCardImageUrl } from "@/utils/imageUtils";
import Image from "next/image";
import { getCardKey } from "@/utils/cardUtils";

const DEFAULT_IMAGE_QUALITY = 100;
const DEFAULT_IMAGE_EXTENSION = "webp";
const FALLBACK_CARD_IMAGE = "/images/card-placeholder.svg";
const PAGE_SIZE = 120;

const BinderCollectionView = ({
  isOwnProfile,
  userEntireCollection,
  movedCards,
  isLoading = false,
  error = null,
}) => {
  // Compute which cards to show (collection minus those in binder)
  const filteredCards = useMemo(() => {
    if (!userEntireCollection || !Array.isArray(userEntireCollection)) return [];
    const quantities = {};
    userEntireCollection.forEach((card) => {
      const key = getCardKey(card);
      quantities[key] =
        (quantities[key] || 0) + (typeof card.quantity === "number" ? card.quantity : 1);
    });
    // Remove moved-to-binder
    return Object.entries(quantities)
      .map(([key, qty]) => {
        const movedCount = movedCards?.[key] || 0;
        const viewQty = Math.max(0, qty - movedCount);
        if (viewQty <= 0) return null;
        const card = userEntireCollection.find((c) => c && getCardKey(c) === key);
        return card ? { ...card, quantity: viewQty } : null;
      })
      .filter(Boolean);
  }, [userEntireCollection, movedCards]);

  // Pagination for large collections
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(filteredCards.length / PAGE_SIZE);
  const paginatedCards =
    filteredCards.length > PAGE_SIZE
      ? filteredCards.slice(0, PAGE_SIZE * page)
      : filteredCards;

  // DRAG: only needed for "drag from collection" to binder
  const handleDragStart = useCallback(
    (e, card) => {
      if (!isOwnProfile) return;
      const cardKey = getCardKey(card);
      const currentViewQuantity = card.quantity || 1;
      if (currentViewQuantity <= 0) {
        e.preventDefault();
        return;
      }
      const dragId = `drag-${Date.now()}`;
      const dragData = {
        ...card,
        id: dragId,
        cardId: card.cardId || card.externalId,
        name: card.tcgName || card.name,
        tcgName: card.tcgName || card.name,
        imageUrl: card.tcgImageUrl || card.imageUrl,
        tcgImageUrl: card.tcgImageUrl || card.imageUrl,
        setName: card.tcgSetName || card.setName,
        isCollectionDrag: true,
        _cardKey: cardKey,
        _originalQuantity: currentViewQuantity,
        _isNewDrag: true,
      };
      e.dataTransfer.setData("application/json", JSON.stringify(dragData));
      e.dataTransfer.setData("text/plain", JSON.stringify({ ...dragData }));
      e.currentTarget.dataset.onCardAdded = "true";
      e.dataTransfer.effectAllowed = "copyMove";
    },
    [isOwnProfile]
  );

  // Helper: Card image
  const getCardImage = (card) => {
    if (!card) return FALLBACK_CARD_IMAGE;
    const imageUrl = card.tcgImageUrl || card.imageUrl || card.image;
    if (!imageUrl && card.cardId) {
      return getCardImageUrl(null, {
        cardId: card.cardId,
        cardName: card.tcgName || card.name,
        debug: true,
        quality: DEFAULT_IMAGE_QUALITY,
        format: DEFAULT_IMAGE_EXTENSION,
      });
    }
    return getCardImageUrl(imageUrl, {
      cardName: card.tcgName || card.name,
      cardId: card.cardId || card.externalId,
      debug: true,
      quality: DEFAULT_IMAGE_QUALITY,
      format: DEFAULT_IMAGE_EXTENSION,
    });
  };

  // --- Loading state (tokens only) ---
  if (isLoading) {
    return (
      <div className="col-span-full text-center py-12 bg-light-background dark:bg-dark-surface rounded-xl">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-light-accent dark:border-dark-accent mx-auto"></div>
        <p className="mt-6 text-light-textMuted dark:text-dark-textMuted text-lg font-medium">Loading your collection...</p>
      </div>
    );
  }
  // --- Error state (tokens only) ---
  if (error) {
    return (
      <div className="col-span-full text-center text-light-error dark:text-dark-error py-12 bg-light-background dark:bg-dark-surface rounded-xl">
        <p className="mb-2 text-base">{error || "Failed to load collection."}</p>
      </div>
    );
  }
  // --- Empty state (tokens only) ---
  if (!filteredCards || filteredCards.length === 0) {
    return (
      <div className="col-span-full text-center py-12 bg-light-background dark:bg-dark-surface rounded-xl">
        <p className="mb-2 text-light-textMuted dark:text-dark-textMuted text-base">
          No cards available in your collection.
        </p>
        <p className="text-xs text-light-textSecondary dark:text-dark-textSecondary">
          Add cards to your collection to see them here.
        </p>
      </div>
    );
  }

  // MAIN GRID (all colors/borders/palette below are mapped to your tokens)
  return (
    <div className="relative h-full">
      <div
        className="
          grid
          grid-cols-2
          sm:grid-cols-3
          md:grid-cols-3
          lg:grid-cols-3
          xl:grid-cols-3
          gap-4
          px-2 py-4
          bg-transparent
        "
        style={{ alignContent: "start" }}
      >
        {paginatedCards.map((card) => {
          if (!card) return null;
          const cardKey = getCardKey(card);
          const cardName = card.tcgName || card.name || "Unnamed Card";
          const cardId = card.externalId || card.cardId || card.id || "";
          const setName = card.tcgSetName || card.setName || "";
          const viewQuantity = card.quantity || 0;
          const displayText = [cardName, cardId ? `#${cardId}` : "", setName ? `(${setName})` : ""]
            .filter(Boolean)
            .join(" ");
          if (viewQuantity <= 0) return null;
          return (
            <div
              key={cardKey}
              className="
                flex flex-col items-center justify-center
                rounded-2xl
                bg-light-surface dark:bg-dark-surface
                border border-light-border dark:border-dark-border
                shadow hover:shadow-xl
                transition-all cursor-move group
                relative
                mx-auto
                aspect-[245/342]
                w-full
                max-w-[180px]
                min-w-[120px]
              "
              draggable={isOwnProfile}
              onDragStart={(e) => handleDragStart(e, card)}
              onDragEnd={(e) => {
                e.preventDefault();
                e.dataTransfer.clearData();
              }}
            >
              <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
                <Image
                  src={getCardImage(card)}
                  alt={cardName}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  className="object-contain rounded-2xl group-hover:scale-105 transition-transform duration-200"
                  priority={false}
                  loading="lazy"
                  onError={(e) => {
                    e.target.src = FALLBACK_CARD_IMAGE;
                  }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <p className="text-white text-xs truncate text-center" title={displayText}>
                    {displayText}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Pagination/load-more for large collections (button uses palette tokens) */}
      {filteredCards.length > PAGE_SIZE && page < totalPages && (
        <div className="text-center my-4">
          <button
            className="px-5 py-2 rounded-xl bg-light-accent dark:bg-dark-accent text-white font-semibold hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition"
            onClick={() => setPage((p) => p + 1)}
          >
            Load more ({paginatedCards.length}/{filteredCards.length})
          </button>
        </div>
      )}
    </div>
  );
};

export default BinderCollectionView;

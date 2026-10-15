"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import CardImage from "@/components/Cards/CardImage";
import { getCardImageUrl } from "@/utils/imageUtils";
import { getCardKey } from "@/utils/cardUtils";

const DEFAULT_IMAGE_QUALITY = 100;
const DEFAULT_IMAGE_EXTENSION = "webp";
const FALLBACK_CARD_IMAGE = "/images/card-placeholder.svg";
const PAGE_SIZE = 120;

// ---- Debug toggle (set NEXT_PUBLIC_DEBUG=true to enable) ----
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';
const dlog = (...args) => { if (DEBUG) console.debug("[BinderCollectionView]", ...args); };

function safeKey(card) {
  const id = String(card?.cardId ?? card?.externalId ?? card?.id ?? "");
  const variation = (card?.variation == null || card?.variation === "") ? "normal" : String(card.variation);
  const condition = card?.condition || "mint";
  return `${id}::${variation}::${condition}`;
}

function collapseByKey(cards = []) {
  const map = new Map();
  for (const c of cards) {
    if (!c) continue;
    const k = (typeof getCardKey === "function" && getCardKey(c)) || safeKey(c);
    const prev = map.get(k);
    const qty = typeof c.quantity === "number" ? c.quantity : 1;
    if (prev) {
      prev.quantity += qty;
    } else {
      map.set(k, { ...c, quantity: qty });
    }
  }
  return Array.from(map.values());
}

const BinderCollectionView = ({
  isOwnProfile,
  userEntireCollection,
  movedCards,
  isLoading = false,
  error = null,
}) => {
  useEffect(() => {
    if (!DEBUG) return;
    console.groupCollapsed("[BinderCollectionView] props snapshot");
    console.debug("isOwnProfile:", isOwnProfile);
    console.debug("userEntireCollection length:", Array.isArray(userEntireCollection) ? userEntireCollection.length : "(not array)");
    console.debug("movedCards keys:", Object.keys(movedCards || {}).length);
    console.groupEnd();
  }, [isOwnProfile, userEntireCollection, movedCards]);

  // Compute which cards to show (collection minus those in binder)
  const filteredCards = useMemo(() => {
    if (!userEntireCollection || !Array.isArray(userEntireCollection)) {
      dlog("userEntireCollection not an array or missing.");
      return [];
    }

    const collapsed = collapseByKey(userEntireCollection);
    const result = [];
    for (const card of collapsed) {
      const key = (typeof getCardKey === "function" && getCardKey(card)) || safeKey(card);
      const totalQty = typeof card.quantity === "number" ? card.quantity : 1;
      const movedQty = (movedCards && movedCards[key]) ? movedCards[key] : 0;
      const remaining = Math.max(0, totalQty - movedQty);
      if (remaining > 0) {
        result.push({ ...card, quantity: remaining });
      }
    }

    if (DEBUG) {
      console.groupCollapsed("[BinderCollectionView] filter step");
      console.debug("collapsed count:", collapsed.length);
      console.debug("result (remaining) count:", result.length);
      if (result.length === 0 && collapsed.length > 0) {
        console.debug("Filter produced 0; falling back to collapsed (unfiltered) so UI still shows cards.");
      }
      console.groupEnd();
    }

    // Graceful fallback if everything got filtered away
    return result.length === 0 && collapsed.length > 0 ? collapsed : result;
  }, [userEntireCollection, movedCards]);

  // Pagination for large collections
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(filteredCards.length / PAGE_SIZE);
  const paginatedCards =
    filteredCards.length > PAGE_SIZE
      ? filteredCards.slice(0, PAGE_SIZE * page)
      : filteredCards;

  useEffect(() => {
    if (!DEBUG) return;
    console.groupCollapsed("[BinderCollectionView] render snapshot");
    console.debug("filteredCards.length:", filteredCards.length);
    console.debug("page:", page, "/", totalPages);
    console.groupEnd();
  }, [filteredCards, page, totalPages]);

  // DRAG: only needed for "drag from collection" to binder
  const handleDragStart = useCallback(
    (e, card) => {
      if (!isOwnProfile) return;
      const key = (typeof getCardKey === "function" && getCardKey(card)) || safeKey(card);
      const currentViewQuantity = card.quantity || 1;
      if (currentViewQuantity <= 0) {
        e.preventDefault();
        return;
      }
      const dragId = `drag-${Date.now()}`;
      // Resolve fields from nested card object (new API shape) with legacy fallbacks
      const resolvedImageUrl =
        card.card?.images?.small ||
        card.images?.small ||
        card.card?.images?.large ||
        card.images?.large ||
        card.tcgImageUrl ||
        card.imageUrl;
      const resolvedName = card.card?.name || card.tcgName || card.name;
      const resolvedSetName = card.card?.set?.name || card.tcgSetName || card.setName;

      const dragData = {
        ...card,
        id: dragId,
        cardId: card.cardId || card.externalId,
        name: resolvedName,
        tcgName: resolvedName,
        imageUrl: resolvedImageUrl,
        tcgImageUrl: resolvedImageUrl,
        setName: resolvedSetName,
        isCollectionDrag: true,
        _cardKey: key,
        _originalQuantity: currentViewQuantity,
        _isNewDrag: true,
      };
      if (DEBUG) dlog("DragStart:", { key, dragData });
      e.dataTransfer.setData("application/json", JSON.stringify(dragData));
      e.dataTransfer.setData("text/plain", JSON.stringify({ ...dragData }));
      e.currentTarget.dataset.onCardAdded = "true";
      e.dataTransfer.effectAllowed = "copyMove";
    },
    [isOwnProfile]
  );

  // Helper: Card image — handles both new API shape (card.images.small) and legacy fields
  const getCardImage = (card) => {
    if (!card) return FALLBACK_CARD_IMAGE;
    const imageUrl =
      card.card?.images?.small ||   // new API: collection entry has nested card object
      card.images?.small ||         // CatalogCard shape
      card.card?.images?.large ||
      card.images?.large ||
      card.tcgImageUrl ||
      card.imageUrl ||
      card.image;
    if (!imageUrl && card.cardId) {
      return getCardImageUrl(null, { cardId: card.cardId, cardName: card.card?.name || card.tcgName || card.name });
    }
    return getCardImageUrl(imageUrl, { cardId: card.cardId || card.externalId });
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

  // MAIN GRID
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
          const key = (typeof getCardKey === "function" && getCardKey(card)) || safeKey(card);
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
              key={key}
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
                <CardImage
                  src={getCardImage(card)}
                  name={cardName}
                  cardId={card.cardId || card.card?.id || card.id}
                  className="absolute inset-0 w-full h-full object-contain rounded-2xl group-hover:scale-105 transition-transform duration-200"
                  imgProps={{
                    loading: "lazy",
                    onError: () => { if (DEBUG) dlog("Image onError; using sprite fallback for:", { key, cardName }); },
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

      {/* Pagination/load-more for large collections */}
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

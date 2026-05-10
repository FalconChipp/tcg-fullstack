// src/components/BinderSlot.jsx

import React, { useState } from 'react';
import CardDetails from './CardDetails';
import { getCardImageUrl } from '@/utils/imageUtils';
import { VIEW_MODES } from '@/utils/constants';

const FALLBACK_CARD_IMAGE = "/images/card-placeholder.svg";

/**
 * BinderSlot - represents a single slot in the binder grid.
 * Now hydrates card info from the userCollection array, so we always show
 * the latest image, name, and set info for each card.
 *
 * @param {Object} props
 * @param {number} index - Index of the slot in the page.
 * @param {Object} card - Card data in the slot (at minimum must have cardId).
 * @param {Function} onDrop - Handler for card drop into this slot.
 * @param {Function} onRemove - Handler for removing the card.
 * @param {Function} onUpdate - Handler for updating the card.
 * @param {boolean} isOwnProfile - Is the current profile the owner?
 * @param {boolean} isDragging - Is this slot being dragged?
 * @param {number} currentPageIndex - Page index for slot actions.
 * @param {Function} onDragOver
 * @param {Function} onDragEnd
 * @param {Function} onDragLeave
 * @param {string} viewMode
 * @param {string} size
 * @param {Array} userCollection - Array of user's collection cards (hydration source)
 */
export default function BinderSlot({
  index,
  onDrop,
  card,
  onRemove,
  onUpdate,
  isOwnProfile,
  isDragging,
  currentPageIndex,
  onDragOver,
  onDragEnd,
  onDragLeave,
  viewMode = VIEW_MODES.GRID,
  size,
  userCollection = [], // <-- NEW: array of cards in user's collection
}) {
  const [showDetails, setShowDetails] = useState(false);

  // --- Hydrate the card data from user's collection for full info ---
  let hydratedCard = card;
  if (card && card.cardId) {
    // Find card in collection, prefer full collection data if present
    const collectionCard = userCollection.find(c => c.cardId === card.cardId);
    if (collectionCard) {
      hydratedCard = { ...collectionCard, ...card }; // slot props override if any
    }
  }

  // --- Helper: Card image URL ---
  const getCardImage = (c) => {
    if (!c) return FALLBACK_CARD_IMAGE;
    // Try all known image field shapes (new API uses card.images.small/large)
    const imageUrl =
      c.images?.small ||          // CatalogCard shape (from API hydration)
      c.card?.images?.small ||    // nested card object from collection entry
      c.image ||
      c.tcgImageUrl ||
      c.imageUrl ||
      c.images?.large ||
      c.card?.images?.large;
    if (!imageUrl) {
      return getCardImageUrl(null, {
        cardId: c.cardId,
        cardName: c.tcgName || c.name,
      });
    }
    return getCardImageUrl(imageUrl, {
      cardId: c.cardId || c.externalId,
    });
  };

  // --- Style helper for container ---
  let finalViewMode = viewMode;
  if (size === 'small') finalViewMode = VIEW_MODES.COMPACT;
  else if (size === 'large') finalViewMode = VIEW_MODES.LIST;

  const getContainerClasses = () => {
    switch (finalViewMode) {
      case VIEW_MODES.LIST:
        return `
          w-full h-20
          bg-light-surface dark:bg-dark-surface
          rounded-xl shadow-sm
          border border-light-border dark:border-dark-border
          hover:shadow-md transition-shadow flex items-center px-3 py-2
        `;
      case VIEW_MODES.COMPACT:
        return `
          w-full h-14 flex items-center justify-center
          bg-light-background dark:bg-dark-alt
          rounded-xl hover:bg-light-alt dark:hover:bg-dark-surface
          border border-light-border dark:border-dark-border
          transition-colors text-xs relative
        `;
      case VIEW_MODES.GRID:
      default:
        return `
          relative w-full h-[430px] max-w-[350px]
          bg-light-surface dark:bg-dark-surface
          rounded-2xl shadow-md
          border border-light-border dark:border-dark-border
          overflow-hidden cursor-move group
          ${isDragging ? 'opacity-50' : ''}
          flex flex-col
        `;
    }
  };

  // --- DRAG & INTERACTION LOGIC ---

  function handleDrop(e) {
    e.preventDefault();
    let data = null;
    if (e.dataTransfer.types.includes('application/json')) {
      data = e.dataTransfer.getData('application/json');
    } else if (e.dataTransfer.types.includes('text/plain')) {
      data = e.dataTransfer.getData('text/plain');
    }
    if (!data) return;
    let cardData;
    try {
      cardData = JSON.parse(data);
    } catch (err) {
      return;
    }
    const fromSlotIdxRaw = e.dataTransfer.getData('fromSlotIdx');
    const fromSlotIdx = typeof fromSlotIdxRaw !== 'undefined' ? Number(fromSlotIdxRaw) : undefined;
    if (onDrop && cardData) {
      onDrop(cardData, fromSlotIdx);
    }
  }

  const handleDragStart = (e) => {
    if (!hydratedCard) return;
    const cardData = {
      ...hydratedCard,
      tcgImageUrl: hydratedCard.tcgImageUrl || hydratedCard.image,
      tcgName: hydratedCard.tcgName || hydratedCard.name,
      slotIndex: index,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(cardData));
    e.dataTransfer.setData('fromSlotIdx', index);
    if (onUpdate) onUpdate(index, cardData);
  };

  function handleDoubleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!hydratedCard) return;
    if (isOwnProfile) {
      onRemove && onRemove(currentPageIndex ?? 0, index);
      return;
    }
    setShowDetails(true);
  }

  function handleKeyDown(e) {
    if (!isOwnProfile) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      onRemove && onRemove(currentPageIndex ?? 0, index);
    }
    if (e.key === 'Enter') {
      setShowDetails(true);
    }
  }

  // --- Render card OR empty slot ---
  const renderCardContent = () => {
    if (!hydratedCard) {
      return (
        <div className={`flex items-center justify-center h-full`}>
          <span className="text-xs text-light-textMuted dark:text-dark-textMuted">Empty</span>
        </div>
      );
    }

    const isSearchResult = hydratedCard.isSearchResult === true;
    const showNotOwnedOverlay = isSearchResult && !hydratedCard._originalQuantity;

    switch (finalViewMode) {
      case VIEW_MODES.LIST:
        return (
          <div className="flex items-center w-full h-full">
            <div className="flex-shrink-0 pr-2">
              <div className="relative">
                <img
                  src={getCardImage(hydratedCard)}
                  alt={hydratedCard.tcgName || hydratedCard.name || 'Card image'}
                  className="w-16 h-auto object-cover rounded"
                  onError={e => { e.target.onerror = null; e.target.src = FALLBACK_CARD_IMAGE; }}
                  draggable={isOwnProfile}
                  onDragStart={handleDragStart}
                  onDragEnd={onDragEnd}
                />
                {showNotOwnedOverlay && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <p className="text-white text-xs font-semibold">Not Owned</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-light-text dark:text-dark-text truncate">
                {hydratedCard.tcgName || hydratedCard.name || hydratedCard.cardId || 'Unnamed Card'}
              </p>
              <p className="text-[10px] text-light-textSecondary dark:text-dark-textSecondary truncate">
                {hydratedCard.tcgSetName || hydratedCard.setName || 'Unknown Set'}
              </p>
            </div>
            {isOwnProfile && (
              <button
                className="text-red-500 hover:text-red-700 ml-2 text-base"
                onClick={e => { e.stopPropagation(); onRemove?.(currentPageIndex, index); }}
                title="Remove card"
              >×</button>
            )}
          </div>
        );
      case VIEW_MODES.COMPACT:
        return (
          <div className="flex items-center justify-center w-full h-full relative">
            <img
              src={getCardImage(hydratedCard)}
              alt={hydratedCard.tcgName || hydratedCard.name || 'Card image'}
              className="h-8 w-6 object-cover rounded shadow"
              draggable={isOwnProfile}
              onDragStart={handleDragStart}
              onDragEnd={onDragEnd}
              onClick={isOwnProfile ? undefined : () => setShowDetails(true)}
            />
            {showNotOwnedOverlay && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <p className="text-white text-[10px] font-semibold">Not Owned</p>
              </div>
            )}
            {isOwnProfile && (
              <button
                className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                onClick={e => { e.stopPropagation(); onRemove?.(currentPageIndex, index); }}
                title="Remove card"
              >×</button>
            )}
          </div>
        );
      case VIEW_MODES.GRID:
      default:
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={getCardImage(hydratedCard)}
              alt={hydratedCard.tcgName || hydratedCard.name || 'Card image'}
              className="object-contain w-full h-full"
              onError={e => { e.target.onerror = null; e.target.src = FALLBACK_CARD_IMAGE; }}
              draggable={isOwnProfile}
              onDragStart={handleDragStart}
              onDragEnd={onDragEnd}
            />
            {showNotOwnedOverlay && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <p className="text-white text-xs font-semibold">Not Owned</p>
              </div>
            )}
            {isOwnProfile && (
              <button
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => { e.stopPropagation(); onRemove?.(currentPageIndex, index); }}
                title="Remove card"
              >×</button>
            )}
          </div>
        );
    }
  };

  // --- MAIN RETURN ---
  return (
    <div
      className={getContainerClasses()}
      tabIndex={0}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onDragOver={e => { e.preventDefault(); onDragOver?.(e); }}
      onDragLeave={e => { e.preventDefault(); onDragLeave?.(e); }}
      onDrop={handleDrop}
    >
      {renderCardContent()}
      {showDetails && hydratedCard && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-light-surface dark:bg-dark-surface rounded-2xl p-4 max-w-md w-full max-h-[90vh] overflow-auto shadow-xl border border-light-border dark:border-dark-border">
            <CardDetails card={hydratedCard} onClose={() => setShowDetails(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

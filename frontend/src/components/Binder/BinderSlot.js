import React, { useState } from 'react';
import CardDetails from './CardDetails';
import { getCardImageUrl } from '@/utils/imageUtils';
import { VIEW_MODES } from '@/utils/constants';

const FALLBACK_CARD_IMAGE = "/images/card-placeholder.svg";

/**
 * BinderSlot - represents a single slot in the binder grid.
 * - Accepts 'size' prop: 'small', 'default', 'large' to override viewMode layout.
 * - Handles all drag/drop, double-click, and key interactions.
 * - Controlled: all slot/card state is from props!
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
}) {
  const [showDetails, setShowDetails] = useState(false);

  // --- Helper: Card image URL ---
  const getCardImage = (card) => {
    if (!card) return FALLBACK_CARD_IMAGE;
    const imageUrl = card.tcgImageUrl || card.imageUrl || card.image;
    if (!imageUrl && card.cardId) {
      return getCardImageUrl(null, {
        cardId: card.cardId,
        cardName: card.tcgName || card.name,
        debug: true,
      });
    }
    return getCardImageUrl(imageUrl, {
      cardId: card.cardId || card.externalId,
      debug: true,
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
    if (!card) return;
    const cardData = {
      ...card,
      tcgImageUrl: card.tcgImageUrl || card.image,
      tcgName: card.tcgName || card.name,
      slotIndex: index,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(cardData));
    e.dataTransfer.setData('fromSlotIdx', index);
    if (onUpdate) onUpdate(index, cardData);
  };

  function handleDoubleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!card) return;
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
    if (!card) {
      return (
        <div className={`flex items-center justify-center h-full`}>
          {/* Changed from text-[#cac8e2] dark:text-[#716d98] to palette tokens */}
          <span className="text-xs text-light-textMuted dark:text-dark-textMuted">Empty</span>
        </div>
      );
    }

    const isSearchResult = card.isSearchResult === true;
    const showNotOwnedOverlay = isSearchResult && !card._originalQuantity;

    switch (finalViewMode) {
      case VIEW_MODES.LIST:
        return (
          <div className="flex items-center w-full h-full">
            <div className="flex-shrink-0 pr-2">
              <div className="relative">
                <img
                  src={getCardImage(card)}
                  alt={card.tcgName || card.name || 'Card image'}
                  className="w-16 h-auto object-cover rounded"
                  onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_CARD_IMAGE; }}
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
              {/* text-[#393962] dark:text-[#e6d6ff] to palette */}
              <p className="text-xs font-medium text-light-text dark:text-dark-text truncate">
                {card.tcgName || card.name || 'Unnamed Card'}
              </p>
              {/* text-[#a7a7b7] dark:text-[#716d98] to palette */}
              <p className="text-[10px] text-light-textSecondary dark:text-dark-textSecondary truncate">
                {card.tcgSetName || card.setName || 'Unknown Set'}
              </p>
            </div>
            {isOwnProfile && (
              <button
                className="text-red-500 hover:text-red-700 ml-2 text-base"
                onClick={(e) => { e.stopPropagation(); onRemove?.(currentPageIndex, index); }}
                title="Remove card"
              >×</button>
            )}
          </div>
        );
      case VIEW_MODES.COMPACT:
        return (
          <div className="flex items-center justify-center w-full h-full relative">
            <img
              src={getCardImage(card)}
              alt={card.tcgName || card.name || 'Card image'}
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
                onClick={(e) => { e.stopPropagation(); onRemove?.(currentPageIndex, index); }}
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
              src={getCardImage(card)}
              alt={card.tcgName || card.name || 'Card image'}
              className="object-contain w-full h-full"
              onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_CARD_IMAGE; }}
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
                onClick={(e) => { e.stopPropagation(); onRemove?.(currentPageIndex, index); }}
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
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        onDragLeave?.(e);
      }}
      onDrop={handleDrop}
    >
      {renderCardContent()}
      {showDetails && card && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          {/* bg-[#fff] dark:bg-[#23232f] border-[#ececf1] dark:border-[#282833] to palette */}
          <div className="bg-light-surface dark:bg-dark-surface rounded-2xl p-4 max-w-md w-full max-h-[90vh] overflow-auto shadow-xl border border-light-border dark:border-dark-border">
            <CardDetails card={card} onClose={() => setShowDetails(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

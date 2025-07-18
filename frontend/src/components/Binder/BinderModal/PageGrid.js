// src/components/BinderEditor/PageGrid.jsx
import React from 'react';
import BinderSlot from '../BinderSlot';

export default function PageGrid({
  pages,
  currentPage,
  viewMode,
  handlers,
  cols,
  totalSlots,
  isOwnProfile,
  userCollection // <-- NEW PROP
}) {
  const slots = pages[currentPage] || [];

  let gridClass = 'grid gap-2 p-2 h-full w-full';
  let slotSize = 'default';
  if (viewMode === 'compact') {
    gridClass += ' grid-cols-6 sm:grid-cols-8';
    slotSize = 'small';
  } else if (viewMode === 'list') {
    gridClass += ' grid-cols-1';
    slotSize = 'large';
  } else {
    gridClass += ` grid-cols-${cols}`;
    slotSize = 'default';
  }

  return (
    <div
      className={gridClass}
      onDragOver={handlers.handlePageDragOver}
      onDrop={handlers.handlePageDrop}
      onDragLeave={handlers.handlePageDragLeave}
      style={{ minHeight: 0, minWidth: 0 }}
    >
      {Array.from({ length: totalSlots }).map((_, i) => (
        <BinderSlot
          key={i}
          index={i}
          card={slots[i]}
          viewMode={viewMode}
          size={slotSize}
          isOwnProfile={isOwnProfile}
          onDrop={(card, fromSlotIdx) => handlers.handleCardDropped(card, i, fromSlotIdx)}
          onRemove={() => handlers.handleRemoveCard(currentPage, i)}
          onUpdate={c => handlers.handleCardDropped(c, i)}
          userCollection={userCollection} // <-- PASS DOWN
        />
      ))}
    </div>
  );
}

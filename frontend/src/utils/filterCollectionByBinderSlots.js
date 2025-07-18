// src/utils/filterCollectionByBinderSlots.js

/**
 * Given the user's collection and binder pages, filter out any cards
 * that are already present in any binder slot (by cardId, accounting for quantity).
 * Returns a new array of collection entries with adjusted quantities.
 *
 * @param {Array} collection - The user's full collection (array of card objects, with quantity)
 * @param {Array} pages - 2D array: each page is an array of slot objects (each with cardId, quantity)
 */
export function filterCollectionByBinderSlots(collection, pages) {
  if (!Array.isArray(collection) || !Array.isArray(pages)) return [];

  // Tally up all cards in slots: { cardId: totalPlacedInBinder }
  const cardsInSlots = {};
  for (const page of pages) {
    for (const slot of page) {
      if (slot && slot.cardId) {
        const qty = Number(slot.quantity) || 1;
        cardsInSlots[slot.cardId] = (cardsInSlots[slot.cardId] || 0) + qty;
      }
    }
  }

  // Now build filtered collection, decrementing quantities
  const filtered = [];
  for (const entry of collection) {
    const qtyOwned = Number(entry.quantity) || 1;
    const cardId = entry.cardId;
    const qtyInBinder = cardsInSlots[cardId] || 0;
    const qtyLeft = qtyOwned - qtyInBinder;
    if (qtyLeft > 0) {
      filtered.push({ ...entry, quantity: qtyLeft });
    }
    // else don't include in filtered list
  }

  return filtered;
}
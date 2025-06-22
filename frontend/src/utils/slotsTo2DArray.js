/**
 * Convert a flat slots array (from backend) into a 2D array by page and slot position.
 * @param {Array} slots - Array of slots from the backend (each must have page, position)
 * @param {number} slotsPerPage - Number of slots per page (e.g., 9 for 3x3)
 * @returns {Array[]} 2D array: [ [slot0, slot1, ...], [slot0, ...], ... ]
 */
export function slotsTo2DArray(slots, slotsPerPage) {
  if (!Array.isArray(slots) || !slotsPerPage) return [];
  // Find the max page number
  const pageCount = Math.max(1, ...slots.map(s => s.page || 1));
  const pages = Array(pageCount).fill(null).map(() => Array(slotsPerPage).fill(null));
  slots.forEach(slot => {
    if (!slot || typeof slot.position !== 'number' || typeof slot.page !== 'number') return;
    const pageIdx = (slot.page || 1) - 1;
    if (pageIdx >= 0 && pageIdx < pages.length && slot.position >= 0 && slot.position < slotsPerPage) {
      pages[pageIdx][slot.position] = slot;
    }
  });
  return pages;
}

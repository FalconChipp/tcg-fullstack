export function binderPagesTo2DArray(pages, slotsPerPage) {
  if (!Array.isArray(pages) || !slotsPerPage) return [];
  return pages
    .sort((a, b) => (a.pageOrder ?? 0) - (b.pageOrder ?? 0))
    .map(pg => {
      const arr = Array(slotsPerPage).fill(null);
      (pg.slots || []).forEach(slot => {
        if (typeof slot.position === 'number' && slot.position >= 0 && slot.position < slotsPerPage) {
          arr[slot.position] = { ...slot, page: (pg.pageOrder ?? 0) };
        }
      });
      // Attach page metadata so we can send back to API
      arr.id = pg.id;
      arr.title = pg.title;
      arr.layout = pg.layout;
      arr.pageOrder = pg.pageOrder;
      return arr;
    });
}

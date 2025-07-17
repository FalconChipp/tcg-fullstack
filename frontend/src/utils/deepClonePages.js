// Clone an array of pages while preserving any custom properties
export const deepClonePages = pages =>
  pages.map(page => {
    const clone = [...page];
    Object.keys(page).forEach(key => {
      if (!Number.isInteger(+key)) clone[key] = page[key];
    });
    return clone;
  });
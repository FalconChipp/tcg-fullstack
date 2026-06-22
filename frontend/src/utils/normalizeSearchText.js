// Normalizes free-text search input so accented characters and common
// symbol/word variants (e.g. "&" vs "and") don't cause false negatives in
// client-side substring matching. Apply to both the query and the
// candidate text before comparing.
export function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (e.g. é -> e)
    .toLowerCase()
    .replace(/&/g, " and ") // treat "&" as the word "and"
    .replace(/\s+/g, " ")
    .trim();
}

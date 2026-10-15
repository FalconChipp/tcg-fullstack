// Resolve a Pokémon sprite URL from a card name (e.g. "Dark Charizard ex", "Mr. Mime V").
// Used by the no-image card fallback (CardImage).

import pokemonList from "@/data/pokemonList.json";

const MAX_WORDS = 3; // longest species names: "Type: Null", "Tapu Koko", "Great Tusk"

function words(str) {
  return String(str ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

let SPRITE_BY_KEY = null;
function spriteByKey() {
  if (!SPRITE_BY_KEY) {
    SPRITE_BY_KEY = new Map();
    for (const p of pokemonList) {
      if (p?.name && p?.sprite) SPRITE_BY_KEY.set(words(p.name).join(" "), p.sprite);
    }
  }
  return SPRITE_BY_KEY;
}

export function getPokemonSpriteUrl(cardName) {
  const w = words(cardName);
  if (!w.length) return null;
  const map = spriteByKey();
  for (let size = Math.min(MAX_WORDS, w.length); size >= 1; size--) {
    for (let i = 0; i + size <= w.length; i++) {
      const hit = map.get(w.slice(i, i + size).join(" "));
      if (hit) return hit;
    }
  }
  return null;
}

// "sv3pt5-12" -> "SV3PT5"
export function setAbbrFromCardId(cardId) {
  if (typeof cardId !== "string") return "";
  const i = cardId.indexOf("-");
  return (i > 0 ? cardId.slice(0, i) : "").toUpperCase();
}

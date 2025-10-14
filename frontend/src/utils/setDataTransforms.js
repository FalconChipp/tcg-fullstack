import inferSetEra from "./setEra";

function computeTotalCards(cacheJson) {
  const counts = cacheJson?.cardCount ?? {};
  const cards = Array.isArray(cacheJson?.cards) ? cacheJson.cards : [];

  if (typeof counts.official === "number" && counts.official > 0) return counts.official;
  if (typeof counts.total === "number" && counts.total > 0) return counts.total;
  if (typeof cacheJson?.total === "number" && cacheJson.total > 0) return cacheJson.total;
  if (cards.length > 0) return cards.length;
  return null;
}

function normalizeImageUrl(raw) {
  if (!raw) return null;
  let url = String(raw);
  if (url.endsWith("/high.webp") || url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".jpeg") || url.endsWith(".webp")) {
    return url;
  }
  return `${url}/high.webp`;
}

function mapCacheCardPrices(card) {
  const prices = Array.isArray(card?.prices) ? card.prices : [];
  if (!prices.length) return null;

  return prices
    .map((price) => {
      if (!price) return null;
      const currency = price.currency || price.currencyCode || price.curr || null;
      const gbp =
        typeof price.gbp === "number"
          ? price.gbp
          : typeof price.market === "number"
            ? price.market
            : typeof price.mid === "number"
              ? price.mid
              : null;
      const tcgplayer = typeof price.tcgplayer === "number" ? price.tcgplayer : null;
      const cardmarket = typeof price.cardmarket === "number" ? price.cardmarket : null;

      return {
        variation: price.variant || price.variation || null,
        gbp,
        tcgplayer,
        cardmarket,
        currency,
      };
    })
    .filter(Boolean);
}

export function mapCacheSetSummary(cacheJson) {
  if (!cacheJson) return null;
  const codeRaw = cacheJson.id || cacheJson.code || cacheJson.slug || null;
  if (!codeRaw) return null;
  const code = String(codeRaw).trim().toLowerCase();
  if (!code) return null;

  const abbr =
    cacheJson.abbreviation?.official ??
    cacheJson.abbreviation?.abbr ??
    cacheJson.abbreviation ??
    null;
  const series =
    cacheJson.serie?.name ??
    cacheJson.series?.name ??
    cacheJson.series ??
    null;
  const seriesId =
    cacheJson.serie?.id ??
    cacheJson.series?.id ??
    cacheJson.seriesId ??
    null;

  const base = {
    code,
    name: cacheJson.name || code.toUpperCase(),
    totalCards: computeTotalCards(cacheJson),
    abbr,
    series,
    seriesId,
  };

  const era = inferSetEra(base);
  return {
    code,
    name: base.name,
    totalCards: base.totalCards,
    abbr,
    series,
    era,
  };
}

export function mapCacheSetDetail(cacheJson) {
  const summary = mapCacheSetSummary(cacheJson);
  if (!summary) return null;

  const seen = new Set();
  const cardsRaw = Array.isArray(cacheJson?.cards) ? cacheJson.cards : [];
  const cards = [];

  for (const card of cardsRaw) {
    if (!card) continue;
    const number = card.localId || card.number || "";
    const id =
      card.id ||
      (number && summary.code ? `${summary.code}-${number}` : null);
    const prices = mapCacheCardPrices(card);

    if (id && seen.has(id)) continue;
    if (id) seen.add(id);

    cards.push({
      id,
      number,
      name: card.name || "",
      rarity: card.rarity || null,
      imageUrl: normalizeImageUrl(card.image ?? card.imageUrl ?? card.image_url),
      prices,
    });
  }

  return {
    ...summary,
    cards,
  };
}

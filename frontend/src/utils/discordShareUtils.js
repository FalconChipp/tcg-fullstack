export function safeLocalStorageGet(key) {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageSet(key, value) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {}
}

export function inferSourceTypeFromCard(card) {
  if (!card) return "collection";
  if (card.wishlist === true) return "wishlist";
  return "collection";
}

function normalizeLatestPriceGBP(card, variation) {
  const list = Array.isArray(card?.latestPrices) ? card.latestPrices : [];
  if (!list.length) return null;

  const desired = String(variation || "normal").toLowerCase();
  const exact = list.find((p) => String(p?.variation || "").toLowerCase() === desired);
  const row = exact || list.find((p) => String(p?.variation || "").toLowerCase() === "normal") || list[0];

  const v = row?.gbp ?? row?.market ?? row?.mid ?? null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

export function normalizeShareEntry({ type, card, sourceEntry, selectedVar }) {
  const c = sourceEntry?.card || card?.card || card || {};
  const entry = sourceEntry || card || {};

  const variation =
    entry?.variation ||
    entry?.variationKey ||
    c?.variation ||
    selectedVar ||
    "normal";

  const priceGBP = normalizeLatestPriceGBP(c, variation);

  return {
    type,
    entryId: entry?.id ?? null,
    cardId: entry?.cardId ?? c?.id ?? c?.cardId ?? card?.cardId ?? card?.id ?? null,
    variation: variation ?? null,

    collection:
      type === "collection"
        ? {
            quantity: Number(entry?.quantity || 1),
            condition: entry?.condition ?? null,
            binderName: entry?.binderName ?? null,
          }
        : undefined,

    wishlist:
      type === "wishlist"
        ? {
            status: entry?.status ?? null,
            priority: entry?.priority ?? null,
            quantity: Number(entry?.quantity || 1),
          }
        : undefined,

    card: {
      id: c?.id ?? null,
      cardId: entry?.cardId ?? c?.id ?? null,
      name: c?.name ?? card?.name ?? card?.tcgName ?? null,
      number: c?.number ?? card?.number ?? null,
      setCode: c?.setCode ?? card?.setCode ?? null,
      setName: c?.set?.name ?? card?.setName ?? card?.setName ?? null,
      rarity: c?.rarity ?? card?.rarity ?? card?.tcgRarity ?? null,
      images: {
        small: c?.images?.small ?? null,
        large: c?.images?.large ?? null,
      },
      variant: variation ?? null,
      variants: Array.isArray(c?.variants) ? c.variants : undefined,
    },

    pricing: {
      priceGBP,
      currency: "GBP",
    },
  };
}

export async function postDiscordShare({ token, channelId, message, payload, requestedByUsername, viewUrl }) {
  const r = await fetch("/api/discord/share-entry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      channelId,
      type: payload.type,
      message: message || null,
      requestedBy: requestedByUsername ? String(requestedByUsername) : undefined,
      viewUrl: viewUrl ? String(viewUrl) : null,
      links: viewUrl ? { view: String(viewUrl) } : undefined,
      entry: payload,
    }),
  });

  const json = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = json?.error || json?.message || `Share failed: HTTP ${r.status} ${r.statusText}`;
    throw new Error(msg);
  }
  if (!json?.ok) {
    throw new Error(json?.error || "Share failed");
  }
  return json;
}

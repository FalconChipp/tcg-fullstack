import { useState, useEffect } from "react";

const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;

// ---------- utils ----------
const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(num) ? null : num;
};

function getCardAveragePrice(card) {
  if (!card || !Array.isArray(card.prices)) return null;
  const selectedVariation = card.variation || "normal";
  let priceObj = card.prices.find((p) => p && p.variation === selectedVariation);
  if (!priceObj && card.prices.length) priceObj = card.prices[0];
  if (!priceObj) return null;
  const tcg = toNumber(priceObj.tcgplayer);
  const cmk = toNumber(priceObj.cardmarket);
  if (tcg == null && cmk == null) return null;
  if (tcg != null && cmk != null) return (tcg + cmk) / 2;
  return tcg != null ? tcg : cmk;
}

function getCollectionTotalValue(col = []) {
  return col.reduce((sum, card) => {
    const price = getCardAveragePrice(card) ?? 0;
    const quantity = card.quantity || 1;
    return sum + price * quantity;
  }, 0);
}

function cacheKey(userId) {
  return `sb5_collection_${String(userId)}`;
}

function readCache(userId) {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(userId, data) {
  try {
    localStorage.setItem(
      cacheKey(userId),
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {}
}

// ---------- hook ----------
export default function useProfileCollection({ userId, token }) {
  const [collection, setCollection] = useState([]);
  const [wishlist, setWishlist] = useState({ entries: [] });
  const [loading, setLoading] = useState(true);
  const [collectionValue, setCollectionValue] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [status, setStatus] = useState(null);

  const [showCardDetails, setShowCardDetails] = useState(false);
  const [cardDetails, setCardDetails] = useState(null);

  const refresh = () => setRefreshTrigger((p) => p + 1);

  useEffect(() => {
    if (!userId) {
      console.warn("[useProfileCollection] No userId provided — collection will be empty.");
    }
    let aborted = false;

    // 0) Stale-while-revalidate: show cached collection instantly if available
    const cached = typeof window !== "undefined" ? readCache(userId) : null;
    if (cached && cached.data && Array.isArray(cached.data)) {
      setCollection(cached.data);
      setCollectionValue(getCollectionTotalValue(cached.data));
      setLoading(false); // show UI immediately
    }

    (async () => {
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // 1) Fetch collection (DB-only pricing) — minimal shape
      const colQ = `
        query GetUserProfileCollection($userId: ID!) {
          collection(userId: $userId) {
            id
            cardId
            quantity
            condition
            variation
            wishlist
            createdAt
            updatedAt
            card {
              id
              name
              number
              setName
              image
              rarity
              variations {
                normal
                holo
                reverse
                firstEdition
                wPromo
              }
              prices {
                variation
                tcgplayer
                cardmarket
                gbp
                updatedAt
              }
            }
          }
        }
      `;

      // 2) Fetch wishlist in parallel (does not block the collection render)
      const wishQ = `
        query Wishlist($userId: ID!) {
          wishlist(userId: $userId) {
            entries {
              id
              cardId
              variation
              quantity
              card {
                id
                name
                setName
                image
                number
              }
            }
            total
            page
            pageSize
          }
        }
      `;

      try {
        const [colResp, wishResp] = await Promise.all([
          fetch(WP_GRAPHQL_URL, {
            method: "POST",
            headers,
            // force network (avoid cached fetches that could be stale)
            cache: "no-store",
            body: JSON.stringify({
              query: colQ,
              variables: { userId: String(userId) },
            }),
          }),
          fetch(WP_GRAPHQL_URL, {
            method: "POST",
            headers,
            cache: "no-store",
            body: JSON.stringify({
              query: wishQ,
              variables: { userId: String(userId) },
            }),
          }),
        ]);

        const colJson = await colResp.json().catch(() => ({}));
        const wishJson = await wishResp.json().catch(() => ({}));

        if (aborted) return;

        const rawCollection = Array.isArray(colJson?.data?.collection)
          ? colJson.data.collection
          : [];

        // Flatten & keep only non-wishlist entries (we do NO upstream hydration here)
        const flat = [];
        for (const entry of rawCollection) {
          if (!entry) continue;
          const isWishlist =
            entry.wishlist === true ||
            entry.wishlist === 1 ||
            String(entry.wishlist).toLowerCase() === "true";
          if (isWishlist) continue;

          const card = entry.card || {};
          flat.push({
            ...entry,
            ...card,
            prices: Array.isArray(card.prices) ? card.prices.filter(Boolean) : [],
            variations:
              card.variations && typeof card.variations === "object"
                ? card.variations
                : null,
            cardId: entry.cardId,
            quantity: entry.quantity,
            condition: entry.condition,
            variation: entry.variation,
            wishlist: entry.wishlist,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          });
        }

        // Update state immediately with DB prices only
        setCollection(flat);
        setCollectionValue(getCollectionTotalValue(flat));
        writeCache(userId, flat);

        // Wishlist (non-blocking)
        const wish = wishJson?.data?.wishlist ?? { entries: [] };
        setWishlist(wish);

        // If there was no cache, flip loading off now
        if (!cached) setLoading(false);
      } catch {
        if (!cached) setLoading(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [userId, token, refreshTrigger]);

  return {
    collection: { value: collection, set: setCollection },
    wishlist: { value: wishlist, set: setWishlist },
    loading: { value: loading, set: setLoading },
    collectionValue: { value: collectionValue, set: setCollectionValue },
    refresh,
    status: { value: status, set: setStatus },
    showCardDetails,
    setShowCardDetails,
    cardDetails,
    setCardDetails,
  };
}

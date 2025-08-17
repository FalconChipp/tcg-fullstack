import { useState, useEffect } from "react";

const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;

// Safely convert to number
const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? null : num;
};

// Calculate the average price for a card, matching panel logic
function getCardAveragePrice(card) {
  if (!card || !Array.isArray(card.prices)) return null;
  const selectedVariation = card.variation || "normal";
  let priceObj = card.prices.find((p) => p && (p.variation === selectedVariation));
  if (!priceObj && card.prices.length) priceObj = card.prices[0];
  if (!priceObj) return null;
  const tcg = toNumber(priceObj.tcgplayer);
  const cmk = toNumber(priceObj.cardmarket);
  if (tcg == null && cmk == null) return null;
  if (tcg != null && cmk != null) return (tcg + cmk) / 2;
  return tcg != null ? tcg : cmk;
}

// Calculate total value for collection
function getCollectionTotalValue(col = []) {
  return col.reduce((sum, card) => {
    const price = getCardAveragePrice(card) ?? 0;
    const quantity = card.quantity || 1;
    return sum + (price * quantity);
  }, 0);
}

// --- UPDATED HOOK: pass { userId, token } --- //
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
    if (!userId) return;
    (async () => {
      setLoading(true);

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
                updatedAt
              }
            }
          }
        }
      `;

      let rawCollectionData = [];
      try {
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const r = await fetch(WP_GRAPHQL_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({ query: colQ, variables: { userId: String(userId) } }),
        });
        const responseJson = await r.json();
        rawCollectionData = responseJson.data?.collection || [];
      } catch (_) {
        rawCollectionData = [];
      }

      // Flatten & keep only non-wishlist
      let col = [];
      (rawCollectionData || []).forEach((entry) => {
        if (!entry) return;
        const isWishlistItem =
          entry.wishlist === true ||
          entry.wishlist === 1 ||
          String(entry.wishlist).toLowerCase() === "true";
        if (!isWishlistItem) {
          const card = entry.card || {};
          const prices = Array.isArray(card.prices) ? card.prices.filter(Boolean) : [];
          const variations = card.variations && typeof card.variations === 'object' ? card.variations : null;
          col.push({
            ...entry,
            ...card,
            prices,
            variations,
            cardId: entry.cardId,
            quantity: entry.quantity,
            condition: entry.condition,
            variation: entry.variation,
            wishlist: entry.wishlist,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          });
        }
      });

      // Proper wishlist query
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
      let wish = { entries: [] };
      try {
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const r = await fetch(WP_GRAPHQL_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({ query: wishQ, variables: { userId: String(userId) } }),
        });
        const responseJson = await r.json();
        wish = responseJson.data?.wishlist ?? { entries: [] };
      } catch (_) {
        wish = { entries: [] };
      }

      const totalValue = getCollectionTotalValue(col);

      setCollection(col);
      setWishlist(wish);
      setCollectionValue(totalValue);
      setLoading(false);
    })();
  }, [userId, token, refreshTrigger]);

  return {
    collection: { value: collection, set: setCollection },
    wishlist: { value: wishlist, set: setWishlist },
    loading: { value: loading, set: setLoading },
    collectionValue: { value: collectionValue, set: setCollectionValue },
    refresh,
    status: { value: status, set: setStatus },
    showCardDetails, setShowCardDetails,
    cardDetails, setCardDetails,
  };
}

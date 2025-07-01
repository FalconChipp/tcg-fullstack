import { useState, useEffect } from "react";

const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";

// Helper to safely convert to number
const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? null : num;
};

export default function useProfileCollection({ user, token }) {
  const [collection, setCollection] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collectionValue, setCollectionValue] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [status, setStatus] = useState(null);

  const [showCardDetails, setShowCardDetails] = useState(false);
  const [cardDetails, setCardDetails] = useState(null);

  // Helper to refresh data (used after edits)
  const refresh = () => setRefreshTrigger((p) => p + 1);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);

      // ---- FIXED QUERY ----
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
          body: JSON.stringify({ query: colQ, variables: { userId: String(user.id) } }),
        });
        const responseJson = await r.json();
        rawCollectionData = responseJson.data?.collection || [];
      } catch (fetchError) {
        rawCollectionData = [];
      }

      // ---- FLATTEN & SPLIT COLLECTION/WISHLIST ----
      let col = [];
      let wish = [];
      (rawCollectionData || []).forEach((entry) => {
        if (!entry) return;
        const isWishlistItem = entry.wishlist === true || entry.wishlist === 1 || String(entry.wishlist).toLowerCase() === "true";
        const card = entry.card || {};
        const fullEntry = {
          ...entry,
          ...card, // flatten card fields for easy access in UI
          cardId: entry.cardId,
          quantity: entry.quantity,
          condition: entry.condition,
          variation: entry.variation,
          wishlist: entry.wishlist,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        };
        if (isWishlistItem) wish.push(fullEntry);
        else col.push(fullEntry);
      });

      // ---- CALCULATE COLLECTION VALUE ----
      const totalValue = col.reduce((sum, card) => {
        // Find "normal" variation price first, fallback to any price
        const normal = card?.prices?.find?.(p => p.variation === "normal");
        const firstPrice = normal
          ? (toNumber(normal.tcgplayer) || toNumber(normal.cardmarket) || 0)
          : (
            card?.prices?.length
              ? (toNumber(card.prices[0].tcgplayer) || toNumber(card.prices[0].cardmarket) || 0)
              : 0
          );
        const quantity = card.quantity || 1;
        return sum + (firstPrice * quantity);
      }, 0);

      setCollection(col);
      setWishlist(wish);
      setCollectionValue(totalValue);
      setLoading(false);
    })();
  }, [user?.id, token, refreshTrigger]);

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

import { useState, useEffect } from "react";

const WP_GRAPHQL_URL = "http://tcg.local/graphql";
const TCG_GRAPHQL_URL = "http://tcg.local/graphql";

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

  // Fetch and enrich collection/wishlist
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);

      // 1. Fetch user's collection cards (public, no token required for read)
      const colQ = `
        query GetUserProfileCollection($userId: ID!) {
            collectionCards(userId: $userId, includeWishlist: true) {
              id
              cardId
              quantity
              condition
              variation
              tcgImageUrl
              tcgSetName
              tcgSetSymbolUrl
              tcgName
              tcgRarity
              tcgEdition
              tags
              isPublic
              wishlist
              tcgplayerMarket
              cardmarketAverageSell
              createdAt
              updatedAt
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
        if (responseJson.errors) {
          rawCollectionData = [];
        } else {
          rawCollectionData = responseJson.data?.collectionCards || [];
        }
      } catch (fetchError) {
        rawCollectionData = [];
      }

      // 2. Enrich each card with up-to-date TCG data
      const searchQ = `
        query SearchCards($name: String, $set: String, $number: String) {
          pokemonCards(
            name: $name
            set: $set
            number: $number
            language: "en"
            perPage: 1 
          ) {
            externalId
            name
            number
            image
            setName
            setSymbol
            setLogo
            rarity
            variations
            edition
            pricing {
              cardmarket { average_sell low trend }
              tcgplayer { low mid high market direct_low }
            }
          }
        }
      `;

      let detailedCards = [];
      if (rawCollectionData && rawCollectionData.length > 0) {
        detailedCards = await Promise.all(
          rawCollectionData.map(async (item) => {
            if (!item || !item.cardId) return item || {};
            const [setCode, numFromCardId] = item.cardId.split("-");
            const variablesForSearchQ = {
              name: item.tcgName || "",
              set: setCode || "",
              number: numFromCardId,
            };
            try {
              const searchResponse = await fetch(TCG_GRAPHQL_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: searchQ, variables: variablesForSearchQ }),
              });
              const searchResultJson = await searchResponse.json();
              const matchedCard = searchResultJson.data?.pokemonCards?.[0];
              if (matchedCard) {
                const apiPrices = matchedCard.pricing || {};
                const now = new Date().toISOString();
                return {
                  ...item,
                  externalId: matchedCard.externalId || item.cardId,
                  tcgName: matchedCard.name || item.tcgName || "Unknown Card",
                  tcgImageUrl: matchedCard.image || item.tcgImageUrl || "",
                  tcgSetName: matchedCard.setName || item.tcgSetName || "Unknown Set",
                  tcgSetSymbolUrl: matchedCard.setSymbol || item.tcgSetSymbolUrl || "",
                  tcgSetLogoUrl: matchedCard.setLogo || item.tcgSetLogoUrl || "",
                  tcgRarity: matchedCard.rarity || item.tcgRarity || "",
                  cardId: item.cardId || matchedCard.externalId || "",
                  number: matchedCard.number || item.number || "",
                  variations: matchedCard.variations || item.variations || "",
                  edition: matchedCard.edition || item.edition || "",
                  cardmarketAverageSell: apiPrices.cardmarket?.average_sell ?? item.cardmarketAverageSell ?? null,
                  cardmarketLowPrice: apiPrices.cardmarket?.low ?? item.cardmarketLowPrice ?? null,
                  cardmarketTrendPrice: apiPrices.cardmarket?.trend ?? item.cardmarketTrendPrice ?? null,
                  tcgplayerLow: apiPrices.tcgplayer?.low ?? item.tcgplayerLow ?? null,
                  tcgplayerMid: apiPrices.tcgplayer?.mid ?? item.tcgplayerMid ?? null,
                  tcgplayerHigh: apiPrices.tcgplayer?.high ?? item.tcgplayerHigh ?? null,
                  tcgplayerMarket: apiPrices.tcgplayer?.market ?? item.tcgplayerMarket ?? null,
                  tcgplayerDirectLow: apiPrices.tcgplayer?.direct_low ?? item.tcgplayerDirectLow ?? null,
                  updatedAt: now,
                  createdAt: item.createdAt || now,
                  dateAdded: item.createdAt || now,
                  wishlist: item.wishlist
                };
              } else {
                return item;
              }
            } catch {
              return item;
            }
          })
        );
      } else {
        detailedCards = rawCollectionData || [];
      }

      // 3. Split into collection and wishlist
      const col = [];
      const wish = [];
      (detailedCards || []).forEach((c) => {
        if (!c) return;
        const isWishlistItem = c.wishlist === true || c.wishlist === 1 || String(c.wishlist).toLowerCase() === "true";
        if (isWishlistItem) {
          wish.push(c);
        } else {
          col.push(c);
        }
      });

      // 4. Calculate total value
      const totalValue = col.reduce((sum, card) => {
        const price = card.tcgplayerMarket || card.tcgplayerMid || 0;
        const quantity = card.quantity || 1;
        return sum + (price * quantity);
      }, 0);

      // 5. Update state
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

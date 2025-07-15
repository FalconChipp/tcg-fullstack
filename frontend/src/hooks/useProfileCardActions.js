const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";
const TCG_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";

/**
 * Handles profile actions for cards, including collection/wishlist edits.
 * Handles both array and object-with-.entries as state shape.
 */
export default function useProfileCardActions({
  isOwnProfile,
  token,
  setStatus,
  setCollection,
  setWishlist,
  setLoading,
  collection,
  wishlist,
  userId,
  refresh
}) {
  // Helper to get .entries or fallback to []
  function getEntries(objOrArray) {
    if (!objOrArray) return [];
    if (Array.isArray(objOrArray)) return objOrArray;
    if (Array.isArray(objOrArray.entries)) return objOrArray.entries;
    return [];
  }
  // Helper to update entries in state, preserving paginated shape
  function updateEntries(prev, newEntries) {
    if (Array.isArray(prev)) return newEntries;
    if (prev && typeof prev === "object") {
      return { ...prev, entries: newEntries };
    }
    return newEntries;
  }

  // --- Move card from wishlist to collection ---
  async function handleMoveToCollection(card) {
    if (!isOwnProfile || !token) {
      setStatus({ type: "error", msg: "Must be logged in." });
      return;
    }
    const updatedCard = { ...card, wishlist: false };

    // CHANGED: Always use the actual .variation from the card, never default to null unless actually null/undefined
    const variables = {
      cardId: card.cardId,
      variation: card.variation ?? null
    };

    // Optimistic UI update
    setWishlist(prev => updateEntries(prev,
      getEntries(prev).filter(x => x.id !== card.id || String(x.variation) !== String(card.variation))
    ));
    setCollection(prev => updateEntries(prev, [
      ...getEntries(prev),
      updatedCard
    ]));
    setStatus({ type: "success", msg: "Moving to collection..." });

    try {
      const mutation = `
        mutation MoveToCollection($cardId: String!, $variation: String) {
          moveToCollection(cardId: $cardId, variation: $variation) {
            id
            cardId
            quantity
            condition
            variation
            wishlist
            card { id name image setName }
          }
        }
      `;
      const response = await fetch(WP_GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: mutation,
          variables, // CHANGED: Always pass the correct value
        }),
      });
      const { data, errors } = await response.json();

      if (errors) {
        setStatus({ type: "error", msg: errors[0].message || "Failed to move card." });
        // Roll back optimistic UI change
        setWishlist(prev => updateEntries(prev, [...getEntries(prev), card]));
        setCollection(prev => updateEntries(prev, getEntries(prev).filter(x => x.id !== card.id)));
        return;
      }
      const { moveToCollection } = data;
      if (moveToCollection) {
        const serverCard = moveToCollection;
        // Remove from wishlist again (for sync)
        setWishlist(prev => updateEntries(prev,
          getEntries(prev).filter(x => x.id !== card.id || String(x.variation) !== String(card.variation))
        ));
        setCollection(prev => {
          const entries = getEntries(prev);
          const exists = entries.some(x => x.id === card.id);
          return updateEntries(
            prev,
            exists
              ? entries.map(x => x.id === card.id ? { ...x, ...serverCard, wishlist: false } : x)
              : [...entries, { ...serverCard, wishlist: false }]
          );
        });
        setStatus({ type: "success", msg: "Moved to collection successfully!" });
      } else {
        throw new Error("Invalid server response");
      }
    } catch (error) {
      setStatus({ type: "error", msg: "Failed to move card. Please try again." });
      // Roll back optimistic UI change
      setWishlist(prev => updateEntries(prev, [...getEntries(prev), card]));
      setCollection(prev => updateEntries(prev, getEntries(prev).filter(x => x.id !== card.id)));
    }
  }

  // --- Remove card from collection ---
  async function handleRemoveCard(collectionId, quantityToRemove = 1) {
    if (!isOwnProfile || !token) {
      setStatus({ type: "error", msg: "Must be logged in." });
      return;
    }

    const entries = getEntries(collection);
    const cardObj = entries.find(card => String(card.id) === String(collectionId));
    const prevCollection = Array.isArray(collection)
      ? [...collection]
      : { ...(collection || {}) };

    setCollection(prev => updateEntries(prev,
      getEntries(prev)
        .map(card =>
          String(card.id) === String(collectionId)
            ? { ...card, quantity: card.quantity - quantityToRemove }
            : card
        )
        .filter(card => String(card.id) !== String(collectionId) || card.quantity > 0)
    ));

    setWishlist(prev => updateEntries(prev,
      getEntries(prev)
        .map(card =>
          String(card.id) === String(collectionId)
            ? { ...card, quantity: card.quantity - quantityToRemove }
            : card
        )
        .filter(card => String(card.id) !== String(collectionId) || card.quantity > 0)
    ));

    try {
      const mutation = `
        mutation RemoveFromCollection($cardId: String!, $variation: String) {
          removeFromCollection(cardId: $cardId, variation: $variation)
        }
      `;
      const variables = {
        cardId: (cardObj?.cardId || cardObj?.id || collectionId).toString(),
        variation: cardObj && typeof cardObj.variation === "string" && cardObj.variation.length > 0
          ? cardObj.variation
          : (cardObj?.variation === null ? null : undefined)
      };

      const response = await fetch(TCG_GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: mutation,
          variables,
        }),
      });
      const { data, errors } = await response.json();
      if (errors || !data?.removeFromCollection) {
        setStatus({ type: "error", msg: "Failed to remove card from collection." });
        setCollection(prevCollection); // Rollback
      } else {
        setStatus({ type: "success", msg: "Card removed from collection." });
      }
    } catch (error) {
      setStatus({ type: "error", msg: "An error occurred while removing the card." });
      setCollection(prevCollection); // Rollback
    }
  }

  // --- Remove from wishlist (uses cardId + variation) ---
  async function handleRemoveFromWishlist(cardId, variation = null) {
    if (!isOwnProfile || !token) {
      setStatus({ type: "error", msg: "Must be logged in." });
      return;
    }
    try {
      const mutation = `
        mutation RemoveFromWishlist($cardId: String!, $variation: String) {
          removeFromWishlist(cardId: $cardId, variation: $variation)
        }
      `;
      const response = await fetch(WP_GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            cardId,
            variation: variation ?? null
          },
        }),
      });
      const { data, errors } = await response.json();
      if (errors || !data?.removeFromWishlist) {
        setStatus({ type: "error", msg: "Failed to remove from wishlist" });
        return;
      }
      if (data.removeFromWishlist) {
        setWishlist(prev => updateEntries(prev,
          getEntries(prev).filter(
            card =>
              String(card.cardId || card.id) !== String(cardId) ||
              String(card.variation || null) !== String(variation || null)
          )
        ));
        setStatus({ type: "success", msg: "Removed from wishlist" });
      }
    } catch (error) {
      setStatus({ type: "error", msg: "Failed to remove from wishlist" });
    }
  }

  // --- Add to wishlist ---
  async function handleAddToWishlist(card) {
    if (!isOwnProfile) return;
    try {
      const mutation = `
        mutation AddToWishlist($cardId: String!, $variation: String) {
          addToWishlist(cardId: $cardId, variation: $variation)
          {
            id
            wishlist
            cardId
            variation
            card { id name image setName }
            quantity
            condition
          }
        }
      `;
      const response = await fetch(WP_GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            cardId: card.cardId,
            variation: card.variation ?? null
          },
        }),
      });
      const { data, errors } = await response.json();
      if (errors) {
        setStatus({ type: "error", msg: "Failed to add to wishlist" });
        return;
      }
      if (data?.addToWishlist) {
        setWishlist(prev => updateEntries(prev, [
          ...getEntries(prev),
          data.addToWishlist
        ]));
        setStatus({ type: "success", msg: "Added to wishlist" });
      }
    } catch (error) {
      setStatus({ type: "error", msg: "Failed to add to wishlist" });
    }
  }

  return {
    handleMoveToCollection,
    handleRemoveCard,
    handleRemoveFromWishlist,
    handleAddToWishlist,
  };
}

const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";
const TCG_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";

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
  // Move card from wishlist to collection
  async function handleMoveToCollection(card) {
    if (!isOwnProfile || !token) {
      setStatus({ type: "error", msg: "Must be logged in." });
      return;
    }
    const updatedCard = { ...card, wishlist: false };
    setWishlist(prev => prev.filter(x => x.id !== card.id));
    setCollection(prev => [...prev, updatedCard]);
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
          variables: { cardId: card.cardId || card.id, variation: card.variation || null },
        }),
      });
      const { data, errors } = await response.json();
      if (errors) {
        setStatus({ type: "error", msg: errors[0].message || "Failed to move card." });
        setWishlist(prev => [...prev, card]);
        setCollection(prev => prev.filter(x => x.id !== card.id));
        return;
      }
      const { moveToCollection } = data;
      if (moveToCollection) {
        const serverCard = moveToCollection;
        setWishlist(prev => prev.filter(x => x.id !== card.id));
        setCollection(prev => {
          const exists = prev.some(x => x.id === card.id);
          if (exists) {
            return prev.map(x => x.id === card.id ? { ...x, ...serverCard, wishlist: false } : x);
          } else {
            return [...prev, { ...serverCard, wishlist: false }];
          }
        });
        setStatus({ type: "success", msg: "Moved to collection successfully!" });
      } else {
        throw new Error("Invalid server response");
      }
    } catch (error) {
      setStatus({ type: "error", msg: "Failed to move card. Please try again." });
      setWishlist(prev => [...prev, card]);
      setCollection(prev => prev.filter(x => x.id !== card.id));
    }
  }

async function handleRemoveCard(collectionId, quantityToRemove = 1) {
  if (!isOwnProfile || !token) {
    setStatus({ type: "error", msg: "Must be logged in." });
    return;
  }

  const cardObj = (collection || []).find(card => String(card.id) === String(collectionId));
  const prevCollection = [...(collection || [])];

  // Optimistically remove from UI
  setCollection(prev =>
    prev
      .map(card =>
        String(card.id) === String(collectionId)
          ? { ...card, quantity: card.quantity - quantityToRemove }
          : card
      )
      .filter(card => String(card.id) !== String(collectionId) || card.quantity > 0)
  );
  setWishlist(prev =>
    prev
      .map(card =>
        String(card.id) === String(collectionId)
          ? { ...card, quantity: card.quantity - quantityToRemove }
          : card
      )
      .filter(card => String(card.id) !== String(collectionId) || card.quantity > 0)
  );

  try {
    const mutation = `
      mutation RemoveFromCollection($cardId: String!, $variation: String) {
        removeFromCollection(cardId: $cardId, variation: $variation)
      }
    `;
    const variables = {
      cardId: (cardObj?.cardId || cardObj?.id || collectionId).toString(),
      variation: cardObj && cardObj.variation ? cardObj.variation : null
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
      // No need to refresh
    }
  } catch (error) {
    setStatus({ type: "error", msg: "An error occurred while removing the card." });
    setCollection(prevCollection); // Rollback
  }
}

  // Remove from wishlist
async function handleRemoveFromWishlist(cardId) {
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
        variables: { cardId, variation: null },
      }),
    });
    const { data, errors } = await response.json();
    if (errors || !data?.removeFromWishlist) {
      setStatus({ type: "error", msg: "Failed to remove from wishlist" });
      return;
    }
    if (data.removeFromWishlist) {
      setWishlist(prev => prev.filter(card => card.id !== cardId));
      setStatus({ type: "success", msg: "Removed from wishlist" });
    }
  } catch (error) {
    setStatus({ type: "error", msg: "Failed to remove from wishlist" });
  }
}


  // Add to wishlist
  async function handleAddToWishlist(card) {
    if (!isOwnProfile) return;
    try {
      const mutation = `
        mutation AddToWishlist($cardId: String!, $variation: String) {
          addToWishlist(cardId: $cardId, variation: $variation)
          {
            id
            wishlist
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
            variation: card.variation || null
          },
        }),
      });
      const { data, errors } = await response.json();
      if (errors) {
        setStatus({ type: "error", msg: "Failed to add to wishlist" });
        return;
      }
      if (data?.addToWishlist) {
        setWishlist(prev => [...prev, data.addToWishlist]);
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

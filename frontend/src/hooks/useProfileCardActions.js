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
        mutation UpdateCollectionCard($collectionId: ID!, $wishlist: Boolean!) {
          updateCollectionCard(
            input: { collectionId: $collectionId, wishlist: $wishlist }
          ) {
            collectionCard {
              id
              wishlist
              tcgName 
              tcgImageUrl
              tcgSetName
              tcgSetSymbolUrl
              tcgRarity
              tcgplayerMarket
              cardmarketAverageSell
            }
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
          variables: { collectionId: card.id, wishlist: false },
        }),
      });
      const { data, errors } = await response.json();
      if (errors) {
        setStatus({ type: "error", msg: errors[0].message || "Failed to move card." });
        setWishlist(prev => [...prev, card]);
        setCollection(prev => prev.filter(x => x.id !== card.id));
        return;
      }
      const { updateCollectionCard } = data;
      if (updateCollectionCard?.collectionCard) {
        const serverCard = updateCollectionCard.collectionCard;
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

  // Remove card from collection/wishlist
  async function handleRemoveCard(collectionId, quantityToRemove = 1) {
    if (!isOwnProfile || !token) {
      setStatus({ type: "error", msg: "Must be logged in." });
      return;
    }
    setLoading(true);
    setCollection(prev => 
      prev.map(card => 
        String(card.id) === String(collectionId)
          ? { ...card, quantity: card.quantity - quantityToRemove }
          : card
      ).filter(card => String(card.id) !== String(collectionId) || card.quantity > 0)
    );
    setWishlist(prev => 
      prev.map(card => 
        String(card.id) === String(collectionId)
          ? { ...card, quantity: card.quantity - quantityToRemove }
          : card
      ).filter(card => String(card.id) !== String(collectionId) || card.quantity > 0)
    );
    try {
      const mutation = `
        mutation RemoveCollectionCard($input: RemoveCollectionCardInput!) {
          removeCollectionCard(input: $input) { 
            deleted
            removedCollectionId
          }
        }
      `;
      const variables = {
        input: {
          collectionId: collectionId.toString()
        },
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
      if (errors || !data?.removeCollectionCard?.deleted) {
        setStatus({ type: "error", msg: "Failed to remove card from collection." });
        refresh();
      } else {
        setStatus({ type: "success", msg: "Card removed from collection." });
      }
    } catch (error) {
      setStatus({ type: "error", msg: "An error occurred while removing the card." });
      refresh();
    } finally {
      setLoading(false);
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
      mutation RemoveFromWishlist($collectionId: ID!) {
        updateCollectionCard(
          input: { collectionId: $collectionId, wishlist: false }
        ) {
          collectionCard {
            id
            wishlist
          }
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
        variables: { collectionId: cardId },
      }),
    });
    const { data, errors } = await response.json();
    if (errors) {
      setStatus({ type: "error", msg: "Failed to remove from wishlist" });
      return;
    }
    if (data?.updateCollectionCard?.collectionCard) {
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
        mutation AddToWishlist($cardId: String!, $name: String!, $setName: String!, $tcgName: String!, $tcgSetName: String!) {
          createCollectionCard(
            data: {
              cardId: $cardId
              name: $name
              setName: $setName
              tcgName: $tcgName
              tcgSetName: $tcgSetName
              wishlist: true
            }
          ) {
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
            name: card.name,
            setName: card.setName,
            tcgName: card.tcgName,
            tcgSetName: card.tcgSetName
          },
        }),
      });
      const { data, errors } = await response.json();
      if (errors) {
        setStatus({ type: "error", msg: "Failed to add to wishlist" });
        return;
      }
      if (data?.createCollectionCard) {
        setWishlist(prev => [...prev, data.createCollectionCard]);
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

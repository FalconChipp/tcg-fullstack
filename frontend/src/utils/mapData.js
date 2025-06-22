export function mapCardToDetail(card) {
  return {
    // Names and numbers
    name: card.name,
    tcgName: card.name, // fallback for the modal
    cardId: card.externalId,
    number: card.number,
    tcgNumber: card.number,
    tcgSetName: card.setName,
    setName: card.setName,
    tcgRarity: card.rarity,
    rarity: card.rarity,
    tcgEdition: card.edition,
    edition: card.edition,
    // Images
    tcgImageUrl: card.image || null, // assuming this is the correct field
    // Variations
    variations: card.variations,
    variation: card.variation,
    // Pricing
    tcgplayerMarket: card.pricing?.tcgplayer?.market ?? null,
    cardmarketAverageSell: card.pricing?.cardmarket?.average_sell ?? null,
    // Collection info (set to 0/unknown as default)
    quantity: card.quantity || 0,
    condition: card.condition || null,
    // Others
    notes: card.notes || "",
    // Add any other needed fields, with correct fallbacks
  };
}

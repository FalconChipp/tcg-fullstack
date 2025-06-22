/**
 * Returns the average value (TCGPlayer + CardMarket) × quantity, or null.
 */
export function getAverageCardValue(card) {
  const tcg = Number(card.tcgplayerMarket);
  const cm = Number(card.cardmarketAverageSell);

  // Handle missing/invalid values
  const tcgValid = !isNaN(tcg) && tcg > 0;
  const cmValid = !isNaN(cm) && cm > 0;

  let avg = null;

  if (tcgValid && cmValid) {
    avg = (tcg + cm) / 2;
  } else if (tcgValid) {
    avg = tcg;
  } else if (cmValid) {
    avg = cm;
  }

  if (avg === null || !card.quantity || isNaN(card.quantity) || card.quantity < 1) return null;
  return avg * card.quantity;
}

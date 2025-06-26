// src/utils/cardUtils.js

export function getCardKey(card) {
  if (!card) return '';
  return `${card.cardId || ''}-${card.variation || 'normal'}-${card.condition || 'unlimited'}`;
}

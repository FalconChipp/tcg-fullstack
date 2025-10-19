import { describe, expect, it } from 'vitest';

import { groupVariantsByNumber } from '../collectPrices.job.js';

describe('groupVariantsByNumber', () => {
  it('preserves full card numbers when variants contain hyphens', () => {
    const rows = [
      { card_id: 'sv08-123', variant: 'normal' },
      { card_id: 'sv08-GG-01', variant: 'reverse' },
      { card_id: 'sv08-GG-01', variant: 'holo' },
      { card_id: 'sv08-TG-5', variant: 'foil' },
    ];

    const result = groupVariantsByNumber(rows);

    expect(result.get('123')).toEqual(['normal']);
    expect(result.get('GG-01')).toEqual(['reverse', 'holo']);
    expect(result.get('TG-5')).toEqual(['foil']);
  });

  it('ignores rows missing a card number segment', () => {
    const rows = [
      { card_id: 'sv08', variant: 'normal' },
      { card_id: null, variant: 'reverse' },
    ];

    const result = groupVariantsByNumber(rows);

    expect(result.size).toBe(0);
  });
});

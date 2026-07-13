import { formatVariation, getVariationOptionsFromCard } from '../formatVariation';

describe('formatVariation', () => {
  test('returns "Standard" for null', () => expect(formatVariation(null)).toBe('Standard'));
  test('returns "Standard" for empty string', () => expect(formatVariation('')).toBe('Standard'));
  test('returns "Standard" for __typename', () => expect(formatVariation('__typename')).toBe('Standard'));

  describe('base types', () => {
    test('normal → Standard', () => expect(formatVariation('normal')).toBe('Standard'));
    test('holo → Holo', () => expect(formatVariation('holo')).toBe('Holo'));
    test('reverse → Reverse Holo', () => expect(formatVariation('reverse')).toBe('Reverse Holo'));
    test('metal → Metal', () => expect(formatVariation('metal')).toBe('Metal'));
  });

  describe('legacy aliases', () => {
    test('holofoil → Holo', () => expect(formatVariation('holofoil')).toBe('Holo'));
    test('reverseholo → Reverse Holo', () => expect(formatVariation('reverseholo')).toBe('Reverse Holo'));
    test('reverseHolofoil → Reverse Holo', () => expect(formatVariation('reverseHolofoil')).toBe('Reverse Holo'));
    test('reverse_holo → Reverse Holo', () => expect(formatVariation('reverse_holo')).toBe('Reverse Holo'));
    test('standard → Standard', () => expect(formatVariation('standard')).toBe('Standard'));
    test('firstEdition → 1st Edition', () => expect(formatVariation('firstEdition')).toBe('1st Edition'));
  });

  describe('compound keys with dash separator', () => {
    test('holo-gold → Holo (Gold)', () => expect(formatVariation('holo-gold')).toBe('Holo (Gold)'));
    test('normal-first_edition → Standard (1st Edition)', () =>
      expect(formatVariation('normal-first_edition')).toBe('Standard (1st Edition)'));
    test('reverse-master_ball_league → Reverse Holo (Master Ball League)', () =>
      expect(formatVariation('reverse-master_ball_league')).toBe('Reverse Holo (Master Ball League)'));
  });

  describe('standalone modifier keys', () => {
    test('first_edition → 1st Edition', () => expect(formatVariation('first_edition')).toBe('1st Edition'));
    test('w_promo → W Promo', () => expect(formatVariation('w_promo')).toBe('W Promo'));
    test('shadowless → Shadowless', () => expect(formatVariation('shadowless')).toBe('Shadowless'));
    test('pre_release → Pre-Release', () => expect(formatVariation('pre_release')).toBe('Pre-Release'));
  });

  describe('fallback title case', () => {
    test('unknown_key → Unknown Key', () =>
      expect(formatVariation('unknown_key')).toBe('Unknown Key'));
    test('some-variation → Some Variation', () =>
      expect(formatVariation('some-variation')).toBe('Some Variation'));
  });
});

describe('getVariationOptionsFromCard', () => {
  test('returns empty array for null', () => expect(getVariationOptionsFromCard(null)).toEqual([]));

  test('extracts from tcgplayerVariations keys', () => {
    const card = { tcgplayerVariations: { normal: { market: 5 }, holofoil: { market: 8 }, __typename: 'Prices' } };
    const result = getVariationOptionsFromCard(card);
    expect(result).toContain('normal');
    expect(result).toContain('holofoil');
    expect(result).not.toContain('__typename');
  });

  test('extracts from variations string array', () => {
    const card = { variations: ['normal', 'reverse'] };
    const result = getVariationOptionsFromCard(card);
    expect(result).toContain('normal');
    expect(result).toContain('reverse');
  });

  test('extracts from comma-separated string', () => {
    const card = { variations: 'normal, holo, reverse' };
    const result = getVariationOptionsFromCard(card);
    expect(result).toContain('normal');
    expect(result).toContain('holo');
    expect(result).toContain('reverse');
  });

  test('extracts from variations object (truthy values only)', () => {
    const card = { variations: { normal: true, holo: false, reverse: true, __typename: true } };
    const result = getVariationOptionsFromCard(card);
    expect(result).toContain('normal');
    expect(result).toContain('reverse');
    expect(result).not.toContain('holo');
    expect(result).not.toContain('__typename');
  });

  test('deduplicates variations', () => {
    const card = { variations: ['normal', 'normal', 'holo'] };
    const result = getVariationOptionsFromCard(card);
    expect(result.filter((v) => v === 'normal')).toHaveLength(1);
  });

  test('puts normal before holo in output order', () => {
    const card = { variations: ['holo', 'normal'] };
    const result = getVariationOptionsFromCard(card);
    expect(result.indexOf('normal')).toBeLessThan(result.indexOf('holo'));
  });

  test('normalises to snake_lower', () => {
    const card = { variations: ['Holo Foil'] };
    const result = getVariationOptionsFromCard(card);
    expect(result).toContain('holo_foil');
  });
});

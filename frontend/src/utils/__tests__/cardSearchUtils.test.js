import {
  pos,
  pickDisplayPrice,
  getBestPriceRow,
  formatGBP,
  canonicalCardKey,
  mergeCardLists,
  makeQueryKey,
  applyFiltersAndSort,
  GBP_SYMBOL,
  FALLBACK_SYMBOL_IMAGE,
  CARDSEARCH_PAGE_SIZE,
  CARDSEARCH_EXACT_LIMIT,
  HOME_RESULT_LIMIT,
} from '../cardSearchUtils';

describe('constants', () => {
  test('GBP_SYMBOL is £', () => expect(GBP_SYMBOL).toBe('£'));
  test('CARDSEARCH_PAGE_SIZE is 48', () => expect(CARDSEARCH_PAGE_SIZE).toBe(48));
  test('CARDSEARCH_EXACT_LIMIT is 12', () => expect(CARDSEARCH_EXACT_LIMIT).toBe(12));
  test('HOME_RESULT_LIMIT is 8', () => expect(HOME_RESULT_LIMIT).toBe(8));
  test('FALLBACK_SYMBOL_IMAGE is a URL', () => expect(FALLBACK_SYMBOL_IMAGE).toMatch(/^https?:\/\//));
});

describe('pos', () => {
  test('returns true for positive finite numbers', () => {
    expect(pos(1)).toBe(true);
    expect(pos(0.01)).toBe(true);
    expect(pos(999)).toBe(true);
  });

  test('returns false for zero', () => expect(pos(0)).toBe(false));
  test('returns false for negative numbers', () => expect(pos(-1)).toBe(false));
  test('returns false for NaN', () => expect(pos(NaN)).toBe(false));
  test('returns false for Infinity', () => expect(pos(Infinity)).toBe(false));
  test('returns false for strings', () => expect(pos('5')).toBe(false));
  test('returns false for null', () => expect(pos(null)).toBe(false));
});

describe('pickDisplayPrice', () => {
  test('returns null for null entry', () => expect(pickDisplayPrice(null)).toBeNull());
  test('returns null for undefined', () => expect(pickDisplayPrice(undefined)).toBeNull());

  test('prefers gbp over market', () => {
    expect(pickDisplayPrice({ gbp: 5, market: 10 })).toBe(5);
  });

  test('falls back to market when no gbp', () => {
    expect(pickDisplayPrice({ market: 10, mid: 8 })).toBe(10);
  });

  test('falls back through mid, low, high', () => {
    expect(pickDisplayPrice({ mid: 8 })).toBe(8);
    expect(pickDisplayPrice({ low: 3 })).toBe(3);
    expect(pickDisplayPrice({ high: 15 })).toBe(15);
  });

  test('skips zero and negative values', () => {
    expect(pickDisplayPrice({ gbp: 0, market: 10 })).toBe(10);
    expect(pickDisplayPrice({ gbp: -1, market: 5 })).toBe(5);
  });

  test('returns null when all values are non-positive', () => {
    expect(pickDisplayPrice({ gbp: 0, market: 0 })).toBeNull();
  });
});

describe('getBestPriceRow', () => {
  test('returns null for empty array', () => expect(getBestPriceRow([])).toBeNull());
  test('returns null for non-array', () => expect(getBestPriceRow(null)).toBeNull());

  test('prefers normal variation', () => {
    const prices = [
      { variation: 'holofoil', market: 10 },
      { variation: 'normal', market: 5 },
    ];
    expect(getBestPriceRow(prices)).toEqual({ variation: 'normal', market: 5 });
  });

  test('falls back to holofoil when no normal', () => {
    const prices = [
      { variation: 'reverseHolofoil', market: 3 },
      { variation: 'holofoil', market: 10 },
    ];
    expect(getBestPriceRow(prices)).toEqual({ variation: 'holofoil', market: 10 });
  });

  test('returns any priced row when no preferred variation matches', () => {
    const prices = [{ variation: 'unlimited', market: 7 }];
    expect(getBestPriceRow(prices)).toEqual({ variation: 'unlimited', market: 7 });
  });

  test('skips rows with no displayable price', () => {
    const prices = [
      { variation: 'normal', market: 0 },
      { variation: 'holofoil', market: 8 },
    ];
    expect(getBestPriceRow(prices)).toEqual({ variation: 'holofoil', market: 8 });
  });
});

describe('formatGBP', () => {
  test('formats positive number', () => expect(formatGBP(5)).toBe('£5.00'));
  test('formats decimal', () => expect(formatGBP(1.5)).toBe('£1.50'));
  test('returns £-- for null', () => expect(formatGBP(null)).toBe('£--'));
  test('returns £-- for NaN', () => expect(formatGBP(NaN)).toBe('£--'));
  test('returns £-- for undefined', () => expect(formatGBP(undefined)).toBe('£--'));
  test('formats zero', () => expect(formatGBP(0)).toBe('£0.00'));
});

describe('canonicalCardKey', () => {
  test('returns fallback for null card', () => expect(canonicalCardKey(null)).toBe('card-0'));
  test('uses custom fallbackIndex', () => expect(canonicalCardKey(null, 5)).toBe('card-5'));

  test('prefers cardId', () => {
    expect(canonicalCardKey({ cardId: 'abc', id: 'def' })).toBe('abc');
  });

  test('uses id when no cardId', () => {
    expect(canonicalCardKey({ id: 'xyz' })).toBe('xyz');
  });

  test('uses setCode-number when no id', () => {
    expect(canonicalCardKey({ set: 'SV1', number: '001' })).toBe('sv1-001');
  });

  test('handles setCode property as well as set', () => {
    expect(canonicalCardKey({ setCode: 'BW1', number: '025' })).toBe('bw1-025');
  });

  test('uses name-index when no id or set+number', () => {
    expect(canonicalCardKey({ name: 'Pikachu' }, 3)).toBe('pikachu-3');
  });

  test('falls back to card-index for empty card', () => {
    expect(canonicalCardKey({}, 7)).toBe('card-7');
  });
});

describe('mergeCardLists', () => {
  test('returns copy of existing when incoming is empty', () => {
    const existing = [{ id: '1', name: 'A' }];
    const result = mergeCardLists(existing, []);
    expect(result).toEqual(existing);
    expect(result).not.toBe(existing);
  });

  test('returns incoming appended when no overlap', () => {
    const a = { id: '1', name: 'A' };
    const b = { id: '2', name: 'B' };
    expect(mergeCardLists([a], [b])).toEqual([a, b]);
  });

  test('replaces existing card with same key', () => {
    const old = { id: '1', name: 'Old' };
    const updated = { id: '1', name: 'New' };
    const result = mergeCardLists([old], [updated]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('New');
  });

  test('handles null existing gracefully', () => {
    const card = { id: '1' };
    expect(mergeCardLists(null, [card])).toEqual([card]);
  });
});

describe('makeQueryKey', () => {
  test('produces consistent key for same inputs', () => {
    const k1 = makeQueryKey({ name: 'Pikachu', setCode: 'SV1', number: '025' });
    const k2 = makeQueryKey({ name: 'pikachu', setCode: 'sv1', number: '025' });
    expect(k1).toBe(k2);
  });

  test('trims whitespace', () => {
    const k1 = makeQueryKey({ name: '  Pikachu  ', setCode: '  SV1  ', number: '025' });
    const k2 = makeQueryKey({ name: 'Pikachu', setCode: 'SV1', number: '025' });
    expect(k1).toBe(k2);
  });

  test('handles missing fields', () => {
    const key = makeQueryKey({ name: 'Bulbasaur' });
    expect(JSON.parse(key)).toEqual({ name: 'bulbasaur', set: '', number: '' });
  });
});

describe('applyFiltersAndSort', () => {
  const makeCard = (overrides) => ({
    id: 'card-1',
    name: 'Pikachu',
    rarity: 'Common',
    number: '025',
    variations: ['normal'],
    prices: [{ variation: 'normal', market: 5 }],
    ...overrides,
  });

  test('returns cards unchanged when no filters', () => {
    const cards = [makeCard()];
    expect(applyFiltersAndSort(cards, {})).toEqual(cards);
  });

  test('returns empty array unchanged', () => {
    expect(applyFiltersAndSort([], {})).toEqual([]);
  });

  test('returns cards unchanged when filters is null', () => {
    const cards = [makeCard()];
    expect(applyFiltersAndSort(cards, null)).toBe(cards);
  });

  test('filters out cards below minPrice', () => {
    const cheap = makeCard({ id: '1', prices: [{ variation: 'normal', market: 2 }] });
    const pricey = makeCard({ id: '2', prices: [{ variation: 'normal', market: 10 }] });
    const result = applyFiltersAndSort([cheap, pricey], { minPrice: 5, maxPrice: '' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  test('filters out cards above maxPrice', () => {
    const cheap = makeCard({ id: '1', prices: [{ variation: 'normal', market: 2 }] });
    const pricey = makeCard({ id: '2', prices: [{ variation: 'normal', market: 20 }] });
    const result = applyFiltersAndSort([cheap, pricey], { minPrice: '', maxPrice: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('filters by rarity', () => {
    const common = makeCard({ id: '1', rarity: 'Common' });
    const rare = makeCard({ id: '2', rarity: 'Rare' });
    const result = applyFiltersAndSort([common, rare], { rarities: ['Rare'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  test('filters onlyHasPrices removes priceless cards', () => {
    const withPrice = makeCard({ id: '1', prices: [{ variation: 'normal', market: 5 }] });
    const noPrice = makeCard({ id: '2', prices: [{ variation: 'normal', market: 0 }] });
    const result = applyFiltersAndSort([withPrice, noPrice], { onlyHasPrices: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('filters onlyHasReverse keeps cards with reverse variation', () => {
    const reverse = makeCard({ id: '1', variations: ['reverseHolofoil'] });
    const normal = makeCard({ id: '2', variations: ['normal'] });
    const result = applyFiltersAndSort([reverse, normal], { onlyHasReverse: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('sorts price-asc', () => {
    const a = makeCard({ id: '1', prices: [{ variation: 'normal', market: 10 }] });
    const b = makeCard({ id: '2', prices: [{ variation: 'normal', market: 3 }] });
    const result = applyFiltersAndSort([a, b], { sortBy: 'price-asc' });
    expect(result[0].id).toBe('2');
    expect(result[1].id).toBe('1');
  });

  test('sorts price-desc', () => {
    const a = makeCard({ id: '1', prices: [{ variation: 'normal', market: 10 }] });
    const b = makeCard({ id: '2', prices: [{ variation: 'normal', market: 3 }] });
    const result = applyFiltersAndSort([a, b], { sortBy: 'price-desc' });
    expect(result[0].id).toBe('1');
  });

  test('sorts name-asc', () => {
    const a = makeCard({ id: '1', name: 'Zubat' });
    const b = makeCard({ id: '2', name: 'Abra' });
    const result = applyFiltersAndSort([a, b], { sortBy: 'name-asc' });
    expect(result[0].name).toBe('Abra');
  });

  test('sorts rarity-desc puts hyper rare first', () => {
    const common = makeCard({ id: '1', rarity: 'Common' });
    const hyper = makeCard({ id: '2', rarity: 'Hyper rare' });
    const result = applyFiltersAndSort([common, hyper], { sortBy: 'rarity-desc' });
    expect(result[0].id).toBe('2');
  });

  test('sorts number-asc', () => {
    const a = makeCard({ id: '1', number: '100' });
    const b = makeCard({ id: '2', number: '5' });
    const result = applyFiltersAndSort([a, b], { sortBy: 'number-asc' });
    expect(result[0].id).toBe('2');
  });

  test('nulls sort to end on price-asc', () => {
    const priced = makeCard({ id: '1', prices: [{ variation: 'normal', market: 5 }] });
    const unpriced = makeCard({ id: '2', prices: [] });
    const result = applyFiltersAndSort([priced, unpriced], { sortBy: 'price-asc' });
    expect(result[result.length - 1].id).toBe('2');
  });
});

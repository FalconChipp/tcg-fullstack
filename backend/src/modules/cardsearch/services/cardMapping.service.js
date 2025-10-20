// CHANGED: helper to coerce ORM rows into CardsearchCard shape

function coercePlainObject(value) {
  if (!value) return null;
  if (typeof value.get === 'function') {
    return value.get({ plain: true });
  }
  return value;
}

function splitCardId(cardId) {
  if (!cardId) return { setCode: null, number: null };
  const normalized = String(cardId).trim();
  if (!normalized || !normalized.includes('-')) {
    return { setCode: null, number: null };
  }
  const [prefix, ...rest] = normalized.split('-');
  return {
    setCode: prefix || null,
    number: rest.length ? rest.join('-') : null,
  };
}

function buildImages(raw) {
  const images = raw.images || {};
  const small = images.small ?? raw.image_small ?? raw.imageSmall ?? null;
  const largeCandidate =
    images.large ??
    raw.image_large ??
    raw.imageLarge ??
    raw.image_url_remote ??
    raw.image ??
    null;

  return {
    small: small ?? null,
    large: largeCandidate ?? small ?? null,
  };
}

function buildSetObject(raw, inferredSetCode) {
  const set = raw.set || {};
  const code = set.code ?? set.setCode ?? raw.setCode ?? raw.set_code ?? inferredSetCode ?? null;
  const name = set.name ?? raw.setName ?? raw.set_name ?? null;
  if (!code && !name) return null;
  return {
    code: code ?? null,
    name: name ?? null,
  };
}

export function mapModelCardToCardsearchCard(cardLike, { fallbackCardId } = {}) {
  const raw = coercePlainObject(cardLike);
  if (!raw) return null;

  const fallbackSplit = splitCardId(fallbackCardId);
  const rawSplit = splitCardId(raw.cardId || raw.id);

  const setCode = raw.setCode ?? raw.set_code ?? rawSplit.setCode ?? fallbackSplit.setCode;
  const number = raw.number ?? raw.cardNumber ?? rawSplit.number ?? fallbackSplit.number;
  const id =
    raw.id ??
    raw.cardId ??
    (setCode && number ? `${setCode}-${number}` : fallbackCardId ?? null);

  const name = raw.name ?? raw.cardName ?? null;
  const images = buildImages(raw);
  const variants = Array.isArray(raw.variants)
    ? raw.variants
    : Array.isArray(raw.variations)
      ? raw.variations
      : undefined;
  const latestPrices = raw.latestPrices ?? raw.prices ?? raw.pricing ?? undefined;

  const set = buildSetObject(raw, setCode);
  const setName = set?.name ?? raw.setName ?? null;
  const image = images.large ?? images.small ?? raw.image ?? raw.image_url_remote ?? null;

  return {
    ...raw,
    id: id ?? null,
    cardId: id ?? null,
    setCode: setCode ?? null,
    number: number ?? null,
    name,
    images,
    variants,
    latestPrices,
    set,
    setName,
    image,
    variations: variants,
    prices: latestPrices,
  };
}


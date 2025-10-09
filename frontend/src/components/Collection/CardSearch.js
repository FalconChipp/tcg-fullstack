"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef, startTransition } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { gql, useApolloClient } from "@apollo/client";

import { getCookie } from "@/utils/cookieUtils";
import { useTheme } from "@/hooks/ThemeProvider";
import { getSetLogo } from "@/utils/setLogos";
import StatusMessage from "@/components/UI/StatusMessage";
import PokemonAutocomplete from "./SearchComponents/PokemonAutocomplete";
import SetAutocomplete from "./SearchComponents/SetAutocomplete";
import { mapCardToDetail } from "@/utils/mapData";
import { formatVariation } from "@/utils/formatVariation";
import CardSkeleton from "../UI/CardSkeleton";

// Lazily load heavy panels so the search UI becomes interactive sooner
const AddToCollectionPanel = dynamic(() => import("./AddToCollectionPanel"), { ssr: false });
const CardDetailsModal   = dynamic(() => import("../UserProfile/CardDetailsModal"), { ssr: false });

/* ---------------- GraphQL: cardsearch module ---------------- */

const CARDSEARCH_QUERY = gql`
  query CardsearchCollectionSearch($input: CardSearchInput!) {
    searchCards: cardsearchSearchCards(input: $input) {
      total
      limit
      offset
      items {
        cardId
        id
        setCode
        number
        name
        rarity
        images { small large }
        set { code name }
        variants { variant displayName }
        latestPrices {
          variant
          market
          mid
          low
          high
          currency
          updatedAt
          provider
        }
      }
    }
  }
`;

const CARDSEARCH_PAGE_SIZE = 48;
const CARDSEARCH_EXACT_LIMIT = 12;

// Fallback set icon
const FALLBACK_SYMBOL_IMAGE = "https://placehold.co/50x50/webp?text=Icon";

const GBP_SYMBOL = '\u00A3';

/* ---------------- Helpers ---------------- */

function canonicalVariantKey(raw) {
  const value = String(raw ?? 'normal').trim().toLowerCase();
  if (!value) return 'normal';
  if (value === 'reverse' || value === 'reverse holo' || value === 'reverse-holo' || value === 'reverseholo' || value === 'reverseholofoil') return 'reverseHolofoil';
  if (value === 'holo' || value === 'holofoil' || value === 'holo foil') return 'holofoil';
  if (value === 'firstedition' || value === 'first edition' || value === '1stedition' || value === '1st edition') return 'firstEdition';
  return value;
}

// Choose a useful price row for tiles
function getBestPrice(prices) {
  if (!Array.isArray(prices) || prices.length === 0) return null;
  const pref = ["normal", "holofoil", "holo", "reverseHolofoil", "reverse"];
  for (const key of pref) {
    const hit = prices.find((p) => p?.variation === key && hasPrice(p));
    if (hit) return hit;
  }
  return prices.find((p) => hasPrice(p)) || null;
}

function hasPrice(entry) {
  if (!entry) return false;
  return [entry.market, entry.tcgplayer, entry.cardmarket, entry.gbp, entry.mid, entry.low, entry.high]
    .some((val) => typeof val === 'number' && Number.isFinite(val));
}

function computeAveragePrice(entry) {
  if (!entry || !hasPrice(entry)) return null;
  if (typeof entry.market === 'number' && Number.isFinite(entry.market)) return entry.market;

  const primary = [];
  if (typeof entry.tcgplayer === 'number' && Number.isFinite(entry.tcgplayer)) primary.push(entry.tcgplayer);
  if (typeof entry.cardmarket === 'number' && Number.isFinite(entry.cardmarket)) primary.push(entry.cardmarket);

  if (primary.length === 2) return (primary[0] + primary[1]) / 2;
  if (primary.length === 1) return primary[0];

  const fallback = firstNumber(entry.gbp, entry.mid, entry.low, entry.high);
  if (fallback != null) return fallback;
  return primary.length ? primary[0] : null;
}

function formatGBP(value) {
  if (value == null || Number.isNaN(value)) return `${GBP_SYMBOL}--`;
  return `${GBP_SYMBOL}${Number(value).toFixed(2)}`;
}

function firstNumber(...values) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function normalizePriceEntry(price) {
  if (!price || typeof price !== 'object') return null;
  const variation = canonicalVariantKey(price.variation ?? price.variant ?? 'normal');
  const providerRaw = price.provider ?? price.source ?? null;
  const providerKey = providerRaw ? String(providerRaw).toLowerCase() : '';
  const currency = String(price.currency ?? price.curr ?? 'GBP').toUpperCase();

  const market = firstNumber(price.market, price.mid, price.price, price.value);
  const mid = firstNumber(price.mid);
  const low = firstNumber(price.low);
  const high = firstNumber(price.high);
  const updatedAt = price.updatedAt || price.updated_at || null;

  const entry = {
    variation,
    provider: providerRaw || null,
    currency,
    market,
    mid,
    low,
    high,
    updatedAt,
  };

  if (currency === 'GBP' && market != null) entry.gbp = market;
  if (currency === 'USD' && market != null) entry.usd = market;
  if (currency === 'EUR' && market != null) entry.eur = market;

  if (typeof price.gbp === 'number') entry.gbp = price.gbp;
  if (typeof price.usd === 'number') entry.usd = price.usd;
  if (typeof price.eur === 'number') entry.eur = price.eur;

  if (Array.isArray(price.sources)) {
    entry.sources = price.sources;
    for (const src of price.sources) {
      if (!src) continue;
      const srcProvider = typeof src.provider === 'string' ? src.provider.toLowerCase() : '';
      const srcValue = firstNumber(src.market, src.mid, src.price, src.value);
      if (srcProvider.includes('tcg') && srcValue != null && entry.tcgplayer == null) entry.tcgplayer = srcValue;
      if (srcProvider.includes('cardmarket') && srcValue != null && entry.cardmarket == null) entry.cardmarket = srcValue;
      if (entry.market == null && srcValue != null) entry.market = srcValue;
    }
  } else if (price.sources && typeof price.sources === 'object') {
    const values = Object.values(price.sources).filter(Boolean);
    if (values.length) entry.sources = values;
    for (const src of values) {
      const srcProvider = typeof src.provider === 'string' ? src.provider.toLowerCase() : '';
      const srcValue = firstNumber(src.market, src.mid, src.price, src.value);
      if (srcProvider.includes('tcg') && srcValue != null && entry.tcgplayer == null) entry.tcgplayer = srcValue;
      if (srcProvider.includes('cardmarket') && srcValue != null && entry.cardmarket == null) entry.cardmarket = srcValue;
      if (entry.market == null && srcValue != null) entry.market = srcValue;
    }
  }

  const tcgValue = firstNumber(price.tcgplayer, providerKey.includes('tcg') ? market : null);
  if (tcgValue != null) entry.tcgplayer = tcgValue;

  const cmktValue = firstNumber(price.cardmarket, providerKey.includes('cardmarket') ? market : null);
  if (cmktValue != null) entry.cardmarket = cmktValue;

  if (entry.market == null) {
    entry.market = firstNumber(entry.tcgplayer, entry.cardmarket, entry.mid, entry.low, entry.high);
  }

  if (price.sampleSize != null) entry.sampleSize = price.sampleSize;

  return entry;
}

function normalizePriceList(list) {
  if (!Array.isArray(list)) return [];
  const byVariant = new Map();

  for (const price of list) {
    const entry = normalizePriceEntry(price);
    if (!entry) continue;
    const key = entry.variation || 'normal';
    const existing = byVariant.get(key);

    const sourceSnapshot = entry.provider && entry.market != null
      ? { provider: entry.provider, currency: entry.currency, market: entry.market, updatedAt: entry.updatedAt }
      : null;

    if (!existing) {
      const base = { ...entry };
      if (entry.sources) {
        base.sources = Array.isArray(entry.sources) ? [...entry.sources] : [entry.sources];
      } else if (sourceSnapshot) {
        base.sources = [sourceSnapshot];
      }
      byVariant.set(key, base);
      continue;
    }

    if (entry.tcgplayer != null) existing.tcgplayer = entry.tcgplayer;
    if (entry.cardmarket != null) existing.cardmarket = entry.cardmarket;
    if (entry.market != null && existing.market == null) existing.market = entry.market;
    if (entry.mid != null && existing.mid == null) existing.mid = entry.mid;
    if (entry.low != null && existing.low == null) existing.low = entry.low;
    if (entry.high != null && existing.high == null) existing.high = entry.high;
    if (entry.gbp != null && existing.gbp == null) existing.gbp = entry.gbp;
    if (entry.usd != null && existing.usd == null) existing.usd = entry.usd;
    if (entry.eur != null && existing.eur == null) existing.eur = entry.eur;

    const existingUpdated = existing.updatedAt ? Date.parse(existing.updatedAt) : null;
    const entryUpdated = entry.updatedAt ? Date.parse(entry.updatedAt) : null;
    if (entryUpdated != null && (existingUpdated == null || entryUpdated > existingUpdated)) {
      existing.updatedAt = entry.updatedAt;
    }

    if (entry.sources) {
      const merged = Array.isArray(existing.sources) ? existing.sources : [];
      merged.push(...(Array.isArray(entry.sources) ? entry.sources : [entry.sources]));
      existing.sources = merged;
    } else if (sourceSnapshot) {
      const merged = Array.isArray(existing.sources) ? existing.sources : [];
      merged.push(sourceSnapshot);
      existing.sources = merged;
    }
  }

  return Array.from(byVariant.values());
}

function normalizeError(err, fallback = "Search failed") {
  if (err instanceof Error) return err;
  if (typeof err === "string" && err.trim()) return new Error(err);
  try {
    return new Error(JSON.stringify(err));
  } catch {
    return new Error(fallback);
  }
}

function collectVariantList(item) {
  const variants = new Set();

  const pushVariant = (value) => {
    const key = canonicalVariantKey(value);
    if (key) variants.add(key);
  };

  if (Array.isArray(item?.variants)) {
    for (const variant of item.variants) {
      if (typeof variant === 'string') pushVariant(variant);
      else if (variant && typeof variant === 'object') pushVariant(variant.variant || variant.displayName);
    }
  }

  const priceSources = Array.isArray(item?.latestPrices) ? item.latestPrices : Array.isArray(item?.prices) ? item.prices : [];
  for (const price of priceSources) {
    if (!price) continue;
    pushVariant(price.variant || price.variation || price.displayName);
  }

  const result = Array.from(variants).filter(Boolean);
  return result.length ? result : ['normal'];
}

function canonicalCardKey(card, fallbackIndex = 0) {
  if (!card) return `card-${fallbackIndex}`;
  const id = card.cardId || card.id;
  if (id) return id;
  const setCode = card.set || card.setCode;
  const number = card.number;
  if (setCode || number) {
    const setPart = setCode ? String(setCode).toLowerCase() : 'set';
    const numPart = number ? String(number).toLowerCase() : 'card';
    return `${setPart}-${numPart}`;
  }
  if (card.name) {
    return `${String(card.name).toLowerCase()}-${fallbackIndex}`;
  }
  return `card-${fallbackIndex}`;
}

function normalizeCardsearchItem(item, index = 0) {
  if (!item) return null;

  const setRecord = item.set || {};
  const setCode = item.setCode || setRecord.code || '';
  const number = item.number || '';
  const setName = setRecord.name || item.setName || setCode || '';
  const image = item.images?.large || item.images?.small || item.image || null;
  const variations = collectVariantList(item);
  const prices = normalizePriceList(item.latestPrices ?? item.prices ?? []);
  const allowed = new Set(variations.length ? variations : ['normal']);
  const filteredPrices = prices.filter((price) => allowed.has(price.variation || 'normal'));

  const preferredId = item.cardId || item.id || (setCode && number ? `${setCode}-${number}` : null);
  const id = preferredId || `card-${index}`;

  return {
    id,
    cardId: preferredId || id,
    name: item.name || '',
    set: setCode || '',
    setCode: setCode || '',
    setName,
    number: number || '',
    image,
    tcgImageUrl: image,
    rarity: item.rarity || null,
    variations,
    prices: filteredPrices,
  };
}

function mapCardsearchItems(items) {
  if (!Array.isArray(items) || !items.length) return [];
  return items
    .map((item, index) => normalizeCardsearchItem(item, index))
    .filter(Boolean);
}

function mergeCardLists(existing, incoming) {
  const base = Array.isArray(existing) ? [...existing] : [];
  if (!Array.isArray(incoming) || incoming.length === 0) return base;

  const indexByKey = new Map();
  base.forEach((card, idx) => {
    indexByKey.set(canonicalCardKey(card, idx), idx);
  });

  incoming.forEach((card, idx) => {
    const key = canonicalCardKey(card, base.length + idx);
    if (indexByKey.has(key)) {
      base[indexByKey.get(key)] = card;
    } else {
      indexByKey.set(key, base.length);
      base.push(card);
    }
  });

  return base;
}


// A stable key for the current search params to keep separate result buckets
function makeQueryKey({ name, setCode, number }) {
  return JSON.stringify({
    name: (name || "").trim().toLowerCase(),
    set: (setCode || "").trim().toLowerCase(),
    number: (number || "").trim(),
  });
}

/* ---------------- Component ---------------- */

export default function CardSearch() {
  const { dark } = useTheme();
  const client = useApolloClient();

  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");

  // local result buckets keyed by queryKey so switching filters feels instant
  const bucketsRef = useRef(new Map()); // key -> { items, hasNextPage, totalCount, nextOffset, pageSize }
  const lastKeyRef = useRef(null);

  const [results, setResults] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedCardDetail, setSelectedCardDetail] = useState(null);
  const [showCardDetail, setShowCardDetail] = useState(false);
  const [cardDetailData, setCardDetailData] = useState(null);
  const [imageLoadedMap, setImageLoadedMap] = useState({});
  const [hasSearched, setHasSearched] = useState(false);

  const isExactCardSearch = Boolean(setCode && number);

  // throttle loadMore so we never queue two at once
  const loadingMoreRef = useRef(false);
  const loadMoreTriggerRef = useRef(null);

  const currentKey = useMemo(() => makeQueryKey({ name, setCode, number }), [name, setCode, number]);

  useEffect(() => {
    setImageLoadedMap({});
  }, [currentKey]);

  const showStatusMessage = (type, message) => {
    setStatusMessage({ type, message });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const markImageLoaded = useCallback((id) => {
    if (!id) return;
    setImageLoadedMap((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  // Kick off a small first page so something renders quickly
  const handleSearch = useCallback(async (e) => {
    if (e?.preventDefault) e.preventDefault(); 
    setHasSearched(true);

    const key = makeQueryKey({ name, setCode, number });
    lastKeyRef.current = key;
    loadingMoreRef.current = false;

    // If we already have a bucket for this query, show it immediately (stale-while-revalidate)
    const bucket = bucketsRef.current.get(key);
    if (bucket) {
      startTransition(() => {
        setResults(bucket.items);
        setHasMore(bucket.hasNextPage);
        setIsLoadingMore(false);
      });
    } else {
      startTransition(() => {
        setResults([]); // clean slate
        setHasMore(false);
        setIsLoadingMore(false);
      });
    }

    const limit = isExactCardSearch
      ? Math.min(CARDSEARCH_PAGE_SIZE, CARDSEARCH_EXACT_LIMIT)
      : CARDSEARCH_PAGE_SIZE;

    const variables = {
      input: {
        name: name || undefined,
        set: setCode || undefined,
        number: number || undefined,
        limit,
        offset: 0,
      },
    };

    setError(null);
    setLoading(true);

    try {
      const res = await client.query({
        query: CARDSEARCH_QUERY,
        variables,
        fetchPolicy: "network-only",
      });

      const payload = res?.data?.searchCards;

      if (!payload) {
        bucketsRef.current.set(key, {
          items: [],
          hasNextPage: false,
          totalCount: 0,
          nextOffset: 0,
          pageSize: limit,
        });

        if (lastKeyRef.current === key) {
          startTransition(() => {
            setResults([]);
            setHasMore(false);
            setIsLoadingMore(false);
          });
        }
        return;
      }

      const items = mapCardsearchItems(payload.items);
      const totalCount = Number(payload.total ?? payload.totalCount ?? items.length);
      const initialOffset = Number(payload.offset ?? 0);
      const nextOffset = Math.min(initialOffset + items.length, totalCount);
      const pageSize = Number(payload.limit ?? limit);
      const bucketNext = {
        items,
        hasNextPage: nextOffset < totalCount,
        totalCount,
        nextOffset,
        pageSize,
      };

      bucketsRef.current.set(key, bucketNext);

      if (lastKeyRef.current === key) {
        startTransition(() => {
          setResults(items);
          setHasMore(bucketNext.hasNextPage);
          setIsLoadingMore(false);
        });
      }
    } catch (err) {
      setError(normalizeError(err));
      if (!bucketsRef.current.get(key)) {
        startTransition(() => {
          setResults([]);
          setHasMore(false);
          setIsLoadingMore(false);
        });
      }
    } finally {
      setLoading(false);
    }
  }, [client, name, setCode, number, isExactCardSearch]);

  // Load more results using cardsearch pagination
  const loadMoreResults = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const key = lastKeyRef.current || currentKey;
      const prev = bucketsRef.current.get(key);
      const totalCount = Number(prev?.totalCount ?? 0);
      const pageSize = Number(prev?.pageSize ?? CARDSEARCH_PAGE_SIZE);
      const currentCount = Array.isArray(prev?.items) ? prev.items.length : 0;
      const nextOffset = Number(prev?.nextOffset ?? currentCount);

      if (!prev || nextOffset >= totalCount) {
        if (prev) {
          const merged = { ...prev, hasNextPage: false, nextOffset };
          bucketsRef.current.set(key, merged);
        }
        if (lastKeyRef.current === key) {
          startTransition(() => {
            setHasMore(false);
          });
        }
        return;
      }

      const vars = {
        input: {
          name: name || undefined,
          set: setCode || undefined,
          number: number || undefined,
          limit: pageSize,
          offset: nextOffset,
        },
      };

      const res = await client.query({
        query: CARDSEARCH_QUERY,
        variables: vars,
        fetchPolicy: "network-only",
      });
      const payload = res?.data?.searchCards;
      if (!payload) {
        const merged = { ...prev, hasNextPage: false, nextOffset };
        bucketsRef.current.set(key, merged);
        if (lastKeyRef.current === key) {
          startTransition(() => setHasMore(false));
        }
        return;
      }

      const newItems = mapCardsearchItems(payload.items);
      const combined = mergeCardLists(prev.items, newItems);
      const mergedTotal = Number(payload.total ?? prev.totalCount ?? combined.length);
      const mergedOffset = Math.min(nextOffset + newItems.length, mergedTotal);
      const merged = {
        ...prev,
        items: combined,
        totalCount: mergedTotal,
        nextOffset: mergedOffset,
        pageSize: Number(payload.limit ?? pageSize),
        hasNextPage: mergedOffset < mergedTotal,
      };
      bucketsRef.current.set(key, merged);

      if (lastKeyRef.current === key) {
        startTransition(() => {
          setResults(combined);
          setHasMore(merged.hasNextPage);
          setIsLoadingMore(false);
        });
      }
    } catch (err) {
      setError(normalizeError(err));
      const key = lastKeyRef.current || currentKey;
      if (key) {
        const prev = bucketsRef.current.get(key);
        const merged = prev
          ? { ...prev, hasNextPage: false }
          : { items: [], hasNextPage: false, totalCount: 0, nextOffset: 0, pageSize: CARDSEARCH_PAGE_SIZE };
        bucketsRef.current.set(key, merged);
        if (lastKeyRef.current === key) {
          startTransition(() => {
            setHasMore(false);
            setIsLoadingMore(false);
          });
        }
      }
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [client, hasMore, currentKey, name, setCode, number]);

  // Infinite scroll (simple & cheap)
  useEffect(() => {
    if (!hasMore) return;
    const node = loadMoreTriggerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadMoreResults();
        }
      });
    }, { root: null, rootMargin: '400px', threshold: 0 });

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMoreResults, results.length]);

  // Wishlist (unchanged)
  const handleAddToWishlist = async (card) => {
    const token = getCookie("authToken");
    if (!token) {
      showStatusMessage("error", "You must be logged in to add to wishlist.");
      return;
    }
    try {
      const mutation = `
        mutation AddToWishlist($cardId: String!, $variation: String) {
          addToWishlist(cardId: $cardId, variation: $variation) {
            id
            cardId
            variation
            createdAt
            updatedAt
          }
        }
      `;
      const variables = {
        cardId: card.cardId || card.id,
        variation:
          card.variation ||
          (Array.isArray(card.variations) && card.variations.length > 0 ? card.variations[0] : ""),
      };
      const res = await fetch(process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: mutation, variables }),
      });
      const json = await res.json();
      if (json.data?.addToWishlist) {
        showStatusMessage("success", `"${card.name}" was added to your wishlist!`);
      } else if (json.errors?.length) {
        showStatusMessage("error", json.errors[0].message || "Failed to add to wishlist.");
      } else {
        showStatusMessage("error", "Failed to add to wishlist.");
      }
    } catch {
      showStatusMessage("error", "Network error. Please try again.");
    }
  };

  // Card details modal
  function handleCardDetail(card) {
    const detail = {
      ...mapCardToDetail(card),
      modalImage: card.tcgImageUrl || card.image,
      prices: card.prices,
      variations: card.variations,
      pricingRaw: null,
    };
    setCardDetailData(detail);
    setShowCardDetail(true);
  }

  return (
    <div className="min-h-screen bg-light-background text-light-text dark:bg-dark-background dark:text-dark-text transition-colors">
      <div className="max-w-[1200px] mx-auto px-5 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight">Pokemon Card Search</h1>
          <p className="text-lg text-light-textMuted dark:text-dark-textMuted">
            Search for any Pokemon card and add it to your collection
          </p>
        </div>

        {/* Search Form */}
        <form
          id="card-search-form"
          onSubmit={handleSearch}
          className="bg-light-surface dark:bg-dark-surface rounded-2xl p-8 pt-8 pb-5 shadow-lg dark:shadow-[0_6px_24px_0_rgba(12,8,24,0.18)] mb-9 border border-light-border dark:border-dark-border transition-colors"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 mb-0">
            <div>
              <label className="block text-base font-medium mb-2">Card Name</label>
              <PokemonAutocomplete
                value={name}
                onChange={setName}
                onSelect={setName}
                className="w-full"
                inputClassName="w-full border rounded-xl px-4 py-3 text-base bg-light-alt dark:bg-dark-alt border-light-border dark:border-dark-border text-light-text dark:text-dark-text placeholder-light-textMuted dark:placeholder-dark-textMuted focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-base font-medium mb-2">Set</label>
              <SetAutocomplete
                value={setCode}
                onChange={setSetCode}
                onSelect={setSetCode}
                className="w-full"
                inputClassName="w-full border rounded-xl px-4 py-3 text-base bg-light-alt dark:bg-dark-alt border-light-border dark:border-dark-border text-light-text dark:text-dark-text placeholder-light-textMuted dark:placeholder-dark-textMuted focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-base font-medium mb-2">Card Number</label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Card number"
                className="w-full border rounded-xl px-4 py-3 text-base bg-light-alt dark:bg-dark-alt border-light-border dark:border-dark-border text-light-text dark:text-dark-text placeholder-light-textMuted dark:placeholder-dark-textMuted focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-light-accent dark:bg-dark-accent text-light-surface dark:text-white font-bold text-lg border-none rounded-xl px-8 py-3 shadow-md transition hover:bg-light-accentLight dark:hover:bg-dark-accentLight hover:text-light-surface dark:hover:text-white disabled:opacity-60 disabled:cursor-not-allowed w-full"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-light-error dark:text-dark-error text-center mt-4 font-medium">
              {error.message || "Search failed"}
            </div>
          )}
        </form>

        {/* Results */}
        {loading && results.length === 0 ? (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
    {Array.from({ length: 4 }).map((_, idx) => (
      <div className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow flex flex-col p-3 min-h-[300px]" key={idx}>
        <div className="w-full aspect-[245/337] bg-light-alt dark:bg-dark-alt rounded-xl mb-3 relative shimmer"></div>
        <div className="mt-2 flex flex-col gap-2">
          <div className="h-3.5 bg-light-alt dark:bg-dark-alt rounded w-full shimmer"></div>
          <div className="h-3.5 bg-light-alt dark:bg-dark-alt rounded w-3/4 shimmer"></div>
          <div className="h-3.5 bg-light-alt dark:bg-dark-alt rounded w-1/2 shimmer"></div>
        </div>
      </div>
    ))}
  </div>
  ) : results.length > 0 ? (
    <div>
      <h2 className="text-xl font-bold mb-6 ml-1">Search Results</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {results.map((card, idx) => {
          const best = getBestPrice(card.prices);
          const averagePrice = computeAveragePrice(best);
          const setKey = card.set || card.setCode || '';
          const numKey = card.number || '';
          const fallbackKey = `${setKey}-${numKey}`.trim();
          const imageKey = card.id || card.cardId || (fallbackKey && fallbackKey !== '-' ? fallbackKey : `card-${idx}`);
          const isLoaded = !!imageLoadedMap[imageKey];
          const isPriority = idx < 8;
          return (
            <div
              className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow hover:shadow-2xl flex flex-col p-3 min-h-[320px] transition border border-light-border dark:border-dark-border"
              key={imageKey}
              onClick={() => handleCardDetail(card)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleCardDetail(card);
              }}
              role="button"
              aria-label={`View details for ${card.name}`}
            >
              <div className="relative w-full aspect-[245/337] bg-light-alt dark:bg-dark-alt rounded-xl mb-3 overflow-hidden">
                <div
                  className={`absolute inset-0 rounded-xl transition-opacity duration-300 ${isLoaded ? 'opacity-0' : 'opacity-100 animate-pulse bg-gradient-to-br from-light-alt/70 via-light-surface to-light-surface dark:from-dark-alt/70 dark:via-dark-surface dark:to-dark-surface'}`}
                />
                <Image
                  src={card.tcgImageUrl || card.image}
                  alt={card.name}
                  fill
                  sizes="(max-width: 640px) 100vw,
                        (max-width: 1024px) 50vw,
                        (max-width: 1280px) 33vw,
                        25vw"
                  className={`object-contain object-center rounded-xl transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoadingComplete={() => markImageLoaded(imageKey)}
                  {...(isPriority ? { priority: true } : { loading: 'lazy' })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-base font-bold flex-1 truncate">{card.name}</span>
                  <img
                    src={getSetLogo(card.setName, card.set)}
                    alt={card.setName || "Set logo"}
                    className="w-8 h-5 rounded bg-light-alt dark:bg-dark-alt"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = FALLBACK_SYMBOL_IMAGE;
                    }}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="flex justify-between text-sm text-light-textMuted dark:text-dark-textMuted">
                  <span className="whitespace-nowrap">{card.setName}</span>
                  <span className="font-semibold">#{card.number}</span>
                </div>

                <div className="flex gap-3 text-sm my-1">
                  <div>
                    <span className="font-bold text-light-accent dark:text-dark-accent">Average</span>
                    <span className="font-semibold ml-1 text-light-text dark:text-dark-text">
                      {formatGBP(averagePrice)}
                    </span>
                  </div>
                  {best?.variation && best.variation !== "normal" ? (
                    <span className="ml-1 text-xs text-light-textMuted dark:text-dark-textMuted">
                      ({formatVariation(best.variation)})
                    </span>
                  ) : null}
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCardDetail(card);
                      setPanelOpen(true);
                    }}
                    className="rounded-lg px-4 py-2 bg-light-accent dark:bg-dark-accent text-light-surface dark:text-dark-surface font-semibold hover:bg-light-accentLight dark:hover:bg-dark-accentLight hover:text-light-surface dark:hover:text-dark-surface transition"
                  >
                    Add
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToWishlist(card);
                    }}
                    className="rounded-lg px-4 py-2 border-2 border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent font-semibold hover:bg-light-accent dark:hover:bg-dark-accent hover:text-light-surface dark:hover:text-dark-surface transition"
                  >
                    Wishlist
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div ref={loadMoreTriggerRef} aria-hidden="true" />
      {(hasMore || isLoadingMore) && (
        <div className="flex items-center justify-center gap-4 mt-12 mb-4 text-lg text-light-textMuted dark:text-dark-textMuted">
          {isLoadingMore ? (
            <>
              <span className="inline-block w-[22px] h-[22px] border-4 border-light-accent dark:border-dark-accent border-r-transparent rounded-full animate-spin"></span>
              Loading more cards...
            </>
          ) : (
            <span>Scroll to load more cards</span>
          )}
        </div>
      )}
    </div>
  ) : (
    <div>
      {/* Show "No results" ONLY after a search has been attempted */}
      {hasSearched && (
        <div className="text-center text-light-textMuted dark:text-dark-textMuted text-lg py-8">
          No results found. Try adjusting your search criteria.
        </div>
      )}

      {/* Skeletons are intentionally always shown in this branch */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <CardSkeleton
            key={idx}
            dark={dark}
            message={!hasSearched ? "No cards yet\nTry searching for a PokÃ©mon, set, or number" : undefined}
            actionLabel={!hasSearched ? "Search cards" : undefined}
          />
        ))}
      </div>
    </div>
  )}

        {/* Add & Status Panels */}
        {panelOpen && selectedCardDetail && (
          <AddToCollectionPanel cardDetail={selectedCardDetail} onClose={() => setPanelOpen(false)} />
        )}

        {/* Status Message */}
        <div className="fixed top-5 right-5 z-50">
          {statusMessage && (
            <StatusMessage
              type={statusMessage.type}
              message={statusMessage.message}
              onClose={() => setStatusMessage(null)}
            />
          )}
        </div>

        {/* Card Details Modal */}
        {showCardDetail && cardDetailData && (
          <CardDetailsModal card={cardDetailData} onClose={() => setShowCardDetail(false)} dark={dark} />
        )}
      </div>
    </div>
  );
}



// frontend/src/pages/search.js
// Batch Add to Collection workbench, now using the same cardsearch
// paging strategy as src/components/Collection/CardSearch.js
//
// UPDATED:
// - Replaced legacy addToCollection mutation + AddToCollectionInput with cardsearchBulkAddToCollection (CardsearchBulkAddInput)
// - Switched handleAddAllToCollection to submit ONE bulk request (much faster, fewer network calls)
// - Added per-item error handling + lightweight UI feedback (no blocking alerts)
// - Kept existing selection logic intact
// - NEW: Added StatusMessage toast feedback for search + preset + bulk-add success/failures

"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  startTransition,
  useEffect,
} from "react";
import { gql, useLazyQuery, useMutation } from "@apollo/client";
import Image from "next/image";

import Layout from "@/components/Layout/Layout";
import PokemonAutocomplete from "@/components/Collection/SearchComponents/PokemonAutocomplete";
import SetAutocomplete from "@/components/Collection/SearchComponents/SetAutocomplete";
import AdvancedFilters from "@/components/Collection/SearchComponents/AdvancedFilters";
import StatusMessage from "@/components/UI/StatusMessage"; // NEW: Toast UI
import { getSetLogo } from "@/utils/setLogos";
import { formatVariation } from "@/utils/formatVariation";

// ---------------- GraphQL: cardsearch module ----------------

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
        images {
          large
        }
        set {
          code
          name
        }
        variants {
          key
          default
          label
        }
        latestPrices {
          variation
          currency
          gbp
          market
          mid
          low
          high
          updatedAt
          provider
        }
      }
    }
  }
`;

// UPDATED: use new bulk-add mutation from cardsearch module
const CARDSEARCH_BULK_ADD_TO_COLLECTION = gql`
  mutation CardsearchBulkAddToCollection($input: CardsearchBulkAddInput!) {
    cardsearchBulkAddToCollection(input: $input) {
      ok
      message
      items {
        cardId
        quantity
        created
        previousQuantity
        newQuantity
        error
      }
    }
  }
`;

const FALLBACK_SYMBOL_IMAGE = "https://placehold.co/50x50/webp?text=Icon";
const GBP_SYMBOL = "\u00A3";

// Match the main CardSearch paging behaviour
const CARDSEARCH_PAGE_SIZE = 48;
const CARDSEARCH_EXACT_LIMIT = 12;

// ---------------- Helpers ----------------

function pos(n) {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function pickDisplayPrice(entry) {
  if (!entry) return null;
  if (pos(entry.gbp)) return entry.gbp;
  if (pos(entry.market)) return entry.market;
  if (pos(entry.mid)) return entry.mid;
  if (pos(entry.low)) return entry.low;
  if (pos(entry.high)) return entry.high;
  return null;
}

function getBestPriceRow(prices) {
  if (!Array.isArray(prices) || prices.length === 0) return null;
  const pref = ["normal", "holofoil", "reverseHolofoil"];
  for (const key of pref) {
    const row = prices.find(
      (p) =>
        (p?.variation || "").toLowerCase() === key.toLowerCase() &&
        pickDisplayPrice(p) != null
    );
    if (row) return row;
  }
  return prices.find((p) => pickDisplayPrice(p) != null) || null;
}

function formatGBP(value) {
  if (value == null || Number.isNaN(value)) return `${GBP_SYMBOL}--`;
  return `${GBP_SYMBOL}${Number(value).toFixed(2)}`;
}

function mapCardsearchItems(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((it, idx) => {
    const setRecord = it.set || {};
    const setCode = it.setCode || setRecord.code || "";
    const number = it.number || "";
    const id =
      it.cardId ||
      it.id ||
      (setCode && number ? `${setCode}-${number}` : `card-${idx}`);
    const image = it.images?.large || null;

    const variants = Array.isArray(it.variants)
      ? it.variants.map((v) =>
          typeof v === "string" ? v : v?.key || v?.label || "normal"
        )
      : ["normal"];

    return {
      id,
      cardId: id,
      name: it.name || "",
      set: setCode,
      setCode,
      setName: setRecord.name || setCode || "",
      number,
      image,
      tcgImageUrl: image,
      rarity: it.rarity || null,
      variations: variants,
      prices: Array.isArray(it.latestPrices) ? it.latestPrices : [],
    };
  });
}

// Same key + merge logic as CardSearch for deduped paging
function canonicalCardKey(card, fallbackIndex = 0) {
  if (!card) return `card-${fallbackIndex}`;
  const id = card.cardId || card.id;
  if (id) return id;
  const setCode = card.set || card.setCode;
  const number = card.number;
  if (setCode || number) {
    const setPart = setCode ? String(setCode).toLowerCase() : "set";
    const numPart = number ? String(number).toLowerCase() : "card";
    return `${setPart}-${numPart}`;
  }
  if (card.name) {
    return `${String(card.name).toLowerCase()}-${fallbackIndex}`;
  }
  return `card-${fallbackIndex}`;
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

function makeQueryKey({ name, setCode, number }) {
  return JSON.stringify({
    name: (name || "").trim().toLowerCase(),
    set: (setCode || "").trim().toLowerCase(),
    number: (number || "").trim(),
  });
}

// Filters + sort (same as CardSearch.js AdvancedFilters)
function applyFiltersAndSort(cards, filters) {
  if (!Array.isArray(cards) || cards.length === 0 || !filters) return cards;

  const {
    minPrice,
    maxPrice,
    rarities,
    variations,
    sortBy,
    onlyHasPrices,
    onlyHasReverse,
  } = filters;

  const min = minPrice !== "" ? parseFloat(minPrice) : null;
  const max = maxPrice !== "" ? parseFloat(maxPrice) : null;

  const raritySet = new Set(rarities || []);
  const variationSet = new Set(variations || []);

  const hasRarityFilter = raritySet.size > 0;
  const hasVariationFilter = variationSet.size > 0;

  const rarityOrder = {
    Common: 1,
    "Common ": 1,
    Uncommon: 2,
    Rare: 3,
    "Double rare": 4,
    "Ultra rare": 5,
    "Illustration rare": 6,
    "Special Illustration Rare": 7,
    "Hyper rare": 8,
  };

  let filtered = cards.filter((card) => {
    const bestRow = getBestPriceRow(card.prices);
    const price = pickDisplayPrice(bestRow);

    if (onlyHasPrices && (price == null || Number.isNaN(price))) {
      return false;
    }

    if (min != null && price != null && price < min) return false;
    if (max != null && price != null && price > max) return false;

    if (hasRarityFilter) {
      const r = card.rarity || "";
      if (!raritySet.has(r)) return false;
    }

    if (onlyHasReverse) {
      const hasReverse =
        Array.isArray(card.variations) &&
        card.variations.some((v) => String(v).toLowerCase().includes("reverse"));
      if (!hasReverse) return false;
    }

    if (hasVariationFilter) {
      const hasAny =
        Array.isArray(card.variations) &&
        card.variations.some((v) => variationSet.has(v));
      if (!hasAny) return false;
    }

    return true;
  });

  if (!sortBy || sortBy === "relevance") {
    return filtered;
  }

  const sorted = [...filtered];

  sorted.sort((a, b) => {
    const aBest = getBestPriceRow(a.prices);
    const bBest = getBestPriceRow(b.prices);
    const aPrice = pickDisplayPrice(aBest);
    const bPrice = pickDisplayPrice(bBest);

    const aRarity = a.rarity || "";
    const bRarity = b.rarity || "";
    const aRarityRank = rarityOrder[aRarity] ?? 999;
    const bRarityRank = rarityOrder[bRarity] ?? 999;

    const aNum = parseInt(a.number, 10);
    const bNum = parseInt(b.number, 10);

    switch (sortBy) {
      case "price-asc": {
        if (aPrice == null && bPrice == null) return 0;
        if (aPrice == null) return 1;
        if (bPrice == null) return -1;
        return aPrice - bPrice;
      }
      case "price-desc": {
        if (aPrice == null && bPrice == null) return 0;
        if (aPrice == null) return 1;
        if (bPrice == null) return -1;
        return bPrice - aPrice;
      }
      case "rarity-asc":
        return aRarityRank - bRarityRank || aRarity.localeCompare(bRarity);
      case "rarity-desc":
        return bRarityRank - aRarityRank || bRarity.localeCompare(aRarity);
      case "number-asc": {
        if (Number.isNaN(aNum) && Number.isNaN(bNum)) return 0;
        if (Number.isNaN(aNum)) return 1;
        if (Number.isNaN(bNum)) return -1;
        return aNum - bNum;
      }
      case "number-desc": {
        if (Number.isNaN(aNum) && Number.isNaN(bNum)) return 0;
        if (Number.isNaN(aNum)) return 1;
        if (Number.isNaN(bNum)) return -1;
        return bNum - aNum;
      }
      case "name-asc":
        return String(a.name).localeCompare(String(b.name));
      case "name-desc":
        return String(b.name).localeCompare(String(a.name));
      default:
        return 0;
    }
  });

  return sorted;
}

// Helper to merge cards into the selection without clobbering existing quantities
function selectIntoBatch(prevSelection, cards, predicate) {
  const next = { ...prevSelection };

  cards.forEach((card, idx) => {
    if (predicate && !predicate(card)) return;

    const key =
      card.cardId ||
      card.id ||
      `${card.setCode || "UNK"}-${card.number || "0"}-${idx}`;

    if (!key) return;

    // Don’t stomp existing quantities – if user already adjusted, leave it.
    if (!next[key]) {
      next[key] = { card, quantity: 1 };
    }
  });

  return next;
}

// -----------------------------------------------------------------------------
// Main page component
// -----------------------------------------------------------------------------

// Keep initial filters in one place so reset is easy
const INITIAL_FILTERS = {
  minPrice: "",
  maxPrice: "",
  rarities: [],
  variations: [],
  sortBy: "relevance",
  onlyHasPrices: false,
  onlyHasReverse: false,
};

export default function CardSearchWorkbenchPage() {
  // Search fields (same as CardSearch.js)
  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");

  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Existing submission feedback (kept for item-level details)
  const [submitResult, setSubmitResult] = useState(null);
  const [submitErrors, setSubmitErrors] = useState([]);

  // NEW: Toast feedback state (StatusMessage)
  const [toast, setToast] = useState(null);

  // Bucketed paging & infinite scroll (same shape as CardSearch)
  const bucketsRef = useRef(new Map());
  const lastKeyRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const loadMoreTriggerRef = useRef(null);
  const observerRef = useRef(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const isExactCardSearch = useMemo(
    () => Boolean(setCode && number),
    [setCode, number]
  );

  const [runSearch, { loading, fetchMore }] = useLazyQuery(CARDSEARCH_QUERY, {
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
    returnPartialData: false,
  });

  // Selection state
  const [selectedCards, setSelectedCards] = useState({});

  // UPDATED: bulk mutation hook
  const [bulkAddToCollection, { loading: adding }] = useMutation(
    CARDSEARCH_BULK_ADD_TO_COLLECTION
  );

  // NEW: tiny helper to show a toast consistently
  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  const availableRarities = useMemo(() => {
    const s = new Set();
    results.forEach((card) => {
      if (card.rarity) s.add(card.rarity);
    });
    return Array.from(s).sort();
  }, [results]);

  const availableVariations = useMemo(() => {
    const s = new Set();
    results.forEach((card) => {
      if (Array.isArray(card.variations)) {
        card.variations.forEach((v) => v && s.add(v));
      }
    });
    return Array.from(s).sort();
  }, [results]);

  const filteredResults = useMemo(
    () => applyFiltersAndSort(results, filters),
    [results, filters]
  );

  const hasResults = filteredResults.length > 0;

  const currentKey = useMemo(
    () => makeQueryKey({ name, setCode, number }),
    [name, setCode, number]
  );

  const disconnectObserver = useCallback(() => {
    if (observerRef.current) {
      try {
        observerRef.current.disconnect();
      } catch {
        // ignore
      }
      observerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Reset error/loading when the query fields change
    setSearchError(null);
    setSubmitting(false);
    loadingMoreRef.current = false;

    // Clear submit feedback when changing search params
    setSubmitResult(null);
    setSubmitErrors([]);

    // NEW: clear toast when changing query params (prevents stale messages)
    setToast(null);
  }, [name, setCode, number]);

  const handleSearch = useCallback(
    async (e) => {
      if (e?.preventDefault) e.preventDefault();
      setHasSearched(true);

      const key = makeQueryKey({ name, setCode, number });
      lastKeyRef.current = key;
      loadingMoreRef.current = false;

      // Reset intersection observer so new search starts fresh
      disconnectObserver();

      const bucket = bucketsRef.current.get(key);
      if (bucket) {
        startTransition(() => {
          setResults(bucket.items);
          setHasMore(bucket.hasNextPage);
          setIsLoadingMore(false);
        });
      } else {
        startTransition(() => {
          setResults([]);
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

      setSearchError(null);
      setSubmitting(true);
      try {
        const res = await runSearch({
          variables,
          context: { queryDeduplication: false },
        });
        const payload = res?.data?.searchCards;
        if (!payload) {
          if (bucket) setHasMore(bucket.hasNextPage);
          return;
        }

        const items = mapCardsearchItems(payload.items);
        const totalCount = Number(payload.total ?? items.length);
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
        setSearchError(err instanceof Error ? err : new Error(String(err)));

        // NEW: Toast feedback for search failure
        showToast("error", "Search failed. Please try again.");

        if (bucket) setHasMore(bucket.hasNextPage);
      } finally {
        setSubmitting(false);
      }
    },
    [
      name,
      setCode,
      number,
      runSearch,
      isExactCardSearch,
      disconnectObserver,
      showToast,
    ]
  );

  const loadMoreResults = useCallback(
    async () => {
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
            startTransition(() => setHasMore(false));
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

        const res = await fetchMore({ variables: vars });
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
        const mergedTotal = Number(
          payload.total ?? prev.totalCount ?? combined.length
        );
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
        setSearchError(err instanceof Error ? err : new Error(String(err)));

        // NEW: Toast feedback for paging error (non-blocking)
        showToast("error", "Couldn’t load more cards. Please try again.");

        const key = lastKeyRef.current || currentKey;
        if (key) {
          const prev = bucketsRef.current.get(key);
          const merged = prev
            ? { ...prev, hasNextPage: false }
            : {
                items: [],
                hasNextPage: false,
                totalCount: 0,
                nextOffset: 0,
                pageSize: CARDSEARCH_PAGE_SIZE,
              };
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
    },
    [fetchMore, hasMore, currentKey, name, setCode, number, showToast]
  );

  // Set up infinite scroll observer like CardSearch
  useEffect(() => {
    if (!hasMore) {
      disconnectObserver();
      return;
    }
    const node = loadMoreTriggerRef.current;
    if (!node) return;

    disconnectObserver();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadMoreResults();
          }
        });
      },
      { root: null, rootMargin: "400px", threshold: 0 }
    );

    observerRef.current = observer;
    observer.observe(node);
    return () => disconnectObserver();
  }, [
    hasMore,
    loadMoreResults,
    filteredResults.length,
    currentKey,
    disconnectObserver,
  ]);

  // Reset search + filters (does NOT clear selection)
  const handleResetSearch = () => {
    setName("");
    setSetCode("");
    setNumber("");
    setFilters(INITIAL_FILTERS);
    setResults([]);
    setHasSearched(false);
    setSearchError(null);
    setHasMore(false);
    setIsLoadingMore(false);
    bucketsRef.current.clear();
    lastKeyRef.current = null;
    disconnectObserver();

    // Clear submit feedback
    setSubmitResult(null);
    setSubmitErrors([]);

    // NEW: clear toast
    setToast(null);
  };

  const handleCardSelect = useCallback((card) => {
    setSelectedCards((prev) => {
      const key = card.cardId || card.id;
      const existing = prev[key];
      const nextQty = existing ? existing.quantity + 1 : 1;
      return {
        ...prev,
        [key]: { card, quantity: nextQty },
      };
    });
  }, []);

  const handleQuantityChange = (key, quantity) => {
    setSelectedCards((prev) => {
      if (!prev[key]) return prev;
      const q = Math.max(0, Number(quantity) || 0);
      if (q === 0) {
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }
      return {
        ...prev,
        [key]: { ...prev[key], quantity: q },
      };
    });
  };

  const handleRemove = (key) => {
    setSelectedCards((prev) => {
      if (!prev[key]) return prev;
      const clone = { ...prev };
      delete clone[key];
      return clone;
    });
  };

  const handleClearAll = () => {
    if (Object.keys(selectedCards).length === 0) return;

    // UPDATED: no blocking confirm — treat as intentional UI action
    setSelectedCards({});
    setSubmitResult(null);
    setSubmitErrors([]);

    // NEW: small feedback toast
    showToast("info", "Selection cleared.");
  };

  const selectedList = useMemo(
    () => Object.values(selectedCards),
    [selectedCards]
  );

  const selectedCount = selectedList.length;
  const totalQuantity = selectedList.reduce(
    (sum, entry) => sum + (entry.quantity || 0),
    0
  );

  // Estimated batch value (for display only)
  const estimatedBatchValue = useMemo(() => {
    return selectedList.reduce((sum, entry) => {
      const { card, quantity } = entry;
      const bestRow = getBestPriceRow(card.prices);
      const unit = pickDisplayPrice(bestRow);
      if (!unit || !quantity) return sum;
      return sum + unit * quantity;
    }, 0);
  }, [selectedList]);

  // Helper to fully load a set bucket (used by smart presets)
  const loadAllPagesForKey = useCallback(
    async (key, baseInput) => {
      let bucket = bucketsRef.current.get(key);

      if (!bucket) {
        const limit = CARDSEARCH_PAGE_SIZE;
        const res = await runSearch({
          variables: {
            input: { ...baseInput, limit, offset: 0 },
          },
          context: { queryDeduplication: false },
        });
        const payload = res?.data?.searchCards;
        const itemsRaw = payload?.items || [];
        const items = mapCardsearchItems(itemsRaw);
        const totalCount = Number(payload?.total ?? items.length);
        const initialOffset = Number(payload?.offset ?? 0);
        const nextOffset = Math.min(initialOffset + items.length, totalCount);
        const pageSize = Number(payload?.limit ?? limit);

        bucket = {
          items,
          hasNextPage: nextOffset < totalCount,
          totalCount,
          nextOffset,
          pageSize,
        };
        bucketsRef.current.set(key, bucket);
      }

      // Pull remaining pages using the same fetchMore logic
      while (bucket.hasNextPage) {
        const res = await fetchMore({
          variables: {
            input: {
              ...baseInput,
              limit: bucket.pageSize,
              offset: bucket.nextOffset,
            },
          },
        });
        const payload = res?.data?.searchCards;
        if (!payload) {
          bucket = { ...bucket, hasNextPage: false };
          bucketsRef.current.set(key, bucket);
          break;
        }

        const newItems = mapCardsearchItems(payload.items);
        const combined = mergeCardLists(bucket.items, newItems);
        const mergedTotal = Number(
          payload.total ?? bucket.totalCount ?? combined.length
        );
        const mergedOffset = Math.min(
          bucket.nextOffset + newItems.length,
          mergedTotal
        );
        bucket = {
          ...bucket,
          items: combined,
          totalCount: mergedTotal,
          nextOffset: mergedOffset,
          pageSize: Number(payload.limit ?? bucket.pageSize),
          hasNextPage: mergedOffset < mergedTotal,
        };
        bucketsRef.current.set(key, bucket);
      }

      if (lastKeyRef.current === key) {
        startTransition(() => {
          setResults(bucket.items);
          setHasMore(bucket.hasNextPage);
          setIsLoadingMore(false);
        });
      }

      return bucket.items;
    },
    [runSearch, fetchMore]
  );

  // SMART PRESETS -----------------------------------------------------------

  // Fetch all cards for the current set (all pages) using the same paging method.
  const fetchSetCards = useCallback(async () => {
    if (!setCode) return [];
    const key = makeQueryKey({ name: "", setCode, number: "" });
    lastKeyRef.current = key;
    const baseInput = { set: setCode };
    const items = await loadAllPagesForKey(key, baseInput);
    return items;
  }, [setCode, loadAllPagesForKey, number]);

  const handlePresetFullSet = useCallback(async () => {
    if (!setCode) {
      // NEW: toast feedback instead of only inline submitResult
      showToast("info", "Pick a set first to use this preset.");
      setSubmitResult({
        ok: false,
        message: "Pick a set first to use this preset.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const cards = await fetchSetCards();
      if (!cards.length) return;

      setSelectedCards((prev) => selectIntoBatch(prev, cards, () => true));
      showToast("success", `Added ${setCode} set cards to selection.`);
    } catch (err) {
      console.error(err);
      setSearchError(err instanceof Error ? err : new Error(String(err)));
      showToast("error", "Preset failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [setCode, fetchSetCards, showToast]);

  const handlePresetCommonsUncommons = useCallback(async () => {
    if (!setCode) {
      showToast("info", "Pick a set first to use this preset.");
      setSubmitResult({
        ok: false,
        message: "Pick a set first to use this preset.",
      });
      return;
    }

    const allowed = new Set(["Common", "Uncommon", "Common ", "Uncommon "]);

    setSubmitting(true);
    try {
      const cards = await fetchSetCards();
      if (!cards.length) return;

      setSelectedCards((prev) =>
        selectIntoBatch(prev, cards, (card) => allowed.has(card.rarity))
      );
      showToast("success", "Added Commons / Uncommons to selection.");
    } catch (err) {
      console.error(err);
      setSearchError(err instanceof Error ? err : new Error(String(err)));
      showToast("error", "Preset failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [setCode, fetchSetCards, showToast]);

  const handlePresetAddVisibleResults = useCallback(() => {
    if (!filteredResults.length) return;

    setSelectedCards((prev) =>
      selectIntoBatch(prev, filteredResults, () => true)
    );

    // NEW: toast feedback
    showToast("success", "Added visible results to selection.");
  }, [filteredResults, showToast]);

  // "Select all results" in the Results section (uses currently visible filteredResults)
  const handleSelectAllVisible = useCallback(() => {
    if (!filteredResults.length) return;
    setSelectedCards((prev) =>
      selectIntoBatch(prev, filteredResults, () => true)
    );

    // NEW: toast feedback
    showToast("success", "Selected all visible results.");
  }, [filteredResults, showToast]);

  // UPDATED: Submit as ONE bulk mutation call
  const handleAddAllToCollection = async () => {
    if (selectedList.length === 0) return;

    setSubmitResult(null);
    setSubmitErrors([]);

    const items = selectedList
      .map((entry) => {
        const { card, quantity } = entry;
        const cardId = card?.cardId || card?.id || null;
        const qty = Number(quantity || 0);
        if (!cardId || !Number.isFinite(qty) || qty <= 0) return null;
        return { cardId, quantity: qty };
      })
      .filter(Boolean);

    if (!items.length) {
      const msg = "No valid items to add (missing cardIds or quantities).";
      setSubmitResult({ ok: false, message: msg });
      showToast("warning", msg); // NEW
      return;
    }

    try {
      const res = await bulkAddToCollection({
        variables: {
          input: {
            cards: items,
          },
        },
      });

      const payload = res?.data?.cardsearchBulkAddToCollection;
      const ok = Boolean(payload?.ok);
      const message =
        payload?.message ||
        (ok ? "Added to collection." : "Completed with errors.");

      const itemErrors = Array.isArray(payload?.items)
        ? payload.items.filter((x) => x?.error)
        : [];

      setSubmitResult({ ok, message });

      if (itemErrors.length) {
        setSubmitErrors(itemErrors);
      }

      // NEW: Toast feedback for bulk add outcomes
      if (ok && itemErrors.length === 0) {
        showToast("success", message || "All cards added to your collection.");
      } else if (ok && itemErrors.length > 0) {
        showToast(
          "warning",
          `Added with ${itemErrors.length} issue(s). Some cards need attention.`
        );
      } else {
        showToast("error", message || "Failed to add cards to your collection.");
      }

      // If fully OK, clear selection. If partial errors, keep selection so user can retry.
      if (ok && itemErrors.length === 0) {
        setSelectedCards({});
      }
    } catch (err) {
      console.error(err);
      const msg = err?.message || "Something went wrong while adding cards.";
      setSubmitResult({ ok: false, message: msg });

      // NEW: toast feedback
      showToast("error", msg);
    }
  };

  // -------------------------------------------------------------------------
  // Layout: top search card, bottom 70/30 results vs selection
  // -------------------------------------------------------------------------

  return (
    <Layout title="Batch Add to Collection">
      {/* NEW: Toast mounted once at page level */}
      {toast && (
        <StatusMessage
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <div className="bg-[#0b0d16] text-white">
        <main className="mx-auto max-w-7xl px-4 py-6 space-y-4">
          {/* TOP: Search + Advanced Filters */}
          <section className="w-full rounded-2xl bg-[#131523] p-5 shadow-lg">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold">Batch Add to Collection</h1>
                <p className="mt-1 text-xs text-gray-400">
                  Power search for cards, build up a selection from multiple
                  searches, then add everything to your collection in one go.
                </p>
              </div>

              <div className="flex flex-col gap-1 rounded-xl bg-[#0b0d16] px-3 py-2 text-[11px] text-gray-300 sm:flex-row sm:items-center sm:justify-end">
                <span
                  className="
                    inline-flex
                    items-center
                    justify-center
                    rounded-full
                    border border-[#2b3258]
                    bg-[#0b0d16]/80
                    px-3
                    text-[10px]
                    font-semibold
                    tracking-[0.16em]
                    text-[#c4d0ff]
                    h-8
                    leading-none
                    text-center
                  "
                >
                  BULK UPDATE MODE
                </span>
                <span className="sm:ml-2">
                  Use this when you&apos;re logging a new binder, a recent
                  purchase, or a trade and want to add lots of cards across
                  multiple sets.
                </span>
              </div>
            </div>

            <form
              onSubmit={handleSearch}
              className="space-y-4 text-sm"
              id="card-search-workbench-form"
            >
              {/* Name | Set | Number | Search / primary actions */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {/* Name */}
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                    Card Name
                  </label>
                  <PokemonAutocomplete
                    value={name}
                    onChange={setName}
                    onSelect={setName}
                    className="w-full"
                    inputClassName="w-full rounded-lg bg-[#0b0d16] px-3 py-2 text-sm outline-none ring-1 ring-[#232642] placeholder:text-gray-500 focus:ring-[#2963ff]"
                  />
                </div>

                {/* Set */}
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                    Set
                  </label>
                  <SetAutocomplete
                    value={setCode}
                    onChange={setSetCode}
                    onSelect={setSetCode}
                    className="w-full"
                    inputClassName="w-full rounded-lg bg-[#0b0d16] px-3 py-2 text-sm outline-none ring-1 ring-[#232642] placeholder:text-gray-500 focus:ring-[#2963ff]"
                  />
                </div>

                {/* Number */}
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                    Card Number
                  </label>
                  <input
                    type="text"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="e.g. 012, 151"
                    className="
                      w-full border-[1.5px] rounded-xl px-4 py-3 text-base
                      bg-light-alt dark:bg-dark-alt
                      border-light-border dark:border-dark-border
                      text-light-text dark:text-dark-text
                      focus:border-light-accent dark:focus:border-dark-accent
                      focus:outline-none transition
                    "
                  />
                </div>

                {/* Search + Reset buttons */}
                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    disabled={submitting || loading}
                    className="
                      w-full rounded-xl bg-[#2963ff] px-4 py-3 text-base font-semibold text-white
                      shadow-md transition hover:bg-[#548dff] disabled:opacity-60
                    "
                  >
                    {submitting || loading ? "Searching..." : "Search"}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetSearch}
                    className="
                      rounded-xl border border-light-border dark:border-dark-border
                      px-4 py-3 text-base text-light-text dark:text-dark-text
                      hover:border-light-accent dark:hover:border-dark-accent
                      transition
                    "
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* SMART PRESETS – only show when a set is selected */}
              {setCode && (
                <div className="mt-3 rounded-lg bg-[#0b0f1d] px-3 py-2 text-[11px] text-gray-300">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500">
                      Smart presets for {setCode}
                    </span>
                    {hasResults && (
                      <button
                        type="button"
                        onClick={handlePresetAddVisibleResults}
                        className="rounded-full border border-[#232642] bg-transparent px-3 py-1 text-[11px] text-gray-200 transition hover:border-[#2963ff] hover:text-white"
                      >
                        Add all current results to selection
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handlePresetFullSet}
                      disabled={submitting || loading}
                      className="rounded-full bg-[#2963ff] px-3 py-1 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#548dff] disabled:opacity-60"
                    >
                      Add 1x of every card in {setCode}
                    </button>
                    <button
                      type="button"
                      onClick={handlePresetCommonsUncommons}
                      disabled={submitting || loading}
                      className="rounded-full border border-[#232642] bg-[#0b0d16] px-3 py-1 text-[11px] font-medium text-gray-200 transition hover:border-[#2963ff] hover:text-white disabled:opacity-60"
                    >
                      Add 1x of each Common / Uncommon
                    </button>
                  </div>

                  <p className="mt-1 text-[10px] text-gray-500">
                    These presets use live data for {setCode}. You can tweak
                    quantities or remove cards in your batch before saving them
                    to your collection.
                  </p>
                </div>
              )}

              {/* Advanced filters row */}
              <div className="mt-4 border-t border-[#232642] pt-3">
                <AdvancedFilters
                  filters={filters}
                  onChange={setFilters}
                  availableRarities={availableRarities}
                  availableVariations={availableVariations}
                />
              </div>

              {searchError && (
                <p className="mt-2 text-xs text-red-400" role="alert">
                  {searchError.message || "Search failed"}
                </p>
              )}

              {/* NOTE: Kept item-level submit details for debugging + retry flow */}
              {submitResult && (
                <div
                  className={`mt-3 rounded-lg px-3 py-2 text-[11px] ${
                    submitResult.ok
                      ? "bg-[#0f1a2e] text-[#c4d0ff]"
                      : "bg-[#2a1114] text-[#ffb4b4]"
                  }`}
                  role="status"
                >
                  <div className="font-semibold">
                    {submitResult.ok
                      ? "Collection updated"
                      : "Collection update failed"}
                  </div>
                  <div className="mt-0.5 opacity-90">{submitResult.message}</div>

                  {submitErrors.length > 0 && (
                    <div className="mt-2">
                      <div className="font-semibold">Some items failed:</div>
                      <ul className="mt-1 list-disc pl-4 space-y-1">
                        {submitErrors.slice(0, 8).map((it) => (
                          <li key={`${it.cardId}-${it.error}`}>
                            <span className="font-semibold">{it.cardId}</span>:{" "}
                            {it.error}
                          </li>
                        ))}
                        {submitErrors.length > 8 && (
                          <li>…and {submitErrors.length - 8} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </form>
          </section>

          {/* BOTTOM: Results (70) + Selected (30) */}
          <section className="flex flex-col gap-4 lg:flex-row">
            {/* Results */}
            <div className="min-h-[400px] flex-1 rounded-2xl bg-[#131523] p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">Results</h2>
                  <div className="text-xs text-gray-400">
                    {loading && "Searching..."}
                    {searchError && !loading && "Error loading cards"}
                    {!loading &&
                      !searchError &&
                      hasResults &&
                      `Showing ${filteredResults.length} of ${results.length} cards`}
                    {!loading &&
                      !searchError &&
                      hasSearched &&
                      !hasResults &&
                      "No results"}
                  </div>
                </div>

                {/* Select-all button for visible results */}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    disabled={!hasResults}
                    className="rounded-full border border-[#232642] bg-[#0b0d16] px-3 py-1 text-[11px] font-medium text-gray-200 transition hover:border-[#2963ff] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Select all results
                  </button>
                </div>
              </div>

              <div className="grid max-h-[calc(100vh-320px)] flex-1 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                {filteredResults.map((card, idx) => {
                  const key =
                    card.cardId || card.id || `${card.setCode}-${card.number}-${idx}`;
                  const inSelection = !!selectedCards[key];
                  const selectedQty = selectedCards[key]?.quantity ?? 0;
                  const bestRow = getBestPriceRow(card.prices);
                  const displayPrice = pickDisplayPrice(bestRow);

                  return (
                    <article
                      key={key}
                      className="group flex flex-col rounded-xl bg-[#0b0d16] p-2 ring-1 ring-transparent transition hover:ring-[#2963ff]/60"
                    >
                      <div className="relative mb-2 aspect-[3/4] overflow-hidden rounded-lg bg-black/40">
                        {card.tcgImageUrl || card.image ? (
                          <Image
                            src={card.tcgImageUrl || card.image}
                            alt={card.name}
                            fill
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col justify-between text-xs">
                        <div className="mb-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="line-clamp-2 font-medium">
                              {card.name}
                            </div>
                            <img
                              src={getSetLogo(card.setName, card.setCode)}
                              alt={card.setName || "Set logo"}
                              className="h-5 w-8 rounded bg-[#1b1e33]"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = FALLBACK_SYMBOL_IMAGE;
                              }}
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                          <div className="mt-1 flex justify-between text-[11px] text-gray-400">
                            <span className="truncate">{card.setName}</span>
                            <span className="font-semibold">#{card.number}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px]">
                            <span className="font-semibold">
                              {formatGBP(displayPrice)}
                            </span>
                            {bestRow?.variation &&
                              bestRow.variation !== "normal" && (
                                <span className="text-gray-400">
                                  ({formatVariation(bestRow.variation)})
                                </span>
                              )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCardSelect(card)}
                          className={`mt-1 w-full rounded-lg px-2 py-1 text-xs font-medium transition ${
                            inSelection
                              ? "bg-[#2963ff] text-white"
                              : "bg-[#1b1e33] text-gray-200"
                          }`}
                        >
                          {inSelection
                            ? `Selected (${selectedQty})`
                            : "Add to selection"}
                        </button>
                      </div>
                    </article>
                  );
                })}

                {!loading && !searchError && hasSearched && !hasResults && (
                  <div className="col-span-full flex items-center justify-center text-sm text-gray-400">
                    No cards match your search. Try changing the filters.
                  </div>
                )}

                {/* Pre-search empty state */}
                {!hasSearched && !loading && (
                  <div className="col-span-full flex flex-col items-center justify-center gap-2 text-center text-sm text-gray-400">
                    <p className="text-base font-medium text-gray-200">
                      Ready to build a batch?
                    </p>
                    <p className="max-w-md text-xs text-gray-400">
                      Start by searching for a card by name, set, or number. Add
                      cards from the results to your selection on the right.
                      Your selection stays even as you change search terms and
                      filters.
                    </p>
                  </div>
                )}

                {/* load-more trigger node for infinite scroll */}
                <div ref={loadMoreTriggerRef} className="col-span-full h-4" />
              </div>

              {(hasMore || isLoadingMore) && (
                <div className="flex items-center justify-center gap-3 mt-3 text-[11px] text-gray-400">
                  {isLoadingMore ? (
                    <>
                      <span className="inline-block h-4 w-4 rounded-full border-2 border-[#2963ff] border-r-transparent animate-spin" />
                      Loading more cards…
                    </>
                  ) : (
                    <span>Scroll down to load more cards</span>
                  )}
                </div>
              )}

              {/* Pricing copy */}
              {hasResults && !loading && !searchError && (
                <p className="mt-3 text-[11px] text-gray-500">
                  Prices shown are the latest market snapshot from SixByFive TCG
                  and may not include every variant or price point yet. We are
                  still collecting data.
                </p>
              )}
            </div>

            {/* Selected */}
            <aside className="w-full rounded-2xl bg-[#131523] p-4 lg:w-[32%]">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Selected</h2>

                <div className="text-right text-xs text-gray-400">
                  <div>
                    {selectedCount} cards • {totalQuantity} copies
                  </div>
                  {estimatedBatchValue > 0 && (
                    <div className="mt-0.5 text-[11px] text-gray-300">
                      Est. value: {formatGBP(estimatedBatchValue)}
                    </div>
                  )}
                </div>
              </div>

              <p className="mb-3 text-[11px] text-gray-400">
                This is your temporary batch. Adjust quantities, remove cards,
                then click{" "}
                <span className="font-semibold text-gray-200">
                  “Add all to Collection”
                </span>{" "}
                to save them. This won&apos;t create listings or trades — it only
                updates your personal collection.
              </p>

              <div className="mb-3 max-h-[calc(100vh-320px)] space-y-2 overflow-y-auto text-xs">
                {selectedList.length === 0 && (
                  <div className="rounded-lg bg-[#0b0d16] p-3 text-gray-400">
                    <p className="text-xs">
                      As you browse results, hit{" "}
                      <span className="font-semibold text-gray-200">
                        “Add to selection”
                      </span>{" "}
                      on any card you want to log. You can:
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px]">
                      <li>Add cards from different sets and searches.</li>
                      <li>Set the quantity you own before saving.</li>
                      <li>
                        Clear the batch at any time without affecting your
                        collection.
                      </li>
                    </ul>
                  </div>
                )}

                {Object.entries(selectedCards).map(([key, { card, quantity }]) => {
                  const bestRow = getBestPriceRow(card.prices);
                  const unitPrice = pickDisplayPrice(bestRow);
                  const lineTotal =
                    unitPrice && quantity ? unitPrice * quantity : null;

                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 rounded-lg bg-[#0b0d16] p-2"
                    >
                      <div className="relative h-12 w-9 overflow-hidden rounded bg-black/30">
                        {card.tcgImageUrl || card.image ? (
                          <Image
                            src={card.tcgImageUrl || card.image}
                            alt={card.name}
                            fill
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="line-clamp-1 font-medium">
                            {card.name}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            #{card.number}
                          </div>
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {card.setName} ({card.setCode})
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={quantity}
                              onChange={(e) =>
                                handleQuantityChange(key, e.target.value)
                              }
                              className="w-16 rounded bg-[#131523] px-2 py-1 text-[11px] outline-none ring-1 ring-[#232642] focus:ring-[#2963ff]"
                            />
                            {unitPrice != null && (
                              <span className="text-[11px] text-gray-300">
                                {formatGBP(unitPrice)} each
                              </span>
                            )}
                          </div>
                          {lineTotal != null && quantity > 1 && (
                            <span className="text-[11px] text-gray-400">
                              {formatGBP(lineTotal)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(key)}
                        className="text-[11px] text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-auto space-y-2">
                <button
                  type="button"
                  disabled={selectedList.length === 0 || adding}
                  onClick={handleAddAllToCollection}
                  className="flex w-full items-center justify-center rounded-lg bg-[#2963ff] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {adding ? "Adding..." : "Add all to Collection"}
                </button>

                <button
                  type="button"
                  disabled={selectedList.length === 0}
                  onClick={handleClearAll}
                  className="w-full rounded-lg bg-[#1b1e33] px-3 py-2 text-xs text-gray-200 disabled:opacity-40"
                >
                  Clear selection
                </button>
              </div>
            </aside>
          </section>
        </main>
      </div>
    </Layout>
  );
}

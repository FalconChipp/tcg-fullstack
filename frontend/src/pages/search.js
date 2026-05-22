// frontend/src/pages/search.js
// Batch Add to Collection workbench
//
// Redesigned:
// - Cleaner dark-only workbench layout
// - Better header and purpose explanation
// - Search panel separated from results
// - Results grid + sticky selected batch sidebar
// - Kept paging strategy
// - Kept smart presets
// - Kept bulk mutation
// - Kept toast feedback

"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  startTransition,
  useEffect,
} from "react";
import { devError } from "@/utils/devLog";
import { gql, useLazyQuery, useMutation } from "@apollo/client";
import Image from "next/image";

import Layout from "@/components/Layout/Layout";
import PokemonAutocomplete from "@/components/Collection/SearchComponents/PokemonAutocomplete";
import SetAutocomplete from "@/components/Collection/SearchComponents/SetAutocomplete";
import AdvancedFilters from "@/components/Collection/SearchComponents/AdvancedFilters";
import StatusMessage from "@/components/UI/StatusMessage";
import { getSetLogo } from "@/utils/setLogos";
import { formatVariation } from "@/utils/formatVariation";

/* ---------------- GraphQL ---------------- */

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

const CARDSEARCH_PAGE_SIZE = 48;
const CARDSEARCH_EXACT_LIMIT = 12;

const INITIAL_FILTERS = {
  minPrice: "",
  maxPrice: "",
  rarities: [],
  variations: [],
  sortBy: "relevance",
  onlyHasPrices: false,
  onlyHasReverse: false,
};

/* ---------------- Helpers ---------------- */

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

  if (!sortBy || sortBy === "relevance") return filtered;

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

function selectIntoBatch(prevSelection, cards, predicate) {
  const next = { ...prevSelection };

  cards.forEach((card, idx) => {
    if (predicate && !predicate(card)) return;

    const key =
      card.cardId ||
      card.id ||
      `${card.setCode || "UNK"}-${card.number || "0"}-${idx}`;

    if (!key) return;

    if (!next[key]) {
      next[key] = { card, quantity: 1 };
    }
  });

  return next;
}

/* ---------------- Small UI ---------------- */

function StatPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-dark-border bg-dark-surface px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-dark-textMuted">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-dark-strong">{value}</p>
    </div>
  );
}

function WorkbenchButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
  type = "button",
}) {
  const cls =
    variant === "primary"
      ? "bg-dark-accent text-white hover:bg-dark-accentLight disabled:opacity-50"
      : variant === "danger"
      ? "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-40"
      : "border border-dark-border bg-dark-alt text-dark-strong hover:border-dark-accent hover:bg-dark-surface disabled:opacity-40";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed ${cls}`}
    >
      {children}
    </button>
  );
}

/* ---------------- Page ---------------- */

export default function CardSearchWorkbenchPage() {
  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");

  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [submitResult, setSubmitResult] = useState(null);
  const [submitErrors, setSubmitErrors] = useState([]);
  const [toast, setToast] = useState(null);

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

  const [selectedCards, setSelectedCards] = useState({});

  const [bulkAddToCollection, { loading: adding }] = useMutation(
    CARDSEARCH_BULK_ADD_TO_COLLECTION
  );

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
      } catch {}

      observerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setSearchError(null);
    setSubmitting(false);
    loadingMoreRef.current = false;
    setSubmitResult(null);
    setSubmitErrors([]);
    setToast(null);
  }, [name, setCode, number]);

  const handleSearch = useCallback(
    async (e) => {
      if (e?.preventDefault) e.preventDefault();

      setHasSearched(true);

      const key = makeQueryKey({ name, setCode, number });
      lastKeyRef.current = key;
      loadingMoreRef.current = false;

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
  }, [fetchMore, hasMore, currentKey, name, setCode, number, showToast]);

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

  function handleResetSearch() {
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
    setSubmitResult(null);
    setSubmitErrors([]);
    setToast(null);
  }

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

  function handleQuantityChange(key, quantity) {
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
  }

  function handleRemove(key) {
    setSelectedCards((prev) => {
      if (!prev[key]) return prev;

      const clone = { ...prev };
      delete clone[key];

      return clone;
    });
  }

  function handleClearAll() {
    if (Object.keys(selectedCards).length === 0) return;

    setSelectedCards({});
    setSubmitResult(null);
    setSubmitErrors([]);
    showToast("info", "Selection cleared.");
  }

  const selectedList = useMemo(
    () => Object.values(selectedCards),
    [selectedCards]
  );

  const selectedCount = selectedList.length;

  const totalQuantity = selectedList.reduce(
    (sum, entry) => sum + (entry.quantity || 0),
    0
  );

  const estimatedBatchValue = useMemo(() => {
    return selectedList.reduce((sum, entry) => {
      const { card, quantity } = entry;
      const bestRow = getBestPriceRow(card.prices);
      const unit = pickDisplayPrice(bestRow);

      if (!unit || !quantity) return sum;

      return sum + unit * quantity;
    }, 0);
  }, [selectedList]);

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

  const fetchSetCards = useCallback(async () => {
    if (!setCode) return [];

    const key = makeQueryKey({ name: "", setCode, number: "" });
    lastKeyRef.current = key;

    const baseInput = { set: setCode };
    const items = await loadAllPagesForKey(key, baseInput);

    return items;
  }, [setCode, loadAllPagesForKey]);

  const handlePresetFullSet = useCallback(async () => {
    if (!setCode) {
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
      devError(err);
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
      devError(err);
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

    showToast("success", "Added visible results to selection.");
  }, [filteredResults, showToast]);

  const handleSelectAllVisible = useCallback(() => {
    if (!filteredResults.length) return;

    setSelectedCards((prev) =>
      selectIntoBatch(prev, filteredResults, () => true)
    );

    showToast("success", "Selected all visible results.");
  }, [filteredResults, showToast]);

  async function handleAddAllToCollection() {
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
      const msg = "No valid items to add.";
      setSubmitResult({ ok: false, message: msg });
      showToast("warning", msg);
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

      if (ok && itemErrors.length === 0) {
        showToast("success", message || "All cards added to your collection.");
        setSelectedCards({});
      } else if (ok && itemErrors.length > 0) {
        showToast(
          "warning",
          `Added with ${itemErrors.length} issue(s). Some cards need attention.`
        );
      } else {
        showToast("error", message || "Failed to add cards to your collection.");
      }
    } catch (err) {
      devError(err);

      const msg = err?.message || "Something went wrong while adding cards.";
      setSubmitResult({ ok: false, message: msg });
      showToast("error", msg);
    }
  }

  return (
    <Layout title="Batch Add to Collection">
      {toast && (
        <StatusMessage
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <div className="min-h-screen bg-dark-background text-dark-text">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          {/* Header */}
          <section className="mb-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex rounded-full border border-dark-border bg-dark-surface px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-dark-textMuted">
                  Collection workbench
                </div>

                <h1 className="text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
                  Batch Add to Collection
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-dark-textMuted sm:text-base">
                  Search across cards, build a temporary batch, adjust
                  quantities, then save everything to your collection in one go.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:min-w-[420px]">
                <StatPill label="Selected" value={selectedCount} />
                <StatPill label="Copies" value={totalQuantity} />
                <StatPill
                  label="Est. value"
                  value={estimatedBatchValue > 0 ? formatGBP(estimatedBatchValue) : "--"}
                />
              </div>
            </div>
          </section>

          {/* Search panel */}
          <section className="mb-6 rounded-3xl border border-dark-border bg-dark-surface p-5 shadow-xl shadow-black/20">
            <form
              onSubmit={handleSearch}
              className="space-y-5 text-sm"
              id="card-search-workbench-form"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_0.7fr_auto_auto] md:items-end">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-dark-textMuted">
                    Card Name
                  </label>

                  <PokemonAutocomplete
                    value={name}
                    onChange={setName}
                    onSelect={setName}
                    className="w-full"
                    inputClassName="w-full rounded-xl border border-dark-border bg-dark-alt px-4 py-3 text-sm text-dark-text outline-none placeholder:text-dark-textMuted focus:border-dark-accent"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-dark-textMuted">
                    Set
                  </label>

                  <SetAutocomplete
                    value={setCode}
                    onChange={setSetCode}
                    onSelect={setSetCode}
                    className="w-full"
                    inputClassName="w-full rounded-xl border border-dark-border bg-dark-alt px-4 py-3 text-sm text-dark-text outline-none placeholder:text-dark-textMuted focus:border-dark-accent"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-dark-textMuted">
                    Number
                  </label>

                  <input
                    type="text"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="e.g. 004"
                    className="w-full rounded-xl border border-dark-border bg-dark-alt px-4 py-3 text-sm text-dark-text outline-none placeholder:text-dark-textMuted focus:border-dark-accent"
                  />
                </div>

                <WorkbenchButton
                  type="submit"
                  disabled={submitting || loading}
                  variant="primary"
                >
                  {submitting || loading ? "Searching..." : "Search"}
                </WorkbenchButton>

                <WorkbenchButton onClick={handleResetSearch}>
                  Clear
                </WorkbenchButton>
              </div>

              {setCode && (
                <div className="rounded-2xl border border-dark-border bg-dark-alt p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-dark-textMuted">
                        Smart presets
                      </p>

                      <p className="mt-1 text-sm text-dark-textMuted">
                        Quick actions for{" "}
                        <span className="font-bold text-dark-strong">
                          {setCode}
                        </span>
                        .
                      </p>
                    </div>

                    {hasResults && (
                      <WorkbenchButton onClick={handlePresetAddVisibleResults}>
                        Add current results
                      </WorkbenchButton>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <WorkbenchButton
                      onClick={handlePresetFullSet}
                      disabled={submitting || loading}
                      variant="primary"
                    >
                      Add 1x of every card
                    </WorkbenchButton>

                    <WorkbenchButton
                      onClick={handlePresetCommonsUncommons}
                      disabled={submitting || loading}
                    >
                      Add Commons / Uncommons
                    </WorkbenchButton>
                  </div>
                </div>
              )}

              <div className="border-t border-dark-border pt-4">
                <AdvancedFilters
                  filters={filters}
                  onChange={setFilters}
                  availableRarities={availableRarities}
                  availableVariations={availableVariations}
                />
              </div>

              {searchError && (
                <p className="text-sm font-medium text-red-400" role="alert">
                  {searchError.message || "Search failed"}
                </p>
              )}

              {submitResult && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    submitResult.ok
                      ? "border-dark-accent/30 bg-dark-accent/10 text-dark-accentLight"
                      : "border-red-500/30 bg-red-500/10 text-red-300"
                  }`}
                  role="status"
                >
                  <div className="font-bold">
                    {submitResult.ok
                      ? "Collection updated"
                      : "Collection update failed"}
                  </div>

                  <div className="mt-1 opacity-90">{submitResult.message}</div>

                  {submitErrors.length > 0 && (
                    <div className="mt-3">
                      <div className="font-bold">Some items failed:</div>

                      <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
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

          {/* Workbench */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            {/* Results */}
            <div className="rounded-3xl border border-dark-border bg-dark-surface p-4 shadow-xl shadow-black/20">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-dark-strong">
                    Results
                  </h2>

                  <p className="mt-1 text-sm text-dark-textMuted">
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
                      "No matching cards"}
                    {!loading &&
                      !hasSearched &&
                      "Search for cards to start building your batch."}
                  </p>
                </div>

                <WorkbenchButton
                  onClick={handleSelectAllVisible}
                  disabled={!hasResults}
                >
                  Select all visible
                </WorkbenchButton>
              </div>

              <div className="max-h-[calc(100vh-350px)] min-h-[460px] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {filteredResults.map((card, idx) => {
                    const key =
                      card.cardId ||
                      card.id ||
                      `${card.setCode}-${card.number}-${idx}`;

                    const inSelection = !!selectedCards[key];
                    const selectedQty = selectedCards[key]?.quantity ?? 0;
                    const bestRow = getBestPriceRow(card.prices);
                    const displayPrice = pickDisplayPrice(bestRow);

                    return (
                      <article
                        key={key}
                        className={`group flex flex-col rounded-2xl border p-2 transition ${
                          inSelection
                            ? "border-dark-accent bg-dark-accent/10"
                            : "border-dark-border bg-dark-alt hover:border-dark-accent/60"
                        }`}
                      >
                        <div className="relative mb-2 aspect-[3/4] overflow-hidden rounded-xl bg-black/30">
                          {card.tcgImageUrl || card.image ? (
                            <Image
                              src={card.tcgImageUrl || card.image}
                              alt={card.name}
                              fill
                              className="object-contain"
                            />
                          ) : null}
                        </div>

                        <div className="flex flex-1 flex-col justify-between text-xs">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="line-clamp-2 font-bold text-dark-strong">
                                {card.name}
                              </div>

                              <img
                                src={getSetLogo(card.setName, card.setCode)}
                                alt={card.setName || "Set logo"}
                                className="h-5 w-8 rounded bg-dark-surface"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = FALLBACK_SYMBOL_IMAGE;
                                }}
                                loading="lazy"
                                decoding="async"
                              />
                            </div>

                            <div className="mt-1 flex justify-between gap-2 text-[11px] text-dark-textMuted">
                              <span className="truncate">{card.setName}</span>
                              <span className="font-semibold">#{card.number}</span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="font-black text-dark-strong">
                                {formatGBP(displayPrice)}
                              </span>

                              {bestRow?.variation &&
                                bestRow.variation !== "normal" && (
                                  <span className="text-dark-textMuted">
                                    ({formatVariation(bestRow.variation)})
                                  </span>
                                )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCardSelect(card)}
                            className={`mt-3 w-full rounded-xl px-2 py-2 text-xs font-bold transition ${
                              inSelection
                                ? "bg-dark-accent text-white"
                                : "bg-dark-surface text-dark-strong hover:bg-dark-accent hover:text-white"
                            }`}
                          >
                            {inSelection
                              ? `Selected (${selectedQty})`
                              : "Add to batch"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {!loading && !searchError && hasSearched && !hasResults && (
                  <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-dark-border text-center text-sm text-dark-textMuted">
                    No cards match your search. Try changing the filters.
                  </div>
                )}

                {!hasSearched && !loading && (
                  <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-dark-border px-6 text-center">
                    <p className="text-base font-black text-dark-strong">
                      Ready to build a batch?
                    </p>

                    <p className="mt-2 max-w-md text-sm leading-6 text-dark-textMuted">
                      Search by card name, set, or number. Add cards to the
                      sidebar and keep searching — your batch stays selected.
                    </p>
                  </div>
                )}

                <div ref={loadMoreTriggerRef} className="h-4" />

                {(hasMore || isLoadingMore) && (
                  <div className="mt-4 flex items-center justify-center gap-3 text-sm text-dark-textMuted">
                    {isLoadingMore ? (
                      <>
                        <span className="inline-block h-4 w-4 rounded-full border-2 border-dark-accent border-r-transparent animate-spin" />
                        Loading more cards…
                      </>
                    ) : (
                      <span>Scroll down to load more cards</span>
                    )}
                  </div>
                )}
              </div>

              {hasResults && !loading && !searchError && (
                <p className="mt-4 text-xs text-dark-textMuted">
                  Prices shown are the latest market snapshot from SixByFive TCG
                  and may not include every variant or price point yet.
                </p>
              )}
            </div>

            {/* Selected batch */}
            <aside className="rounded-3xl border border-dark-border bg-dark-surface p-4 shadow-xl shadow-black/20 lg:sticky lg:top-28 lg:self-start">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-dark-strong">
                    Selected batch
                  </h2>

                  <p className="mt-1 text-sm text-dark-textMuted">
                    {selectedCount} cards • {totalQuantity} copies
                  </p>
                </div>

                {estimatedBatchValue > 0 && (
                  <div className="rounded-2xl border border-dark-border bg-dark-alt px-3 py-2 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-dark-textMuted">
                      Est.
                    </p>
                    <p className="text-sm font-black text-dark-strong">
                      {formatGBP(estimatedBatchValue)}
                    </p>
                  </div>
                )}
              </div>

              <div className="mb-4 rounded-2xl border border-dark-border bg-dark-alt p-3 text-xs leading-5 text-dark-textMuted">
                Build your temporary batch here. Adjust quantities before saving.
                This only updates your personal collection.
              </div>

              <div className="max-h-[calc(100vh-430px)] min-h-[260px] space-y-2 overflow-y-auto pr-1">
                {selectedList.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-dark-border bg-dark-alt p-4 text-sm text-dark-textMuted">
                    <p className="font-bold text-dark-strong">
                      No cards selected yet.
                    </p>

                    <ul className="mt-3 list-disc space-y-1 pl-4 text-xs">
                      <li>Add cards from multiple searches.</li>
                      <li>Set quantities before saving.</li>
                      <li>Clear the batch without changing your collection.</li>
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
                      className="flex gap-3 rounded-2xl border border-dark-border bg-dark-alt p-3"
                    >
                      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-black/30">
                        {card.tcgImageUrl || card.image ? (
                          <Image
                            src={card.tcgImageUrl || card.image}
                            alt={card.name}
                            fill
                            className="object-contain"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="line-clamp-1 text-sm font-bold text-dark-strong">
                              {card.name}
                            </p>

                            <p className="mt-0.5 line-clamp-1 text-xs text-dark-textMuted">
                              {card.setName} #{card.number}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemove(key)}
                            className="text-xs font-bold text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-dark-textMuted">
                              Qty
                            </span>

                            <input
                              type="number"
                              min={0}
                              value={quantity}
                              onChange={(e) =>
                                handleQuantityChange(key, e.target.value)
                              }
                              className="w-16 rounded-lg border border-dark-border bg-dark-surface px-2 py-1 text-xs text-dark-text outline-none focus:border-dark-accent"
                            />
                          </div>

                          <div className="text-right">
                            {unitPrice != null && (
                              <p className="text-xs font-bold text-dark-strong">
                                {formatGBP(unitPrice)} each
                              </p>
                            )}

                            {lineTotal != null && quantity > 1 && (
                              <p className="text-[11px] text-dark-textMuted">
                                {formatGBP(lineTotal)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2 border-t border-dark-border pt-4">
                <WorkbenchButton
                  disabled={selectedList.length === 0 || adding}
                  onClick={handleAddAllToCollection}
                  variant="primary"
                >
                  {adding ? "Adding..." : "Add all to Collection"}
                </WorkbenchButton>

                <button
                  type="button"
                  disabled={selectedList.length === 0}
                  onClick={handleClearAll}
                  className="w-full rounded-xl border border-dark-border bg-dark-alt px-4 py-2.5 text-sm font-bold text-dark-strong transition hover:border-red-400/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
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
// src/components/Collection/CardSearch.js
"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useRef,
  startTransition,
} from "react";
import { AuthContext } from "@/components/Auth/AuthProvider";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { gql, useLazyQuery } from "@apollo/client";

import { getCookie } from "@/utils/cookieUtils";
import { getGraphqlUrl } from "@/utils/apiClient";
import { useTheme } from "@/hooks/ThemeProvider";
import { getSetLogo } from "@/utils/setLogos";
import StatusMessage from "@/components/UI/StatusMessage";
import PokemonAutocomplete from "./SearchComponents/PokemonAutocomplete";
import SetAutocomplete from "./SearchComponents/SetAutocomplete";
import AdvancedFilters from "./SearchComponents/AdvancedFilters";
import { mapCardToDetail } from "@/utils/mapData";
import { formatVariation } from "@/utils/formatVariation";
import SearchIntro from "../Home/SearchIntro";

const AddToCollectionPanel = dynamic(() => import("./AddToCollectionPanel"), {
  ssr: false,
});

const CardDetailsModal = dynamic(
  () => import("../Cards/CardDetailsModal"),
  { ssr: false }
);

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

const CARDSEARCH_PAGE_SIZE = 48;
const CARDSEARCH_EXACT_LIMIT = 12;
const HOME_RESULT_LIMIT = 8;

const FALLBACK_SYMBOL_IMAGE = "https://placehold.co/50x50/webp?text=Icon";
const GBP_SYMBOL = "\u00A3";

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

    const variants =
      Array.isArray(it.variants) && it.variants.length > 0
        ? it.variants
            .map((v) => (typeof v === "string" ? v : v?.key || v?.label || null))
            .filter(Boolean)
        : null;

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

/* ---------------- Small UI ---------------- */

function SearchFeature({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-dark-border bg-dark-alt px-3 py-1 text-xs font-bold text-dark-textMuted">
      {children}
    </span>
  );
}

function PopularSearchButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-dark-border bg-dark-surface px-3 py-1.5 text-xs font-bold text-dark-textMuted transition hover:border-dark-accent hover:text-dark-strong"
    >
      {children}
    </button>
  );
}

/* ---------------- Component ---------------- */

export default function CardSearch({ variant = "search" }) {
  const { dark } = useTheme();
  const { openAuthModal } = useContext(AuthContext);

  const isHomeVariant = variant === "home";
  const isSearchVariant = !isHomeVariant;

  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");

  const bucketsRef = useRef(new Map());
  const lastKeyRef = useRef(null);

  const [results, setResults] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const [filters, setFilters] = useState({
    minPrice: "",
    maxPrice: "",
    rarities: [],
    variations: [],
    sortBy: "relevance",
    onlyHasPrices: false,
    onlyHasReverse: false,
  });

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelWishlist, setPanelWishlist] = useState(false);
  const [selectedCardDetail, setSelectedCardDetail] = useState(null);
  const [showCardDetail, setShowCardDetail] = useState(false);
  const [cardDetailData, setCardDetailData] = useState(null);

  const [imageLoadedMap, setImageLoadedMap] = useState({});
  const [hasSearched, setHasSearched] = useState(false);

  const isExactCardSearch = Boolean(setCode && number);

  const loadingMoreRef = useRef(false);
  const loadMoreTriggerRef = useRef(null);
  const observerRef = useRef(null);

  const [runSearch, { fetchMore }] = useLazyQuery(CARDSEARCH_QUERY, {
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
    returnPartialData: false,
  });

  const [submitting, setSubmitting] = useState(false);

  const currentKey = useMemo(
    () => makeQueryKey({ name, setCode, number }),
    [name, setCode, number]
  );

  const availableRarities = useMemo(() => {
    const set = new Set();

    results.forEach((card) => {
      if (card.rarity) set.add(card.rarity);
    });

    return Array.from(set).sort();
  }, [results]);

  const availableVariations = useMemo(() => {
    const set = new Set();

    results.forEach((card) => {
      if (Array.isArray(card.variations)) {
        card.variations.forEach((v) => v && set.add(v));
      }
    });

    return Array.from(set).sort();
  }, [results]);

  const filteredResults = useMemo(
    () => applyFiltersAndSort(results, filters),
    [results, filters]
  );

  const visibleResults = isHomeVariant
    ? filteredResults.slice(0, HOME_RESULT_LIMIT)
    : filteredResults;

  const showStatusMessage = useCallback((type, message) => {
    setStatusMessage({ type, message });
  }, []);

  const markImageLoaded = useCallback((id) => {
    if (!id) return;
    setImageLoadedMap((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  const disconnectObserver = useCallback(() => {
    if (observerRef.current) {
      try {
        observerRef.current.disconnect();
      } catch {}

      observerRef.current = null;
    }
  }, []);

  useEffect(() => {
    loadingMoreRef.current = false;
    setSearchError(null);
    setSubmitting(false);
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

        const bucketNext = {
          items,
          hasNextPage: nextOffset < totalCount,
          totalCount,
          nextOffset,
          pageSize: Number(payload.limit ?? limit),
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
        showStatusMessage("error", "Search failed. Please try again.");

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
      showStatusMessage,
    ]
  );

  const loadMoreResults = useCallback(async () => {
    if (isHomeVariant) return;
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
      showStatusMessage("error", "Couldn’t load more results.");

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
  }, [
    fetchMore,
    hasMore,
    currentKey,
    name,
    setCode,
    number,
    showStatusMessage,
    isHomeVariant,
  ]);

  useEffect(() => {
    if (isHomeVariant) return;

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
    isHomeVariant,
  ]);

  const handleAddToWishlist = async (card) => {
    const token = getCookie("authToken");

    if (!token) {
      openAuthModal();
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
          (Array.isArray(card.variations) && card.variations.length > 0
            ? card.variations[0]
            : ""),
      };

      const res = await fetch(getGraphqlUrl(), {
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
        showStatusMessage(
          "error",
          json.errors[0].message || "Failed to add to wishlist."
        );
      } else {
        showStatusMessage("error", "Failed to add to wishlist.");
      }
    } catch {
      showStatusMessage("error", "Network error. Please try again.");
    }
  };

  function handleCardDetail(card) {
    const firstVariation =
      Array.isArray(card.variations) && card.variations.length
        ? card.variations[0]
        : null;

    const detail = {
      ...mapCardToDetail(card),
      modalImage: card.tcgImageUrl || card.image,
      prices: card.prices,
      variations: card.variations,
      variation: card.variation || firstVariation || "normal",
      pricingRaw: null,
    };

    setCardDetailData(detail);
    setShowCardDetail(true);
  }

  function applyPopularSearch(search) {
  if (typeof search === "string") {
      setName(search);
      setSetCode("");
      setNumber("");
      return;
  }

  const nextName = search.name || "";
  const nextSetCode = search.setCode || "";
  const nextNumber = search.number || "";

  setName(nextName);
  setSetCode(nextSetCode);
  setNumber(nextNumber);
}

  const hasActiveResultsSection = isSearchVariant
    ? hasSearched || submitting || results.length > 0
    : false;

  const rootClass = isHomeVariant
    ? "bg-dark-background text-dark-text px-5 sm:px-7"
    : `${
        hasActiveResultsSection ? "min-h-screen " : ""
      }bg-light-background text-light-text dark:bg-dark-background dark:text-dark-text transition-colors`;

  const innerClass = isHomeVariant
    ? "max-w-7xl mx-auto py-14 sm:py-16"
    : "max-w-[1200px] mx-auto px-5 py-10";

  const formClass = isHomeVariant
    ? "bg-dark-surface rounded-3xl p-5 sm:p-6 shadow-xl shadow-black/20 mb-6 border border-dark-border"
    : "bg-light-surface dark:bg-dark-surface rounded-2xl p-8 pt-8 pb-5 shadow-lg dark:shadow-[0_6px_24px_0_rgba(12,8,24,0.18)] mb-5 border border-light-border dark:border-dark-border transition-colors";

  const inputClass =
    "w-full border rounded-xl px-4 py-3 text-base bg-light-alt dark:bg-dark-alt border-light-border dark:border-dark-border text-light-text dark:text-dark-text placeholder-light-textMuted dark:placeholder-dark-textMuted focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition";

  const homeInputClass =
    "w-full border rounded-xl px-4 py-3 text-base bg-dark-alt border-dark-border text-dark-text placeholder:text-dark-textMuted focus:border-dark-accent focus:outline-none transition";

  const activeInputClass = isHomeVariant ? homeInputClass : inputClass;

  return (
    <div className={rootClass}>
      <div className={innerClass}>
        {isSearchVariant && (
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold mb-2 tracking-tight">
              Pokémon Card Search
            </h1>

            <p className="text-lg text-light-textMuted dark:text-dark-textMuted">
              Search for any Pokémon card and add it to your collection or wishlist.
            </p>

            <div className="mt-5 mx-auto max-w-7xl rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-5 py-4 shadow-sm dark:shadow-[0_6px_24px_0_rgba(12,8,24,0.18)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-left">
                  <div className="text-sm font-semibold">
                    Adding lots of cards?
                  </div>

                  <div className="text-sm text-light-textMuted dark:text-dark-textMuted">
                    Use the Batch Add workbench to build a selection across
                    multiple searches and save everything in one go.
                  </div>
                </div>

                <Link
                  href="/search"
                  className="inline-flex items-center justify-center rounded-xl bg-light-accent dark:bg-dark-accent px-4 py-2 text-sm font-semibold text-white hover:text-white hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition"
                >
                  Open Batch Add →
                </Link>
              </div>
            </div>
          </div>
        )}

        {isHomeVariant && (
          <div className="mb-8">
            <div className="mb-4 inline-flex items-center rounded-full border border-dark-border bg-dark-surface px-3 py-1.5 text-xs font-bold text-dark-textMuted">
              Start with search
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
                  Find the exact card you need.
                </h2>

                <p className="mt-3 max-w-2xl text-base leading-7 text-dark-textMuted">
                  Search by Pokémon, set, number, or expansion. Start broad with
                  a card name, or narrow it down with set and card number.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <SearchFeature>Name search</SearchFeature>
                <SearchFeature>Set lookup</SearchFeature>
                <SearchFeature>Card number</SearchFeature>
                <SearchFeature>Price data</SearchFeature>
              </div>
            </div>
          </div>
        )}

        <form id="card-search-form" onSubmit={handleSearch} className={formClass}>
          {isSearchVariant && <SearchIntro />}

          <div
            className={
              isHomeVariant
                ? "grid grid-cols-1 gap-4 md:grid-cols-[1fr_0.8fr_0.55fr_auto]"
                : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 mb-0"
            }
          >
            <div>
              <label
                className={
                  isHomeVariant
                    ? "block text-sm font-bold mb-2 text-dark-strong"
                    : "block text-base font-medium mb-2"
                }
              >
                Card Name
              </label>

              <PokemonAutocomplete
                value={name}
                onChange={setName}
                onSelect={setName}
                className="w-full"
                inputClassName={activeInputClass}
              />
            </div>

            <div>
              <label
                className={
                  isHomeVariant
                    ? "block text-sm font-bold mb-2 text-dark-strong"
                    : "block text-base font-medium mb-2"
                }
              >
                Set
              </label>

              <SetAutocomplete
                value={setCode}
                onChange={setSetCode}
                onSelect={setSetCode}
                className="w-full"
                inputClassName={activeInputClass}
              />
            </div>

            <div>
              <label
                className={
                  isHomeVariant
                    ? "block text-sm font-bold mb-2 text-dark-strong"
                    : "block text-base font-medium mb-2"
                }
              >
                Number
              </label>

              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="4"
                className={activeInputClass}
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className={
                  isHomeVariant
                    ? "h-[50px] w-full rounded-xl bg-dark-accent px-6 text-base font-black text-white shadow-md transition hover:bg-dark-accentLight disabled:opacity-60 disabled:cursor-not-allowed"
                    : "bg-light-accent dark:bg-dark-accent text-light-surface dark:text-white font-bold text-lg border-none rounded-xl px-8 py-3 shadow-md transition hover:bg-light-accentLight dark:hover:bg-dark-accentLight hover:text-light-surface dark:hover:text-white disabled:opacity-60 disabled:cursor-not-allowed w-full"
                }
              >
                {submitting ? "Searching..." : "Search"}
              </button>
            </div>
          </div>


          {searchError ? (
            <div
              className={
                isHomeVariant
                  ? "text-dark-error text-center mt-4 font-medium"
                  : "text-light-error dark:text-dark-error text-center mt-4 font-medium"
              }
              role="alert"
              aria-live="assertive"
            >
              {searchError.message || "Search failed"}
            </div>
          ) : !submitting && isSearchVariant ? (
            <p
              className="text-sm text-gray-500 dark:text-gray-400 text-center mt-4"
              aria-live="polite"
            >
              Note: Pricing data is still syncing — some prices may be
              temporarily inaccurate.
            </p>
          ) : null}

          {isSearchVariant && (
            <AdvancedFilters
              filters={filters}
              onChange={setFilters}
              availableRarities={availableRarities}
              availableVariations={availableVariations}
            />
          )}
        </form>

        {hasSearched || submitting ? (
          submitting && results.length === 0 ? (
            <div
              className={
                isHomeVariant
                  ? "flex items-center justify-center py-10 text-dark-textMuted"
                  : "flex items-center justify-center py-10 text-light-textMuted dark:text-dark-textMuted"
              }
            >
              <span
                className={
                  isHomeVariant
                    ? "inline-block w-[22px] h-[22px] mr-3 border-4 border-dark-accent border-r-transparent rounded-full animate-spin"
                    : "inline-block w-[22px] h-[22px] mr-3 border-4 border-light-accent dark:border-dark-accent border-r-transparent rounded-full animate-spin"
                }
              />
              Searching cards…
            </div>
          ) : results.length > 0 ? (
            <div>
              <div
                className={
                  isHomeVariant
                    ? "flex flex-col sm:flex-row sm:items-end sm:justify-between mb-4 gap-2"
                    : "flex flex-col sm:flex-row sm:items-end sm:justify-between mb-4 ml-1 gap-2"
                }
              >
                <div>
                  <h2
                    className={
                      isHomeVariant
                        ? "text-xl font-black text-dark-strong"
                        : "text-xl font-bold"
                    }
                  >
                    Search Results
                  </h2>

                  {isHomeVariant && filteredResults.length > HOME_RESULT_LIMIT ? (
                    <p className="mt-1 text-sm text-dark-textMuted">
                      Showing the first {HOME_RESULT_LIMIT} results. Use the
                      workbench if you want to build a larger batch.
                    </p>
                  ) : null}
                </div>

                <p
                  className={
                    isHomeVariant
                      ? "text-sm text-dark-textMuted"
                      : "text-sm text-light-textMuted dark:text-dark-textMuted"
                  }
                >
                  Showing{" "}
                  <span className="font-semibold">{visibleResults.length}</span>{" "}
                  of <span className="font-semibold">{filteredResults.length}</span>{" "}
                  cards
                </p>
              </div>

              {filteredResults.length === 0 ? (
                <div
                  className={
                    isHomeVariant
                      ? "text-center text-dark-textMuted text-lg py-8"
                      : "text-center text-light-textMuted dark:text-dark-textMuted text-lg py-8"
                  }
                >
                  No cards match your filters. Try relaxing them.
                </div>
              ) : (
                <div
                  className={
                    isHomeVariant
                      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                      : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                  }
                >
                  {visibleResults.map((card, idx) => {
                    const bestRow = getBestPriceRow(card.prices);
                    const displayPrice = pickDisplayPrice(bestRow);
                    const setKey = card.set || card.setCode || "";
                    const numKey = card.number || "";
                    const fallbackKey = `${setKey}-${numKey}`.trim();

                    const imageKey =
                      card.id ||
                      card.cardId ||
                      (fallbackKey && fallbackKey !== "-"
                        ? fallbackKey
                        : `card-${idx}`);

                    const isLoaded = !!imageLoadedMap[imageKey];
                    const isPriority = idx < 8;

                    return (
                      <div
                        className={
                          isHomeVariant
                            ? "bg-dark-surface rounded-2xl shadow-lg shadow-black/10 hover:shadow-2xl flex flex-col p-3 min-h-[320px] transition border border-dark-border cursor-pointer"
                            : "bg-light-surface dark:bg-dark-surface rounded-2xl shadow hover:shadow-2xl flex flex-col p-3 min-h-[320px] transition border border-light-border dark:border-dark-border cursor-pointer"
                        }
                        key={imageKey}
                        onClick={() => handleCardDetail(card)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            handleCardDetail(card);
                          }
                        }}
                        role="button"
                        aria-label={`View details for ${card.name}`}
                      >
                        <div
                          className={
                            isHomeVariant
                              ? "relative w-full aspect-[245/337] bg-dark-alt rounded-xl mb-3 overflow-hidden"
                              : "relative w-full aspect-[245/337] bg-light-alt dark:bg-dark-alt rounded-xl mb-3 overflow-hidden"
                          }
                        >
                          <div
                            className={`absolute inset-0 rounded-xl transition-opacity duration-300 ${
                              isLoaded
                                ? "opacity-0"
                                : isHomeVariant
                                ? "opacity-100 animate-pulse bg-gradient-to-br from-dark-alt/70 via-dark-surface to-dark-surface"
                                : "opacity-100 animate-pulse bg-gradient-to-br from-light-alt/70 via-light-surface to-light-surface dark:from-dark-alt/70 dark:via-dark-surface dark:to-dark-surface"
                            }`}
                          />

                          <Image
                            src={card.tcgImageUrl || card.image}
                            alt={card.name}
                            fill
                            sizes="(max-width: 640px) 100vw,
                                    (max-width: 1024px) 50vw,
                                    (max-width: 1280px) 33vw,
                                    25vw"
                            className={`object-contain object-center rounded-xl transition-opacity duration-300 ${
                              isLoaded ? "opacity-100" : "opacity-0"
                            }`}
                            onLoadingComplete={() => markImageLoaded(imageKey)}
                            onLoad={() => markImageLoaded(imageKey)}
                            {...(isPriority
                              ? { priority: true }
                              : { loading: "lazy" })}
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-start gap-2">
                            <span
                              className={
                                isHomeVariant
                                  ? "text-base font-bold flex-1 truncate text-dark-strong"
                                  : "text-base font-bold flex-1 truncate"
                              }
                            >
                              {card.name}
                            </span>

                            <img
                              src={getSetLogo(card.setName, card.set)}
                              alt={card.setName || "Set logo"}
                              className={
                                isHomeVariant
                                  ? "w-8 h-5 rounded bg-dark-alt"
                                  : "w-8 h-5 rounded bg-light-alt dark:bg-dark-alt"
                              }
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = FALLBACK_SYMBOL_IMAGE;
                              }}
                              loading="lazy"
                              decoding="async"
                            />
                          </div>

                          <div
                            className={
                              isHomeVariant
                                ? "flex justify-between text-sm text-dark-textMuted"
                                : "flex justify-between text-sm text-light-textMuted dark:text-dark-textMuted"
                            }
                          >
                            <span className="whitespace-nowrap truncate">
                              {card.setName}
                            </span>
                            <span className="font-semibold">#{card.number}</span>
                          </div>

                          <div className="flex gap-3 text-sm my-1">
                            <div>
                              <span
                                className={
                                  isHomeVariant
                                    ? "font-bold text-dark-accent"
                                    : "font-bold text-light-accent dark:text-dark-accent"
                                }
                              >
                                Price
                              </span>

                              <span
                                className={
                                  isHomeVariant
                                    ? "font-semibold ml-1 text-dark-text"
                                    : "font-semibold ml-1 text-light-text dark:text-dark-text"
                                }
                              >
                                {formatGBP(displayPrice)}
                              </span>
                            </div>

                            {bestRow?.variation &&
                            bestRow.variation !== "normal" ? (
                              <span
                                className={
                                  isHomeVariant
                                    ? "ml-1 text-xs text-dark-textMuted"
                                    : "ml-1 text-xs text-light-textMuted dark:text-dark-textMuted"
                                }
                              >
                                ({formatVariation(bestRow.variation)})
                              </span>
                            ) : null}
                          </div>

                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCardDetail(card);
                                setPanelWishlist(false);
                                setPanelOpen(true);
                              }}
                              className={
                                isHomeVariant
                                  ? "rounded-lg px-4 py-2 bg-dark-accent !text-white font-semibold hover:bg-dark-accentLight transition"
                                  : "rounded-lg px-4 py-2 bg-light-accent dark:bg-dark-accent !text-white dark:text-dark-surface font-semibold hover:bg-light-accentLight dark:hover:bg-dark-accentLight hover:text-light-surface dark:hover:text-white transition"
                              }
                            >
                              Add
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCardDetail(card);
                                setPanelWishlist(true);
                                setPanelOpen(true);
                              }}
                              className={
                                isHomeVariant
                                  ? "rounded-lg px-4 py-2 border-2 border-dark-accent text-dark-accent font-semibold hover:bg-dark-accent hover:text-white transition"
                                  : "rounded-lg px-4 py-2 border-2 border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent font-semibold hover:bg-light-accent dark:hover:bg-dark-accent hover:text-light-surface dark:hover:text-white transition"
                              }
                            >
                              Wishlist
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}


              {isSearchVariant && (
                <>
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
                </>
              )}
            </div>
          ) : (
            !submitting &&
            hasSearched && (
              <div
                className={
                  isHomeVariant
                    ? "text-center text-dark-textMuted text-lg py-8"
                    : "text-center text-light-textMuted dark:text-dark-textMuted text-lg py-8"
                }
              >
                No results found. Try adjusting your search criteria.
              </div>
            )
          )
        ) : null}

        {panelOpen && selectedCardDetail && (
          <AddToCollectionPanel
            cardDetail={selectedCardDetail}
            initialWishlist={panelWishlist}
            onClose={() => {
              setPanelOpen(false);
              setPanelWishlist(false);
            }}
          />
        )}

        <div className="fixed top-5 right-5 z-50">
          {statusMessage && (
            <StatusMessage
              type={statusMessage.type}
              message={statusMessage.message}
              onClose={() => setStatusMessage(null)}
            />
          )}
        </div>

        {showCardDetail && cardDetailData && (
          <CardDetailsModal
            card={cardDetailData}
            owned={false}
            onClose={() => setShowCardDetail(false)}
            dark={dark}
          />
        )}
      </div>
    </div>
  );
}
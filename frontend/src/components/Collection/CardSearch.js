// src/components/Collection/CardSearch.js
"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  startTransition,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link"; // NEW: link to batch workbench page
import { gql, useLazyQuery } from "@apollo/client";

import { getCookie } from "@/utils/cookieUtils";
import { useTheme } from "@/hooks/ThemeProvider";
import { getSetLogo } from "@/utils/setLogos";
import StatusMessage from "@/components/UI/StatusMessage";
import PokemonAutocomplete from "./SearchComponents/PokemonAutocomplete";
import SetAutocomplete from "./SearchComponents/SetAutocomplete";
import AdvancedFilters from "./SearchComponents/AdvancedFilters";
import { mapCardToDetail } from "@/utils/mapData";
import { formatVariation } from "@/utils/formatVariation";
import CardSkeleton from "../UI/CardSkeleton"; // kept in case you want it later
import SearchIntro from "../Home/SearchIntro";

// Lazily load heavy panels so the search UI becomes interactive sooner
const AddToCollectionPanel = dynamic(() => import("./AddToCollectionPanel"), {
  ssr: false,
});
const CardDetailsModal = dynamic(
  () => import("../UserProfile/CardDetailsModal"),
  { ssr: false }
);

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

/* ---------------- Filters + sort ---------------- */

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

/* ---------------- Component ---------------- */

export default function CardSearch() {
  const { dark } = useTheme();

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

  // CHANGED: use toast only — let StatusMessage auto-dismiss handle timing
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
        showStatusMessage("error", "Search failed. Please try again."); // NEW: toast feedback
        if (bucket) setHasMore(bucket.hasNextPage);
      } finally {
        setSubmitting(false);
      }
    },
    [name, setCode, number, runSearch, isExactCardSearch, disconnectObserver, showStatusMessage]
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
          if (lastKeyRef.current === key) startTransition(() => setHasMore(false));
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
        showStatusMessage("error", "Couldn’t load more results."); // NEW: toast feedback
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
    [fetchMore, hasMore, currentKey, name, setCode, number, showStatusMessage]
  );

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
  }, [hasMore, loadMoreResults, filteredResults.length, currentKey, disconnectObserver]);

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
          (Array.isArray(card.variations) && card.variations.length > 0
            ? card.variations[0]
            : ""),
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

  // CHANGED: only force full-screen height once search/results exist
  const hasActiveResultsSection = hasSearched || submitting || results.length > 0;

  return (
    <div
      className={`${
        hasActiveResultsSection ? "min-h-screen " : ""
      }bg-light-background text-light-text dark:bg-dark-background dark:text-dark-text transition-colors`}
    >
      <div className="max-w-[1200px] mx-auto px-5 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight">
            Pokemon Card Search
          </h1>
          <p className="text-lg text-light-textMuted dark:text-dark-textMuted">
            Search for any Pokemon card and add it to your collection/wishlist
          </p>

          <div className="mt-5 mx-auto max-w-7xl rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-5 py-4 shadow-sm dark:shadow-[0_6px_24px_0_rgba(12,8,24,0.18)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-left">
                <div className="text-sm font-semibold">
                  Adding lots of cards?
                </div>
                <div className="text-sm text-light-textMuted dark:text-dark-textMuted">
                  Use the Batch Add workbench to build a selection across multiple searches and save everything in one go.
                </div>
              </div>

              <Link
                href="/search"
                className="
                  inline-flex items-center justify-center
                  rounded-xl
                  bg-light-accent dark:bg-dark-accent
                  px-4 py-2
                  text-sm font-semibold
                  text-white
                  hover:text-white
                  hover:bg-light-accentLight dark:hover:bg-dark-accentLight
                  transition
                "
              >
                Open Batch Add →
              </Link>
            </div>
          </div>
        </div>

        {/* Search Form */}
        <form
          id="card-search-form"
          onSubmit={handleSearch}
          className="bg-light-surface dark:bg-dark-surface rounded-2xl p-8 pt-8 pb-5 shadow-lg dark:shadow-[0_6px_24px_0_rgba(12,8,24,0.18)] mb-5 border border-light-border dark:border-dark-border transition-colors"
        >
          <SearchIntro />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 mb-0">
            <div>
              <label className="block text-base font-medium mb-2">
                Card Name
              </label>
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
              <label className="block text-base font-medium mb-2">
                Card Number
              </label>
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
                disabled={submitting}
                className="bg-light-accent dark:bg-dark-accent text-light-surface dark:text-white font-bold text-lg border-none rounded-xl px-8 py-3 shadow-md transition hover:bg-light-accentLight dark:hover:bg-dark-accentLight hover:text-light-surface dark:hover:text-white disabled:opacity-60 disabled:cursor-not-allowed w-full"
              >
                {submitting ? "Searching..." : "Search"}
              </button>
            </div>
          </div>

          {searchError ? (
            <div
              className="text-light-error dark:text-dark-error text-center mt-4 font-medium"
              role="alert"
              aria-live="assertive"
            >
              {searchError.message || "Search failed"}
            </div>
          ) : !submitting ? (
            <p
              className="text-sm text-gray-500 dark:text-gray-400 text-center mt-4"
              aria-live="polite"
            >
              Note: Pricing data is still syncing — some prices may be temporarily inaccurate.
            </p>
          ) : null}

          <AdvancedFilters
            filters={filters}
            onChange={setFilters}
            availableRarities={availableRarities}
            availableVariations={availableVariations}
          />
        </form>

        {/* Results area: only shows after a search (or while searching) */}
        {hasSearched || submitting ? (
          submitting && results.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-light-textMuted dark:text-dark-textMuted">
              <span className="inline-block w-[22px] h-[22px] mr-3 border-4 border-light-accent dark:border-dark-accent border-r-transparent rounded-full animate-spin" />
              Searching cards…
            </div>
          ) : results.length > 0 ? (
            <div>
              {/* Header + counts */}
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-4 ml-1 gap-2">
                <h2 className="text-xl font-bold">Search Results</h2>
                <p className="text-sm text-light-textMuted dark:text-dark-textMuted">
                  Showing{" "}
                  <span className="font-semibold">{filteredResults.length}</span>{" "}
                  of <span className="font-semibold">{results.length}</span> cards
                </p>
              </div>

              {/* No results after filters */}
              {filteredResults.length === 0 ? (
                <div className="text-center text-light-textMuted dark:text-dark-textMuted text-lg py-8">
                  No cards match your filters. Try relaxing them.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {filteredResults.map((card, idx) => {
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
                        className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow hover:shadow-2xl flex flex-col p-3 min-h-[320px] transition border border-light-border dark:border-dark-border"
                        key={imageKey}
                        onClick={() => handleCardDetail(card)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            handleCardDetail(card);
                        }}
                        role="button"
                        aria-label={`View details for ${card.name}`}
                      >
                        <div className="relative w-full aspect-[245/337] bg-light-alt dark:bg-dark-alt rounded-xl mb-3 overflow-hidden">
                          <div
                            className={`absolute inset-0 rounded-xl transition-opacity duration-300 ${
                              isLoaded
                                ? "opacity-0"
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
                            <span className="text-base font-bold flex-1 truncate">
                              {card.name}
                            </span>
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
                            <span className="whitespace-nowrap">
                              {card.setName}
                            </span>
                            <span className="font-semibold">#{card.number}</span>
                          </div>

                          <div className="flex gap-3 text-sm my-1">
                            <div>
                              <span className="font-bold text-light-accent dark:text-dark-accent">
                                Price
                              </span>
                              <span className="font-semibold ml-1 text-light-text dark:text-dark-text">
                                {formatGBP(displayPrice)}
                              </span>
                            </div>
                            {bestRow?.variation &&
                            bestRow.variation !== "normal" ? (
                              <span className="ml-1 text-xs text-light-textMuted dark:text-dark-textMuted">
                                ({formatVariation(bestRow.variation)})
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
                              className="rounded-lg px-4 py-2 bg-light-accent dark:bg-dark-accent !text-white dark:text-dark-surface font-semibold hover:bg-light-accentLight dark:hover:bg-dark-accentLight hover:text-light-surface dark:hover:text-white transition"
                            >
                              Add
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToWishlist(card);
                              }}
                              className="rounded-lg px-4 py-2 border-2 border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent font-semibold hover:bg-light-accent dark:hover:bg-dark-accent hover:text-light-surface dark:hover:text-white transition"
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
            !submitting &&
            hasSearched && (
              <div className="text-center text-light-textMuted dark:text-dark-textMuted text-lg py-8">
                No results found. Try adjusting your search criteria.
              </div>
            )
          )
        ) : null}

        {/* Add & Status Panels */}
        {panelOpen && selectedCardDetail && (
          <AddToCollectionPanel
            cardDetail={selectedCardDetail}
            onClose={() => setPanelOpen(false)}
          />
        )}

        {/* Toast */}
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
            onClose={() => setShowCardDetail(false)}
            dark={dark}
          />
        )}
      </div>
    </div>
  );
}

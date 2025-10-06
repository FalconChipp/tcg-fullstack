"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef, startTransition } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { gql, useLazyQuery } from "@apollo/client";

import { getCookie } from "@/utils/cookieUtils";
import { useTheme } from "@/hooks/ThemeProvider";
import { getSetLogo } from "@/utils/setLogos";
import StatusMessage from "@/components/UI/StatusMessage";
import PokemonAutocomplete from "./SearchComponents/PokemonAutocomplete";
import SetAutocomplete from "./SearchComponents/SetAutocomplete";
import { mapCardToDetail } from "@/utils/mapData";
import CardSkeleton from "../UI/CardSkeleton";

// Lazily load heavy panels so the search UI becomes interactive sooner
const AddToCollectionPanel = dynamic(() => import("./AddToCollectionPanel"), { ssr: false });
const CardDetailsModal   = dynamic(() => import("../UserProfile/CardDetailsModal"), { ssr: false });

/* ---------------- GraphQL: connection (smaller first page) ---------------- */

const SEARCH_CARDS_CONNECTION = gql`
  query SearchCardsConnection($input: SearchCardsInput!) {
    searchCardsConnection(input: $input) {
      totalCount
      pageInfo { hasNextPage endCursor }
      edges {
        cursor
        node {
          id
          name
          set
          setName
          number
          image
          rarity
          variations { normal reverse holo firstEdition }
          prices {
            variation
            tcgplayer
            cardmarket
            gbp
            currency
            updatedAt
          }
        }
      }
    }
  }
`;

// Feature flag: opt-in to the new cardsearch module via NEXT_PUBLIC_CARDSEARCH_V2='1'
const USE_CARDSEARCH_V2 = process.env.NEXT_PUBLIC_CARDSEARCH_V2 === '1';

const CARDSEARCH_V2_QUERY = gql`
  query CardSearchV2($input: CardSearchInput!) {
    searchCards(input: $input) {
      total
      limit
      offset
      items {
        cardId
        setCode
        number
        name
        rarity
        images { small large }
        set { code name }
        variants { variant }
        latestPrices {
          variant
          market
          mid
          currency
          updatedAt
        }
      }
    }
  }
`;

const CARDSEARCH_V2_LIMIT = 48;

// Fallback set icon
const FALLBACK_SYMBOL_IMAGE = "https://placehold.co/50x50/webp?text=Icon";

// fetch less at first so results appear faster
const FIRST_PAGE = 16;
const PAGE_SIZE  = 24;

/* ---------------- Helpers ---------------- */

// Choose a useful price row for tiles
function getBestPrice(prices) {
  if (!Array.isArray(prices) || prices.length === 0) return null;
  const pref = ["normal", "holo", "reverse"];
  for (const key of pref) {
    const hit = prices.find(
      (p) =>
        p.variation === key &&
        (typeof p.tcgplayer === "number" ||
          typeof p.cardmarket === "number" ||
          typeof p.gbp === "number")
    );
    if (hit) return hit;
  }
  return prices.find(
    (p) =>
      typeof p.tcgplayer === "number" ||
      typeof p.cardmarket === "number" ||
      typeof p.gbp === "number"
  ) || null;
}

function variationsToArray(v) {
  if (!v || typeof v !== "object") return [];
  return Object.entries(v)
    .filter(([, on]) => !!on)
    .map(([k]) => k);
}

function normalizeNode(n) {
  return {
    ...n,
    tcgImageUrl: n.image,
    prices: Array.isArray(n.prices) ? n.prices : [],
    variations: variationsToArray(n.variations),
  };
}

function edgesToCards(edges) {
  if (!Array.isArray(edges)) return [];
  return edges.map((e) => normalizeNode(e.node));
}

function mapCardsearchVariantFlags(list) {
  const set = new Set(
    (Array.isArray(list) ? list : [])
      .map((v) => {
        if (!v) return '';
        if (typeof v === 'string') return v.toLowerCase();
        return String(v.variant || v.displayName || '').toLowerCase();
      })
      .filter(Boolean)
  );
  return {
    normal: set.size === 0 ? true : set.has('normal'),
    reverse: set.has('reverse') || set.has('reverse holo') || set.has('reverse holofoil'),
    holo: set.has('holo') || set.has('holofoil') || set.has('foil'),
    firstEdition: set.has('firstedition') || set.has('1stedition') || set.has('first edition'),
  };
}

function mapCardsearchV2Items(items) {
  if (!Array.isArray(items) || !items.length) return [];
  return items.map((item, index) => {
    const setRecord = item?.set || {};
    const setCode = item?.setCode || setRecord.code || '';
    const setName = setRecord.name || setCode || item?.setName || '';
    const image = item?.images?.large || item?.images?.small || null;
    const variantFlags = mapCardsearchVariantFlags(item?.variants);
    const prices = Array.isArray(item?.latestPrices)
      ? item.latestPrices.map((p) => ({
          variation: (p?.variant || 'normal').toLowerCase(),
          tcgplayer: null,
          cardmarket: null,
          gbp:
            typeof p?.market === 'number'
              ? p.market
              : typeof p?.mid === 'number'
              ? p.mid
              : null,
          currency: p?.currency || 'GBP',
          updatedAt: p?.updatedAt || null,
        }))
      : [];
    return {
      id: item?.cardId || item?.id || `${setCode}-${item?.number || index}`,
      name: item?.name || '',
      set: setCode || '',
      setName: setName || '',
      number: item?.number || '',
      image,
      rarity: item?.rarity || null,
      variations: variantFlags,
      prices,
    };
  });
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

  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");

  // local result buckets keyed by queryKey so switching filters feels instant
  const bucketsRef = useRef(new Map()); // key -> { items, endCursor, hasNextPage, totalCount }
  const lastKeyRef = useRef(null);

  const [results, setResults] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [endCursor, setEndCursor] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedCardDetail, setSelectedCardDetail] = useState(null);
  const [showCardDetail, setShowCardDetail] = useState(false);
  const [cardDetailData, setCardDetailData] = useState(null);
  const [imageLoadedMap, setImageLoadedMap] = useState({});

  const isExactCardSearch = Boolean(setCode && number);

  // throttle loadMore so we never queue two at once
  const loadingMoreRef = useRef(false);
  const loadMoreTriggerRef = useRef(null);

  const activeQuery = USE_CARDSEARCH_V2 ? CARDSEARCH_V2_QUERY : SEARCH_CARDS_CONNECTION;

  const [runSearch, { data, loading, error, fetchMore }] = useLazyQuery(
    activeQuery,
    {
      fetchPolicy: "cache-first",
      nextFetchPolicy: "cache-first",
      notifyOnNetworkStatusChange: true,
      returnPartialData: true,
    }
  );

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
    e.preventDefault();

    const key = makeQueryKey({ name, setCode, number });
    lastKeyRef.current = key;

    // If we already have a bucket for this query, show it immediately (stale-while-revalidate)
    const bucket = bucketsRef.current.get(key);
    if (bucket) {
      startTransition(() => {
        setResults(bucket.items);
        setHasMore(bucket.hasNextPage);
        setEndCursor(bucket.endCursor || null);
        setIsLoadingMore(false);
      });
    } else {
      startTransition(() => {
        setResults([]); // clean slate
        setHasMore(false);
        setEndCursor(null);
        setIsLoadingMore(false);
      });
    }

    const variables = USE_CARDSEARCH_V2
      ? {
          input: {
            name: name || undefined,
            set: setCode || undefined,
            number: number || undefined,
            limit: isExactCardSearch ? Math.min(CARDSEARCH_V2_LIMIT, 12) : CARDSEARCH_V2_LIMIT,
            offset: 0,
          },
        }
      : {
          input: {
            name,
            set: setCode,
            number,
            first: isExactCardSearch ? Math.min(FIRST_PAGE, 8) : FIRST_PAGE,
            after: null,
            budget: 8,
          },
        };

    const res = await runSearch({ variables });
    const payload = USE_CARDSEARCH_V2 ? res?.data?.searchCards : res?.data?.searchCardsConnection;

    if (!payload) return;

    let items = [];
    let bucketNext = null;

    if (USE_CARDSEARCH_V2) {
      items = mapCardsearchV2Items(payload.items).map((node) => normalizeNode(node));
      const totalCount = Number(payload.total ?? payload.totalCount ?? items.length);
      const initialOffset = Number(payload.offset ?? 0);
      const pageSize = Number(payload.limit ?? CARDSEARCH_V2_LIMIT);
      const nextOffset = Math.min(initialOffset + items.length, totalCount);
      const hasNextPage = nextOffset < totalCount;
      bucketNext = {
        items,
        endCursor: null,
        hasNextPage,
        totalCount,
        nextOffset,
        pageSize,
      };
    } else {
      items = edgesToCards(payload.edges);
      bucketNext = {
        items,
        endCursor: payload.pageInfo?.endCursor || null,
        hasNextPage: !!payload.pageInfo?.hasNextPage,
        totalCount: payload.totalCount || items.length,
      };
    }

    // Cache this bucket
    bucketsRef.current.set(key, bucketNext);

    // Only update visible list if the user is still on the same query
    if (lastKeyRef.current === key) {
      startTransition(() => {
        setResults(items);
        setHasMore(bucketNext.hasNextPage);
        setEndCursor(bucketNext.endCursor);
        setIsLoadingMore(false);
      });
    }
  }, [name, setCode, number, runSearch, isExactCardSearch, USE_CARDSEARCH_V2]);

  // Load more with cursor (manual merge, no double fetch)
  const loadMoreResults = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const key = lastKeyRef.current || currentKey;

      if (USE_CARDSEARCH_V2) {
        const prev = bucketsRef.current.get(key);
        const totalCount = Number(prev?.totalCount ?? 0);
        const pageSize = Number(prev?.pageSize ?? CARDSEARCH_V2_LIMIT);
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

        const res = await fetchMore({ variables: vars });
        const payload = res?.data?.searchCards;
        if (!payload) {
          if (lastKeyRef.current === key) {
            startTransition(() => setHasMore(false));
          }
          return;
        }

        const newItems = mapCardsearchV2Items(payload.items).map((node) => normalizeNode(node));
        const priorItems = Array.isArray(prev.items) ? prev.items : [];
        const combined = [...priorItems, ...newItems];
        const unique = [];
        const seen = new Set();
        combined.forEach((card, idx) => {
          let identifier = card?.id || card?.cardId;
          if (!identifier) {
            const setKey = card?.set || card?.setCode || '';
            const numKey = card?.number || '';
            const combinedKey = `${setKey}-${numKey}`.trim();
            identifier = combinedKey && combinedKey !== '-' ? combinedKey : `card-${idx}`;
          }
          if (seen.has(identifier)) return;
          seen.add(identifier);
          unique.push(card);
        });

        const mergedTotal = Number(payload.total ?? prev.totalCount ?? unique.length);
        const mergedOffset = Math.min(unique.length, mergedTotal);
        const mergedHasNext = mergedOffset < mergedTotal;
        const merged = {
          ...prev,
          items: unique,
          totalCount: mergedTotal,
          nextOffset: mergedOffset,
          pageSize: Number(payload.limit ?? prev.pageSize ?? CARDSEARCH_V2_LIMIT),
          hasNextPage: mergedHasNext,
        };
        bucketsRef.current.set(key, merged);

        if (lastKeyRef.current === key) {
          startTransition(() => {
            setResults(merged.items);
            setHasMore(merged.hasNextPage);
            setEndCursor(null);
          });
        }
        return;
      }

      if (!endCursor) return;

      const vars = {
        input: {
          name,
          set: setCode,
          number,
          first: PAGE_SIZE,
          after: endCursor,
          budget: 4, // tiny preview for next page
        },
      };

      const res = await fetchMore({ variables: vars });
      const payload = res?.data?.searchCardsConnection;
      if (!payload) return;

      const newItems = edgesToCards(payload.edges);

      const prev = bucketsRef.current.get(key) || {
        items: [],
        endCursor: null,
        hasNextPage: false,
        totalCount: 0,
      };
      const merged = {
        items: [...prev.items, ...newItems],
        endCursor: payload.pageInfo?.endCursor || null,
        hasNextPage: !!payload.pageInfo?.hasNextPage,
        totalCount: payload.totalCount || prev.totalCount,
      };
      bucketsRef.current.set(key, merged);

      if (lastKeyRef.current === key) {
        startTransition(() => {
          setResults(merged.items);
          setHasMore(merged.hasNextPage);
          setEndCursor(merged.endCursor);
        });
      }
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [fetchMore, hasMore, endCursor, name, setCode, number, currentKey, USE_CARDSEARCH_V2]);

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
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight">Pokémon Card Search</h1>
          <p className="text-lg text-light-textMuted dark:text-dark-textMuted">
            Search for any Pokémon card and add it to your collection
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
                          <span className="font-bold text-light-accent dark:text-dark-accent">TCGP</span>
                          <span className="font-semibold ml-1 text-light-text dark:text-dark-text">
                            {typeof best?.tcgplayer === "number"
                              ? `£${best.tcgplayer.toFixed(2)}`
                              : typeof best?.gbp === "number"
                              ? `£${best.gbp.toFixed(2)}`
                              : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold text-light-accent dark:text-dark-accent">CMKT</span>
                          <span className="font-semibold ml-1 text-light-text dark:text-dark-text">
                            {typeof best?.cardmarket === "number"
                              ? `£${best.cardmarket.toFixed(2)}`
                              : "—"}
                          </span>
                        </div>
                        {best?.variation && best.variation !== "normal" ? (
                          <span className="ml-1 text-xs text-light-textMuted dark:text-dark-textMuted">
                            ({best.variation})
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
            <div className="text-center text-light-textMuted dark:text-dark-textMuted text-lg py-8">
              No results found. Try adjusting your search criteria.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <CardSkeleton key={idx} dark={dark} />
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


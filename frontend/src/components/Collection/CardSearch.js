"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useLazyQuery } from "@apollo/client";
import { SearchCardsDocument as SEARCH_CARDS } from "@sixbyfive/tcg-binder";

import AddToCollectionPanel from "./AddToCollectionPanel";
import { getCookie } from "@/utils/cookieUtils";
import { useTheme } from "@/hooks/ThemeProvider";
import { getSetLogo } from "@/utils/setLogos";
import Image from "next/image";
import StatusMessage from "@/components/UI/StatusMessage";
import PokemonAutocomplete from "./SearchComponents/PokemonAutocomplete";
import SetAutocomplete from "./SearchComponents/SetAutocomplete";
import CardDetailsModal from "../UserProfile/CardDetailsModal";
import { mapCardToDetail } from "@/utils/mapData";
import CardSkeleton from "../UI/CardSkeleton";

const FALLBACK_SYMBOL_IMAGE = "https://placehold.co/50x50/webp?text=Icon";
const PER_PAGE = 25;

/* -------------------- Pricing helpers -------------------- */

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function parseMaybeJson(val) {
  if (val == null) return null;
  if (typeof val === "number") return { number: val };
  if (typeof val === "string") {
    // sometimes the API returns fields like `"market":"{\"low\":3.7,...}"`
    try {
      const obj = JSON.parse(val);
      return { object: obj };
    } catch {
      const asNum = Number(val);
      return Number.isFinite(asNum) ? { number: asNum } : null;
    }
  }
  if (typeof val === "object") return { object: val };
  return null;
}

function pickTcgplayerNumber(v) {
  // prefer market -> mid -> low; each may be a number OR a JSON string
  const tryKeys = ["market", "mid", "low", "price", "usd"];
  for (const k of tryKeys) {
    const parsed = parseMaybeJson(v?.[k]);
    if (!parsed) continue;
    if ("number" in parsed) return parsed.number;
    if ("object" in parsed) {
      const m = toNum(parsed.object?.market ?? parsed.object?.mid ?? parsed.object?.low);
      if (m != null) return m;
    }
  }
  return null;
}

function pickCardmarketNumber(v) {
  // prefer trendPrice -> averageSellPrice -> lowPrice; may also arrive as JSON string
  const tryKeys = ["trendPrice", "averageSellPrice", "lowPrice", "eur"];
  for (const k of tryKeys) {
    const parsed = parseMaybeJson(v?.[k]);
    if (!parsed) continue;
    if ("number" in parsed) return parsed.number;
    if ("object" in parsed) {
      const t = toNum(
        parsed.object?.trendPrice ??
          parsed.object?.averageSellPrice ??
          parsed.object?.lowPrice
      );
      if (t != null) return t;
    }
  }
  return null;
}

// Turn { normal: {...}, holo: {...}, reverse: {...} } (or JSON string) into:
// [{ variation, tcgplayer, cardmarket, gbp? }]
function normalizePricing(raw) {
  if (raw == null) return [];

  let val = raw;
  if (typeof val === "string") {
    try {
      val = JSON.parse(val);
    } catch {
      return [];
    }
  }

  if (Array.isArray(val)) {
    // Defensive: support array shape if it appears
    return val.map((p) => ({
      variation: p?.variation ?? "normal",
      tcgplayer: toNum(p?.tcgplayer ?? p?.tcg ?? p?.usd ?? p?.price),
      cardmarket: toNum(p?.cardmarket ?? p?.cmk ?? p?.eur),
      gbp: toNum(p?.gbp),
    }));
  }

  if (typeof val === "object") {
    const out = [];
    for (const [variation, v] of Object.entries(val)) {
      if (v && typeof v === "object") {
        out.push({
          variation,
          tcgplayer: pickTcgplayerNumber(v),
          cardmarket: pickCardmarketNumber(v),
          gbp: toNum(v?.gbp),
        });
      } else {
        out.push({ variation, tcgplayer: toNum(v), cardmarket: null, gbp: null });
      }
    }
    return out;
  }

  return [];
}

// Pick a usable price for the tile
function getBestPrice(prices, prefer = "normal") {
  if (!Array.isArray(prices)) return { variation: null, tcgplayer: null, cardmarket: null };
  const preferred = prices.find((p) => p.variation === prefer);
  if (preferred) return preferred;
  return (
    prices.find(
      (p) =>
        (p.tcgplayer != null && !Number.isNaN(p.tcgplayer)) ||
        (p.cardmarket != null && !Number.isNaN(p.cardmarket))
    ) || { variation: null, tcgplayer: null, cardmarket: null }
  );
}

function normalizeCard(node) {
  return {
    ...node,
    prices: normalizePricing(node.pricing), // UI uses this
    tcgImageUrl: node.image,
    variations: Array.isArray(node.variations) ? node.variations : [],
  };
}

/* -------------------- Component -------------------- */

export default function CardSearch() {
  const { dark } = useTheme();

  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");

  const [results, setResults] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedCardDetail, setSelectedCardDetail] = useState(null);

  const [showCardDetail, setShowCardDetail] = useState(false);
  const [cardDetailData, setCardDetailData] = useState(null);

  const isExactCardSearch = Boolean(setCode && number);

  const [runSearch, { data, loading, error, fetchMore, refetch }] = useLazyQuery(SEARCH_CARDS, {
    notifyOnNetworkStatusChange: true,
  });

  // Map apollo result to local state
  useEffect(() => {
    if (!data?.searchCards) return;
    const edges = Array.isArray(data.searchCards.edges) ? data.searchCards.edges : [];
    const cards = edges.map((e) => normalizeCard(e.node));
    setResults(cards);
    setCursor(data.searchCards.pageInfo?.endCursor ?? null);
    setHasMore(!!data.searchCards.pageInfo?.hasNextPage && !isExactCardSearch);
  }, [data, isExactCardSearch]);

  // One quick refresh if some pricing is empty (server may fill a moment later)
  const maybeRefreshIfMissingPrices = useCallback(() => {
    const anyMissing = results.some((c) => !c.prices || c.prices.length === 0);
    if (!anyMissing || !refetch) return;
    setTimeout(() => {
      refetch();
    }, 1500);
  }, [results, refetch]);

  // Main search
  const handleSearch = async (e) => {
    e.preventDefault();
    setResults([]);
    setCursor(null);
    setHasMore(false);

    const variables = {
      input: {
        name,
        set: setCode,
        number,
        first: PER_PAGE,
        after: null,
      },
    };

    await runSearch({ variables });
    // schedule possible refresh for missing pricing
    setTimeout(() => maybeRefreshIfMissingPrices(), 50);
  };

  // Load more via Apollo fetchMore
  const loadMoreResults = useCallback(async () => {
    if (isExactCardSearch || isLoadingMore || !hasMore || !cursor) return;
    setIsLoadingMore(true);
    try {
      const variables = {
        input: {
          name,
          set: setCode,
          number,
          first: PER_PAGE,
          after: cursor,
        },
      };
      const res = await fetchMore({ variables });
      const edges = Array.isArray(res?.data?.searchCards?.edges) ? res.data.searchCards.edges : [];
      const more = edges.map((e) => normalizeCard(e.node));
      setResults((prev) => [...prev, ...more]);
      setCursor(res?.data?.searchCards?.pageInfo?.endCursor ?? null);
      setHasMore(!!res?.data?.searchCards?.pageInfo?.hasNextPage && !isExactCardSearch);
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, hasMore, isExactCardSearch, name, number, setCode, fetchMore, isLoadingMore]);

  // Auto-load more when results come in (except exact card search)
  useEffect(() => {
    if (!loading && !isExactCardSearch && hasMore && results.length > 0 && !isLoadingMore) {
      loadMoreResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, hasMore]);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || isExactCardSearch || loading) return;
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
      if (nearBottom && !isLoadingMore) {
        loadMoreResults();
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasMore, isExactCardSearch, isLoadingMore, loadMoreResults, loading]);

  const showStatusMessage = (type, message) => {
    setStatusMessage({ type, message });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Wishlist unchanged (kept for completeness)
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

  // ✅ Card details modal gets full pricing context
  function handleCardDetail(card) {
    const detail = {
      ...mapCardToDetail(card),
      modalImage: card.tcgImageUrl || card.image,
      prices: card.prices,            // [{ variation, tcgplayer, cardmarket, gbp? }]
      variations: card.variations,    // ["normal","holo","reverse",...]
      pricingRaw: card.pricing ?? {}, // original map if needed
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
          className="
            bg-light-surface dark:bg-dark-surface
            rounded-2xl p-8 pt-8 pb-5
            shadow-lg dark:shadow-[0_6px_24px_0_rgba(12,8,24,0.18)]
            mb-9
            border border-light-border dark:border-dark-border
            transition-colors
          "
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 mb-0">
            {/* Name */}
            <div>
              <label className="block text-base font-medium mb-2">Card Name</label>
              <PokemonAutocomplete
                value={name}
                onChange={setName}
                onSelect={setName}
                className="w-full"
                inputClassName="
                  w-full border rounded-xl px-4 py-3 text-base
                  bg-light-alt dark:bg-dark-alt
                  border-light-border dark:border-dark-border
                  text-light-text dark:text-dark-text
                  placeholder-light-textMuted dark:placeholder-dark-textMuted
                  focus:border-light-accent dark:focus:border-dark-accent
                  focus:outline-none transition
                "
              />
            </div>

            {/* Set */}
            <div>
              <label className="block text-base font-medium mb-2">
                <span className="flex items-center gap-3">
                  Set
                  <div className="relative group inline-block align-middle">
                    <svg
                      className="w-4 h-4 text-light-accent dark:text-dark-accent cursor-pointer"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                      aria-label="Information"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <circle cx="12" cy="16" r="1" fill="currentColor" />
                    </svg>
                    <div
                      className="
                        absolute left-0 top-full mt-2 z-50 w-max min-w-[220px] max-w-xs
                        bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text
                        px-3 py-2 rounded shadow-lg text-xs border border-light-border dark:border-dark-border
                        opacity-0 group-hover:opacity-100
                        pointer-events-none transition-opacity duration-200
                      "
                    >
                      <svg
                        className="absolute left-0 -top-2"
                        width="20"
                        height="12"
                        viewBox="0 0 20 12"
                        fill="none"
                        aria-hidden="true"
                      >
                        <polygon points="0,12 10,0 20,12" fill="currentColor" className="dark:fill-dark-surface" />
                      </svg>
                      You can enter a set code (e.g, <b>sv08</b>), set abbreviation (e.g, <b>SSP</b>), or type the set name.
                    </div>
                  </div>
                </span>
              </label>
              <SetAutocomplete
                value={setCode}
                onChange={setSetCode}
                onSelect={setSetCode}
                className="w-full"
                inputClassName="
                  w-full border rounded-xl px-4 py-3 text-base
                  bg-light-alt dark:bg-dark-alt
                  border-light-border dark:border-dark-border
                  text-light-text dark:text-dark-text
                  placeholder-light-textMuted dark:placeholder-dark-textMuted
                  focus:border-light-accent dark:focus:border-dark-accent
                  focus:outline-none transition
                "
              />
            </div>

            {/* Number */}
            <div>
              <label className="block text-base font-medium mb-2">Card Number</label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Card number"
                className="
                  w-full border rounded-xl px-4 py-3 text-base
                  bg-light-alt dark:bg-dark-alt
                  border-light-border dark:border-dark-border
                  text-light-text dark:text-dark-text
                  placeholder-light-textMuted dark:placeholder-dark-textMuted
                  focus:border-light-accent dark:focus:border-dark-accent
                  focus:outline-none transition
                "
              />
            </div>

            {/* Button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="
                  bg-light-accent dark:bg-dark-accent
                  text-light-surface dark:text-white
                  font-bold text-lg border-none rounded-xl px-8 py-3
                  shadow-md transition
                  hover:bg-light-accentLight dark:hover:bg-dark-accentLight
                  hover:text-light-surface dark:hover:text-white
                  disabled:opacity-60 disabled:cursor-not-allowed
                  w-full
                "
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
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow flex flex-col p-3 min-h-[300px] pointer-events-none"
                key={idx}
              >
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
              {results.map((card) => {
                const priceObj = getBestPrice(card.prices, "normal");
                return (
                  <div
                    className="
                      bg-light-surface dark:bg-dark-surface
                      rounded-2xl shadow hover:shadow-2xl flex flex-col p-3 min-h-[320px] transition
                      border border-light-border dark:border-dark-border
                    "
                    key={card.id}
                    onClick={() => handleCardDetail(card)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") handleCardDetail(card);
                    }}
                    role="button"
                    aria-label={`View details for ${card.name}`}
                  >
                    <div className="relative w-full aspect-[245/337] bg-light-alt dark:bg-dark-alt rounded-xl mb-3 overflow-hidden">
                      <Image
                        src={card.tcgImageUrl || card.image}
                        alt={card.name}
                        fill
                        unoptimized
                        className="object-contain object-center rounded-xl"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-base font-bold flex-1 truncate">{card.name}</span>
                        <img
                          src={getSetLogo(card.setName)}
                          alt={card.setName || "Set logo"}
                          className="w-8 h-5 rounded bg-light-alt dark:bg-dark-alt"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = FALLBACK_SYMBOL_IMAGE;
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-sm text-light-textMuted dark:text-dark-textMuted">
                        <span className="whitespace-nowrap">{card.setName}</span>
                        <span className="font-semibold">#{card.number}</span>
                      </div>

                      {/* ✅ Pricing on tiles */}
                      <div className="flex gap-3 text-sm my-1">
                        <div>
                          <span className="font-bold text-light-accent dark:text-dark-accent">TCGP</span>
                          <span className="font-semibold ml-1 text-light-text dark:text-dark-text">
                            {priceObj.tcgplayer != null ? `£${priceObj.tcgplayer.toFixed(2)}` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold text-light-accent dark:text-dark-accent">CMKT</span>
                          <span className="font-semibold ml-1 text-light-text dark:text-dark-text">
                            {priceObj.cardmarket != null ? `£${priceObj.cardmarket.toFixed(2)}` : "—"}
                          </span>
                        </div>
                        {priceObj.variation && priceObj.variation !== "normal" ? (
                          <span className="ml-1 text-xs text-light-textMuted dark:text-dark-textMuted">
                            ({priceObj.variation})
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
                          className="
                            rounded-lg px-4 py-2
                            bg-light-accent dark:bg-dark-accent
                            text-light-surface dark:text-dark-surface
                            font-semibold
                            hover:bg-light-accentLight dark:hover:bg-dark-accentLight
                            hover:text-light-surface dark:hover:text-dark-surface
                            transition
                          "
                        >
                          Add
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToWishlist(card);
                          }}
                          className="
                            rounded-lg px-4 py-2
                            border-2 border-light-accent dark:border-dark-accent
                            text-light-accent dark:text-dark-accent
                            font-semibold
                            hover:bg-light-accent dark:hover:bg-dark-accent
                            hover:text-light-surface dark:hover:text-dark-surface
                            transition
                          "
                        >
                          Wishlist
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {isLoadingMore &&
                Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow flex flex-col p-3 min-h-[300px] pointer-events-none"
                    key={`load-${idx}`}
                  >
                    <div className="w-full aspect-[245/337] bg-light-alt dark:bg-dark-alt rounded-xl mb-3 relative shimmer"></div>
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="h-3.5 bg-light-alt dark:bg-dark-alt rounded w-full shimmer"></div>
                      <div className="h-3.5 bg-light-alt dark:bg-dark-alt rounded w-3/4 shimmer"></div>
                      <div className="h-3.5 bg-light-alt dark:bg-dark-alt rounded w-1/2 shimmer"></div>
                    </div>
                  </div>
                ))}
            </div>

            {!isExactCardSearch && hasMore && (
              <div className="flex items-center justify-center gap-4 mt-12 mb-4 text-lg text-light-textMuted dark:text-dark-textMuted">
                <span className="inline-block w-[22px] h-[22px] border-4 border-light-accent dark:border-dark-accent border-r-transparent rounded-full animate-spin"></span>
                Loading more cards...
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

        {/* ✅ Card Details Modal receives full pricing context */}
        {showCardDetail && cardDetailData && (
          <CardDetailsModal card={cardDetailData} onClose={() => setShowCardDetail(false)} dark={dark} />
        )}
      </div>
    </div>
  );
}

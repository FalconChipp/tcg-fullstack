"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import AddToCollectionPanel from "./AddToCollectionPanel";
import { getCookie } from "@/utils/cookieUtils";
import { useTheme } from "@/hooks/ThemeProvider";
import { getSetLogo } from "@/utils/setLogos";
import Image from "next/image";
import StatusMessage from '@/components/UI/StatusMessage';
import PokemonAutocomplete from "./SearchComponents/PokemonAutocomplete";
import SetAutocomplete from "./SearchComponents/SetAutocomplete";
import CardDetailsModal from "../UserProfile/CardDetailsModal";
import { mapCardToDetail } from "@/utils/mapData";
import CardSkeleton from "../UI/CardSkeleton";

// --- CONSTANTS ---
const FALLBACK_CARD_IMAGE = "https://cdn.pidgi.net/images/f/f6/Card_back_INTL_-_Pokemon_Trading_Card_Game.png";
const FALLBACK_SYMBOL_IMAGE = "https://placehold.co/50x50/webp?text=Icon";
const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";
const PER_PAGE = 25;

export default function CardSearch() {
  const { dark } = useTheme();
  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");
  const [language, setLanguage] = useState("en");

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedCardDetail, setSelectedCardDetail] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  
  const [showCardDetail, setShowCardDetail] = useState(false);
  const [cardDetailData, setCardDetailData] = useState(null);

  const isExactCardSearch = Boolean(setCode && number);

  // --- Fetch cards with GraphQL query ---
  const fetchCards = async (pageToFetch = 1) => {
    const query = `
      query SearchCards($input: SearchInput!) {
        searchCards(input: $input) {
          cards {
            id
            name
            number
            setName
            image
            rarity
            variations
            prices {
              variation
              tcgplayer
              cardmarket
              updatedAt
            }
          }
          total
          page
          pageSize
        }
      }
    `;
    const variables = {
      input: {
        name,
        set: setCode,
        number,
        page: pageToFetch,
        pageSize: PER_PAGE,
      }
    };

    const res = await fetch(WP_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0].message);
    return json.data.searchCards.cards;
  };

  // --- Main search handler ---
  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPage(1);
    setHasMore(true);

    try {
      const cards = await fetchCards(1);
      setResults(cards);
      setHasMore(cards.length === PER_PAGE);
    } catch (err) {
      setError(err.message);
      setResults([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  // --- Infinite scroll load ---
  const loadMoreResults = useCallback(async () => {
    if (isExactCardSearch || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    try {
      const nextPage = page + 1;
      const cards = await fetchCards(nextPage);
      if (cards.length < PER_PAGE) setHasMore(false);
      setPage(nextPage);
      setResults(prev => [...prev, ...cards]);
    } catch (err) {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, hasMore, isLoadingMore, isExactCardSearch, name, setCode, number, language]);

  // --- Show status message for add-to-wishlist etc ---
  const showStatusMessage = (type, message) => {
    setStatusMessage({ type, message });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // --- Add card to wishlist ---
const handleAddToWishlist = async (card) => {
  const token = getCookie("authToken");
  if (!token) {
    showStatusMessage('error', "You must be logged in to add to wishlist.");
    return;
  }

  // Your backend allows extra args, so set defaults for all:
  const mutation = `
    mutation QuickAddWishlist($cardId: String!, $quantity: Int, $condition: String, $variation: String, $wishlist: Boolean) {
      addToCollection(
        cardId: $cardId,
        quantity: $quantity,
        condition: $condition,
        variation: $variation,
        wishlist: $wishlist
      ) {
        id
        cardId
        quantity
        condition
        variation
        wishlist
        createdAt
        updatedAt
      }
    }
  `;
  const variables = {
    cardId: card.cardId,                 // or card.cardId if that is the primary key, adjust as needed
    quantity: 1,
    condition: "mint",
    variation: card.variation || (Array.isArray(card.variations) && card.variations.length > 0 ? card.variations[0] : ""),
    wishlist: true
  };

  try {
    const res = await fetch(WP_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });
    const json = await res.json();

    // CHANGED: check new backend field
    if (json.data?.addToCollection && json.data.addToCollection.wishlist) {
      showStatusMessage('success', `"${card.name}" was added to your wishlist!`);
    } else if (json.errors && json.errors.length > 0) {
      showStatusMessage('error', json.errors[0].message || "Failed to add to wishlist.");
    } else {
      showStatusMessage('error', "Failed to add to wishlist.");
    }
  } catch (err) {
    showStatusMessage('error', "Network error. Please try again.");
  }
};


  // --- Infinite scroll event listener ---
  useEffect(() => {
    if (!hasMore || isExactCardSearch || loading) return;
    const handleScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
      if (nearBottom && !isLoadingMore) {
        loadMoreResults();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, isExactCardSearch, isLoadingMore, loadMoreResults, loading]);

  // --- Handle card detail modal open ---
  function handleCardDetail(card) {
    setCardDetailData(mapCardToDetail(card));
    setShowCardDetail(true);
  }

  // --- JSX ---
  return (
    <div className={`min-h-screen bg-light-background text-light-text dark:bg-dark-background dark:text-dark-text transition-colors`}>
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
                inputClassName={`
                  w-full border rounded-xl px-4 py-3 text-base
                  bg-light-alt dark:bg-dark-alt
                  border-light-border dark:border-dark-border
                  text-light-text dark:text-dark-text
                  placeholder-light-textMuted dark:placeholder-dark-textMuted
                  focus:border-light-accent dark:focus:border-dark-accent
                  focus:outline-none transition
                `}
              />
            </div>
            {/* Set */}
            <div>
              <label className="block text-base font-medium mb-2">
                <span className="flex items-center gap-3">
                  Set
                  <div className="relative group inline-block align-middle">
                    {/* Info icon */}
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
                    {/* Tooltip */}
                    <div className="
                      absolute left-0 top-full mt-2 z-50 w-max min-w-[220px] max-w-xs
                      bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text
                      px-3 py-2 rounded shadow-lg text-xs border border-light-border dark:border-dark-border
                      opacity-0 group-hover:opacity-100
                      pointer-events-none transition-opacity duration-200
                    ">
                      {/* Arrow */}
                      <svg
                        className="absolute left-0 -top-2"
                        width="20"
                        height="12"
                        viewBox="0 0 20 12"
                        fill="none"
                        aria-hidden="true"
                      >
                        <polygon
                          points="0,12 10,0 20,12"
                          fill="currentColor"
                          className="dark:fill-dark-surface"
                        />
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
                inputClassName={`
                  w-full border rounded-xl px-4 py-3 text-base
                  bg-light-alt dark:bg-dark-alt
                  border-light-border dark:border-dark-border
                  text-light-text dark:text-dark-text
                  placeholder-light-textMuted dark:placeholder-dark-textMuted
                  focus:border-light-accent dark:focus:border-dark-accent
                  focus:outline-none transition
                `}
              />
            </div>
            {/* Card Number */}
            <div>
              <label className="block text-base font-medium mb-2">Card Number</label>
              <input
                type="text"
                value={number}
                onChange={e => setNumber(e.target.value)}
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
            {/* Search Button */}
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
              {error}
            </div>
          )}
        </form>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow flex flex-col p-3 min-h-[300px] pointer-events-none" key={idx}>
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
              {results.map(cardRaw => {
                const card = mapCardToDetail(cardRaw)
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
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleCardDetail(card); }}
                  role="button"
                  aria-label={`View details for ${card.name}`}
                >
                  <div className="relative w-full aspect-[245/337] bg-light-alt dark:bg-dark-alt rounded-xl mb-3 overflow-hidden">
                    <Image
                      src={card.tcgImageUrl}
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
                        onError={e => {
                          e.target.onerror = null;
                          e.target.src = FALLBACK_SYMBOL_IMAGE;
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-sm text-light-textMuted dark:text-dark-textMuted">
                      <span className="whitespace-nowrap">{card.setName}</span>
                      <span className="font-semibold">#{card.number}</span>
                    </div>
                    <div className="flex gap-2 text-sm my-1">
                      <div>
                        <span className="font-bold text-light-accent dark:text-dark-accent">TCGP</span>
                        <span className="font-semibold ml-1 text-light-text dark:text-dark-text">
                          {card.tcgplayerMarket ? `£${card.tcgplayerMarket.toFixed(2)}` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-light-accent dark:text-dark-accent">CMKT</span>
                        <span className="font-semibold ml-1 text-light-text dark:text-dark-text">
                          {card.cardmarketAverageSell ? `£${card.cardmarketAverageSell.toFixed(2)}` : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedCardDetail(card); setPanelOpen(true); }}
                        className="
                          rounded-lg px-4 py-2
                          bg-light-accent dark:bg-dark-accent
                          text-light-surface dark:text-dark-surface
                          font-semibold
                          hover:bg-light-accentLight dark:hover:bg-dark-accentLight
                          hover:text-light-surface dark:hover:text-dark-surface
                          transition
                        "
                      >Add</button>
                      <button
                        onClick={e => { e.stopPropagation(); handleAddToWishlist(card); }}
                        className="
                          rounded-lg px-4 py-2
                          border-2 border-light-accent dark:border-dark-accent
                          text-light-accent dark:text-dark-accent
                          font-semibold
                          hover:bg-light-accent dark:hover:bg-dark-accent
                          hover:text-light-surface dark:hover:text-dark-surface
                          transition
                        "
                      >Wishlist</button>
                    </div>
                  </div>
                </div>
              )})}
              {isLoadingMore &&
                Array.from({ length: 4 }).map((_, idx) => (
                  <div className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow flex flex-col p-3 min-h-[300px] pointer-events-none" key={`load-${idx}`}>
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
          <AddToCollectionPanel
            cardDetail={selectedCardDetail}
            onClose={() => setPanelOpen(false)}
          />
        )}
        {/* Status Message Container */}
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
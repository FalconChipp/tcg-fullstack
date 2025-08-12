import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCardImageUrl } from '@/utils/imageUtils';

// TCG Pocket cards filter (unchanged)
const TCG_POCKET_CODES = [
  'P-A', 'A1', 'A1A', 'A2', 'A2A', 'A2B', 'A3',
];

function isPocketCard(card) {
  if (!card) return false;
  if (card.externalId) {
    const prefix = card.externalId.split('-')[0].toUpperCase();
    if (TCG_POCKET_CODES.includes(prefix)) return true;
    if (card.externalId.split('/')[0].toUpperCase() === 'P-A') return true;
  }
  if (typeof card.setName === "string" && card.setName.toLowerCase() === "tcgp") {
    return true;
  }
  const img = card.image || card.tcgImageUrl || "";
  if (img.toLowerCase().includes("/tcgp/")) {
    return true;
  }
  return false;
}

const FALLBACK_CARD_IMAGE = "/images/card-placeholder.svg";

const getCardImage = (card) => {
  if (!card) return FALLBACK_CARD_IMAGE;
  const providedUrl = getCardImageUrl(card.image, {
    cardName: card.name,
    cardId: card.externalId,
    debug: true
  });
  if (!providedUrl || providedUrl === FALLBACK_CARD_IMAGE) {
    const baseUrl = `https://assets.tcgdex.net/en/${card.setName?.toLowerCase()}/${card.externalId}`;
    return getCardImageUrl(baseUrl, {
      cardName: card.name,
      cardId: card.externalId,
      debug: true
    });
  }
  return providedUrl;
};

export default function BinderCardSearch({
  onDragStart,
  isOwnProfile,
  searchTerm = '',
  onSearchTermChange = () => {},
  searchResults = [],
  onSearchResultsChange = () => {},
  searchPage = 1,
  onSearchPageChange = () => {},
  hasMoreResults = true,
  onHasMoreResultsChange = () => {}
}) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const observer = useRef();

  // Infinite scroll: attaches to the last card in the grid
  const lastCardRef = useCallback(node => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreResults) {
        onSearchPageChange(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMoreResults, onSearchPageChange]);

  // -- Fixed version: Fetch ONE API page per client scroll page, append all valid results --
  const fetchCards = useCallback(async (currentPage, isNewSearch = false) => {
    if (!searchTerm.trim()) return;

    if (currentPage > 1) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
    }

    try {
      const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;
      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query SearchCards($input: SearchInput!) {
              searchCards(input: $input) {
                cards {
                  externalId: id
                  name
                  image
                  setName
                  rarity
                }
              }
            }
          `,
          variables: {
            input: { name: searchTerm, page: currentPage, pageSize: 28 }
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const response = await res.json();
      const serverCards = response.data?.searchCards?.cards || [];
      const filteredCards = serverCards.filter(card => !isPocketCard(card));

      // If API returned less than 28, this was the last page.
      onHasMoreResultsChange(serverCards.length === 28);

      if (isNewSearch) {
        onSearchResultsChange(filteredCards);
      } else {
        onSearchResultsChange(prev => [...prev, ...filteredCards]);
      }
    } catch (err) {
      setError(`Search failed: ${err.message}`);
    } finally {
      if (currentPage > 1) setLoadingMore(false);
      else setLoading(false);
    }
  }, [searchTerm, onSearchResultsChange, onHasMoreResultsChange]);

  // Handle "search" button or enter key (new search always resets page 1)
  const handleSearch = (e) => {
    e.preventDefault();
    onSearchPageChange(1);
    fetchCards(1, true);
  };

  // When the user scrolls/paginates, load more (will only fire for >1)
  useEffect(() => {
    if (searchPage > 1) {
      fetchCards(searchPage, false);
    }
  }, [searchPage, fetchCards]);

  // When the searchTerm changes, clear results & reset
  useEffect(() => {
    onSearchPageChange(1);
    onSearchResultsChange([]);
    onHasMoreResultsChange(true);
  }, [searchTerm, onSearchPageChange, onSearchResultsChange, onHasMoreResultsChange]);

  // Cleanup intersection observer on unmount
  useEffect(() => {
    return () => {
      observer.current?.disconnect();
    };
  }, []);

  // Drag logic
  const handleDrag = (e, card) => {
    const dragData = {
      ...card,
      tcgImageUrl: card.tcgImageUrl || card.image,
      tcgName: card.tcgName || card.name,
      isSearchResult: true,
      cardId: card.cardId || card.externalId,
      _originalQuantity: null
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    if (onDragStart) onDragStart(dragData, e);
  }

  // ---- Render ----
  return (
    <div className="p-4">
      {/* Search input */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={e => onSearchTermChange(e.target.value)}
          placeholder="Search for cards..."
          className="
            flex-1 px-3 py-2 rounded
            border border-light-border dark:border-dark-border
            bg-light-surface dark:bg-dark-surface
            text-light-text dark:text-dark-text
            placeholder-light-textMuted dark:placeholder-dark-textMuted
            focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
            transition
          "
        />
        <button
          type="submit"
          disabled={loading}
          className="
            px-4 py-2
            rounded
            font-semibold
            bg-light-accent dark:bg-dark-accent
            text-white
            disabled:bg-light-border dark:disabled:bg-dark-border
            transition
          "
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {loading && <p className="text-center text-light-textMuted dark:text-dark-textMuted">Loading...</p>}
      {error && <p className="text-light-error dark:text-dark-error">{error}</p>}

      {/* Card Grid - PALETTE CLASSES ONLY */}
      <div
        className="
          grid
          grid-cols-2
          sm:grid-cols-3
          md:grid-cols-4
          lg:grid-cols-4
          xl:grid-cols-4
          gap-4
          px-2 py-4
          bg-transparent
        "
        style={{ alignContent: "start" }}
      >
        {searchResults.filter(card => !isPocketCard(card)).map((card, index) => (
          <div
            key={card.externalId}
            ref={index === searchResults.length - 1 ? lastCardRef : null}
            draggable={isOwnProfile}
            onDragStart={(e) => {
              if (!e.dataTransfer) e.persist();
              handleDrag(e, card);
            }}
            onDragEnd={(e) => {
              e.preventDefault();
              if (e.dataTransfer) e.dataTransfer.clearData();
            }}
            className="
              flex flex-col items-center justify-center
              rounded-2xl
              bg-light-surface dark:bg-dark-surface
              border border-light-border dark:border-dark-border
              shadow hover:shadow-xl
              transition-all cursor-move group
              relative
              mx-auto
              aspect-[245/342]
              w-full
              max-w-[180px]
              min-w-[120px]
            "
          >
            <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
              <img
                src={getCardImage(card)}
                alt={card.tcgName || card.name}
                className="object-contain w-full h-full rounded-2xl group-hover:scale-105 transition-transform duration-200"
                draggable={false}
                onDragStart={e => e.preventDefault()}
                onError={e => {
                  e.target.style.display = 'none';
                  const fallback = e.target.nextElementSibling;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <p className="text-white text-xs truncate text-center" title={card.tcgName || card.name}>
                  {card.tcgName || card.name}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {loadingMore && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-light-accent dark:border-dark-accent"></div>
        </div>
      )}
    </div>
  );
}

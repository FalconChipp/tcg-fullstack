"use client";

import React, { useState, useMemo, useContext, useEffect, useRef } from "react"; // CHANGED: add useRef
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation"; // NEW: read query params + optionally clean URL
import { getSetLogo } from "@/utils/setLogos";
import EditCollectionCardModal from "@/components/Collection/EditCollectionCardModal";
import CardDetailsModal from "@/components/Cards/CardDetailsModal";
import { formatCondition, getConditionClass } from "@/utils/formatCondition";
import { formatRelativeTime } from "@/utils/formatDate";
import { AuthContext } from "@/components/Auth/AuthProvider";
import QuantitySelectorModal from "@/components/UI/QuantitySelectorModal";
import { getCardImageUrl } from "@/utils/imageUtils";
import CardSkeleton from "@/components/UI/CardSkeleton";

import useProfileCollection from "@/hooks/useProfileCollection";
import useProfileCardActions from "@/hooks/useProfileCardActions";

const SORT_OPTIONS = [
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
  { value: "set-asc", label: "Set (A-Z)" },
  { value: "set-desc", label: "Set (Z-A)" },
  { value: "price-asc", label: "Price (Low to High)" },
  { value: "price-desc", label: "Price (High to Low)" },
  { value: "date-asc", label: "Date Added (Oldest First)" },
  { value: "date-desc", label: "Date Added (Newest First)" },
  { value: "quantity-asc", label: "Quantity (Low to High)" },
  { value: "quantity-desc", label: "Quantity (High to Low)" },
];

const currencyFmt = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatCurrency = (v) => currencyFmt.format(v);

/* ---------------------------------------------
   Pricing helpers (handle all shapes you might get)
   --------------------------------------------- */

/** Coerce any “prices”/“pricing.latest” shape into a list of entries */
function normalizePricesList(cardLike) {
  if (!cardLike) return [];

  // Prefer already-flattened list
  if (Array.isArray(cardLike.latestPrices)) return cardLike.latestPrices; // CHANGED
  if (Array.isArray(cardLike.prices)) return cardLike.prices;

  // PokémonTCG-normalized shape stored by backend: { latest: [...] }
  if (cardLike.pricing && Array.isArray(cardLike.pricing.latest)) {
    return cardLike.pricing.latest;
  }

  // Legacy vendor object: { tcgplayer: {...} cardmarket: {...} gbp?: number }
  if (
    cardLike.pricing &&
    typeof cardLike.pricing === "object" &&
    (cardLike.pricing.tcgplayer || cardLike.pricing.cardmarket || cardLike.pricing.gbp != null)
  ) {
    return [
      {
        variation: "normal",
        ...cardLike.pricing,
      },
    ];
  }

  // Legacy numeric fields on the card record (DB columns)
  // tcgplayerMarket / cardmarketTrendPrice are the best single-estimates
  const maybeEntry = {};
  let hasAny = false;

  // try cardLike first
  if (typeof cardLike.tcgplayerMarket === "number") {
    maybeEntry.tcgplayer = cardLike.tcgplayerMarket;
    hasAny = true;
  }
  if (typeof cardLike.cardmarketTrendPrice === "number") {
    maybeEntry.cardmarket = cardLike.cardmarketTrendPrice;
    hasAny = true;
  }

  // if nothing, try nested card
  const nested = cardLike.card || null;
  if (!hasAny && nested) {
    if (typeof nested.tcgplayerMarket === "number") {
      maybeEntry.tcgplayer = nested.tcgplayerMarket;
      hasAny = true;
    }
    if (typeof nested.cardmarketTrendPrice === "number") {
      maybeEntry.cardmarket = nested.cardmarketTrendPrice;
      hasAny = true;
    }
  }

  if (hasAny) {
    return [{ variation: "normal", ...maybeEntry }];
  }

  // If the usable shape actually sits under nested card
  if (cardLike.card) return normalizePricesList(cardLike.card);

  return [];
}

/** Compute a single GBP number from a price entry */
function extractGBP(entry) {
  if (!entry || typeof entry !== "object") return null;
  // Explicit gbp field wins
  if (typeof entry.gbp === "number" && Number.isFinite(entry.gbp)) return entry.gbp;

  // Otherwise average of tcgplayer/cardmarket if both exist
  const toNum = (v) => (typeof v === "number" ? v : Number.isFinite(Number(v)) ? Number(v) : null);
  const tp = toNum(entry.tcgplayer);
  const cm = toNum(entry.cardmarket);
  if (tp != null && cm != null) return (tp + cm) / 2;
  if (tp != null) return tp;
  if (cm != null) return cm;

  // Some shapes have nested vendor payloads; try common fields
  const nTP =
    toNum(entry?.tcgplayer?.market) ??
    toNum(entry?.tcgplayer?.mid) ??
    toNum(entry?.tcgplayer?.low) ??
    null;
  const nCM =
    toNum(entry?.cardmarket?.trendPrice) ??
    toNum(entry?.cardmarket?.averageSellPrice) ??
    toNum(entry?.cardmarket?.lowPrice) ??
    null;

  if (nTP != null && nCM != null) return (nTP + nCM) / 2;
  if (nTP != null) return nTP;
  if (nCM != null) return nCM;

  return null;
}

/** Pick the best-matching price entry given a desired variation */
function pickPriceEntry(pricesList, desiredVariation) {
  if (!Array.isArray(pricesList) || pricesList.length === 0) return null;
  const safeVar = (v) => String(v || "").toLowerCase().replace(/\s+/g, "_");

  if (desiredVariation) {
    const d = safeVar(desiredVariation);
    const exact = pricesList.find((p) => safeVar(p.variation) === d);
    if (exact) return exact;
  }

  // Preference order if no exact match
  const pref = ["normal", "holo", "reverse", "firstedition", "first_edition"];
  for (const key of pref) {
    const hit = pricesList.find((p) => safeVar(p.variation) === key);
    if (hit) return hit;
  }

  // Fallback: first entry with a usable price
  const priced = pricesList.find((p) => extractGBP(p) != null);
  return priced || pricesList[0];
}

/** Public helper used for both display and sort */
function getCardGBP(cardLike) {
  // Variation can be on the collection row OR nested card OR default to "normal"
  const desiredVariation = cardLike?.variation || cardLike?.card?.variation || "normal";

  const list = normalizePricesList(cardLike);
  const entry = pickPriceEntry(list, desiredVariation);
  if (!entry) return null;
  const gbp = extractGBP(entry);
  return gbp != null && Number.isFinite(gbp) ? gbp : null;
}

/* --------------------------------------------- */

const getDate = (date) => {
  if (!date) return null;
  if (typeof date === "string" && /^\d+$/.test(date.trim())) return new Date(parseInt(date, 10));
  return new Date(date);
};

function CollectionSkeletonGrid({ count = 10 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-6">
      {Array.from({ length: count }).map((_, idx) => (
        <CardSkeleton key={idx} />
      ))}
    </div>
  );
}

export default function ProfileCollectionPanel({
  userId,
  profile,
  isOwnProfile,
  onAddToCollection,
  onCardUpdated,
  dark,
  onCollectionValueChange,
}) {
  const { token } = useContext(AuthContext);

  // NEW: deep-link params
  const searchParams = useSearchParams();
  const router = useRouter();
  const deepLinkHandledRef = useRef(false); // NEW: prevent re-opening

  const effectiveUserId = profile?.userId || userId;

  const { collection, loading } = useProfileCollection({
    userId: effectiveUserId,
    token,
  });

  // Local display state for instant updates
  const [displayCollection, setDisplayCollection] = useState(collection.value || []);
  useEffect(() => {
    setDisplayCollection(collection.value || []);
  }, [collection.value]);

  // NEW: compute total collection value from current displayCollection
  const collectionValue = useMemo(
    () =>
      (displayCollection || []).reduce((sum, card) => {
        const price = getCardGBP(card) ?? 0;
        const qty = card.quantity || 1;
        return sum + price * qty;
      }, 0),
    [displayCollection]
  );

  // NEW: notify parent (Profile page) whenever value changes
  useEffect(() => {
    if (typeof onCollectionValueChange === "function") {
      onCollectionValueChange(collectionValue);
    }
  }, [collectionValue, onCollectionValueChange]);

  const [setFilter, setSetFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState("name-asc");
  const [selectedCard, setSelectedCard] = useState(null);
  const [editingCard, setEditingCard] = useState(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [removeCard, setRemoveCard] = useState(null);

  const { handleRemoveCard } = useProfileCardActions({
    isOwnProfile,
    token,
    setCollection: setDisplayCollection,
    collection: displayCollection,
  });

  // NEW: open CardDetailsModal from deep link query params
  //
  // Expected params:
  //   ?from=collection&openCard=sv08-175&entryId=<collectionEntryId>&variation=normal
  //
  // We match by entryId first (best), then fallback to cardId match.
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (!searchParams) return;

    const from = String(searchParams.get("from") || "").toLowerCase();
    if (from !== "collection") return;

    const openCard = searchParams.get("openCard"); // canonical cardId like "sv08-175"
    const entryId = searchParams.get("entryId");   // collection entry UUID
    const variation = searchParams.get("variation");

    if (!openCard && !entryId) return;
    if (!Array.isArray(displayCollection) || displayCollection.length === 0) return;

    // Try to find the exact entry row first
    let match =
      (entryId
        ? displayCollection.find((c) => String(c.id) === String(entryId))
        : null) || null;

    // Fallback to cardId match (canonical)
    if (!match && openCard) {
      match =
        displayCollection.find((c) => String(c.cardId || c.id) === String(openCard)) || null;
    }

    if (!match) return;

    deepLinkHandledRef.current = true;

    // If variation was provided, attach it so pricing selection is consistent
    const selected = variation ? { ...match, variation } : match;
    setSelectedCard(selected);

    // Optional: clean the URL so refresh doesn’t re-open the modal
    // (Keeps the user on the same page but removes query params)
    // If you *want* the URL to remain shareable after opening, comment this out.
    try {
      const path = window.location.pathname;
      router.replace(path, { scroll: false });
    } catch {}
  }, [searchParams, displayCollection, router]);

  const filteredCards = useMemo(() => {
    return (displayCollection || []).filter(
      (card) =>
        (!setFilter || card.setName === setFilter) &&
        (!rarityFilter || card.rarity === rarityFilter) &&
        (!search || (card.name || "").toLowerCase().includes(search.toLowerCase()))
    );
  }, [displayCollection, setFilter, rarityFilter, search]);

  const sortedCards = useMemo(() => {
    if (!filteredCards.length) return [];
    const arr = [...filteredCards];
    const [sortBy, direction] = sortOption.split("-");
    const mult = direction === "asc" ? 1 : -1;

    switch (sortBy) {
      case "name":
        return arr.sort((a, b) => mult * ((a.name || "").localeCompare(b.name || "")));
      case "set":
        return arr.sort((a, b) => mult * ((a.setName || "").localeCompare(b.setName || "")));
      case "price":
        return arr.sort((a, b) => {
          const aP = getCardGBP(a) ?? 0;
          const bP = getCardGBP(b) ?? 0;
          if (aP === bP) return (a.name || "").localeCompare(b.name || "");
          return mult * (aP - bP);
        });
      case "quantity":
        return arr.sort((a, b) => mult * ((a.quantity || 0) - (b.quantity || 0)));
      case "date": {
        const getTime = (c) =>
          c.createdAt ? getDate(c.createdAt)?.getTime() ?? 0 : 0;
        return arr.sort((a, b) => mult * (getTime(a) - getTime(b)));
      }
      default:
        return arr;
    }
  }, [filteredCards, sortOption]);

  const fillFirstRowSkeletons = (cardCount) => {
    if (cardCount >= 5) return null;
    return Array.from({ length: 5 - cardCount }).map((_, idx) => <CardSkeleton key={`skeleton-fill-${idx}`} />);
  };

  const triggerRemove = (card) => {
    if (!isOwnProfile || !card || !card.id) return;
    if (card.quantity > 1) {
      setRemoveCard(card);
      setShowQuantityModal(true);
      setConfirmRemoveId(null);
    } else if (confirmRemoveId === card.id) {
      setDisplayCollection((prev) => prev.filter((x) => String(x.id) !== String(card.id)));
      handleRemoveCard(card.id, 1, {
        onError: () => setDisplayCollection(collection.value || []),
      });
      setConfirmRemoveId(null);
    } else {
      setConfirmRemoveId(card.id);
    }
  };

  const confirmQuantityRemove = (quantity) => {
    if (removeCard) {
      setDisplayCollection((prev) =>
        prev
          .map((x) =>
            String(x.id) === String(removeCard.id) ? { ...x, quantity: x.quantity - quantity } : x
          )
          .filter((x) => x.quantity > 0)
      );
      handleRemoveCard(removeCard.id, quantity, {
        onError: () => setDisplayCollection(collection.value || []),
      });
    }
    setShowQuantityModal(false);
    setRemoveCard(null);
  };

  if (loading.value) {
    return (
      <section className="w-full max-w-8xl mx-auto mt-6">
        <CollectionSkeletonGrid count={10} />
      </section>
    );
  }

  if ((displayCollection?.length ?? 0) === 0) {
    return (
      <section className="w-full max-w-8xl mx-auto mt-6">
        <div className="text-center py-8">
          <div className="flex flex-col items-center gap-2 mb-2">
            <span className="text-2xl font-bold text-vault-accent">
              No cards in this collection yet.
            </span>
            <span className="text-base text-vault-textSecondary">
              Start adding cards to see them here!
            </span>
          </div>
        </div>
        <CollectionSkeletonGrid count={10} />
      </section>
    );
  }

  const allSets = Array.from(new Set((displayCollection || []).map((card) => card.setName).filter(Boolean)));
  const allRarities = Array.from(new Set((displayCollection || []).map((card) => card.rarity).filter(Boolean)));

  const openEditModal = (card) => {
    setEditingCard(card);
    setSelectedCard(null);
  };
  const handleCardDetailsRemove = (card) => triggerRemove(card);
  const handleEditModalClose = () => setEditingCard(null);

  return (
    <section className="w-full max-w-8xl mx-auto mt-6">
      {/* Filters / search / sort + optional total badge */}
      <div className="flex flex-col gap-2 mb-4 px-4">
        <div className="max-w-3xl flex flex-wrap justify-start gap-2 items-center py-2 transition-all">
          <div className="relative w-[250px]">
            <input
              type="text"
              placeholder="Search"
              className="w-full bg-vault-surface text-vault-text rounded-md px-3 pl-8 py-1.5 border border-vault-border focus:border-vault-accent dark:focus:border-vault-accent outline-none text-sm transition h-9 font-semibold"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-vault-textSecondary pointer-events-none">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </span>
          </div>
          <select
            value={setFilter}
            onChange={(e) => setSetFilter(e.target.value)}
            className="w-[110px] bg-vault-surface text-vault-text rounded-md px-3 py-1.5 border border-vault-border focus:border-vault-accent dark:focus:border-vault-accent outline-none text-sm transition h-9 font-semibold"
          >
            <option value="">Set</option>
            {allSets.map((set) => (
              <option key={set} value={set}>
                {set}
              </option>
            ))}
          </select>
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value)}
            className="w-[110px] bg-vault-surface text-vault-text rounded-md px-3 py-1.5 border border-vault-border focus:border-vault-accent dark:focus:border-vault-accent outline-none text-sm transition h-9 font-semibold"
          >
            <option value="">Rarity</option>
            {allRarities.map((rarity) => (
              <option key={rarity} value={rarity}>
                {rarity}
              </option>
            ))}
          </select>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="w-[130px] bg-vault-surface text-vault-text rounded-md px-3 py-1.5 border border-vault-border focus:border-vault-accent dark:focus:border-vault-accent outline-none text-sm transition h-9 font-semibold"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-vault-textTertiary">
          <span>
            Showing <span className="font-semibold">{sortedCards.length}</span> of{" "}
            <span className="font-semibold">{displayCollection.length}</span> cards
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-[6px] bg-vault-raised border border-vault-border/70 dark:border-vault-border/70 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            Estimated value:&nbsp;
            {collectionValue > 0 ? formatCurrency(collectionValue) : "—"}
          </span>
        </div>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {sortedCards.map((card) => {
          const img =
            card?.images?.large ?? card?.images?.small ?? card?.image ?? card?.tcgImageUrl ?? "";
          const setLabel =
            card?.setName || card?.set?.name || (card?.setCode ? String(card.setCode).toUpperCase() : "");
          const priceGBP = getCardGBP(card);

          return (
            <div
              key={card.id}
              className="bg-vault-surface rounded-[10px]  p-3 flex flex-col items-center hover: transition group"
            >
              <div
                className="relative w-full aspect-[245/337] bg-vault-raised rounded-[6px] mb-2 overflow-hidden cursor-pointer"
                onClick={() => setSelectedCard(card)}
              >
                <Image
                  src={getCardImageUrl(img)}
                  alt={card.name}
                  fill
                  unoptimized
                  className="object-contain rounded-[6px] group-hover:scale-105 transition-transform duration-300"
                />
                {card.quantity > 1 && (
                  <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded-[6px] text-xs font-bold">
                    x{card.quantity}
                  </div>
                )}
                {card.condition && (
                  <div
                    className={`absolute bottom-2 left-2 px-2 py-1 rounded-[6px] text-xs bg-black bg-opacity-70 ${getConditionClass(
                      card.condition
                    )}`}
                  >
                    {formatCondition(card.condition)}
                  </div>
                )}
              </div>

              <div className="w-full flex flex-col items-start mt-1">
                <div className="flex justify-between items-center w-full mb-1">
                  <span
                    className="text-base font-bold truncate text-vault-text"
                    title={card.name}
                  >
                    {card.name}
                  </span>
                  {setLabel && (
                    <img src={getSetLogo(setLabel)} alt={setLabel} className="w-6 h-4 rounded ml-2" />
                  )}
                </div>

                <span className="text-sm text-vault-textTertiary">
                  #{card.number || card.cardId}
                </span>

                {priceGBP != null ? (
                  <span className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">
                    {formatCurrency(priceGBP)}
                  </span>
                ) : (
                  <span className="text-xs text-vault-textTertiary mt-1">—</span>
                )}

                {card.createdAt && (
                  <span className="text-xs text-vault-textTertiary mt-1">
                    Added: {formatRelativeTime(getDate(card.createdAt))}
                  </span>
                )}
              </div>

              {isOwnProfile && (
                <div className="mt-3 w-full flex justify-center">
                  <div
                    className="flex flex-row flex-nowrap gap-2 items-center"
                    onMouseLeave={() => {
                      if (confirmRemoveId === card.id) setConfirmRemoveId(null);
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCard(card);
                        setSelectedCard(null);
                      }}
                      className="flex items-center gap-1 px-4 py-2 rounded-[6px] text-xs font-semibold bg-vault-textSecondary hover:bg-vault-accent dark:bg-vault-textSecondary dark:hover:bg-vault-accent text-vault-text  focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent transition-all duration-150 active:scale-95"
                      title="Edit card details"
                      tabIndex={0}
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="mr-1" aria-hidden="true">
                        <path
                          d="M17.25 7.75L12.25 2.75C12.051 2.551 11.799 2.427 11.529 2.427C11.259 2.427 11.007 2.551 10.808 2.75L3.25 10.308V15.25H8.192L15.75 7.692C15.949 7.493 16.201 7.369 16.471 7.369C16.741 7.369 16.993 7.493 17.192 7.692C17.391 7.891 17.515 8.143 17.515 8.413C17.515 8.683 17.391 8.935 17.192 9.134L9.634 16.692C9.435 16.891 9.183 17.015 8.913 17.015C8.643 17.015 8.391 16.891 8.192 16.692C7.993 16.493 7.869 16.241 7.869 15.971C7.869 15.701 7.993 15.449 8.192 15.25L15.75 7.692L17.25 7.75Z"
                          fill="currentColor"
                        />
                      </svg>
                      Edit
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCard(card);
                      }}
                      className="flex items-center gap-1 px-4 py-2 rounded-[6px] text-xs font-semibold bg-vault-accent hover:bg-vault-accentHover dark:bg-vault-accent dark:hover:bg-vault-accentHover text-white  focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent transition-all duration-150 active:scale-95"
                      title="View card details"
                      tabIndex={0}
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="mr-1" aria-hidden="true">
                        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
                        <circle cx="10" cy="10" r="3" fill="currentColor" />
                      </svg>
                      View
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerRemove(card);
                      }}
                      className={`flex items-center gap-1 px-4 py-2 rounded-[6px] text-xs font-semibold bg-vault-danger hover:bg-vault-danger dark:bg-vault-danger dark:hover:bg-vault-danger text-white  focus:outline-none focus:ring-2 focus:ring-vault-danger dark:focus:ring-vault-danger transition-all duration-150 active:scale-95 ${
                        confirmRemoveId === card.id ? "ring-2 ring-vault-danger dark:ring-vault-danger scale-105" : ""
                      }`}
                      title={confirmRemoveId === card.id ? "Click to confirm removal" : "Remove card"}
                      tabIndex={0}
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="mr-1" aria-hidden="true">
                        <path
                          d="M5 6h10M8 9v4m4-4v4M3 6h14v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      {confirmRemoveId === card.id ? "Sure?" : "Remove"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {fillFirstRowSkeletons(sortedCards.length < 5 ? sortedCards.length : 5)}
      </div>

      {/* Modals */}
      {selectedCard && (
        <CardDetailsModal
          card={selectedCard}
          sourceType="collection"
          sourceEntry={selectedCard}
          isOwnProfile={isOwnProfile}
          username={profile?.username}
          onClose={() => setSelectedCard(null)}
          dark={dark}
          onEdit={isOwnProfile ? (c) => setEditingCard(c) : undefined}
          onDelete={isOwnProfile ? handleCardDetailsRemove : undefined}
        />
      )}

      {editingCard && isOwnProfile && (
        <EditCollectionCardModal
          card={editingCard}
          token={token}
          onClose={handleEditModalClose}
          onUpdated={(updatedCard) => {
            setEditingCard(null);
            if (onCardUpdated) onCardUpdated(updatedCard);
          }}
          onRemoved={(removedCardId) => {
            setEditingCard(null);
            setDisplayCollection((prev) => prev.filter((card) => card.id !== removedCardId));
          }}
        />
      )}

      <QuantitySelectorModal
        isOpen={showQuantityModal}
        onClose={() => {
          setShowQuantityModal(false);
          setRemoveCard(null);
        }}
        maxQuantity={removeCard?.quantity || 1}
        onConfirm={confirmQuantityRemove}
        cardName={removeCard?.name || "card"}
      />
    </section>
  );
}

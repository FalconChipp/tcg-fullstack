// src/components/UserProfile/ProfileWishlistPanel.js
// UPDATED (2026-01-13):
// - Uses updateWishlistEntry mutation via shared gql file (drop updateWishlistStatus.js)
// - Correctly displays backend `status` (no more fallback-to-ACTIVE for all cards)
// - After mutation success, updates BOTH local UI state + parent wishlist state
// - Normalizes statuses to uppercase for consistent chip matching
// - Keeps optimistic UI + rollback on error

"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useTheme } from "@/hooks/ThemeProvider";
import { getCardImageUrl } from "@/utils/imageUtils";
import QuantitySelectorModal from "@/components/UI/QuantitySelectorModal";
import CardSkeleton from "@/components/UI/CardSkeleton";

import WishlistShareButtons from "./WishlistShareButtons";
import WishlistShareImageModal from "./WishlistShareImageModal";

import { useMutation } from "@apollo/client";
import { UPDATE_WISHLIST_ENTRY } from "@/graphql/updateWishlistEntry";

/* ---------------------------------------------
   Filters + sort options
--------------------------------------------- */

const SORT_OPTIONS = [
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
  { value: "set-asc", label: "Set (A-Z)" },
  { value: "set-desc", label: "Set (Z-A)" },
  { value: "quantity-asc", label: "Quantity (Low to High)" },
  { value: "quantity-desc", label: "Quantity (High to Low)" },
  { value: "date-asc", label: "Date Added (Oldest First)" },
  { value: "date-desc", label: "Date Added (Newest First)" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Actively Hunting" },
  { value: "GRAIL", label: "Dream Cards" },
  { value: "EVENTUAL", label: "Want Someday" },
  { value: "UPGRADE", label: "Upgrade Targets" },
];

const STATUS_CHIPS = ["ACTIVE", "GRAIL", "EVENTUAL", "UPGRADE"];

/* ---------------------------------------------
   Helpers
--------------------------------------------- */

function cleanStr(v) {
  return typeof v === "string" ? v.trim() : "";
}
function safeLower(v) {
  return cleanStr(v).toLowerCase();
}
function normStatus(v) {
  const s = cleanStr(v).toUpperCase();
  return STATUS_CHIPS.includes(s) ? s : "ACTIVE";
}
function getTimeLike(v) {
  if (!v) return 0;
  if (typeof v === "string" && /^\d+$/.test(v)) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  const d = new Date(v);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}
function getWishlistSetLabel(entry) {
  const card = entry?.card || entry || {};
  const setName = cleanStr(card?.set?.name) || cleanStr(card?.setName);
  const setCode = cleanStr(card?.set?.code) || cleanStr(card?.setCode) || cleanStr(card?.set?.id);
  return setCode ? setCode.toUpperCase() : setName;
}
function prettyStatus(s) {
  switch (String(s || "").toUpperCase()) {
    case "ACTIVE":
      return "Hunting";
    case "GRAIL":
      return "Dream";
    case "EVENTUAL":
      return "Someday";
    case "UPGRADE":
      return "Upgrade";
    default:
      return "";
  }
}
function normalizeEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map((e) => ({
    ...e,
    status: normStatus(e?.status),
  }));
}

export default function ProfileWishlistPanel({
  wishlist = [], // parent passes entries array
  isOwnProfile = false,
  onCardRemoved,
  onMoveToCollection,
  onViewCardDetail,

  // ✅ toast setter (NOT wishlist status)
  setToastStatus,

  dark: darkProp,

  // ✅ from useWishlistData
  setWishlist,
  refreshWishlist,
}) {
  const router = useRouter();
  const { dark: themeDark } = useTheme?.() || {};
  const dark = darkProp ?? themeDark ?? false;

  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // ✅ local render state derived from prop (so UI responds instantly)
  const [displayWishlist, setDisplayWishlist] = useState(() => normalizeEntries(wishlist));
  useEffect(() => {
    setDisplayWishlist(normalizeEntries(wishlist));
  }, [wishlist]);

  const [updateWishlistEntry, { loading: statusSaving }] = useMutation(UPDATE_WISHLIST_ENTRY);

  /* ----------------------------- share helpers ----------------------------- */

  const profileUsername = useMemo(() => {
    const q = router?.query || {};
    const direct =
      (typeof q.username === "string" && q.username) ||
      (typeof q.user === "string" && q.user) ||
      (typeof q.slug === "string" && q.slug) ||
      (Array.isArray(q.slug) && q.slug[0]) ||
      "";
    if (direct) return direct;
    const path = router?.asPath || "";
    const m = path.match(/\/profile\/([^/?#]+)/i);
    return m?.[1] ? decodeURIComponent(m[1]) : "";
  }, [router?.query, router?.asPath]);

  const shareFilters = useMemo(() => {
    const q = router?.query || {};
    return {
      status: typeof q.status === "string" ? q.status : undefined,
      set: typeof q.set === "string" ? q.set : undefined,
      search: typeof q.q === "string" ? q.q : undefined,
    };
  }, [router?.query]);

  const shareTopCards = useMemo(() => {
    return (displayWishlist || [])
      .slice(0, 5)
      .map((entry) => {
        const card = entry?.card || {};
        const setCode = card?.set?.code ?? card?.setCode ?? card?.set?.id ?? "";
        const setName = card?.set?.name ?? card?.setName ?? "";
        const setLabel =
          typeof setCode === "string" && setCode.trim()
            ? String(setCode).toUpperCase()
            : typeof setName === "string"
              ? setName.trim()
              : "";
        const number = card?.number ? String(card.number).trim() : "";
        const rawImg =
          card?.images?.large ??
          card?.images?.small ??
          card?.image ??
          card?.tcgImageUrl ??
          "";
        const absoluteImg = rawImg ? getCardImageUrl(rawImg) : "";
        const shareImageUrl = absoluteImg ? `/api/img-proxy?url=${encodeURIComponent(absoluteImg)}` : "";
        return { name: card?.name || "(Unknown)", setLabel, number, shareImageUrl };
      });
  }, [displayWishlist]);

  const shareSetLabel = useMemo(() => {
    return shareFilters?.set ? String(shareFilters.set).toUpperCase() : "";
  }, [shareFilters?.set]);

  /* ------------------------------ FILTERS ------------------------------ */

  const [search, setSearch] = useState(cleanStr(shareFilters?.search || ""));
  const [setFilter, setSetFilter] = useState(cleanStr(shareFilters?.set || ""));
  const [statusFilter, setStatusFilter] = useState(cleanStr(shareFilters?.status || ""));
  const [sortOption, setSortOption] = useState("name-asc");

  useEffect(() => {
    setSearch(cleanStr(shareFilters?.search || ""));
    setSetFilter(cleanStr(shareFilters?.set || ""));
    setStatusFilter(cleanStr(shareFilters?.status || ""));
  }, [shareFilters?.search, shareFilters?.set, shareFilters?.status]);

  const allSets = useMemo(() => {
    const set = new Set();
    (displayWishlist || []).forEach((entry) => {
      const label = getWishlistSetLabel(entry);
      if (label) set.add(label);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [displayWishlist]);

  const filteredWishlist = useMemo(() => {
    const s = safeLower(search);
    const setNeedle = cleanStr(setFilter);
    const statusNeedle = cleanStr(statusFilter).toUpperCase();

    return (displayWishlist || []).filter((entry) => {
      const card = entry?.card || {};
      const name = cleanStr(card?.name);

      const entryStatus = normStatus(entry?.status);
      const passStatus = !statusNeedle || entryStatus === statusNeedle;

      const label = getWishlistSetLabel(entry);
      const passSet = !setNeedle || label === setNeedle || safeLower(label) === safeLower(setNeedle);

      const passSearch = !s || safeLower(name).includes(s);

      return passStatus && passSet && passSearch;
    });
  }, [displayWishlist, search, setFilter, statusFilter]);

  const sortedWishlist = useMemo(() => {
    if (!filteredWishlist.length) return [];
    const arr = [...filteredWishlist];
    const [sortBy, direction] = sortOption.split("-");
    const mult = direction === "asc" ? 1 : -1;

    switch (sortBy) {
      case "name":
        return arr.sort((a, b) => {
          const aN = cleanStr(a?.card?.name || a?.name);
          const bN = cleanStr(b?.card?.name || b?.name);
          return mult * aN.localeCompare(bN);
        });

      case "set":
        return arr.sort((a, b) => {
          const aS = getWishlistSetLabel(a);
          const bS = getWishlistSetLabel(b);
          const primary = mult * cleanStr(aS).localeCompare(cleanStr(bS));
          if (primary !== 0) return primary;
          const aN = cleanStr(a?.card?.name || a?.name);
          const bN = cleanStr(b?.card?.name || b?.name);
          return aN.localeCompare(bN);
        });

      case "quantity":
        return arr.sort((a, b) => mult * ((a?.quantity || 1) - (b?.quantity || 1)));

      case "date":
        return arr.sort((a, b) => {
          const aT = getTimeLike(a?.createdAt || a?.addedAt || a?.updatedAt);
          const bT = getTimeLike(b?.createdAt || b?.addedAt || b?.updatedAt);
          return mult * (aT - bT);
        });

      default:
        return arr;
    }
  }, [filteredWishlist, sortOption]);

  /* ------------------------------ status UI ------------------------------ */

  async function handleSetEntryStatus(entry, nextStatus) {
    if (!isOwnProfile) return;
    if (!entry?.cardId) return;

    const prevStatus = normStatus(entry?.status);
    const next = normStatus(nextStatus);
    if (prevStatus === next) return;

    // optimistic UI (local)
    setDisplayWishlist((prev) =>
      (prev || []).map((x) =>
        String(x.id) === String(entry.id) ? { ...x, status: next } : x
      )
    );

    try {
      const res = await updateWishlistEntry({
        variables: {
          cardId: entry.cardId,
          variation: entry.variation || null,
          status: next,
        },
      });

      const savedStatus = normStatus(res?.data?.updateWishlistEntry?.status);

      // ✅ local state
      setDisplayWishlist((prev) =>
        (prev || []).map((x) =>
          String(x.id) === String(entry.id) ? { ...x, status: savedStatus } : x
        )
      );

      // ✅ parent state (so it doesn't snap back on rerender/remount)
      if (typeof setWishlist === "function") {
        setWishlist((prev) => {
          const prevEntries = Array.isArray(prev?.entries) ? prev.entries : [];
          return {
            ...(prev || {}),
            entries: prevEntries.map((x) =>
              String(x.id) === String(entry.id) ? { ...x, status: savedStatus } : x
            ),
          };
        });
      }

      // ✅ optional refetch to keep caches honest
      if (typeof refreshWishlist === "function") refreshWishlist();

      if (typeof setToastStatus === "function") {
        setToastStatus({ type: "success", msg: `Wishlist status: ${prettyStatus(savedStatus)}` });
      }
    } catch (err) {
      console.warn("[Wishlist] update status failed", err);

      // rollback local
      setDisplayWishlist((prev) =>
        (prev || []).map((x) =>
          String(x.id) === String(entry.id) ? { ...x, status: prevStatus } : x
        )
      );

      if (typeof setToastStatus === "function") {
        setToastStatus({ type: "error", msg: "Failed to update wishlist status." });
      }
    }
  }

  /* ------------------------------ remove logic ------------------------------ */

  function handleRemoveClick(entry) {
    if (!entry) return;

    if ((entry.quantity || 1) > 1) {
      setSelectedCard(entry);
      setShowQuantityModal(true);
      setConfirmRemoveId(null);
      return;
    }

    if (confirmRemoveId === entry.id) {
      setDisplayWishlist((prev) => prev.filter((x) => String(x.id) !== String(entry.id)));
      if (typeof onCardRemoved === "function") {
        onCardRemoved(entry.cardId, entry.variation || null, 1);
      }
      setConfirmRemoveId(null);
      return;
    }

    setConfirmRemoveId(entry.id);
  }

  const handleQuantityConfirm = (quantity) => {
    if (!selectedCard) return;

    setDisplayWishlist((prev) =>
      prev
        .map((x) =>
          String(x.id) === String(selectedCard.id)
            ? { ...x, quantity: (x.quantity || 1) - quantity }
            : x
        )
        .filter((x) => (x.quantity || 0) > 0)
    );

    if (typeof onCardRemoved === "function") {
      onCardRemoved(selectedCard.cardId, selectedCard.variation || null, quantity);
    }

    setShowQuantityModal(false);
    setSelectedCard(null);
  };

  const fillFirstRowSkeletons = (cardCount) => {
    if (cardCount >= 5) return null;
    return Array.from({ length: 5 - cardCount }).map((_, idx) => (
      <CardSkeleton key={`skeleton-fill-${idx}`} />
    ));
  };

  /* ------------------------------ empty state ------------------------------ */

  if ((displayWishlist?.length ?? 0) === 0) {
    return (
      <section className="w-full max-w-8xl mx-auto mt-6">
        <div className={`text-center py-8 ${dark ? "text-dark-text" : "text-light-text"}`}>
          <div className="flex flex-col items-center gap-2 mb-2">
            <span className={`text-2xl font-bold ${dark ? "text-dark-accent" : "text-light-accent"}`}>
              {isOwnProfile ? "You haven't added any cards to your wishlist yet." : "No wishlist cards to display."}
            </span>
            <span className={`text-base ${dark ? "text-dark-textSecondary" : "text-light-textSecondary"}`}>
              {isOwnProfile
                ? "Search for cards and add them to your wishlist to keep track of what you want!"
                : "No cards found in this user's wishlist."}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-6">
          {Array.from({ length: 5 }).map((_, idx) => (
            <CardSkeleton key={idx} />
          ))}
        </div>

        <WishlistShareImageModal
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          username={profileUsername}
          status={shareFilters?.status}
          setLabel={shareSetLabel}
          count={0}
          topCards={[]}
        />
      </section>
    );
  }

  /* ------------------------------- main grid ------------------------------- */

  return (
    <section className="w-full max-w-8xl mx-auto mt-6">
      {isOwnProfile && profileUsername ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className={`text-xl font-extrabold ${dark ? "text-dark-text" : "text-light-text"}`}>Wishlist</h2>
            <p className={`text-sm font-semibold ${dark ? "text-dark-textSecondary" : "text-light-textSecondary"}`}>
              Share this wishlist view (filters included).
            </p>
          </div>

          <WishlistShareButtons
            username={profileUsername}
            filters={shareFilters}
            count={displayWishlist.length}
            topCards={shareTopCards}
            onOpenShareImage={() => setShareModalOpen(true)}
          />
        </div>
      ) : (
        <div className="mb-4">
          <h2 className={`text-xl font-extrabold ${dark ? "text-dark-text" : "text-light-text"}`}>Wishlist</h2>
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-col gap-2 mb-4 px-4">
        <div className="max-w-3xl flex flex-wrap justify-start gap-2 items-center py-2 transition-all">
          <div className="relative w-[250px]">
            <input
              type="text"
              placeholder="Search"
              className="w-full bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text rounded-md px-3 pl-8 py-1.5 border border-light-border dark:border-dark-border focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm transition h-9 font-semibold"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-light-textSecondary dark:text-dark-textSecondary pointer-events-none">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </span>
          </div>

          <select
            value={setFilter}
            onChange={(e) => setSetFilter(e.target.value)}
            className="w-[140px] bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text rounded-md px-3 py-1.5 border border-light-border dark:border-dark-border focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm transition h-9 font-semibold"
          >
            <option value="">Set</option>
            {allSets.map((set) => (
              <option key={set} value={set}>
                {set}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-[160px] bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text rounded-md px-3 py-1.5 border border-light-border dark:border-dark-border focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm transition h-9 font-semibold"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="w-[160px] bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text rounded-md px-3 py-1.5 border border-light-border dark:border-dark-border focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm transition h-9 font-semibold"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-light-textMuted dark:text-dark-textMuted">
          <span>
            Showing <span className="font-semibold">{sortedWishlist.length}</span> of{" "}
            <span className="font-semibold">{displayWishlist.length}</span> cards
          </span>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSetFilter("");
              setStatusFilter("");
              setSortOption("name-asc");
            }}
            className="text-[11px] font-semibold underline opacity-80 hover:opacity-100"
          >
            Reset filters
          </button>
        </div>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {sortedWishlist.map((entry) => {
          const card = entry.card || {};
          const img = card?.images?.large ?? card?.images?.small ?? card?.image ?? card?.tcgImageUrl ?? "";

          const setLabel =
            card?.set?.name ??
            card?.setName ??
            (card?.setCode ? String(card.setCode).toUpperCase() : "");

          const currentStatus = normStatus(entry?.status);

          return (
            <div
              key={entry.id}
              className={`
                rounded-2xl shadow-lg p-3 flex flex-col items-center min-h-[420px]
                hover:shadow-xl transition group
                border border-light-border dark:border-dark-border
                ${dark ? "bg-dark-surface" : "bg-light-surface"}
              `}
            >
              <div
                className={`
                  relative w-full aspect-[245/337] rounded-lg mb-2 overflow-hidden cursor-pointer
                  ${dark ? "bg-dark-alt" : "bg-light-alt"}
                `}
                onClick={() => onViewCardDetail && onViewCardDetail(entry)}
              >
                <Image
                  src={getCardImageUrl(img)}
                  alt={card.name || "Pokémon Card"}
                  fill
                  className="object-contain rounded-lg group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />

                {entry.quantity > 1 && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-bold">
                    x{entry.quantity}
                  </div>
                )}
              </div>

              <div className="w-full flex flex-col items-start mt-1 flex-1">
                <h3 className={`text-base font-bold truncate mb-1 ${dark ? "text-dark-text" : "text-light-text"}`}>
                  {card.name || "(Unknown)"}
                </h3>

                <div className={`text-sm truncate ${dark ? "text-dark-textSecondary" : "text-light-textSecondary"}`}>
                  {setLabel || "(No set)"}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className={`${dark ? "text-dark-textMuted" : "text-light-textMuted"}`}>#{card.number}</span>
                </div>

                <div className="flex items-center gap-4 text-xs mt-1">
                  <span className={`${dark ? "text-dark-textMuted" : "text-light-textMuted"}`}>
                    Qty: {entry.quantity || 1}
                  </span>
                  <span className={`${dark ? "text-dark-accent" : "text-light-accent"}`}>
                    {entry.condition || "mint"}
                  </span>
                </div>

                {/* Status chips */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {isOwnProfile ? (
                    STATUS_CHIPS.map((s) => {
                      const active = currentStatus === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={statusSaving}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!active) handleSetEntryStatus(entry, s);
                          }}
                          className={`
                            px-2 py-1 rounded-full text-[11px] font-extrabold border transition
                            ${statusSaving ? "opacity-70 cursor-not-allowed" : ""}
                            ${
                              active
                                ? "bg-light-accent dark:bg-dark-accent text-white border-transparent"
                                : "bg-light-alt dark:bg-dark-alt text-light-text dark:text-white border-light-border dark:border-dark-border hover:bg-light-surface dark:hover:bg-dark-surface"
                            }
                          `}
                          title={`Set status: ${s}`}
                        >
                          {prettyStatus(s)}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-[11px] font-semibold text-light-textMuted dark:text-dark-textMuted">
                      Status: {prettyStatus(currentStatus)}
                    </span>
                  )}
                </div>
              </div>

              {isOwnProfile && (
                <div className="mt-4 flex items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => onMoveToCollection(entry)}
                    className={`
                      h-10 px-4 rounded-lg font-medium transition-colors flex-grow
                      bg-light-primary hover:bg-light-accent text-white
                      dark:bg-dark-primary dark:hover:bg-dark-accent
                    `}
                  >
                    Collect
                  </button>

                  <div className="relative" onMouseLeave={() => setConfirmRemoveId(null)}>
                    <button
                      type="button"
                      onClick={() => handleRemoveClick(entry)}
                      className={`
                        flex items-center justify-center
                        rounded-lg transition-all duration-200 h-10
                        ${confirmRemoveId === entry.id ? "w-24" : "w-10"}
                        bg-light-error hover:bg-light-error/90 text-white
                        dark:bg-dark-error dark:hover:bg-dark-error/90 dark:text-white
                      `}
                      title={confirmRemoveId === entry.id ? "Click to confirm removal" : "Remove from wishlist"}
                    >
                      {confirmRemoveId === entry.id ? (
                        <span className="text-xs font-semibold">Sure?</span>
                      ) : (
                        <span className="text-xl leading-none">×</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {fillFirstRowSkeletons(sortedWishlist.length)}
      </div>

      <QuantitySelectorModal
        isOpen={showQuantityModal}
        onClose={() => {
          setShowQuantityModal(false);
          setSelectedCard(null);
        }}
        maxQuantity={selectedCard?.quantity || 1}
        onConfirm={handleQuantityConfirm}
        cardName={selectedCard?.card?.name || "card"}
      />

      <WishlistShareImageModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        username={profileUsername}
        status={shareFilters?.status}
        setLabel={shareSetLabel}
        count={displayWishlist.length}
        topCards={shareTopCards}
      />
    </section>
  );
}

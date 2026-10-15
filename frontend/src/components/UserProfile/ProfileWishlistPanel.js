// src/components/UserProfile/ProfileWishlistPanel.js
// UPDATED (2026-01-26):
// - ADDED: Per-card "Share to Discord" action for wishlist tiles (NO card details modal needed)
// - ADDED: ShareToDiscordDialog integration (uses Option B endpoints already implemented)
// - ADDED: Normalizer to build the payload shape expected by /api/discord/share-entry
// - ADDED: Safe auth token getter (prop -> localStorage -> cookie) so dialog can load guilds/channels
// - KEEP: Existing wishlist view share (WishlistShareButtons + WishlistShareImageModal)

"use client";

import React, { useEffect, useMemo, useState } from "react";
import CardImage from "@/components/Cards/CardImage";
import { devWarn } from "@/utils/devLog";
import { useRouter } from "next/router";
import { useTheme } from "@/hooks/ThemeProvider";
import { getCardImageUrl } from "@/utils/imageUtils";
import QuantitySelectorModal from "@/components/UI/QuantitySelectorModal";
import CardSkeleton from "@/components/UI/CardSkeleton";

import WishlistShareButtons from "./WishlistShareButtons";
import WishlistShareImageModal from "./WishlistShareImageModal";

// ✅ ADDED: Discord share dialog (same one used elsewhere)
import ShareToDiscordDialog from "@/components/UserProfile/ShareToDiscordDialog";

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

/* ---------------------------------------------
   ✅ ADDED: Auth token getter for Discord options
--------------------------------------------- */

function safeGetAuthTokenFromClient() {
  try {
    if (typeof window === "undefined") return "";
    // 1) localStorage common keys
    const ls =
      window.localStorage.getItem("authToken") ||
      window.localStorage.getItem("token") ||
      window.localStorage.getItem("sbf_token") ||
      "";
    if (ls) return ls;

    // 2) cookie fallback
    const cookie = window.document?.cookie || "";
    // try known cookie names: authToken | sbf_token | token
    const pick = (name) => {
      const m = cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
      return m?.[1] ? decodeURIComponent(m[1]) : "";
    };
    return pick("authToken") || pick("sbf_token") || pick("token") || "";
  } catch {
    return "";
  }
}

/* ---------------------------------------------
   ✅ ADDED: Build Discord payload for wishlist entry
   This matches backend expectations:
   - entry.id, entry.cardId, entry.card.name are required
--------------------------------------------- */

function buildDiscordWishlistPayload(entry) {
  const card = entry?.card || {};
  const setCode = card?.set?.code ?? card?.setCode ?? card?.set?.id ?? null;
  const setName = card?.set?.name ?? card?.setName ?? null;

  return {
    // ShareToDiscordDialog expects payload.type
    type: "wishlist",

    // Backend expects entry.id + cardId + card.name
    id: entry?.id,
    entryId: entry?.id, // harmless extra; backend normalizer handles entry.id anyway
    cardId: entry?.cardId ?? card?.id ?? null,
    variation: entry?.variation ?? entry?.variationKey ?? null,

    // Wishlist fields
    status: normStatus(entry?.status),
    quantity: entry?.quantity ?? 1,

    // Card block used by embed builder
    card: {
      id: card?.id ?? entry?.cardId ?? null,
      name: card?.name ?? entry?.name ?? null,
      number: card?.number ?? null,
      setCode: setCode ? String(setCode).toUpperCase() : null,
      setName: setName ? String(setName) : null,
      rarity: card?.rarity ?? null,
      images: {
        small: card?.images?.small ?? null,
        large: card?.images?.large ?? null,
      },
    },
  };
}

/* ---------------------------------------------
   ✅ ADDED: Simple Discord icon (no dependency)
--------------------------------------------- */

function DiscordIcon({ className = "w-5 h-5" }) {
  // lightweight inline icon (not exact brand svg, but clear)
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M19.5 4.8A17.8 17.8 0 0 0 15.7 3c-.2.4-.5 1-.6 1.4a16.4 16.4 0 0 0-4.2 0c-.2-.5-.4-1-.6-1.4A17.9 17.9 0 0 0 6.5 4.8C4.4 7.9 3.8 11 4 14c1.3 1 2.8 1.7 4.4 2.2.3-.4.6-.9.9-1.4-.5-.2-1-.4-1.4-.7l.3-.2c2.7 1.3 5.6 1.3 8.3 0l.3.2c-.5.3-.9.5-1.4.7.3.5.6 1 .9 1.4 1.6-.5 3.1-1.2 4.4-2.2.4-3.5-.7-6.6-2.5-9.2ZM9.3 13.2c-.7 0-1.2-.6-1.2-1.4s.5-1.4 1.2-1.4 1.2.6 1.2 1.4-.5 1.4-1.2 1.4Zm5.4 0c-.7 0-1.2-.6-1.2-1.4s.5-1.4 1.2-1.4 1.2.6 1.2 1.4-.5 1.4-1.2 1.4Z" />
    </svg>
  );
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

  // ✅ ADDED (optional): pass token in if parent already has it (best)
  token: tokenProp,
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

  /* ----------------------------- ✅ ADDED: Discord share state ----------------------------- */

  const [discordDialogOpen, setDiscordDialogOpen] = useState(false);
  const [discordPayload, setDiscordPayload] = useState(null);

  // token used by /api/discord/share-options + /api/discord/guild-channels
  const discordAuthToken = useMemo(() => {
    return cleanStr(tokenProp) || safeGetAuthTokenFromClient();
  }, [tokenProp]);

  function openDiscordShareForEntry(entry) {
    const payload = buildDiscordWishlistPayload(entry);

    // Basic sanity (same checks backend does)
    if (!payload?.id || !payload?.cardId || !payload?.card?.name) {
      if (typeof setToastStatus === "function") {
        setToastStatus({ type: "error", msg: "Missing data required to share this wishlist entry." });
      }
      return;
    }

    setDiscordPayload(payload);
    setDiscordDialogOpen(true);
  }

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
      devWarn("[Wishlist] update status failed", err);

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
        <div className={`text-center py-8 ${dark ? "text-vault-text" : "text-vault-text"}`}>
          <div className="flex flex-col items-center gap-2 mb-2">
            <span className={`text-2xl font-bold ${dark ? "text-vault-accent" : "text-vault-accent"}`}>
              {isOwnProfile ? "You haven't added any cards to your wishlist yet." : "No wishlist cards to display."}
            </span>
            <span className={`text-base ${dark ? "text-vault-textSecondary" : "text-vault-textSecondary"}`}>
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

        {/* ✅ ADDED: Discord dialog mount (safe even when empty) */}
        <ShareToDiscordDialog
          open={discordDialogOpen}
          onClose={() => setDiscordDialogOpen(false)}
          isDark={dark}
          token={discordAuthToken}
          payload={discordPayload}
          requestedByUsername={profileUsername || undefined}
          viewUrl={typeof window !== "undefined" ? window.location.href : undefined}
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
            <h2 className={`text-xl font-extrabold ${dark ? "text-vault-text" : "text-vault-text"}`}>Wishlist</h2>
            <p className={`text-sm font-semibold ${dark ? "text-vault-textSecondary" : "text-vault-textSecondary"}`}>
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
          <h2 className={`text-xl font-extrabold ${dark ? "text-vault-text" : "text-vault-text"}`}>Wishlist</h2>
        </div>
      )}

      {/* Filters row */}
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
            className="w-[140px] bg-vault-surface text-vault-text rounded-md px-3 py-1.5 border border-vault-border focus:border-vault-accent dark:focus:border-vault-accent outline-none text-sm transition h-9 font-semibold"
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
            className="w-[160px] bg-vault-surface text-vault-text rounded-md px-3 py-1.5 border border-vault-border focus:border-vault-accent dark:focus:border-vault-accent outline-none text-sm transition h-9 font-semibold"
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
            className="w-[160px] bg-vault-surface text-vault-text rounded-md px-3 py-1.5 border border-vault-border focus:border-vault-accent dark:focus:border-vault-accent outline-none text-sm transition h-9 font-semibold"
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
                rounded-[10px]  p-3 flex flex-col items-center min-h-[420px]
                hover: transition group
                border border-vault-border
                ${dark ? "bg-vault-surface" : "bg-vault-surface"}
              `}
            >
              <div
                className={`
                  relative w-full aspect-[245/337] rounded-[6px] mb-2 overflow-hidden cursor-pointer
                  ${dark ? "bg-vault-raised" : "bg-vault-raised"}
                `}
                // KEEP: you can still use onViewCardDetail if parent wants it
                onClick={() => onViewCardDetail && onViewCardDetail(entry)}
              >
                <CardImage
                  src={img ? getCardImageUrl(img) : null}
                  name={card?.name}
                  cardId={entry.cardId || card?.id}
                  className="absolute inset-0 w-full h-full object-contain rounded-[6px] group-hover:scale-105 transition-transform duration-300"
                />

                {entry.quantity > 1 && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-[6px] text-xs font-bold">
                    x{entry.quantity}
                  </div>
                )}
              </div>

              <div className="w-full flex flex-col items-start mt-1 flex-1">
                <h3 className={`text-base font-bold truncate mb-1 ${dark ? "text-vault-text" : "text-vault-text"}`}>
                  {card.name || "(Unknown)"}
                </h3>

                <div className={`text-sm truncate ${dark ? "text-vault-textSecondary" : "text-vault-textSecondary"}`}>
                  {setLabel || "(No set)"}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className={`${dark ? "text-vault-textTertiary" : "text-vault-textTertiary"}`}>#{card.number}</span>
                </div>

                <div className="flex items-center gap-4 text-xs mt-1">
                  <span className={`${dark ? "text-vault-textTertiary" : "text-vault-textTertiary"}`}>
                    Qty: {entry.quantity || 1}
                  </span>
                  <span className={`${dark ? "text-vault-accent" : "text-vault-accent"}`}>
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
                            px-2 py-1 rounded-[6px] text-[11px] font-extrabold border transition
                            ${statusSaving ? "opacity-70 cursor-not-allowed" : ""}
                            ${
                              active
                                ? "bg-vault-accent text-vault-text border-transparent"
                                : "bg-vault-raised text-vault-text dark:text-white border-vault-border hover:bg-vault-surface dark:hover:bg-vault-surface"
                            }
                          `}
                          title={`Set status: ${s}`}
                        >
                          {prettyStatus(s)}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-[11px] font-semibold text-vault-textTertiary">
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
                      h-10 px-4 rounded-[6px] font-medium transition-colors flex-grow
                      bg-vault-accent hover:bg-vault-accent text-vault-text
                      dark:bg-vault-accent dark:hover:bg-vault-accentHover
                    `}
                  >
                    Collect
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDiscordShareForEntry(entry);
                    }}
                    className={`
                      h-10 w-10 rounded-[10px] flex items-center justify-center
                      border  transition-all
                      hover: active:scale-[0.98]
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                      ${dark
                        ? "bg-vault-raised border-vault-border text-white hover:border-vault-accent focus-visible:ring-vault-accent focus-visible:ring-offset-vault-surface"
                        : "bg-vault-raised border-vault-border text-vault-text hover:border-vault-accent focus-visible:ring-vault-accent focus-visible:ring-offset-vault-surface"}
                    `}
                    title="Share to Discord"
                    aria-label="Share to Discord"
                  >
                    <span
                      className={`
                        inline-flex items-center justify-center
                        transition-transform duration-200
                        group-hover:scale-105
                      `}
                    >
                      <DiscordIcon className="w-5 h-5" />
                    </span>
                  </button>

                  <div className="relative" onMouseLeave={() => setConfirmRemoveId(null)}>
                    <button
                      type="button"
                      onClick={() => handleRemoveClick(entry)}
                      className={`
                        flex items-center justify-center
                        rounded-[6px] transition-all duration-200 h-10
                        ${confirmRemoveId === entry.id ? "w-24" : "w-10"}
                        bg-vault-danger hover:bg-vault-danger/90 text-white
                        dark:bg-vault-danger dark:hover:bg-vault-danger/90 dark:text-white
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

      <ShareToDiscordDialog
        open={discordDialogOpen}
        onClose={() => setDiscordDialogOpen(false)}
        isDark={dark}
        token={discordAuthToken}
        payload={discordPayload}
        requestedByUsername={profileUsername || undefined}
        viewUrl={typeof window !== "undefined" ? window.location.href : undefined}
      />
    </section>
  );
}

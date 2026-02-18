// src/components/UserProfile/CardDetailsModal.js

"use client";

import React from "react";
import Image from "next/image";
import { gql, useApolloClient } from "@apollo/client";
import { getCardImageUrl } from "@/utils/imageUtils";
import { formatVariation } from "@/utils/formatVariation";
import { formatCondition, getConditionClass } from "@/utils/formatCondition";
import { formatDate, formatRelativeTime } from "@/utils/formatDate";
import { AuthContext } from "@/components/Auth/AuthProvider";
import PriceHistoryChart from "./PriceHistoryChart";
import { fetchMyAlerts, upsertAlert } from "@/graphql/priceAlerts";
import { executeMutation } from "@/utils/graphqlUtils";

// ✅ NEW: externalized Discord share dialog
import ShareToDiscordDialog from "@/components/UserProfile/ShareToDiscordDialog";

// Optional: only used if your project exposes it
let useThemeHook;
try {
  // Avoid hard crash if ThemeProvider path changes
  // eslint-disable-next-line global-require
  useThemeHook = require("@/hooks/ThemeProvider").useTheme;
} catch {}

const FALLBACK_CARD_IMAGE = "/images/card-placeholder.svg";
const GBP_SYMBOL = "\u00A3";

/* ========================================================================== */
/*                      Minimal Discord Share helpers (KEPT)                   */
/* ========================================================================== */

function safeLocalStorageGet(key) {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeLocalStorageSet(key, value) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {}
}

function inferSourceTypeFromCard(card) {
  // Your collection rows have `wishlist: false`
  // Your wishlist entries might not, so prefer explicit prop if you pass it.
  if (!card) return "collection";
  if (card.wishlist === true) return "wishlist";
  return "collection";
}

function normalizeLatestPriceGBP(card, variation) {
  const list = Array.isArray(card?.latestPrices) ? card.latestPrices : [];
  if (!list.length) return null;

  const desired = String(variation || "normal").toLowerCase();
  const exact = list.find((p) => String(p?.variation || "").toLowerCase() === desired);
  const row = exact || list.find((p) => String(p?.variation || "").toLowerCase() === "normal") || list[0];

  const v = row?.gbp ?? row?.market ?? row?.mid ?? null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

function normalizeShareEntry({ type, card, sourceEntry, selectedVar }) {
  // We send a consistent shape to backend so backend can post to bot.
  // We keep it close to what your bot expects (card + collection/wishlist context).
  const c = sourceEntry?.card || card?.card || card || {};
  const entry = sourceEntry || card || {};

  const variation =
    entry?.variation ||
    entry?.variationKey ||
    c?.variation ||
    selectedVar ||
    "normal";

  const priceGBP = normalizeLatestPriceGBP(c, variation);

  return {
    type, // "collection" | "wishlist"
    entryId: entry?.id ?? null,
    cardId: entry?.cardId ?? c?.id ?? c?.cardId ?? card?.cardId ?? card?.id ?? null,
    variation: variation ?? null,

    // Context
    collection:
      type === "collection"
        ? {
            quantity: Number(entry?.quantity || 1),
            condition: entry?.condition ?? null,
            binderName: entry?.binderName ?? null,
          }
        : undefined,

    wishlist:
      type === "wishlist"
        ? {
            status: entry?.status ?? null,
            priority: entry?.priority ?? null,
            quantity: Number(entry?.quantity || 1),
          }
        : undefined,

    // Card fields the bot embed builder cares about
    card: {
      id: c?.id ?? null,
      cardId: entry?.cardId ?? c?.id ?? null,
      name: c?.name ?? card?.name ?? card?.tcgName ?? null,
      number: c?.number ?? card?.number ?? null,
      setCode: c?.setCode ?? card?.setCode ?? null,
      setName: c?.set?.name ?? card?.setName ?? card?.setName ?? null,
      rarity: c?.rarity ?? card?.rarity ?? card?.tcgRarity ?? null,
      images: {
        small: c?.images?.small ?? null,
        large: c?.images?.large ?? null,
      },
      variant: variation ?? null,
      variants: Array.isArray(c?.variants) ? c.variants : undefined,
    },

    pricing: {
      priceGBP,
      currency: "GBP",
    },
  };
}

async function postDiscordShare({ token, channelId, message, payload, requestedByUsername, viewUrl }) {
  const url = "/api/discord/share-entry";

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      channelId,
      type: payload.type,
      message: message || null,
      requestedBy: requestedByUsername ? String(requestedByUsername) : undefined,
      viewUrl: viewUrl ? String(viewUrl) : null,
      links: viewUrl ? { view: String(viewUrl) } : undefined,
      entry: payload,
    }),
  });

  const json = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = json?.error || json?.message || `Share failed: HTTP ${r.status} ${r.statusText}`;
    throw new Error(msg);
  }
  if (!json?.ok) {
    throw new Error(json?.error || "Share failed");
  }
  return json;
}

/* ========================================================================== */
/*                                 GraphQL                                     */
/* ========================================================================== */

const PRICE_INSIGHTS_QUERY = gql`
  query CardPriceInsights($cardId: ID!, $variant: String, $historyLimit: Int!) {
    history: cardsearchPriceObservations(cardId: $cardId, variant: $variant, limit: $historyLimit) {
      date
      market
      mid
      low
      high
    }
    rollups: cardsearchPriceRollups(cardId: $cardId, variant: $variant) {
      currency
      latest {
        date
        market
      }
      d7 {
        avg
        change
        changePct
      }
      d30 {
        avg
        change
        changePct
      }
      d90 {
        avg
        change
        changePct
      }
    }
  }
`;

const HISTORY_RANGE_OPTIONS = [
  { label: "1d", value: 1 },
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

const VARIANT_ALIAS = {
  normal: "normal",
  standard: "normal",
  holo: "holo",
  holofoil: "holo",
  holo_foil: "holo",
  "holo foil": "holo",
  reverse: "reverse",
  reverse_holo: "reverse",
  reverseholo: "reverse",
  "reverse holo": "reverse",
  reverseholofoil: "reverse",
  reverse_holofoil: "reverse",
  "reverse holofoil": "reverse",
  firstedition: "firstEdition",
  first_edition: "firstEdition",
  "first edition": "firstEdition",
  foil: "foil",
};

const PRICE_ALERT_CONDITIONS = [
  { value: "below", label: "<= target" },
  { value: "above", label: ">= target" },
  { value: "pct_down", label: "-% window" },
  { value: "pct_up", label: "+% window" },
];

/* ---------- helpers ---------- */
const toNumber = (v) => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};

const gbp = (v) => (v === null || v === undefined ? "N/A" : `${GBP_SYMBOL}${Number(v).toFixed(2)}`);

const hasValidDate = (d) => {
  if (!d) return false;
  const t = new Date(d);
  return !isNaN(t.getTime());
};

const pickPointValue = (row) => {
  if (!row) return null;
  return toNumber(row.market) ?? toNumber(row.mid) ?? toNumber(row.high) ?? toNumber(row.low);
};

const canonicalVariantForBackend = (value) => {
  if (value == null) return null;
  const withUnderscore = String(value)
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
  return VARIANT_ALIAS[withUnderscore] ?? value;
};

// Prefer first available image and normalize with getCardImageUrl
const pickImage = (card) => {
  const candidates = [
    card?.image,
    card?.modalImage,
    card?.tcgImageUrl,
    card?.tcgImage,
    card?.images?.large,
    card?.images?.small,
    card?.tcgplayer?.images?.large,
    card?.tcgplayer?.images?.small,
    card?.cardmarket?.images?.large,
    card?.cardmarket?.images?.small,
  ].filter(Boolean);

  for (const c of candidates) {
    const src = getCardImageUrl(c);
    if (src) return src;
  }
  return FALLBACK_CARD_IMAGE;
};

// Pick a price row for a given variation; else any row that has a price
const hasPrice = (row) => {
  if (!row) return false;
  return [row.market, row.tcgplayer, row.cardmarket, row.gbp, row.mid, row.low, row.high].some((val) => toNumber(val) != null);
};

const computeAveragePrice = (row) => {
  if (!hasPrice(row)) return null;
  const market = toNumber(row?.market);
  if (market != null) return market;

  const primary = [];
  const tp = toNumber(row?.tcgplayer);
  const cm = toNumber(row?.cardmarket);
  if (tp != null) primary.push(tp);
  if (cm != null) primary.push(cm);
  if (primary.length === 2) return (primary[0] + primary[1]) / 2;
  if (primary.length === 1) return primary[0];

  const fallback = toNumber(row?.gbp) ?? toNumber(row?.mid) ?? toNumber(row?.low) ?? toNumber(row?.high);
  if (fallback != null) return fallback;
  return primary.length ? primary[0] : null;
};

const findPriceRow = (rows, targetVar) => {
  if (!Array.isArray(rows)) return null;
  const exact = rows.find((p) => p?.variation === targetVar && hasPrice(p));
  if (exact) return exact;
  return rows.find((p) => hasPrice(p)) || null;
};

const isPercentCondition = (condition) => condition === "pct_up" || condition === "pct_down";

export default function CardDetailsModal({
  card,
  onClose,
  dark, // optional hint from parent
  onEdit,
  onDelete,
  onAddToWatchlist,
  onDuplicate,

  // ownership & share context
  isOwnProfile,
  sourceType,
  sourceEntry,
  username = "",
}) {
  if (!card) return null;

  const client = useApolloClient();
  const auth = React.useContext(AuthContext);
  const token = auth?.token ?? null;
  const cardId = card.cardId || card.id || null;

  // ----- Dark mode detection -----
  const themeDark = (() => {
    try {
      return useThemeHook ? !!useThemeHook().dark : undefined;
    } catch {
      return undefined;
    }
  })();

  const htmlHasDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  // Final decision: prop > ThemeProvider > <html class="dark">
  const isDark = typeof dark === "boolean" ? dark : themeDark ?? htmlHasDark;

  /* --------- Image ---------- */
  const [imgSrc, setImgSrc] = React.useState(pickImage(card));
  const [imgLoading, setImgLoading] = React.useState(true);

  /* --------- Prices / variations see unchanged below ---------- */
  const priceRows = React.useMemo(() => {
    const list = Array.isArray(card.prices) ? card.prices.filter(Boolean) : [];
    if (list.length) return list;
    const fallback = [];
    const tcg = toNumber(card.pricing?.tcgplayer?.market);
    const cm = toNumber(card.pricing?.cardmarket?.average_sell);
    const avg = toNumber(card.pricing?.average);
    if (tcg != null || cm != null || avg != null) {
      fallback.push({
        variation: "normal",
        tcgplayer: tcg,
        cardmarket: cm,
        market: avg,
        updatedAt: card.pricing?.updated_at || card.pricing?.updatedAt || null,
      });
    }
    return fallback;
  }, [card.prices, card.pricing]);

  const variationSet = new Set(priceRows.map((p) => p?.variation).filter(Boolean));
  if (card.variation) variationSet.add(card.variation);
  if (variationSet.size === 0) variationSet.add("normal");
  const variations = Array.from(variationSet);

  const initialVar =
    card.variation && variationSet.has(card.variation)
      ? card.variation
      : variationSet.has("normal")
      ? "normal"
      : variations[0];

  const [selectedVar, setSelectedVar] = React.useState(initialVar);

  React.useEffect(() => {
    setSelectedVar(initialVar);
  }, [initialVar]);

  const backendVariant = React.useMemo(() => canonicalVariantForBackend(selectedVar), [selectedVar]);

  const [historyRange, setHistoryRange] = React.useState(30);

  React.useEffect(() => {
    setHistoryRange(30);
  }, [cardId]);

  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState(null);
  const [historyPoints, setHistoryPoints] = React.useState([]);
  const [rollups, setRollups] = React.useState(null);

  const [alertsState, setAlertsState] = React.useState({
    loading: false,
    items: [],
    error: null,
  });
  const [alertForm, setAlertForm] = React.useState({
    condition: "below",
    value: "",
    windowHours: 24,
  });
  const [alertSaving, setAlertSaving] = React.useState(false);
  const [alertMessage, setAlertMessage] = React.useState(null);
  const [quickActionMessage, setQuickActionMessage] = React.useState(null);
  const [watchlistBusy, setWatchlistBusy] = React.useState(false);
  const [duplicateBusy, setDuplicateBusy] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("overview");

  const [shareOpen, setShareOpen] = React.useState(false);

  const selectedRow = findPriceRow(priceRows, selectedVar);
  const averagePrice = computeAveragePrice(selectedRow);
  const quantity = Number(card.quantity || 1);
  const totalValue = averagePrice == null ? null : averagePrice * quantity;
  const priceUpdated = selectedRow?.updatedAt;
  const priceUpdatedRelative = hasValidDate(priceUpdated) ? formatRelativeTime(priceUpdated) : null;
  const addedDate = card.createdAt || card.dateAdded || null;
  const addedDateText = hasValidDate(addedDate) ? formatDate(addedDate) : null;
  const addedDateRelative = hasValidDate(addedDate) ? formatRelativeTime(addedDate) : null;
  const variantLabel = formatVariation(selectedVar);
  const conditionClass = getConditionClass(card.condition);
  const conditionLabel = formatCondition(card.condition) || "Unspecified";
  const watchlistEnabled = typeof onAddToWatchlist === "function";
  const duplicateEnabled = typeof onDuplicate === "function";

  // determine ownership for share button
  const computedIsOwnProfile = typeof isOwnProfile === "boolean" ? isOwnProfile : !!(onEdit || onDelete);

  // determine share type
  const computedSourceType =
    sourceType === "wishlist" || sourceType === "collection"
      ? sourceType
      : inferSourceTypeFromCard(sourceEntry || card);

  // build share payload once per card/variation
  const sharePayload = React.useMemo(() => {
    return normalizeShareEntry({
      type: computedSourceType,
      card,
      sourceEntry,
      selectedVar,
    });
  }, [computedSourceType, card, sourceEntry, selectedVar]);

  // Build "View card" URL for Discord (profile deep link)
  const siteOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const profileUsername = typeof username === "string" ? username : "";

  // fallback to authenticated user if profileUsername is missing
  const requestedByUsernameFinal = profileUsername || auth?.user?.username || auth?.user?.name || "";

  const shareCardId = sharePayload?.cardId || sharePayload?.card?.cardId || null;

  // NOTE: this is what you had (no card query params yet)
  const discordViewUrl = shareCardId && profileUsername ? `${siteOrigin}/profile/${encodeURIComponent(profileUsername)}` : null;

  const fallbackAddToWatchlist = React.useCallback(async () => {
    if (!token) throw new Error("Sign in to manage your watchlist.");
    if (!cardId) throw new Error("Missing card identifier.");
    const mutation = `
      mutation QuickAddToWishlist($cardId: String!, $variation: String) {
        addToWishlist(cardId: $cardId, variation: $variation) { id }
      }
    `;
    const variables = { cardId, variation: backendVariant ?? null };
    const result = await executeMutation(mutation, variables, token);
    if (!result?.addToWishlist) throw new Error("Failed to add this card to your watchlist.");
    const cardName = card.name || card.tcgName || "Card";
    return `"${cardName}" added to your watchlist.`;
  }, [token, cardId, backendVariant, card.name, card.tcgName]);

  const fallbackDuplicateEntry = React.useCallback(async () => {
    if (!token) throw new Error("Sign in to duplicate entries.");
    if (!cardId) throw new Error("Missing card identifier.");
    const mutation = `
      mutation QuickDuplicateCollectionCard($cardId: String!, $quantity: Int, $condition: String, $variation: String) {
        addToCollection(cardId: $cardId, quantity: $quantity, condition: $condition, variation: $variation) { id }
      }
    `;
    const variables = {
      cardId,
      quantity: Math.max(1, Number(card.quantity) || 1),
      condition: card.condition || null,
      variation: backendVariant ?? null,
    };
    const result = await executeMutation(mutation, variables, token);
    if (!result?.addToCollection) throw new Error("Failed to duplicate this card.");
    return "Added another copy to your collection.";
  }, [token, cardId, backendVariant, card.quantity, card.condition]);

  const handleWatchlistClick = React.useCallback(async () => {
    if (watchlistBusy) return;
    setQuickActionMessage(null);
    try {
      setWatchlistBusy(true);
      let successText = "Card added to your watchlist.";
      if (watchlistEnabled) {
        const maybePromise = onAddToWatchlist(card, selectedVar);
        if (maybePromise && typeof maybePromise.then === "function") await maybePromise;
      } else {
        successText = await fallbackAddToWatchlist();
      }
      setQuickActionMessage({ type: "success", text: successText });
    } catch (err) {
      setQuickActionMessage({ type: "error", text: err?.message || "Unable to update your watchlist." });
    } finally {
      setWatchlistBusy(false);
    }
  }, [watchlistBusy, watchlistEnabled, onAddToWatchlist, card, selectedVar, fallbackAddToWatchlist]);

  const handleDuplicateClick = React.useCallback(async () => {
    if (duplicateBusy) return;
    setQuickActionMessage(null);
    try {
      setDuplicateBusy(true);
      let successText = "Copied this card into a new entry.";
      if (duplicateEnabled) {
        const maybePromise = onDuplicate(card, selectedVar);
        if (maybePromise && typeof maybePromise.then === "function") await maybePromise;
      } else {
        successText = await fallbackDuplicateEntry();
      }
      setQuickActionMessage({ type: "success", text: successText });
    } catch (err) {
      setQuickActionMessage({ type: "error", text: err?.message || "Unable to duplicate this card right now." });
    } finally {
      setDuplicateBusy(false);
    }
  }, [duplicateBusy, duplicateEnabled, onDuplicate, card, selectedVar, fallbackDuplicateEntry]);

  React.useEffect(() => {
    if (!quickActionMessage) return undefined;
    if (typeof window === "undefined") return undefined;
    const timeout = window.setTimeout(() => setQuickActionMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [quickActionMessage]);

  React.useEffect(() => {
    setActiveTab("overview");
  }, [cardId]);

  React.useEffect(() => {
    if (!cardId) {
      setHistoryPoints([]);
      setRollups(null);
      return;
    }
    let cancelled = false;
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const { data } = await client.query({
          query: PRICE_INSIGHTS_QUERY,
          variables: {
            cardId,
            variant: backendVariant ?? null,
            historyLimit: Math.max(1, historyRange),
          },
          fetchPolicy: "network-only",
        });
        if (cancelled) return;
        const rows = Array.isArray(data?.history) ? data.history : [];
        const mapped = rows
          .map((row) => ({
            date: row.date,
            market: toNumber(row.market),
            mid: toNumber(row.mid),
            low: toNumber(row.low),
            high: toNumber(row.high),
          }))
          .filter((row) => pickPointValue(row) != null);
        setHistoryPoints(mapped);
        setRollups(data?.rollups ?? null);
      } catch (err) {
        if (cancelled) return;
        setHistoryError(err?.message || "Failed to load price history");
        setHistoryPoints([]);
        setRollups(null);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [client, cardId, backendVariant, historyRange]);

  const loadAlerts = React.useCallback(async () => {
    if (!token || !cardId) {
      setAlertsState({ loading: false, items: [], error: null });
      return;
    }
    setAlertsState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const list = await fetchMyAlerts({
        token,
        cardId,
        variation: backendVariant ?? null,
      });
      setAlertsState({ loading: false, items: Array.isArray(list) ? list : [], error: null });
    } catch (err) {
      setAlertsState({ loading: false, items: [], error: err?.message || "Failed to load alerts" });
    }
  }, [token, cardId, backendVariant]);

  React.useEffect(() => {
    if (!token || !cardId) {
      setAlertsState({ loading: false, items: [], error: null });
      return;
    }
    loadAlerts();
  }, [token, cardId, backendVariant, loadAlerts]);

  const historySummary = React.useMemo(() => {
    if (!historyPoints.length) return { latest: null, delta: null, deltaPct: null };
    const firstPoint = historyPoints.find((p) => pickPointValue(p) != null);
    const lastPoint = [...historyPoints].reverse().find((p) => pickPointValue(p) != null);
    const latest = pickPointValue(lastPoint);
    if (latest == null) return { latest: null, delta: null, deltaPct: null };
    const firstValue = pickPointValue(firstPoint);
    const delta = firstValue != null ? latest - firstValue : null;
    const deltaPct = firstValue != null && firstValue !== 0 ? (delta / firstValue) * 100 : null;
    return { latest, delta, deltaPct };
  }, [historyPoints]);

  const rollupBadges = React.useMemo(() => {
    if (!rollups) return [];
    const entries = [
      { label: "7d", data: rollups.d7 },
      { label: "30d", data: rollups.d30 },
      { label: "90d", data: rollups.d90 },
    ];
    return entries
      .map(({ label, data }) => {
        if (!data) return null;
        const change = toNumber(data.change);
        const changePct = toNumber(data.changePct);
        if (change == null && changePct == null) return null;
        return { label, change, changePct };
      })
      .filter(Boolean);
  }, [rollups]);

  const latestPriceForAlerts = React.useMemo(() => {
    const val = historySummary.latest ?? averagePrice ?? null;
    return val != null ? Number(val) : null;
  }, [historySummary.latest, averagePrice]);

  React.useEffect(() => {
    setAlertForm((prev) => ({ ...prev, value: "" }));
    setAlertMessage(null);
  }, [backendVariant, cardId]);

  React.useEffect(() => {
    if (latestPriceForAlerts == null) return;
    setAlertForm((prev) => {
      if (prev.value) return prev;
      const decimals = isPercentCondition(prev.condition) ? 1 : 2;
      return { ...prev, value: latestPriceForAlerts.toFixed(decimals) };
    });
  }, [latestPriceForAlerts]);

  const alertValuePlaceholder = React.useMemo(() => {
    if (isPercentCondition(alertForm.condition)) return "10";
    if (latestPriceForAlerts != null) return latestPriceForAlerts.toFixed(2);
    return "20.00";
  }, [alertForm.condition, latestPriceForAlerts]);

  async function handleAlertSubmit(e) {
    e.preventDefault();
    if (!token) {
      setAlertMessage({ type: "error", text: "Sign in to create price alerts." });
      return;
    }
    if (!cardId) return;
    const numeric = Number(alertForm.value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setAlertMessage({ type: "error", text: "Enter a valid threshold value." });
      return;
    }
    setAlertSaving(true);
    setAlertMessage(null);
    try {
      const payload = {
        cardId,
        variation: backendVariant ?? null,
        condition: alertForm.condition,
        value: isPercentCondition(alertForm.condition) ? Math.abs(numeric) : numeric,
        windowHours: Math.max(1, Number(alertForm.windowHours) || 24),
        isActive: true,
        currency: "GBP",
      };
      await upsertAlert({ token, input: payload });
      setAlertMessage({ type: "success", text: "Alert saved. We'll notify you in notifications and email." });
      await loadAlerts();
    } catch (err) {
      setAlertMessage({ type: "error", text: err?.message || "Failed to save alert" });
    } finally {
      setAlertSaving(false);
    }
  }

  const alerts = alertsState.items || [];
  const alertsLoading = alertsState.loading;
  const alertsError = alertsState.error;

  /* ---------- token classes ---------- */
  const bgPanel = isDark ? "bg-dark-surface border border-dark-border" : "bg-white border border-light-border";
  const bgHeader = isDark ? "bg-dark-background" : "bg-light-background";
  const border = isDark ? "border-dark-border" : "border-light-border";
  const textMuted = isDark ? "text-dark-textMuted" : "text-light-textMuted";
  const textMain = isDark ? "text-white" : "text-light-primary";
  const chipRarity = isDark ? "bg-dark-primary text-dark-accentLight" : "bg-light-accent text-white";
  const chipEdition = isDark ? "bg-dark-border text-dark-accentLight" : "bg-light-border text-light-accent";
  const cardBg = isDark ? "bg-dark-background" : "bg-light-background";
  const headerGradient = isDark
    ? "bg-gradient-to-r from-dark-accent/35 via-transparent to-transparent"
    : "bg-gradient-to-r from-light-accent/40 via-transparent to-transparent";
  const headerDivider = isDark ? "bg-dark-border/80" : "bg-light-border/70";
  const statCard = `${cardBg} ${border} shadow-sm backdrop-blur-sm`;
  const subtlePill = isDark ? "bg-dark-border/70 text-dark-textMuted" : "bg-light-border/80 text-light-textMuted";
  const highlightPill = isDark ? "bg-dark-accent/20 text-dark-accentLight" : "bg-light-accent/20 text-light-accent";
  const primaryCta = isDark
    ? "bg-dark-accent text-black hover:bg-dark-accentLight focus:ring-dark-accent"
    : "bg-light-accent text-white hover:bg-light-accentLight focus:ring-light-accent";
  const secondaryCta = isDark
    ? "border border-dark-border/80 text-dark-textMuted hover:text-white hover:border-dark-accent"
    : "border border-light-border/80 text-light-textMuted hover:text-light-primary hover:border-light-accent";
  const disabledCta = isDark
    ? "bg-dark-border text-dark-textMuted cursor-not-allowed opacity-70"
    : "bg-light-border text-light-textMuted cursor-not-allowed opacity-70";
  const watchlistButtonStyles = watchlistBusy ? `${disabledCta} cursor-wait` : primaryCta;
  const duplicateButtonStyles = duplicateBusy
    ? `${disabledCta} cursor-wait`
    : duplicateEnabled || token
    ? secondaryCta
    : `${secondaryCta} opacity-90`;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 ${isDark ? "dark" : ""}`}>
      <div className={`w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden ${bgPanel} animate-fade-in flex flex-col max-h-[calc(100vh-2rem)]`}>
        {/* Header */}
        <div className={`relative flex flex-wrap items-start gap-4 px-6 py-5 border-b ${bgHeader} ${border}`}>
          <div className={`pointer-events-none absolute inset-0 ${headerGradient}`} />
          <div className={`pointer-events-none absolute inset-x-6 bottom-0 h-px ${headerDivider}`} />
          <div className="relative z-10 flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className={`text-xl sm:text-2xl font-extrabold truncate ${textMain}`} title={card.name || card.tcgName}>
                {card.name || card.tcgName || `Card #${card.id || card.cardId}`}
              </h2>
              {card.number && (
                <span className={`text-2xs px-2 py-1 rounded-full font-semibold ${subtlePill}`}>#{card.number}</span>
              )}
              {variantLabel && (
                <span className={`text-2xs px-2 py-1 rounded-full font-semibold ${highlightPill}`}>{variantLabel}</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {card.setName && <span className={textMuted}>{card.setName}</span>}
              {(card.rarity || card.tcgRarity) && (
                <span className={`px-2 py-0.5 rounded-full font-semibold ${chipRarity}`}>{card.rarity || card.tcgRarity}</span>
              )}
              {(card.edition || card.tcgEdition) && (
                <span className={`px-2 py-0.5 rounded-full ${chipEdition}`}>{card.edition || card.tcgEdition}</span>
              )}
            </div>

            {(averagePrice != null || totalValue != null) && (
              <div className="hidden sm:flex flex-wrap gap-3">
                {averagePrice != null && (
                  <div className={`px-3 py-2 rounded-xl ${statCard}`}>
                    <div className={`text-[11px] uppercase tracking-wide ${textMuted}`}>Avg Price</div>
                    <div className="text-sm font-semibold text-emerald-400">{gbp(averagePrice)}</div>
                  </div>
                )}
                {totalValue != null && (
                  <div className={`px-3 py-2 rounded-xl ${statCard}`}>
                    <div className={`text-[11px] uppercase tracking-wide ${textMuted}`}>Portfolio</div>
                    <div className={`text-sm font-semibold ${textMain}`}>{gbp(totalValue)}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="relative z-10 flex items-center gap-2 sm:gap-3">
            {onEdit && (
              <button
                onClick={onEdit}
                className={`rounded-xl px-3 py-2 text-xs font-semibold border transition ${
                  isDark
                    ? "border-dark-border/70 text-white hover:border-dark-accent hover:bg-dark-border/50"
                    : "border-light-border/70 text-light-primary hover:border-light-accent hover:bg-light-accent/10"
                }`}
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="rounded-xl px-3 py-2 text-xs font-semibold bg-red-500/90 hover:bg-red-500 text-white transition shadow"
              >
                Remove
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className={`rounded-full p-2 transition border ${
                isDark
                  ? "border-dark-border/70 text-dark-textMuted hover:text-white hover:bg-dark-border/60"
                  : "border-light-border/70 text-light-textMuted hover:text-light-primary hover:bg-light-border/50"
              } focus:outline-none focus:ring-2 ${isDark ? "focus:ring-dark-accent" : "focus:ring-light-accent"}`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" fill="none" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="grid grid-cols-1 gap-6 items-start md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] md:gap-8">
            {/* Left: Image */}
            <div className="flex flex-col items-center gap-4 min-w-0 md:items-start md:pr-0.5">
              <div className={`relative w-full max-w-[18rem] md:max-w-sm aspect-[2.5/3.5] rounded-xl overflow-hidden ${cardBg} shadow-lg`}>
                {imgLoading && (
                  <div className={`absolute inset-0 flex items-center justify-center ${isDark ? "bg-dark-surface" : "bg-light-alt"}`}>
                    <div className="w-16 h-24 rounded-lg animate-pulse border border-dashed border-current opacity-40" />
                  </div>
                )}
                <Image
                  src={imgSrc}
                  alt={card.name || card.tcgName || "Card image"}
                  fill
                  className="object-contain"
                  priority
                  unoptimized
                  onLoadingComplete={() => setImgLoading(false)}
                  onError={() => {
                    if (imgSrc !== FALLBACK_CARD_IMAGE) setImgSrc(FALLBACK_CARD_IMAGE);
                    setImgLoading(false);
                  }}
                />
              </div>

              <div className={`w-full max-w-[18rem] md:max-w-sm rounded-2xl p-4 ${statCard} flex flex-col gap-3`}>
                <div className="flex items-center justify-between">
                  <span className={`text-2xs uppercase tracking-wide ${textMuted}`}>Quick actions</span>
                  <span className={`text-2xs px-2 py-0.5 rounded-full font-semibold ${subtlePill}`}>
                    {computedSourceType === "wishlist" ? "Wishlist" : "Collection"}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleWatchlistClick}
                    className={[
                      "w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-white font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-0",
                      watchlistButtonStyles,
                      watchlistBusy ? "opacity-80" : "",
                    ].join(" ")}
                    disabled={watchlistBusy}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M10 2.5l2.09 4.23 4.66.68-3.38 3.3.8 4.62L10 12.97l-4.17 2.26.8-4.62-3.38-3.3 4.66-.68L10 2.5z" />
                    </svg>
                    {watchlistBusy ? "Saving..." : "Add to Watchlist"}
                  </button>

                  <button
                    type="button"
                    onClick={handleDuplicateClick}
                    className={[
                      "w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-0",
                      duplicateButtonStyles,
                      duplicateBusy ? "opacity-80" : "",
                    ].join(" ")}
                    disabled={duplicateBusy}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M6 4a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2h-1v2a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h1V4zm2 0v2h3a2 2 0 012 2v4h1V4H8zM5 8v8h6V8H5z" />
                    </svg>
                    {duplicateBusy ? "Duplicating..." : "Duplicate Entry"}
                  </button>

                  {/* Share button (only for own profile) */}
                  {computedIsOwnProfile && (
                    <button
                      type="button"
                      onClick={() => setShareOpen(true)}
                      className={[
                        "w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-0",
                        primaryCta,
                      ].join(" ")}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a2.5 2.5 0 000-1.39l7-4.11A2.99 2.99 0 0018 7.91a3 3 0 10-2.83-4H15.1a3 3 0 100 6h.07l-7 4.11a3 3 0 100 4.0l7.13 4.19c.52.5 1.2.79 1.95.79a3 3 0 10.75-5.92z" />
                      </svg>
                      Share to Discord
                    </button>
                  )}
                </div>

                {quickActionMessage && (
                  <div
                    className={`mt-1 text-xs px-3 py-2 rounded-lg ${
                      quickActionMessage.type === "success"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : quickActionMessage.type === "error"
                        ? "bg-rose-500/10 text-rose-400"
                        : isDark
                        ? "bg-dark-alt/80 text-dark-textMuted"
                        : "bg-light-alt text-light-textMuted"
                    }`}
                  >
                    {quickActionMessage.text}
                  </div>
                )}

                <ShareToDiscordDialog
                  open={shareOpen}
                  onClose={() => setShareOpen(false)}
                  isDark={isDark}
                  token={token}
                  payload={sharePayload}
                  requestedByUsername={requestedByUsernameFinal}
                  viewUrl={discordViewUrl}
                  postDiscordShare={postDiscordShare}
                  safeLocalStorageGet={safeLocalStorageGet}
                  safeLocalStorageSet={safeLocalStorageSet}
                />
              </div>
            </div>

            {/* Right: Details (UNCHANGED BELOW) */}
            <div className="flex flex-col gap-5 min-w-0 md:gap-6 md:pl-2">
              {/* Variation picker (always visible) */}
              {variations.length > 1 && (
                <div className={`rounded-2xl p-4 ${statCard}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                    <div className={`text-2xs uppercase tracking-wide ${textMuted}`}>Variation</div>
                    <span className={`text-2xs px-2 py-0.5 rounded-full font-semibold ${subtlePill}`}>
                      {variations.length} options
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {variations.map((v) => {
                      const active = v === selectedVar;
                      return (
                        <button
                          key={v}
                          onClick={() => setSelectedVar(v)}
                          className={[
                            "px-3 py-1.5 rounded-full text-xs font-semibold transition-transform border",
                            active
                              ? isDark
                                ? "bg-dark-accent text-white border-dark-accent shadow-lg -translate-y-0.5"
                                : "bg-light-accent text-white border-light-accent shadow-sm -translate-y-0.5"
                              : isDark
                              ? "bg-dark-alt/70 text-dark-textMuted hover:text-white hover:bg-dark-border/60 border-dark-border/70"
                              : "bg-light-alt text-light-textMuted hover:text-light-primary border-light-border",
                          ].join(" ")}
                        >
                          {formatVariation(v)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab navigation */}
              <div>
                <div
                  className={`grid grid-cols-2 gap-1 rounded-2xl border ${border} shadow-sm p-1 ${
                    isDark ? "bg-dark-background/70" : "bg-light-background/80"
                  }`}
                >
                  {["overview", "history"].map((key) => {
                    const isActive = activeTab === key;
                    const label = key === "overview" ? "Overview" : "Price History";
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveTab(key)}
                        className={[
                          "px-4 py-2 text-sm font-semibold rounded-xl transition",
                          isActive
                            ? isDark
                              ? "bg-dark-accent text-white shadow"
                              : "bg-light-primary text-white shadow"
                            : isDark
                            ? "text-dark-textMuted hover:text-white"
                            : "text-light-textMuted hover:text-light-primary",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* ✅ RESTORED: full section from your paste (unchanged) */}
                {/* NOTE: keeping your original JSX exactly as provided */}
                <div className="pt-5 flex flex-col gap-5 md:pt-6">
                  {activeTab === "overview" ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className={`rounded-2xl p-4 ${statCard}`}>
                          <div className={`text-[11px] uppercase tracking-wide mb-2 ${textMuted}`}>Quantity</div>
                          <div className={`text-2xl font-bold ${textMain}`}>{quantity}</div>
                          <div className={`text-2xs mt-1 ${textMuted}`}>In portfolio</div>
                        </div>
                        <div className={`rounded-2xl p-4 ${statCard}`}>
                          <div className={`text-[11px] uppercase tracking-wide mb-2 ${textMuted}`}>Condition</div>
                          <div className={`text-sm font-semibold ${conditionClass}`}>{conditionLabel}</div>
                          <div className={`text-2xs mt-1 ${textMuted}`}>Trader reported</div>
                        </div>
                        <div className={`rounded-2xl p-4 ${statCard}`}>
                          <div className={`text-[11px] uppercase tracking-wide mb-2 ${textMuted}`}>Added</div>
                          <div className={`text-sm font-semibold ${textMain}`}>{addedDateText || "--"}</div>
                          {addedDateRelative && <div className={`text-2xs mt-1 ${textMuted}`}>{addedDateRelative}</div>}
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className={`rounded-2xl p-5 ${statCard}`}>
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <div className={`text-[11px] uppercase tracking-wide ${textMuted}`}>Average Price</div>
                              <div className="text-2xl font-bold text-emerald-400">{gbp(averagePrice)}</div>
                            </div>
                            <span className={`text-2xs px-2 py-0.5 rounded-full font-semibold ${subtlePill}`}>
                              {variantLabel}
                            </span>
                          </div>
                          <div className={`text-2xs mt-3 ${textMuted}`}>
                            {priceUpdatedRelative ? `Updated ${priceUpdatedRelative}` : "Awaiting latest sale"}
                          </div>
                        </div>

                        <div className={`rounded-2xl p-5 ${statCard}`}>
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <div className={`text-[11px] uppercase tracking-wide ${textMuted}`}>Portfolio Value</div>
                              <div className={`text-2xl font-bold ${textMain}`}>{totalValue == null ? "--" : gbp(totalValue)}</div>
                            </div>
                            <span className={`text-2xs px-2 py-0.5 rounded-full font-semibold ${highlightPill}`}>
                              {quantity} {quantity === 1 ? "copy" : "copies"}
                            </span>
                          </div>
                          <div className={`text-2xs mt-3 ${textMuted}`}>Current market estimate across your holdings.</div>
                        </div>
                      </div>

                      {variations.length > 0 && (
                        <div className={`rounded-2xl ${statCard}`}>
                          <div className="flex items-center justify-between px-5 pt-5 pb-3">
                            <h3 className={`text-sm font-semibold ${textMain}`}>All Variation Prices</h3>
                            <span className={`text-2xs px-2 py-0.5 rounded-full font-semibold ${subtlePill}`}>
                              Live marketplace sample
                            </span>
                          </div>
                          <div className={`px-5 pb-5 overflow-x-auto`}>
                            <table className="min-w-[420px] w-full text-sm border-collapse">
                              <thead>
                                <tr className={`text-left ${textMuted}`}>
                                  <th className="px-2 py-2 font-semibold">Variation</th>
                                  <th className="px-2 py-2 font-semibold">Average Price</th>
                                  <th className="px-2 py-2 font-semibold">Last Updated</th>
                                </tr>
                              </thead>
                              <tbody>
                                {variations.map((v) => {
                                  const row = findPriceRow(priceRows, v);
                                  const avg = computeAveragePrice(row);
                                  const updated = row?.updatedAt;
                                  const active = v === selectedVar;
                                  return (
                                    <tr
                                      key={v}
                                      className={[
                                        "transition-colors",
                                        active ? (isDark ? "bg-dark-alt/60" : "bg-light-alt/60") : "",
                                      ].join(" ")}
                                    >
                                      <td className="px-2 py-3 font-semibold">
                                        <div className="flex items-center gap-2">
                                          <span>{formatVariation(v)}</span>
                                          {active && (
                                            <span className={`text-2xs px-2 py-0.5 rounded-full font-semibold ${highlightPill}`}>
                                              Selected
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-2 py-3">{gbp(avg)}</td>
                                      <td className="px-2 py-3">{hasValidDate(updated) ? formatRelativeTime(updated) : "--"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {card.notes && (
                        <div
                          className={`rounded-2xl p-5 border ${border} ${
                            isDark ? "bg-dark-surface/70 text-dark-text" : "bg-white text-light-text"
                          } shadow-sm`}
                        >
                          <div className={`text-2xs uppercase tracking-wide mb-2 font-semibold ${textMuted}`}>Collector Notes</div>
                          <div className="whitespace-pre-line leading-relaxed text-sm">{card.notes}</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col gap-5">
                      <div className={`rounded-2xl p-5 ${statCard}`}>
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                          <div className="space-y-2">
                            <h3 className={`text-sm font-semibold ${textMain}`}>Price History</h3>
                            {historySummary.latest != null ? (
                              <div className="flex items-center gap-2 text-sm font-semibold">
                                <span>{gbp(historySummary.latest)}</span>
                                {historySummary.delta != null && historySummary.delta !== 0 ? (
                                  <span className={`${historySummary.delta > 0 ? "text-emerald-500" : "text-rose-500"} text-xs font-semibold`}>
                                    {`${historySummary.delta > 0 ? "+" : ""}${GBP_SYMBOL}${Math.abs(historySummary.delta).toFixed(2)}`}
                                    {historySummary.deltaPct != null && (
                                      <span className="ml-1">({`${historySummary.deltaPct > 0 ? "+" : ""}${historySummary.deltaPct.toFixed(1)}%`})</span>
                                    )}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <div className={`text-xs ${textMuted}`}>No recent pricing samples yet.</div>
                            )}
                            <div
                              className={`text-xs px-3 py-2 inline-flex items-center gap-2 rounded-lg border border-dashed ${
                                isDark ? "border-dark-border/70 bg-dark-alt/50" : "border-light-border/80 bg-light-alt/70"
                              } ${textMuted}`}
                            >
                              Still gathering price data; check back soon.
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {HISTORY_RANGE_OPTIONS.map((opt) => {
                              const active = historyRange === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setHistoryRange(opt.value)}
                                  className={[
                                    "px-3 py-1 rounded-full text-xs font-semibold transition border",
                                    active
                                      ? isDark
                                        ? "bg-dark-accent text-black border-dark-accent"
                                        : "bg-light-accent text-white border-light-accent"
                                      : isDark
                                      ? "border-dark-border text-dark-textMuted hover:border-dark-accent"
                                      : "border-light-border text-light-textMuted hover:border-light-accent",
                                  ].join(" ")}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {historyLoading ? (
                          <div className="h-[160px] w-full rounded-xl bg-light-alt/60 dark:bg-dark-alt/60 animate-pulse" />
                        ) : historyError ? (
                          <div className={`text-sm ${textMuted}`}>{historyError}</div>
                        ) : historyPoints.length ? (
                          <PriceHistoryChart data={historyPoints} dark={isDark} />
                        ) : (
                          <div className={`text-sm ${textMuted}`}>No price history available yet.</div>
                        )}
                        {rollupBadges.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 text-xs mt-3">
                            {rollupBadges.map((badge) => {
                              const positive = badge.change != null && badge.change > 0;
                              const negative = badge.change != null && badge.change < 0;
                              const badgeClass = positive
                                ? "bg-emerald-500/10 text-emerald-500"
                                : negative
                                ? "bg-rose-500/10 text-rose-500"
                                : isDark
                                ? "bg-dark-alt text-dark-textMuted"
                                : "bg-light-alt text-light-textMuted";
                              const changeText =
                                badge.change != null ? `${badge.change > 0 ? "+" : ""}${GBP_SYMBOL}${Math.abs(badge.change).toFixed(2)}` : null;
                              const pctText =
                                badge.changePct != null ? `${badge.changePct > 0 ? "+" : ""}${Number(badge.changePct).toFixed(1)}%` : null;
                              return (
                                <span key={badge.label} className={`px-2 py-1 rounded-full font-medium ${badgeClass}`}>
                                  {badge.label}
                                  {changeText && <span className="ml-1">{changeText}</span>}
                                  {pctText && <span className="ml-1">{pctText}</span>}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Alerts card remains unchanged (kept as-is) */}
                      <div className={`rounded-2xl p-5 ${statCard}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className={`text-sm font-bold ${textMain}`}>Price Alerts</h3>
                          <a href="/account?tab=alerts" className="text-xs font-semibold text-light-accent dark:text-dark-accent hover:underline">
                            Manage
                          </a>
                        </div>

                        <div className={`flex flex-wrap items-center gap-3 text-xs mb-4 ${textMuted}`}>
                          <span>
                            Current market:&nbsp;
                            <span className="font-semibold text-light-accent dark:text-dark-accent">
                              {latestPriceForAlerts != null ? gbp(latestPriceForAlerts) : "N/A"}
                            </span>
                          </span>
                          <span className={`hidden sm:inline-block ${textMuted}`}>&bull;</span>
                          <span>Alerts evaluate against the selected trailing window.</span>
                        </div>

                        {token ? (
                          <>
                            <form
                              className="grid gap-3 mb-4 sm:grid-cols-[minmax(0,15rem)_repeat(2,minmax(0,8rem))] items-end"
                              onSubmit={handleAlertSubmit}
                            >
                              <div className="flex flex-col gap-2">
                                <label className={`text-xs font-semibold tracking-wide ${textMuted} uppercase`}>Condition</label>
                                <select
                                  className={`h-11 px-3 py-2 rounded-lg border transition focus:outline-none focus:ring-2 ${
                                    isDark
                                      ? "bg-dark-alt border-dark-border focus:border-dark-accent focus:ring-dark-accent/60 text-white"
                                      : "bg-light-surface border-light-border focus:border-light-accent focus:ring-light-accent/70 text-light-primary"
                                  } appearance-none pr-8`}
                                  value={alertForm.condition}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    setAlertForm((prev) => ({
                                      ...prev,
                                      condition: next,
                                      value: isPercentCondition(next)
                                        ? isPercentCondition(prev.condition) && prev.value
                                          ? prev.value
                                          : "10"
                                        : !isPercentCondition(prev.condition) && prev.value
                                        ? prev.value
                                        : latestPriceForAlerts != null
                                        ? latestPriceForAlerts.toFixed(2)
                                        : "",
                                    }));
                                  }}
                                >
                                  {PRICE_ALERT_CONDITIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex flex-col gap-2">
                                <label className={`text-xs font-semibold tracking-wide ${textMuted} uppercase`}>
                                  {isPercentCondition(alertForm.condition) ? "Percent change" : `Target price (${GBP_SYMBOL})`}
                                </label>
                                <input
                                  type="number"
                                  step={isPercentCondition(alertForm.condition) ? "0.1" : "0.01"}
                                  min="0"
                                  required
                                  className={`h-11 px-3 py-2 rounded-lg border transition focus:outline-none focus:ring-2 ${
                                    isDark
                                      ? "bg-dark-alt border-dark-border focus:border-dark-accent focus:ring-dark-accent/60 text-white"
                                      : "bg-light-surface border-light-border focus:border-light-accent focus:ring-light-accent/70 text-light-primary"
                                  }`}
                                  value={alertForm.value}
                                  onChange={(e) => setAlertForm((prev) => ({ ...prev, value: e.target.value }))}
                                  placeholder={alertValuePlaceholder}
                                />
                              </div>

                              <div className="flex flex-col gap-2">
                                <label className={`text-xs font-semibold tracking-wide ${textMuted} uppercase`}>Window (hours)</label>
                                <input
                                  type="number"
                                  min="1"
                                  className={`h-11 px-3 py-2 rounded-lg border transition focus:outline-none focus:ring-2 ${
                                    isDark
                                      ? "bg-dark-alt border-dark-border focus:border-dark-accent focus:ring-dark-accent/60 text-white"
                                      : "bg-light-surface border-light-border focus:border-light-accent focus:ring-light-accent/70 text-light-primary"
                                  }`}
                                  value={alertForm.windowHours}
                                  onChange={(e) => setAlertForm((prev) => ({ ...prev, windowHours: e.target.value }))}
                                />
                              </div>

                              <div className="sm:col-span-3 flex justify-end mt-2 sm:mt-0">
                                <button
                                  type="submit"
                                  disabled={alertSaving}
                                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                                    alertSaving
                                      ? "opacity-60 cursor-wait bg-light-accent text-white dark:bg-dark-accent"
                                      : "bg-light-accent text-white hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight"
                                  }`}
                                >
                                  {alertSaving ? "Saving..." : "Save alert"}
                                </button>
                              </div>
                            </form>

                            <div className={`text-xs mb-3 ${textMuted}`}>
                              {isPercentCondition(alertForm.condition)
                                ? "Example: 12 means the alert fires if the price moves by 12% within the selected window."
                                : `Example: 0.50 means the alert fires when the market price crosses ${GBP_SYMBOL}0.50.`}
                            </div>

                            {alertMessage && (
                              <div
                                className={`text-sm rounded-lg px-3 py-2 mb-3 ${
                                  alertMessage.type === "success" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                                }`}
                              >
                                {alertMessage.text}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className={`text-sm ${textMuted}`}>Sign in to create alerts. We&rsquo;ll notify you when this card hits your targets.</p>
                        )}

                        <div className="mt-3">
                          {alertsLoading ? (
                            <div className={`text-sm ${textMuted}`}>Loading alerts...</div>
                          ) : alertsError ? (
                            <div className="text-sm text-light-error dark:text-dark-error">{alertsError}</div>
                          ) : alerts.length ? (
                            <ul className="space-y-3">
                              {alerts.map((alert) => {
                                const valueNum = toNumber(alert.value);
                                const valueText = isPercentCondition(alert.condition)
                                  ? `${valueNum != null ? valueNum.toFixed(1) : alert.value}%`
                                  : gbp(valueNum ?? alert.value);
                                const windowHours = alert.windowHours ?? 24;
                                const timestamp = alert.lastFiredAt || alert.updatedAt || alert.createdAt || null;

                                let conditionLabel = "";
                                if (alert.condition === "above") conditionLabel = `>= ${valueText}`;
                                else if (alert.condition === "below") conditionLabel = `<= ${valueText}`;
                                else if (alert.condition === "pct_up") conditionLabel = `+${valueText} / ${windowHours}h`;
                                else conditionLabel = `-${valueText} / ${windowHours}h`;

                                return (
                                  <li
                                    key={alert.id}
                                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border ${
                                      isDark ? "border-dark-border bg-dark-alt/70" : "border-light-border bg-light-alt/70"
                                    }`}
                                  >
                                    <div className="space-y-1">
                                      <div className="text-sm font-semibold text-light-primary dark:text-white">{conditionLabel}</div>
                                      <div className={`text-xs ${textMuted}`}>
                                        Window&nbsp;
                                        <span className="font-medium text-light-accent dark:text-dark-accent">{windowHours}h</span>
                                        {timestamp && (
                                          <span className="ml-2">
                                            {alert.lastFiredAt ? "Triggered" : "Updated"} {formatRelativeTime(timestamp)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span
                                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                        alert.isActive
                                          ? "bg-emerald-500/15 text-emerald-500"
                                          : isDark
                                          ? "bg-dark-border text-dark-textMuted"
                                          : "bg-light-border text-light-textMuted"
                                      }`}
                                    >
                                      {alert.isActive ? "Active" : "Paused"}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : token ? (
                            <p className={`text-sm ${textMuted}`}>No alerts yet for this variant.</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

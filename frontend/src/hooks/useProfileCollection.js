// H:\tcg-fullstack\frontend\src\hooks\useProfileCollection.js
//
// UPDATED (2026-01-13):
// - FIX: Normalize wishlist entry.status on fetch so UI never falls back to ACTIVE incorrectly
// - Defensive: ensures wishlist shape is always { entries: [] }
// - No changes to queries required (you already request `status`)

import { useState, useEffect } from "react";
import { getGraphqlUrl } from "@/utils/apiClient";
import { devWarn } from "@/utils/devLog";

// ---------- utils ----------
const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(num) ? null : num;
};

function getCardAveragePrice(card) {
  if (!card || !Array.isArray(card.prices)) return null;
  const selectedVariation = card.variation || "normal";
  let priceObj = card.prices.find((p) => p && p.variation === selectedVariation);
  if (!priceObj && card.prices.length) priceObj = card.prices[0];
  if (!priceObj) return null;
  const tcg = toNumber(priceObj.tcgplayer);
  const cmk = toNumber(priceObj.cardmarket);
  if (tcg == null && cmk == null) return null;
  if (tcg != null && cmk != null) return (tcg + cmk) / 2;
  return tcg != null ? tcg : cmk;
}

function getCollectionTotalValue(col = []) {
  return col.reduce((sum, card) => {
    const price = getCardAveragePrice(card) ?? 0;
    const quantity = card.quantity || 1;
    return sum + price * quantity;
  }, 0);
}

function cacheKey(userId) {
  return `sb5_collection_${String(userId)}`;
}

function readCache(userId) {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(userId, data) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

/**
 * ✅ NEW: normalize wishlist entry status at the source (this hook).
 * This prevents UI components from ever "defaulting to ACTIVE" due to missing/odd casing.
 */
const WISHLIST_STATUSES = new Set(["ACTIVE", "GRAIL", "EVENTUAL", "UPGRADE"]);

function normalizeWishlistStatus(status) {
  if (typeof status !== "string") return "ACTIVE";
  const s = status.trim().toUpperCase();
  return WISHLIST_STATUSES.has(s) ? s : "ACTIVE";
}

function normalizeWishlistPayload(payload) {
  const base = payload && typeof payload === "object" ? payload : {};
  const entries = Array.isArray(base.entries) ? base.entries : [];

  return {
    ...base,
    entries: entries.map((e) => ({
      ...e,
      status: normalizeWishlistStatus(e?.status), // ✅ CHANGED: enforced
    })),
  };
}

// ---------- hook ----------
export default function useProfileCollection({ userId, token }) {
  const [collection, setCollection] = useState([]);
  const [wishlist, setWishlist] = useState({ entries: [] });
  const [loading, setLoading] = useState(true);
  const [collectionValue, setCollectionValue] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [status, setStatus] = useState(null);

  const [showCardDetails, setShowCardDetails] = useState(false);
  const [cardDetails, setCardDetails] = useState(null);

  const refresh = () => setRefreshTrigger((p) => p + 1);

  useEffect(() => {
    if (!userId) {
      devWarn("[useProfileCollection] No userId provided — collection will be empty.");
    }
    let aborted = false;

    // 0) Stale-while-revalidate: show cached collection instantly if available
    const cached = typeof window !== "undefined" ? readCache(userId) : null;
    if (cached && cached.data && Array.isArray(cached.data)) {
      setCollection(cached.data);
      setCollectionValue(getCollectionTotalValue(cached.data));
      setLoading(false); // show UI immediately
    }

    (async () => {
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // 1) Fetch collection (DB-only pricing) — minimal shape
      const colQ = `
        query GetUserProfileCollection($userId: ID!) {
          collection(userId: $userId) {
            id
            cardId
            quantity
            condition
            variation
            wishlist
            createdAt
            updatedAt
            card {
              id
              name
              number
              setCode
              set { name }
              images { small large }
              variants { key label default }
              latestPrices { provider currency market mid low high gbp variation updatedAt }
            }
          }
        }
      `;

      // 2) Fetch wishlist in parallel (does not block the collection render)
      const wishQ = `
        query Wishlist($userId: ID!) {
          wishlist(userId: $userId) {
            entries {
              id
              cardId
              variation
              quantity
              status
              card {
                id
                name
                number
                setCode
                set { name }
                images { small large }
                variants { key label default }
                latestPrices { provider currency market mid low high gbp variation updatedAt }
              }
            }
            total
            page
            pageSize
          }
        }
      `;

      try {
        const [colResp, wishResp] = await Promise.all([
          fetch(getGraphqlUrl(), {
            method: "POST",
            headers,
            // force network (avoid cached fetches that could be stale)
            cache: "no-store",
            body: JSON.stringify({
              query: colQ,
              variables: { userId: String(userId) },
            }),
          }),
          fetch(getGraphqlUrl(), {
            method: "POST",
            headers,
            cache: "no-store",
            body: JSON.stringify({
              query: wishQ,
              variables: { userId: String(userId) },
            }),
          }),
        ]);

        const colJson = await colResp.json().catch(() => ({}));
        const wishJson = await wishResp.json().catch(() => ({}));

        if (aborted) return;

        const rawCollection = Array.isArray(colJson?.data?.collection) ? colJson.data.collection : [];

        // Flatten & keep only non-wishlist entries (we do NO upstream hydration here)
        const flat = [];
        for (const entry of rawCollection) {
          if (!entry) continue;
          const isWishlist =
            entry.wishlist === true ||
            entry.wishlist === 1 ||
            String(entry.wishlist).toLowerCase() === "true";
          if (isWishlist) continue;

          const card = entry.card || {};
          flat.push({
            ...entry,
            ...card,
            setName: card.set?.name || card.setName || null, // CHANGED
            prices: Array.isArray(card.latestPrices) ? card.latestPrices.filter(Boolean) : [], // CHANGED
            variations: Array.isArray(card.variants)
              ? card.variants.map((v) => v?.key || v?.variant).filter(Boolean)
              : Array.isArray(card.variations)
                ? card.variations
                    .map((v) => (typeof v === "string" ? v : v?.key || v?.variant))
                    .filter(Boolean)
                : null, // CHANGED
            cardId: entry.cardId,
            quantity: entry.quantity,
            condition: entry.condition,
            variation: entry.variation,
            wishlist: entry.wishlist,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          });
        }

        // Update state immediately with DB prices only
        setCollection(flat);
        setCollectionValue(getCollectionTotalValue(flat));
        writeCache(userId, flat);

        // ✅ CHANGED: Wishlist normalization (non-blocking)
        // Ensures `status` is preserved and uppercased; prevents UI defaulting to ACTIVE.
        const wishRaw = wishJson?.data?.wishlist ?? { entries: [] };
        const wishNormalized = normalizeWishlistPayload(wishRaw);
        setWishlist(wishNormalized);

        // If there was no cache, flip loading off now
        if (!cached) setLoading(false);
      } catch {
        if (!cached) setLoading(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [userId, token, refreshTrigger]);

  return {
    collection: { value: collection, set: setCollection },
    wishlist: { value: wishlist, set: setWishlist },
    loading: { value: loading, set: setLoading },
    collectionValue: { value: collectionValue, set: setCollectionValue },
    refresh,
    status: { value: status, set: setStatus },
    showCardDetails,
    setShowCardDetails,
    cardDetails,
    setCardDetails,
  };
}

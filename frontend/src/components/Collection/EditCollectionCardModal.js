"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getCookie } from "@/utils/cookieUtils";
import { formatVariation } from "@/utils/formatVariation";
import { getGraphqlUrl } from "@/utils/apiClient";

const TCG_GRAPHQL_URL = "https://tcg.sixbyfive.com/tcgdex/graphql";

// -------- helpers --------
const normalizeVariation = (v) =>
  v == null || (typeof v === "string" && v.trim() === "") ? null : String(v).trim();

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function gqlFetch(url, query, variables, token) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  return json;
}

const VARIATION_LABELS = {
  normal: "Normal",
  reverse: "Reverse Holo",
  holo: "Holo",
  firstEdition: "1st Edition",
};

function normalizeVariations(v) {
  try {
    const obj = typeof v === "string" ? JSON.parse(v) : v;
    if (!obj || typeof obj !== "object") return { normal: true };
    return {
      normal: !!(obj.normal ?? obj.Normal ?? true),
      reverse: !!(obj.reverse || obj.reverseHolofoil || obj.Reverse),
      holo: !!(obj.holo || obj.holofoil || obj.Holo),
      firstEdition: !!obj.firstEdition,
    };
  } catch {
    return { normal: true };
  }
}

function hasUnknownArgError(json) {
  return Array.isArray(json?.errors) && json.errors.some((e) =>
    /unknown argument|unknown field|cannot query field/i.test(e?.message || "")
  );
}
function isEntryNotFound(json) {
  return Array.isArray(json?.errors) && json.errors.some((e) =>
    /entry not found|not found/i.test(e?.message || "")
  );
}

// -------- component --------
export default function EditCollectionCardModal({ card, onClose, onUpdated, onRemoved }) {
  const [quantity, setQuantity] = useState(card.quantity || 1);
  const [condition, setCondition] = useState(card.condition || "mint");
  const [variation, setVariation] = useState(normalizeVariation(card.variation)); // desired/new
  const originalVariationRef = useRef(normalizeVariation(card.variation)); // lookup key

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [enrichedCard, setEnrichedCard] = useState(card);

  // Enrich minimal UI details (safe to keep)
  useEffect(() => {
    let abort = false;
    async function fetchCardData() {
      if (!card.cardId) return;
      const q = `
        query SearchCard($externalId: String!) {
          pokemonCards(externalId: $externalId, language: "en", perPage: 1) {
            externalId
            name
            image
            setName
            rarity
            variations
            pricing {
              cardmarket { average_sell averageSell low lowPrice trend trendPrice }
              tcgplayer {
                low mid high market direct_low directLow
                prices { normal { market } holofoil { market } reverseHolofoil { market } }
              }
            }
          }
        }
      `;
      try {
        const json = await gqlFetch(TCG_GRAPHQL_URL, q, { externalId: card.cardId });
        if (abort) return;
        const c = json?.data?.pokemonCards?.[0];
        if (!c) return;

        const cm = c.pricing?.cardmarket || {};
        const tp = c.pricing?.tcgplayer || {};
        const tcgMarket =
          toNumber(tp?.market) ??
          toNumber(tp?.prices?.normal?.market) ??
          toNumber(tp?.prices?.holofoil?.market) ??
          toNumber(tp?.prices?.reverseHolofoil?.market);

        setEnrichedCard((prev) => ({
          ...prev,
          tcgName: c.name || prev.tcgName || "",
          tcgImageUrl: c.image?.trim?.() || prev.tcgImageUrl || "",
          tcgSetName: c.setName || prev.tcgSetName || "",
          tcgRarity: c.rarity || prev.tcgRarity || "",
          ...(tcgMarket != null ? { tcgplayerMarket: tcgMarket } : {}),
          ...(toNumber(cm?.average_sell) ?? toNumber(cm?.averageSell) != null
            ? { cardmarketAverageSell: toNumber(cm?.average_sell) ?? toNumber(cm?.averageSell) }
            : {}),
          variations: normalizeVariations(c.variations),
        }));
      } catch {
        // ignore
      }
    }
    fetchCardData();
    return () => {
      abort = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.cardId]);

  const variationOptions = useMemo(() => {
    const v = normalizeVariations(enrichedCard?.variations);
    const opts = [{ value: "", label: "— None —" }];
    ["normal", "reverse", "holo", "firstEdition"].forEach((k) => {
      if (v[k]) opts.push({ value: k, label: VARIATION_LABELS[k] });
    });
    const val = variation ?? "";
    if (val && !opts.some((o) => o.value === val)) {
      opts.push({ value: val, label: `Custom: ${formatVariation(val)}` });
    }
    return opts;
  }, [enrichedCard?.variations, variation]);

  // Minimal, schema-safe mutations (no wishlist/isPublic/notes/tags)
  const UPDATE_BASE = `
    mutation UpdateCollectionEntry(
      $cardId: String!, $variation: String,
      $quantity: Int, $condition: String
    ) {
      updateCollectionEntry(
        cardId: $cardId, variation: $variation,
        quantity: $quantity, condition: $condition
      ) {
        id
        cardId
        quantity
        condition
        variation
      }
    }
  `;

  // Attempt rename shape A (supported in some backends)
  const UPDATE_RENAME_A = `
    mutation UpdateCollectionEntry(
      $cardId: String!, $variation: String, $newVariation: String,
      $quantity: Int, $condition: String
    ) {
      updateCollectionEntry(
        cardId: $cardId, variation: $variation, newVariation: $newVariation,
        quantity: $quantity, condition: $condition
      ) {
        id
        cardId
        quantity
        condition
        variation
      }
    }
  `;

  // Attempt rename shape B (alt naming)
  const UPDATE_RENAME_B = `
    mutation UpdateCollectionEntry(
      $cardId: String!, $fromVariation: String, $toVariation: String,
      $quantity: Int, $condition: String
    ) {
      updateCollectionEntry(
        cardId: $cardId, fromVariation: $fromVariation, toVariation: $toVariation,
        quantity: $quantity, condition: $condition
      ) {
        id
        cardId
        quantity
        condition
        variation
      }
    }
  `;

  const REMOVE_MUTATION = `
    mutation RemoveFromCollection($cardId: String!, $variation: String) {
      removeFromCollection(cardId: $cardId, variation: $variation)
    }
  `;

  async function handleUpdate() {
    setLoading(true);
    setError(null);
    setInfo(null);

    const token = getCookie("authToken");
    if (!token) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    const cardId = card.cardId || card.id;
    const currentVariation = originalVariationRef.current;
    const desiredVariation = normalizeVariation(variation);

    try {
      // Try rename if the variation changed
      if (desiredVariation !== currentVariation) {
        let json = await gqlFetch(
          getGraphqlUrl(),
          UPDATE_RENAME_A,
          {
            cardId,
            variation: currentVariation,
            newVariation: desiredVariation,
            quantity,
            condition,
          },
          token
        );

        if (hasUnknownArgError(json)) {
          json = await gqlFetch(
            getGraphqlUrl(),
            UPDATE_RENAME_B,
            {
              cardId,
              fromVariation: currentVariation,
              toVariation: desiredVariation,
              quantity,
              condition,
            },
            token
          );
        }

        if (json?.data?.updateCollectionEntry) {
          onUpdated(json.data.updateCollectionEntry);
          onClose();
          return;
        }

        // Fall back to base update (no rename) using the ORIGINAL variation for lookup
        const base = await gqlFetch(
          getGraphqlUrl(),
          UPDATE_BASE,
          {
            cardId,
            variation: currentVariation,
            quantity,
            condition,
          },
          token
        );
        if (!base?.data?.updateCollectionEntry) {
          // Pass through server error if present
          throw new Error(
            base?.errors?.[0]?.message ||
              json?.errors?.[0]?.message ||
              "Update failed"
          );
        }

        // Inform user that rename isn't supported
        setInfo(
          "Saved other changes, but your server doesn’t support renaming the variation. Remove this entry and re-add it with the new variation if you need to change it."
        );
        // Keep UI in sync with the persisted (original) variation
        setVariation(currentVariation);
        onUpdated(base.data.updateCollectionEntry);
        return;
      }

      // Simple update when variation is unchanged
      const json = await gqlFetch(
        getGraphqlUrl(),
        UPDATE_BASE,
        {
          cardId,
          variation: currentVariation,
          quantity,
          condition,
        },
        token
      );

      if (!json?.data?.updateCollectionEntry) {
        throw new Error(json?.errors?.[0]?.message || "Update failed");
      }

      onUpdated(json.data.updateCollectionEntry);
      onClose();
    } catch (err) {
      setError(err?.message || "Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remove this card from your collection?")) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    const token = getCookie("authToken");
    if (!token) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }
    try {
      const json = await gqlFetch(
        getGraphqlUrl(),
        REMOVE_MUTATION,
        { cardId: card.cardId || card.id, variation: originalVariationRef.current },
        token
      );
      if (json?.data?.removeFromCollection) {
        onRemoved(card.id);
        onClose();
      } else {
        throw new Error(json?.errors?.[0]?.message || "Remove failed");
      }
    } catch (err) {
      setError(err?.message || "Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl shadow-2xl px-7 py-7 relative animate-fade-in transition-colors">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-light-alt dark:hover:bg-dark-alt text-light-textMuted dark:text-dark-textMuted hover:text-light-accent dark:hover:text-dark-accent transition"
          aria-label="Close"
          type="button"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M6 6l10 10M16 6L6 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <h2 className="text-xl font-bold text-light-primary dark:text-dark-primary mb-5 tracking-tight">
          Edit Collection Card
        </h2>

        {error && (
          <div className="mb-4 text-sm rounded-lg bg-red-100 dark:bg-red-950 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 px-3 py-2">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-4 text-sm rounded-lg bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 px-3 py-2">
            {info}
          </div>
        )}

        {/* Minimal, schema-safe fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-light-textSecondary dark:text-dark-textSecondary mb-1">
              Quantity
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full rounded-lg bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border px-3 py-2 text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-light-textSecondary dark:text-dark-textSecondary mb-1">
              Condition
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full rounded-lg bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border px-3 py-2 text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm font-semibold"
            >
              <option value="mint">Mint</option>
              <option value="near_mint">Near Mint</option>
              <option value="played">Played</option>
              <option value="poor">Poor</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-light-textSecondary dark:text-dark-textSecondary mb-1">
              Variation
            </label>
            <select
              value={variation ?? ""}
              onChange={(e) => setVariation(e.target.value ? e.target.value : null)}
              className="w-full rounded-lg bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border px-3 py-2 text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm"
            >
              {variationOptions.map((o) => (
                <option key={String(o.value)} value={o.value ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-light-textMuted dark:text-dark-textMuted">
              Current on record: {formatVariation(originalVariationRef.current) || "None"}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-7">
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="flex-1 bg-light-accent dark:bg-dark-accent hover:bg-light-accentLight dark:hover:bg-dark-accentLight text-white font-bold py-2 rounded-xl shadow transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            type="button"
          >
            {loading && (
              <svg className="animate-spin mr-1" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" />
              </svg>
            )}
            {loading ? "Saving..." : "Save"}
          </button>
          <button
            onClick={handleRemove}
            disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl shadow transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M5 6h10M8 9v4m4-4v4M3 6h14v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

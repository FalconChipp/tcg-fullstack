"use client";

import React, { useState, useEffect } from "react";
import { getCookie } from "@/utils/cookieUtils";
import { formatVariation } from "@/utils/formatVariation";

const WP_GRAPHQL_URL = "http://tcg.local/graphql";
const TCG_GRAPHQL_URL = "https://tcg.sixbyfive.com/tcgdex/graphql";

export default function EditCollectionCardModal({
  card,
  onClose,
  onUpdated,
  onRemoved,
}) {
  // Local state
  const [quantity, setQuantity] = useState(card.quantity || 1);
  const [condition, setCondition] = useState(card.condition || "mint");
  const [variation, setVariation] = useState(card.variation || "");
  const [isPublic, setIsPublic] = useState(!!card.isPublic);
  const [wishlist, setWishlist] = useState(!!card.wishlist);
  const [notes, setNotes] = useState(card.notes || "");
  const [tags, setTags] = useState(card.tags ? card.tags.join(", ") : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [enrichedCard, setEnrichedCard] = useState(card);

  // Fetch TCGdex details
  useEffect(() => {
    async function fetchCardData() {
      if (!card.cardId) return;
      const searchQ = `
        query SearchCard($externalId: String!) {
          pokemonCards(
            externalId: $externalId
            language: "en"
            perPage: 1 
          ) {
            externalId
            name
            number
            image
            setId
            setName
            setSymbol
            setLogo
            rarity
            variations
            edition
            pricing {
              cardmarket { average_sell low trend }
              tcgplayer { low mid high market direct_low }
            }
          }
        }
      `;
      try {
        const r = await fetch(TCG_GRAPHQL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: searchQ,
            variables: { externalId: card.cardId },
          }),
        });
        const json = await r.json();
        if (json.data?.pokemonCards && json.data.pokemonCards.length > 0) {
          const matchedCard = json.data.pokemonCards[0];
          setEnrichedCard({
            ...card,
            tcgName: matchedCard.name || card.tcgName || "",
            tcgImageUrl: matchedCard.image ? matchedCard.image.trim() : card.tcgImageUrl || "",
            tcgSetName: matchedCard.setName || card.tcgSetName || "",
            tcgSetSymbolUrl: matchedCard.setSymbol ? matchedCard.setSymbol.trim() : card.tcgSetSymbolUrl || "",
            tcgRarity: matchedCard.rarity || card.tcgRarity || "",
            tcgplayerMarket: matchedCard.pricing?.tcgplayer?.market || card.tcgplayerMarket || null,
            cardmarketAverageSell: matchedCard.pricing?.cardmarket?.average_sell || card.cardmarketAverageSell || null,
          });
        }
      } catch (err) {
        setEnrichedCard(card);
      }
    }
    fetchCardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.cardId]);

  // -- Save handler
  async function handleUpdate() {
    setLoading(true);
    setError(null);
    const token = getCookie("authToken");
    if (!token) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }
    const mutation = `
      mutation UpdateCollectionCard($input: UpdateCollectionCardInput!) {
        updateCollectionCard(input: $input) {
          collectionCard {
            id
            cardId
            quantity
            condition
            variation
            notes
            tags
            isPublic
            wishlist
            tcgName
            tcgSetName
            tcgImageUrl
            tcgSetSymbolUrl
            tcgRarity
            tcgplayerMarket
            cardmarketAverageSell
          }
        }
      }
    `;
    const formatTcgData = v => v === null || v === undefined ? "" : String(v).trim();
    const formatUrlField = url => {
      if (!url) return "";
      const trimmed = String(url).trim();
      try { return new URL(trimmed).href; } catch { return trimmed.startsWith("/") ? trimmed : ""; }
    };
    const formatNumericValue = v => {
      if (v === null || v === undefined || v === "") return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };
    const variables = {
      input: {
        collectionId: card.id,
        quantity,
        condition,
        variation,
        notes,
        tags,
        isPublic,
        wishlist,
        tcgName: formatTcgData(enrichedCard.tcgName || card.tcgName),
        tcgSetName: formatTcgData(enrichedCard.tcgSetName || card.tcgSetName),
        tcgImageUrl: formatUrlField(enrichedCard.tcgImageUrl || card.tcgImageUrl),
        tcgSetSymbolUrl: formatUrlField(enrichedCard.tcgSetSymbolUrl || card.tcgSetSymbolUrl),
        tcgRarity: formatTcgData(enrichedCard.tcgRarity || card.tcgRarity),
        tcgplayerMarket: formatNumericValue(enrichedCard.tcgplayerMarket || card.tcgplayerMarket),
        cardmarketAverageSell: formatNumericValue(enrichedCard.cardmarketAverageSell || card.cardmarketAverageSell),
      },
    };

    try {
      const res = await fetch(WP_GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: mutation, variables }),
      });
      const json = await res.json();
      if (json?.data?.updateCollectionCard?.collectionCard) {
        onUpdated(json.data.updateCollectionCard.collectionCard);
        onClose();
      } else {
        setError(json?.errors?.[0]?.message || "Update failed");
      }
    } catch (err) {
      setError("Network error. See console.");
    } finally {
      setLoading(false);
    }
  }

  // -- Remove handler
  async function handleRemove() {
    if (!confirm("Are you sure you want to remove this card?")) return;
    setLoading(true);
    setError(null);
    const token = getCookie("authToken");
    if (!token) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }
    const mutation = `
      mutation RemoveCard($input: RemoveCardFromCollectionInput!) {
        removeCardFromCollection(input: $input) {
          success
        }
      }
    `;
    const variables = { input: { collectionId: card.id } };
    try {
      const res = await fetch(WP_GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: mutation, variables }),
      });
      const json = await res.json();
      if (json?.data?.removeCardFromCollection?.success) {
        onRemoved(card.id);
        onClose();
      } else {
        setError(json?.errors?.[0]?.message || "Remove failed");
      }
    } catch (err) {
      setError("Network error. See console.");
    } finally {
      setLoading(false);
    }
  }

  // -- RENDER
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="
        w-full max-w-sm bg-light-surface dark:bg-dark-surface
        border border-light-border dark:border-dark-border
        rounded-2xl shadow-2xl px-7 py-7 relative animate-fade-in
        transition-colors
      ">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-light-alt dark:hover:bg-dark-alt text-light-textMuted dark:text-dark-textMuted hover:text-light-accent dark:hover:text-dark-accent transition"
          aria-label="Close"
          type="button"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M6 6l10 10M16 6L6 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <h2 className="text-xl font-bold text-light-primary dark:text-dark-primary mb-5 tracking-tight">
          Edit Collection Card
        </h2>
        {error && (
          <div className="mb-5 text-sm rounded-lg bg-red-100 dark:bg-red-950 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 px-3 py-2 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M10 3.5l6.5 13H3.5l6.5-13zm0 7v3m0 2v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Quantity */}
          <div>
            <label className="block text-sm font-semibold text-light-textSecondary dark:text-dark-textSecondary mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
              className="w-full rounded-lg bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border px-3 py-2 text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm font-semibold"
            />
          </div>
          {/* Condition */}
          <div>
            <label className="block text-sm font-semibold text-light-textSecondary dark:text-dark-textSecondary mb-1">Condition</label>
            <select
              value={condition}
              onChange={e => setCondition(e.target.value)}
              className="w-full rounded-lg bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border px-3 py-2 text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm font-semibold"
            >
              <option value="mint">Mint</option>
              <option value="near_mint">Near Mint</option>
              <option value="played">Played</option>
              <option value="poor">Poor</option>
            </select>
          </div>
          {/* Variation */}
          <div>
            <label className="block text-sm font-semibold text-light-textSecondary dark:text-dark-textSecondary mb-1">Variation</label>
            <input
              type="text"
              value={formatVariation(variation)}
              onChange={e => setVariation(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
              placeholder="Reverse Holo, 1st Edition, etc."
              className="w-full rounded-lg bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border px-3 py-2 text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm"
            />
          </div>
          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-light-textSecondary dark:text-dark-textSecondary mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any personal notes"
              rows={2}
              className="w-full rounded-lg bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border px-3 py-2 text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm resize-none"
            />
          </div>
          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-light-textSecondary dark:text-dark-textSecondary mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="e.g. trade,rare"
              className="w-full rounded-lg bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border px-3 py-2 text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent outline-none text-sm"
            />
          </div>
          {/* Toggles */}
          <div className="flex items-center gap-6 mt-1">
            <label className="flex items-center gap-2 text-sm text-light-textMuted dark:text-dark-textMuted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={() => setIsPublic(!isPublic)}
                className="form-checkbox h-4 w-4 rounded border-light-border dark:border-dark-border text-light-accent dark:text-dark-accent focus:ring-0"
              />
              Public
            </label>
            <label className="flex items-center gap-2 text-sm text-light-textMuted dark:text-dark-textMuted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={wishlist}
                onChange={() => setWishlist(!wishlist)}
                className="form-checkbox h-4 w-4 rounded border-light-border dark:border-dark-border text-light-accent dark:text-dark-accent focus:ring-0"
              />
              Wishlist
            </label>
          </div>
        </div>
        {/* Buttons */}
        <div className="flex gap-3 mt-7">
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="flex-1 bg-light-accent dark:bg-dark-accent hover:bg-light-accentLight dark:hover:bg-dark-accentLight text-white font-bold py-2 rounded-xl shadow transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            type="button"
          >
            {loading && (
              <svg className="animate-spin mr-1" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4"/>
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
              <path d="M5 6h10M8 9v4m4-4v4M3 6h14v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

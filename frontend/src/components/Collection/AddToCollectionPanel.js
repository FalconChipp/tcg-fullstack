"use client";

import React, { useState, useContext, useEffect } from "react";
import { AuthContext } from "@/components/Auth/AuthProvider";
import { useTheme } from "@/hooks/ThemeProvider";
import Image from "next/image";
import { executeMutation } from "@/utils/graphqlUtils";
import StatusMessage from "@/components/UI/StatusMessage";
import { getCardImageUrl } from "@/utils/imageUtils";

const FALLBACK_CARD_IMAGE = "https://cdn.pidgi.net/images/f/f6/Card_back_INTL_-_Pokemon_Trading_Card_Game.png";

export default function AddToCollectionPanel({ cardDetail, onClose }) {
  const { token, loading: authLoading } = useContext(AuthContext);
  const { dark } = useTheme();

  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState("mint");
  const [variation, setVariation] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [wishlist, setWishlist] = useState(false);
  const [variationOptions, setVariationOptions] = useState([]);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract variation options on mount
  useEffect(() => {
    let variationsArray = [];
    if (cardDetail?.tcgplayerVariations && typeof cardDetail.tcgplayerVariations === "object") {
      variationsArray = Object.keys(cardDetail.tcgplayerVariations).filter(
        (k) => cardDetail.tcgplayerVariations[k] !== null && k !== "__typename"
      );
    } else if (cardDetail?.variations && typeof cardDetail.variations === "string") {
      variationsArray = cardDetail.variations.split(",").map((s) => s.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
    } else if (Array.isArray(cardDetail?.variations)) {
      variationsArray = cardDetail.variations.map(v => v.toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
    }
    if (variationsArray.length > 0) {
      setVariationOptions(variationsArray);
      if (!variation && variationsArray.includes("normal")) setVariation("normal");
      else if (!variation) setVariation(variationsArray[0]);
    } else {
      setVariationOptions([]);
      setVariation("");
    }
    // eslint-disable-next-line
  }, [cardDetail]);

  function formatVariationText(variationKey) {
    if (!variationKey) return "Standard";
    return variationKey
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .replace(/Holofoil/g, "Holo")
      .replace(/_/g, " ")
      .trim();
  }

  function showStatus(type, message) {
    setStatusMessage({ type, message });
    setTimeout(() => setStatusMessage(null), 3200);
  }

  async function handleSubmit() {
    if (!token) {
      showStatus("error", "Authentication token not found. Please log in.");
      return;
    }
    if (!cardDetail || !cardDetail.cardId) {
      showStatus("error", "Card details are missing. Cannot add to collection.");
      return;
    }
    setIsSubmitting(true);

    const inputVariables = {
      cardId: cardDetail.cardId,
      quantity,
      condition,
      variation: variation || "normal",
      isPublic,
      wishlist,
      tcgName: cardDetail.name || cardDetail.tcgName || "",
      tcgSetName: cardDetail.set?.name || cardDetail.tcgSetName || "",
      tcgImageUrl: cardDetail.image || cardDetail.tcgImageUrl || "",
      tcgSetSymbolUrl: cardDetail.set?.logo || cardDetail.set?.symbol || cardDetail.tcgSetSymbolUrl || "",
      tcgRarity: cardDetail.rarity || cardDetail.tcgRarity || "",
    };

    try {
      const mutation = `
        mutation AddCardToCollection($input: AddCardToCollectionInput!) {
          addCardToCollection(input: $input) {
            collectionCard { id }
          }
        }
      `;
      const finalVariables = { input: inputVariables };
      const result = await executeMutation(mutation, finalVariables, token);
      const success = result?.addCardToCollection?.collectionCard;
      if (success) {
        showStatus("success", `Card added to your ${wishlist ? "wishlist" : "collection"}!`);
        setTimeout(() => { onClose && onClose(); }, 1500);
      } else {
        const errorMessage = result?.errors?.[0]?.message || "Failed to add card. Please try again.";
        throw new Error(errorMessage);
      }
    } catch (err) {
      showStatus("error", err.message || "Unexpected error. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-end">
        <div className="w-full max-w-md bg-light-surface dark:bg-dark-surface p-8 shadow-2xl rounded-l-3xl h-full flex flex-col items-center justify-center border border-light-border dark:border-dark-border">
          <span className="text-lg font-semibold text-light-text dark:text-dark-text">Loading authentication...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-end" onClick={onClose}>
      <div
        className="
          w-full max-w-sm sm:max-w-md
          bg-light-surface dark:bg-dark-surface
          rounded-l-3xl shadow-2xl h-full p-8 relative flex flex-col
          border border-light-border dark:border-dark-border
          animate-in slide-in-from-right-4 fade-in
          transition-colors
        "
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-3xl text-light-textMuted dark:text-dark-textMuted hover:text-light-accent dark:hover:text-dark-accent transition-colors"
          aria-label="Close panel"
          type="button"
        >
          &times;
        </button>
        {/* Card preview */}
        <div className="flex gap-4 items-center mb-7">
          <div className="relative w-24 h-36 rounded-2xl bg-light-alt dark:bg-dark-alt overflow-hidden shadow border border-light-border dark:border-dark-border">
            <Image
              src={getCardImageUrl(
                cardDetail?.image ||
                cardDetail?.tcgImageUrl ||
                cardDetail?.tcgImage
              )}
              alt={cardDetail?.name || "Card"}
              fill
              className="object-contain rounded-2xl"
              sizes="120px"
              onError={(e) => { e.target.src = FALLBACK_CARD_IMAGE; }}
              priority
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-light-primary dark:text-dark-primary mb-1">
              Add <span className="text-light-accent dark:text-dark-accent">{cardDetail?.name || "Card"}</span>
            </h2>
            <div className="flex gap-2 items-center text-sm text-light-textSecondary dark:text-dark-textSecondary mb-0.5">
              <span>{cardDetail?.setName}</span>
              <span>#{cardDetail?.number}</span>
            </div>
            <div className="text-xs text-light-accent dark:text-dark-accent font-semibold">{cardDetail?.rarity}</div>
          </div>
        </div>
        {/* Form */}
        <form
          className="flex flex-col gap-4"
          onSubmit={e => { e.preventDefault(); handleSubmit(); }}
        >
          {/* Variation */}
          <div className="flex flex-col gap-1">
            <label htmlFor="variation" className="font-medium text-light-textSecondary dark:text-dark-textSecondary">
              Variation
            </label>
            {variationOptions.length > 0 ? (
              <select
                id="variation"
                value={variation}
                onChange={e => setVariation(e.target.value)}
                className="rounded-lg border border-light-border dark:border-dark-border px-3 py-2 bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text focus:outline-none focus:border-light-accent dark:focus:border-dark-accent"
              >
                {variationOptions.map(opt => (
                  <option key={opt} value={opt}>
                    {formatVariationText(opt)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="variation"
                type="text"
                value={variation}
                onChange={e => setVariation(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                placeholder="e.g. reverse_holo, 1st_edition"
                className="rounded-lg border border-light-border dark:border-dark-border px-3 py-2 bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text focus:outline-none focus:border-light-accent dark:focus:border-dark-accent"
              />
            )}
          </div>
          {/* Condition */}
          <div className="flex flex-col gap-1">
            <label htmlFor="condition" className="font-medium text-light-textSecondary dark:text-dark-textSecondary">
              Condition
            </label>
            <select
              id="condition"
              value={condition}
              onChange={e => setCondition(e.target.value)}
              className="rounded-lg border border-light-border dark:border-dark-border px-3 py-2 bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text focus:outline-none focus:border-light-accent dark:focus:border-dark-accent"
            >
              <option value="mint">Mint</option>
              <option value="near_mint">Near Mint</option>
              <option value="played">Played</option>
              <option value="poor">Poor</option>
            </select>
          </div>
          {/* Quantity */}
          <div className="flex flex-col gap-1">
            <label htmlFor="quantity" className="font-medium text-light-textSecondary dark:text-dark-textSecondary">
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="rounded-lg border border-light-border dark:border-dark-border px-3 py-2 bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text focus:outline-none focus:border-light-accent dark:focus:border-dark-accent"
            />
          </div>
          {/* Wishlist Toggle */}
          <div className="flex items-center gap-3 mt-2">
            <label className="relative flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={wishlist}
                onChange={e => setWishlist(e.target.checked)}
                className="sr-only peer"
              />
              <div className={`
                w-10 h-6 bg-light-alt dark:bg-dark-alt rounded-full transition-colors duration-200 border border-light-border dark:border-dark-border
                peer-checked:bg-light-accent dark:peer-checked:bg-dark-accent
              `}></div>
              <div className={`
                absolute left-1 top-1 w-4 h-4 rounded-full bg-white dark:bg-dark-surface shadow transition-transform duration-200
                ${wishlist ? "translate-x-4" : ""}
              `}></div>
            </label>
            <span className="text-sm text-light-text dark:text-dark-text font-medium">Add to Wishlist</span>
          </div>
          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || authLoading}
            className="mt-2 w-full bg-light-accent dark:bg-dark-accent hover:bg-light-accentLight dark:hover:bg-dark-accentLight text-white font-bold py-2.5 rounded-xl shadow transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Adding..." : wishlist ? "Add to Wishlist" : "Add to Collection"}
          </button>
        </form>
        {/* Status message */}
        {statusMessage && (
          <div className="mt-5">
            <StatusMessage
              type={statusMessage.type}
              message={statusMessage.message}
              onClose={() => setStatusMessage(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

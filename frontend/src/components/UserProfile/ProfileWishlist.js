"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useTheme } from '@/hooks/ThemeProvider';

import { getCardImageUrl, getSetLogo } from "@/utils/imageUtils";
import QuantitySelectorModal from "@/components/UI/QuantitySelectorModal";

// --- UPDATED: Expects wishlist entries with nested .card object
export default function ProfileWishlistPanel({
  wishlistItems = [],
  onMoveToCollection,
  onCardRemoved,
  isOwnProfile,
}) {
  const { dark } = useTheme();
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedCardEntry, setSelectedCardEntry] = useState(null);

  // ---- LOGGING: Shows wishlist items on every render
  useEffect(() => {
    // Will run on mount and whenever wishlistItems changes
    console.log("ProfileWishlistPanel: wishlistItems =", wishlistItems);
    if (Array.isArray(wishlistItems) && wishlistItems.length > 0) {
      wishlistItems.forEach((entry, i) => {
        if (!entry.card) {
          console.warn(`Wishlist entry at index ${i} has no .card object!`, entry);
        } else {
          console.log(`Wishlist entry ${i}:`, entry, "Card:", entry.card);
        }
      });
    }
  }, [wishlistItems]);

  // --- Handles removal click, supports multi-quantity
  function handleRemoveClick(entry) {
    if ((entry.quantity || 1) > 1) {
      setSelectedCardEntry(entry);
      setShowQuantityModal(true);
      setConfirmRemoveId(null);
    } else if (confirmRemoveId === entry.id) {
      onCardRemoved(entry.cardId, entry.variation || null, 1); // Use correct cardId + variation for mutation
      setConfirmRemoveId(null);
    } else {
      setConfirmRemoveId(entry.id);
    }
  }

  // --- Handles multi-quantity removal
  const handleQuantityConfirm = (quantity) => {
    if (selectedCardEntry) {
      onCardRemoved(selectedCardEntry.cardId, selectedCardEntry.variation || null, quantity);
    }
    setShowQuantityModal(false);
    setSelectedCardEntry(null);
  };

  return (
    <div className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${dark ? 'bg-dark-background' : 'bg-light-background'}`}>
      <h2 className={`text-3xl font-bold mb-8 ${dark ? 'text-dark-text' : 'text-light-text'}`}>My Wishlist</h2>
      
      {Array.isArray(wishlistItems) && wishlistItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {wishlistItems.map((entry, idx) => {
            const card = entry.card || {};
            // LOGGING: Each mapped entry and its card
            console.log(`Rendering wishlist entry ${idx}:`, entry);
            if (!card || Object.keys(card).length === 0) {
              console.warn(`No card data found for wishlist entry ${entry.id}`, entry);
            }
            return (
              <div
                key={entry.id}
                className={`rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl ${dark ? 'bg-dark-surface' : 'bg-light-surface'}`}
              >
                <div className="relative aspect-[2.5/3.5]">
                  <Image
                    src={getCardImageUrl(card.image)}
                    alt={card.name || "Pokémon Card"}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className={`p-4 ${dark ? 'text-dark-text' : 'text-light-text'}`}>
                  <h3 className="text-lg font-semibold mb-1">
                    {card.name || "(Unknown)"}
                  </h3>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs rounded px-2 py-0.5 bg-light-alt dark:bg-dark-alt">
                      {card.setName || "(No set)"}
                    </span>
                    {card.setName && (
                      <img
                        src={getSetLogo(card.setName)}
                        alt={card.setName}
                        className="w-6 h-4 rounded ml-1"
                      />
                    )}
                    {entry.variation && (
                      <span className="ml-2 text-xs bg-light-secondary dark:bg-dark-secondary px-2 py-0.5 rounded">
                        {entry.variation}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-sm">{`Qty: ${entry.quantity || 1}`}</span>
                    <span className="text-sm capitalize">{entry.condition || "mint"}</span>
                  </div>
                  {isOwnProfile && (
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onMoveToCollection(entry)}
                        className={`h-10 px-4 rounded-lg font-medium transition-colors flex-grow ${
                          dark 
                            ? 'bg-dark-primary hover:bg-dark-secondary text-white' 
                            : 'bg-light-primary hover:bg-light-secondary text-white'
                        }`}
                      >
                        Collect
                      </button>
                      <div
                        className="relative"
                        onMouseLeave={() => setConfirmRemoveId(null)}
                      >
                        <button
                          type="button"
                          onClick={() => handleRemoveClick(entry)}
                          className={`flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 h-10 ${
                            confirmRemoveId === entry.id ? 'w-24' : 'w-10'
                          }`}
                          title={
                            confirmRemoveId === entry.id
                              ? "Click to confirm removal"
                              : "Remove from wishlist"
                          }
                        >
                          {confirmRemoveId === entry.id ? (
                            <span className="text-xs">Sure?</span>
                          ) : (
                            <span className="text-xl">×</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`text-center py-12 ${dark ? 'text-dark-text' : 'text-light-text'}`}>
          <p className="text-xl font-semibold">No cards in wishlist</p>
          <p className={`mt-2 ${dark ? 'text-dark-textSecondary' : 'text-light-textSecondary'}`}>
            Start adding cards to your wishlist
          </p>
        </div>
      )}
      
      {/* Quantity Selector Modal */}
      <QuantitySelectorModal
        isOpen={showQuantityModal}
        onClose={() => {
          setShowQuantityModal(false);
          setSelectedCardEntry(null);
        }}
        maxQuantity={selectedCardEntry?.quantity || 1}
        onConfirm={handleQuantityConfirm}
        cardName={selectedCardEntry?.card?.name || 'card'}
      />
    </div>
  );
}

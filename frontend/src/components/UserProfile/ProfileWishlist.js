"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useTheme } from '@/hooks/ThemeProvider';

import { getCardImageUrl, getSetSymbolUrl } from "@/utils/imageUtils";
import QuantitySelectorModal from "@/components/UI/QuantitySelectorModal";

export default function ProfileWishlist({
  wishlistItems = [],
  onMoveToCollection,
  onCardRemoved,
  isOwnProfile,
}) {
  const { dark } = useTheme();
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  function handleRemoveClick(card) {
    if (card.quantity > 1) {
      setSelectedCard(card);
      setShowQuantityModal(true);
      setConfirmRemoveId(null);
    } else if (confirmRemoveId === card.id) {
      onCardRemoved(card.id, 1);
      setConfirmRemoveId(null);
    } else {
      setConfirmRemoveId(card.id);
    }
  }

  const handleQuantityConfirm = (quantity) => {
    if (selectedCard) {
      onCardRemoved(selectedCard.id, quantity);
    }
    setShowQuantityModal(false);
    setSelectedCard(null);
  };

  return (
    <div className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${
      dark ? 'bg-dark-background' : 'bg-light-background'
    }`}>
      <h2 className={`text-3xl font-bold mb-8 ${
        dark ? 'text-dark-text' : 'text-light-text'
      }`}>My Wishlist</h2>
      
      {Array.isArray(wishlistItems) && wishlistItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {wishlistItems.map((card) => (
            <div
              key={card.id}
              className={`rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl ${
                dark ? 'bg-dark-surface' : 'bg-light-surface'
              }`}
            >
              <div className="relative aspect-[2.5/3.5]">
                <Image
                  src={getCardImageUrl(card.tcgImageUrl)}
                  alt={card.tcgName || "Pokémon Card"}
                  fill
                  className="object-cover"
                />
              </div>
              <div className={`p-4 ${
                dark ? 'text-dark-text' : 'text-light-text'
              }`}>
                <h3 className="text-lg font-semibold mb-1">
                  {card.tcgName || card.name || "(Unknown)"}
                </h3>
                <div className="flex items-center gap-2">
                  <p className={`text-sm ${
                    dark ? 'text-dark-textSecondary' : 'text-light-textSecondary'
                  }`}>
                    {card.tcgSetName || card.setName || "(No set)"}
                  </p>
                </div>
                <div className="mt-2 flex justify-between items-center">
                  <span className={`text-sm ${
                    dark ? 'text-dark-textSecondary' : 'text-light-textSecondary'
                  }`}>
                    Qty: {card.quantity || 1}
                  </span>
                  <span className={`text-sm ${
                    dark ? 'text-dark-textSecondary' : 'text-light-textSecondary'
                  }`}>
                    {card.condition || "mint"}
                  </span>
                </div>
                {isOwnProfile && (
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onMoveToCollection(card)}
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
                        onClick={() => handleRemoveClick(card)}
                        className={`flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 h-10 ${
                          confirmRemoveId === card.id ? 'w-24' : 'w-10'
                        }`}
                        title={
                          confirmRemoveId === card.id
                            ? "Click to confirm removal"
                            : "Remove from wishlist"
                        }
                      >
                        {confirmRemoveId === card.id ? (
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
          ))}
        </div>
      ) : (
        <div className={`text-center py-12 ${
          dark ? 'text-dark-text' : 'text-light-text'
        }`}>
          <p className="text-xl font-semibold">No cards in wishlist</p>
          <p className={`mt-2 ${
            dark ? 'text-dark-textSecondary' : 'text-light-textSecondary'
          }`}>
            Start adding cards to your wishlist
          </p>
        </div>
      )}
      
      {/* Quantity Selector Modal */}
      <QuantitySelectorModal
        isOpen={showQuantityModal}
        onClose={() => {
          setShowQuantityModal(false);
          setSelectedCard(null);
        }}
        maxQuantity={selectedCard?.quantity || 1}
        onConfirm={handleQuantityConfirm}
        cardName={selectedCard?.tcgName || 'card'}
      />
    </div>
  );
}

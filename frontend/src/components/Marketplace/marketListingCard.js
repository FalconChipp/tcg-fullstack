"use client";
import React from "react";
import { FaShoppingCart } from "react-icons/fa";

// Example props: { listing }
export default function MarketplaceListingCard({ listing }) {
  return (
    <div className="
      bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border
      rounded-2xl shadow hover:shadow-2xl transition p-4 flex flex-col group
    ">
      <div className="relative w-full aspect-[3/4] mb-3 bg-light-alt dark:bg-dark-alt rounded-xl overflow-hidden flex items-center justify-center">
        <img
          src={listing.cardImage}
          alt={listing.cardName}
          className="object-contain w-full h-full"
          draggable={false}
        />
        {/* Optional: Proof-of-ownership overlay icon */}
        {listing.proofImage && (
          <div className="absolute bottom-2 right-2 bg-light-surface/80 dark:bg-dark-surface/80 rounded-full p-1 text-xs">
            <span className="text-light-accent dark:text-dark-accent">PO</span>
          </div>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="font-bold text-lg text-light-primary dark:text-dark-primary truncate">
            {listing.cardName}
          </div>
          <div className="text-xs text-light-textMuted dark:text-dark-textMuted ml-2">{listing.setName}</div>
        </div>
        <div className="text-sm text-light-textSecondary dark:text-dark-textSecondary mb-1">
          #{listing.cardNumber} • {listing.rarity}
        </div>
        <div className="text-base font-semibold mb-2 text-light-accent dark:text-dark-accent">
          £{listing.price.toFixed(2)}
        </div>
        <div className="flex gap-2 mt-2">
          <button
            className="
              flex items-center justify-center gap-2 w-full py-2 rounded-xl
              bg-light-accent dark:bg-dark-accent text-light-surface dark:text-dark-surface font-bold
              hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition
              shadow
            "
          >
            <FaShoppingCart /> Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}

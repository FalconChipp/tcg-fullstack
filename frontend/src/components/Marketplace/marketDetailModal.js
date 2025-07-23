// /components/Marketplace/MarketplaceListingModal.js
"use client";
import React, { useState } from "react";
import Image from "next/image";

const FALLBACK_CARD_IMAGE = "https://cdn.pidgi.net/images/f/f6/Card_back_INTL_-_Pokemon_Trading_Card_Game.png";

export default function MarketplaceListingModal({ listing, onClose }) {
  const [full, setFull] = useState(false);

  if (!listing) return null;

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 ${
        full ? "overflow-auto" : "overflow-hidden"
      }`}
    >
      <div
        className={`
          bg-light-surface dark:bg-dark-surface
          rounded-2xl shadow-xl relative flex flex-col
          border border-light-border dark:border-dark-border
          ${full ? "w-full h-full max-w-none max-h-none rounded-none" : "w-[90%] max-w-3xl max-h-[95vh]"}
        `}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-2xl text-light-textMuted dark:text-dark-textMuted hover:text-light-error dark:hover:text-dark-error"
          aria-label="Close"
        >
          &times;
        </button>
        {/* Content */}
        <div className="flex flex-col md:flex-row gap-8 p-8 overflow-auto">
          {/* Image */}
          <div className="flex-1">
            <div className="relative aspect-[2/3] w-full max-w-[290px] mx-auto mb-5">
              <Image
                src={listing.cardImage || FALLBACK_CARD_IMAGE}
                alt={listing.cardName}
                fill
                className="object-contain rounded-xl"
                priority
                sizes="(max-width: 768px) 80vw, 290px"
              />
            </div>
            {/* Proof of card photo, if present */}
            {listing.proofImage && (
              <div className="mt-3 text-xs text-light-success dark:text-dark-success text-center font-semibold">
                Proof of ownership provided
              </div>
            )}
          </div>
          {/* Listing Info */}
          <div className="flex-1 flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-light-primary dark:text-dark-primary">
              {listing.cardName}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-light-alt dark:bg-dark-alt">
                <div className="text-xs text-light-textMuted dark:text-dark-textMuted">Set</div>
                <div className="font-semibold">{listing.setName}</div>
              </div>
              <div className="p-3 rounded-xl bg-light-alt dark:bg-dark-alt">
                <div className="text-xs text-light-textMuted dark:text-dark-textMuted">Number</div>
                <div>{listing.cardNumber}</div>
              </div>
              <div className="p-3 rounded-xl bg-light-alt dark:bg-dark-alt">
                <div className="text-xs text-light-textMuted dark:text-dark-textMuted">Rarity</div>
                <div>{listing.rarity}</div>
              </div>
              <div className="p-3 rounded-xl bg-light-alt dark:bg-dark-alt">
                <div className="text-xs text-light-textMuted dark:text-dark-textMuted">Condition</div>
                <div>{listing.condition}</div>
              </div>
              <div className="p-3 rounded-xl bg-light-alt dark:bg-dark-alt">
                <div className="text-xs text-light-textMuted dark:text-dark-textMuted">Language</div>
                <div>{listing.language}</div>
              </div>
              <div className="p-3 rounded-xl bg-light-alt dark:bg-dark-alt">
                <div className="text-xs text-light-textMuted dark:text-dark-textMuted">Seller</div>
                <div>{listing.seller}</div>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-4">
              <div className="flex items-center gap-2 text-lg">
                <span className="font-bold text-light-accent dark:text-dark-accent">£{listing.price.toFixed(2)}</span>
                <span className="text-xs text-light-textMuted dark:text-dark-textMuted">per card</span>
              </div>
              <div className="text-xs text-light-textMuted dark:text-dark-textMuted">
                Listed on {new Date(listing.listedAt).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-3 mt-7">
              <button
                className="flex-1 py-3 rounded-xl font-bold text-white bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight shadow"
                // onClick={() => ...}
              >
                Buy Now
              </button>
              <button
                className="flex-1 py-3 rounded-xl font-bold border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text hover:bg-light-surface dark:hover:bg-dark-surface shadow"
                // onClick={() => ...}
              >
                Message Seller
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

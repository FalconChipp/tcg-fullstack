// /components/Marketplace/MarketplaceListingModal.js
"use client";
import React, { useState } from "react";
import Image from "next/image";

const FALLBACK_CARD_IMAGE =
  "https://cdn.pidgi.net/images/f/f6/Card_back_INTL_-_Pokemon_Trading_Card_Game.png";

export default function MarketplaceListingModal({ listing, onClose }) {
  const [full, setFull] = useState(false);

  // --- New state for Make Offer modal ---
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerStatus, setOfferStatus] = useState(null);
  const [offerError, setOfferError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!listing) return null;

  // --- Simulate offer submission ---
  async function handleOfferSubmit(e) {
    e.preventDefault();
    setOfferError(null);

    // Validate offer
    const amount = parseFloat(offerAmount);
    if (isNaN(amount) || amount < 1 || amount >= listing.price) {
      setOfferError(
        `Enter a valid offer below the asking price (£${listing.price.toFixed(
          2
        )}).`
      );
      return;
    }

    setSubmitting(true);

    // Simulate network call
    setTimeout(() => {
      setSubmitting(false);
      setOfferStatus(
        `Offer of £${amount.toFixed(2)} sent to ${listing.seller}. Await their response!`
      );
      setOfferOpen(false);
      setOfferAmount("");
    }, 1200);
  }

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
                <span className="font-bold text-light-accent dark:text-dark-accent">
                  £{listing.price.toFixed(2)}
                </span>
                <span className="text-xs text-light-textMuted dark:text-dark-textMuted">per card</span>
              </div>
              <div className="text-xs text-light-textMuted dark:text-dark-textMuted">
                Listed on{" "}
                {new Date(listing.listedAt).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            </div>

            {/* Offer status feedback */}
            {offerStatus && (
              <div className="bg-light-success/20 dark:bg-dark-success/20 text-light-success dark:text-dark-success p-3 rounded text-center text-sm font-semibold">
                {offerStatus}
              </div>
            )}

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
              <button
                className="flex-1 py-3 rounded-xl font-bold border border-light-accent dark:border-dark-accent bg-transparent text-light-accent dark:text-dark-accent hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 shadow"
                onClick={() => setOfferOpen(true)}
              >
                Make Offer
              </button>
            </div>
          </div>
        </div>

        {/* Make Offer Modal */}
        {offerOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
            <div className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow-xl max-w-md w-full p-7 border border-light-border dark:border-dark-border relative">
              <button
                className="absolute top-3 right-3 text-2xl text-light-textMuted dark:text-dark-textMuted hover:text-light-error dark:hover:text-dark-error"
                onClick={() => {
                  setOfferOpen(false);
                  setOfferError(null);
                  setOfferAmount("");
                }}
                aria-label="Close offer dialog"
              >
                &times;
              </button>
              <h3 className="text-xl font-bold mb-2 text-light-accent dark:text-dark-accent text-center">
                Make an Offer
              </h3>
              <p className="mb-4 text-center text-light-textMuted dark:text-dark-textMuted">
                Enter your offer below the asking price (£{listing.price.toFixed(2)}).
              </p>
              <form onSubmit={handleOfferSubmit} className="flex flex-col gap-3">
                <input
                  type="number"
                  min="1"
                  max={listing.price - 0.01}
                  step="0.01"
                  placeholder="Enter offer amount"
                  value={offerAmount}
                  onChange={e => setOfferAmount(e.target.value)}
                  className="w-full py-2 px-4 rounded-xl bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border text-lg text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition"
                  disabled={submitting}
                  required
                />
                {offerError && (
                  <div className="text-sm text-light-error dark:text-dark-error text-center">{offerError}</div>
                )}
                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-light-accent dark:bg-dark-accent text-white dark:text-dark-surface font-bold hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition"
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Send Offer"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

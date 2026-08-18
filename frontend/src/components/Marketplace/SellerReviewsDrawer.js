// frontend/src/components/Marketplace/SellerReviewsDrawer.js
"use client";

import React, { useEffect, useState } from "react";
import { gqlFetch } from "@/utils/apiClient";
import SellerTierBadge from "./SellerTierBadge";

const SELLER_REVIEWS_QUERY = `
  query SellerReviews($userId: ID!, $limit: Int, $offset: Int) {
    sellerReputation(userId: $userId) {
      score positive negative neutral completedMarketplace flagged
    }
    sellerReviews(userId: $userId, limit: $limit, offset: $offset) {
      cardId rating review createdAt
    }
  }
`;

const PAGE_SIZE = 15;

function Stars({ rating, size = "sm" }) {
  const sz = size === "lg" ? "text-xl" : "text-sm";
  return (
    <span className={`${sz} leading-none`} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? "text-amber-400" : "text-vault-border dark:text-vault-border"}>
          ★
        </span>
      ))}
    </span>
  );
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function SellerReviewsDrawer({ sellerId, sellerUsername, open, onClose }) {
  const [reputation, setReputation] = useState(null);
  const [reviews, setReviews]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [offset, setOffset]         = useState(0);
  const [hasMore, setHasMore]       = useState(true);

  useEffect(() => {
    if (!open || !sellerId) return;
    setOffset(0);
    setReviews([]);
    setHasMore(true);
    load(0, true);
  }, [open, sellerId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load(off, reset = false) {
    setLoading(true);
    setError(null);
    try {
      const data = await gqlFetch(SELLER_REVIEWS_QUERY, {
        userId: sellerId,
        limit:  PAGE_SIZE,
        offset: off,
      });
      if (reset) {
        setReputation(data?.sellerReputation ?? null);
        setReviews(data?.sellerReviews ?? []);
      } else {
        setReviews((prev) => [...prev, ...(data?.sellerReviews ?? [])]);
      }
      setHasMore((data?.sellerReviews ?? []).length === PAGE_SIZE);
      setOffset(off + PAGE_SIZE);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const rep = reputation;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-[61] w-full max-w-md flex flex-col bg-vault-bg ">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-vault-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-vault-text">
              {sellerUsername ? `${sellerUsername}'s reviews` : "Seller reviews"}
            </h2>
            {rep && (
              <p className="text-xs text-vault-textTertiary mt-0.5">
                {rep.completedMarketplace} sale{rep.completedMarketplace !== 1 ? "s" : ""} completed
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-[6px] flex items-center justify-center hover:bg-vault-raised dark:hover:bg-vault-raised transition text-vault-textTertiary text-lg"
          >
            ✕
          </button>
        </div>

        {/* Tier badge + reputation summary */}
        {rep && (
          <div className="px-5 py-4 border-b border-vault-border flex-shrink-0 space-y-3">
            {rep.flagged && (
              <div className="px-3 py-2 rounded-[6px] bg-red-500/10 border border-red-400/30 text-xs text-red-500 font-semibold">
                ⚠ This seller has been flagged by our moderation team.
              </div>
            )}
            <SellerTierBadge reputation={rep} size="lg" />
            {/* Breakdown row */}
            {(rep.positive + rep.negative + rep.neutral) > 0 && (
              <div className="flex gap-4 text-xs px-1">
                <span className="text-emerald-600 dark:text-emerald-400">
                  <span className="font-bold">{rep.positive}</span> positive
                </span>
                <span className="text-vault-textTertiary">
                  <span className="font-bold">{rep.neutral}</span> neutral
                </span>
                <span className="text-red-500">
                  <span className="font-bold">{rep.negative}</span> negative
                </span>
              </div>
            )}
          </div>
        )}

        {/* Reviews list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading && reviews.length === 0 && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-[10px] border border-vault-border p-4 animate-pulse">
                  <div className="h-4 w-24 bg-vault-border/60 dark:bg-vault-border/60 rounded mb-2" />
                  <div className="h-3 w-full bg-vault-border/40 dark:bg-vault-border/40 rounded" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-[10px] border border-red-400/30 bg-red-500/5 p-4 text-sm text-red-500">
              Failed to load reviews: {error}
            </div>
          )}

          {!loading && !error && reviews.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">⭐</div>
              <p className="font-semibold text-vault-text">No reviews yet</p>
              <p className="text-sm text-vault-textTertiary mt-1">
                Reviews appear after a buyer confirms receipt.
              </p>
            </div>
          )}

          {reviews.map((r, i) => (
            <div
              key={i}
              className="rounded-[10px] border border-vault-border bg-vault-surface p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <Stars rating={r.rating} />
                <span className="text-[10px] text-vault-textTertiary flex-shrink-0">
                  {fmtDate(r.createdAt)}
                </span>
              </div>
              {r.review ? (
                <p className="text-sm text-vault-text leading-relaxed">
                  {r.review}
                </p>
              ) : (
                <p className="text-xs text-vault-textTertiary italic">No written review</p>
              )}
              {r.cardId && (
                <p className="text-[10px] text-vault-textTertiary mt-2 font-mono">
                  {r.cardId}
                </p>
              )}
            </div>
          ))}

          {/* Load more */}
          {hasMore && reviews.length > 0 && (
            <button
              type="button"
              onClick={() => load(offset)}
              disabled={loading}
              className="w-full py-2.5 rounded-[10px] text-sm font-semibold border border-vault-border text-vault-textTertiary hover:bg-vault-raised dark:hover:bg-vault-raised transition disabled:opacity-50"
            >
              {loading ? "Loading…" : "Load more reviews"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

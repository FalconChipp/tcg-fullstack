// backend/src/modules/marketplace/utils/listingUtils.js

/**
 * listingUtils
 * -----------------------------------------------------------------------------
 * Small helpers specific to marketplace listings.
 * Use these to keep services thin and consistent.
 * -----------------------------------------------------------------------------
 */

import { formatCurrency } from './priceUtils.js';

/**
 * Build a human-friendly title for a listing.
 * - PRODUCT: prefer explicit listing.title
 * - CARD: fallback to "Card: <cardId>" (the field resolver can fetch the name)
 */
export function buildListingTitle(listing) {
  if (!listing) return '';
  if (listing.type === 'PRODUCT') {
    return listing.title || 'Product';
  }
  return listing.cardId ? `Card: ${listing.cardId}` : 'Card';
}

/**
 * Present a compact summary object for API/logging/admin dashboards.
 * Avoids leaking large nested associations.
 */
export function summarizeListing(listing) {
  if (!listing) return null;
  return {
    id: listing.id,
    type: listing.type,
    sellerId: listing.userId,
    buyerId: listing.buyerId ?? null,
    status: listing.status,
    quantity: listing.quantity,
    price: String(listing.price),
    currency: listing.currency || 'GBP',
    title: buildListingTitle(listing),
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
}

/**
 * Simple status guardrails for updates.
 */
export const ALLOWED_LISTING_STATUSES = ['active', 'sold', 'removed', 'cancelled'];

/**
 * Human-readable display string (e.g., "£12.34 • active • 1x").
 * Ideal for admin tables and logs.
 */
export function listingDisplay(listing, locale = 'en-GB') {
  const priceStr = formatCurrency(listing.price, listing.currency || 'GBP', locale);
  const qtyStr = `${listing.quantity ?? 1}x`;
  return `${priceStr} • ${listing.status} • ${qtyStr}`;
}

/**
 * Quick filter predicate builders (useful in-memory when needed).
 */
export function byType(type) {
  return (l) => l?.type === type;
}

export function byStatus(status) {
  return (l) => l?.status === status;
}

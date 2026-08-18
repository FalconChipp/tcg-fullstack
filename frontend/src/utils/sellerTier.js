// Seller tier logic — shared across ListingDetailModal, ProfileHeader, SellerReviewsDrawer

export const SELLER_TIERS = [
  {
    key:      'new',
    label:    'New Seller',
    minSales: 0,
    minRate:  0,
    bg:       'bg-slate-500/10',
    border:   'border-slate-400/60',
    text:     'text-slate-500 dark:text-slate-400',
    dot:      'bg-slate-400',
    glow:     '',
  },
  {
    key:      'bronze',
    label:    'Bronze',
    minSales: 1,
    minRate:  0,
    bg:       'bg-amber-600/10',
    border:   'border-amber-500/70',
    text:     'text-amber-700 dark:text-amber-500',
    dot:      'bg-amber-500',
    glow:     '',
  },
  {
    key:      'silver',
    label:    'Silver',
    minSales: 10,
    minRate:  75,
    bg:       'bg-slate-400/10',
    border:   'border-slate-300/70',
    text:     'text-slate-500 dark:text-slate-300',
    dot:      'bg-slate-300',
    glow:     '',
  },
  {
    key:      'gold',
    label:    'Gold',
    minSales: 25,
    minRate:  85,
    bg:       'bg-yellow-400/10',
    border:   'border-yellow-400/70',
    text:     'text-yellow-600 dark:text-yellow-400',
    dot:      'bg-yellow-400',
    glow:     '',
  },
  {
    key:      'platinum',
    label:    'Platinum',
    minSales: 50,
    minRate:  90,
    bg:       'bg-cyan-400/10',
    border:   'border-cyan-400/70',
    text:     'text-cyan-600 dark:text-cyan-400',
    dot:      'bg-cyan-400',
    glow:     '',
  },
  {
    key:      'elite',
    label:    'Elite Seller',
    minSales: 100,
    minRate:  95,
    bg:       'bg-violet-500/10',
    border:   'border-violet-400/70',
    text:     'text-violet-600 dark:text-violet-400',
    dot:      'bg-violet-400',
    glow:     'shadow-[0_0_8px_0] shadow-violet-400/30',
  },
];

/**
 * Compute the current tier and related stats from a sellerReputation object.
 *
 * @param {{ completedMarketplace: number, positive: number, negative: number, neutral: number }} rep
 * @returns {{ tier, positiveRate, totalRatings, nextTier, progressPct }}
 */
export function getSellerTier(rep) {
  if (!rep) return { tier: SELLER_TIERS[0], positiveRate: 100, totalRatings: 0, nextTier: SELLER_TIERS[1], progressPct: 0 };

  const sales        = rep.completedMarketplace ?? 0;
  const totalRatings = (rep.positive ?? 0) + (rep.negative ?? 0) + (rep.neutral ?? 0);
  const positiveRate = totalRatings > 0
    ? Math.round(((rep.positive ?? 0) / totalRatings) * 100)
    : 100; // benefit of the doubt with no ratings

  // Highest tier where BOTH conditions are met (live recalculation)
  let tierIndex = 0;
  for (let i = 0; i < SELLER_TIERS.length; i++) {
    const t = SELLER_TIERS[i];
    if (sales >= t.minSales && (t.minRate === 0 || positiveRate >= t.minRate)) {
      tierIndex = i;
    }
  }

  const tier     = SELLER_TIERS[tierIndex];
  const nextTier = SELLER_TIERS[tierIndex + 1] ?? null;

  // Progress toward next tier (by sales — the easier metric to show)
  let progressPct = 100;
  if (nextTier) {
    const from = tier.minSales;
    const to   = nextTier.minSales;
    progressPct = Math.min(100, Math.round(((sales - from) / (to - from)) * 100));
  }

  return { tier, tierIndex, positiveRate, totalRatings, nextTier, progressPct };
}

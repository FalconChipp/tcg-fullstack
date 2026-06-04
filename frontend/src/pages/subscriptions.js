"use client";
import React, { useEffect, useState, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Layout from "@/components/Layout/Layout";
import {
  fetchUserSubscription,
  fetchSubscriptionPlans,
  startSubscriptionCheckout,
  openBillingPortal,
} from "@/utils/subscriptionsApi";
import SubscriptionFAQ from "@/components/Subscriptions/subscriptionFaq";
import SubscriptionDiscord from "@/components/Subscriptions/subscriptionDiscord";

// ─── Marketing content (static copy, not DB data) ────────────────────────────

const PLAN_META = {
  free: {
    highlight: "Core collecting tools, no card required.",
    cta: "Get started free",
    popular: false,
    forSellers: false,
    color: "neutral",
    features: [
      { label: "Collection tracking (unlimited cards)", live: true },
      { label: "Up to 3 digital binders", live: true },
      { label: "Advanced card search", live: true },
      { label: "Wishlist", live: true },
      { label: "Public profile & shareable binders", live: true },
      { label: "Price tracking & history", live: true },
      { label: "Price change alerts", live: true },
      { label: "Shipping labels", live: true },
      { label: "Discord community access", live: true },
    ],
  },
  collector: {
    highlight: "More binders, more listings, lower fee.",
    cta: "Upgrade to Collector",
    popular: false,
    forSellers: false,
    color: "blue",
    features: [
      { label: "Everything in Free", live: true },
      { label: "Up to 10 digital binders", live: true },
      { label: "Up to 10 active listings", live: true },
      { label: "Up to 5 active trades", live: true },
      { label: "Saved searches & filters", live: true },
      { label: "Priority support (Discord role)", live: true },
    ],
  },
  trader: {
    highlight: "The most for serious collectors. Best non-seller fee.",
    cta: "Upgrade to Trader",
    popular: true,
    forSellers: false,
    color: "violet",
    features: [
      { label: "Everything in Collector", live: true },
      { label: "Up to 25 digital binders", live: true },
      { label: "Up to 25 active listings", live: true },
      { label: "Up to 10 active trades", live: true },
      { label: "Custom binder themes & covers", live: true },
      { label: "Priority betas & feedback sessions", live: true },
    ],
  },
  vendor: {
    highlight: "Built for sellers and shops. Lowest platform fee.",
    cta: "Start selling",
    popular: false,
    forSellers: true,
    color: "amber",
    features: [
      { label: "Everything in Trader", live: true },
      { label: "Unlimited digital binders", live: true },
      { label: "Unlimited active listings", live: true },
      { label: "Unlimited active trades", live: true },
      { label: "Seller profile & storefront", live: false },
      { label: "Order management & shipping labels", live: true },
      { label: "Inventory tools & bulk import", live: false },
      { label: "Seller analytics & insights", live: false },
      { label: "Priority support", live: true },
    ],
  },
};

const COMPARISON_ROWS = [
  { feature: "Marketplace fee",        free: "7%",  collector: "5%",  trader: "4%",  vendor: "2%" },
  { feature: "Active listings",        free: "5",   collector: "10",  trader: "25",  vendor: "Unlimited" },
  { feature: "Active trades",          free: "3",   collector: "5",   trader: "10",  vendor: "Unlimited" },
  { feature: "Digital binders",        free: "3",   collector: "10",  trader: "25",  vendor: "Unlimited" },
  { feature: "Collection tracking",    free: "✓",   collector: "✓",   trader: "✓",   vendor: "✓" },
  { feature: "Card search",            free: "✓",   collector: "✓",   trader: "✓",   vendor: "✓" },
  { feature: "Wishlist",               free: "✓",   collector: "✓",   trader: "✓",   vendor: "✓" },
  { feature: "Price tracking & alerts",free: "✓",   collector: "✓",   trader: "✓",   vendor: "✓" },
  { feature: "Price history",          free: "✓",   collector: "✓",   trader: "✓",   vendor: "✓" },
  { feature: "Shipping labels",        free: "✓",   collector: "✓",   trader: "✓",   vendor: "✓" },
  { feature: "Seller storefront",      free: "—",   collector: "—",   trader: "—",   vendor: "Soon" },
  { feature: "Priority support",       free: "—",   collector: "✓",   trader: "✓",   vendor: "✓" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPrice(pence) {
  return `£${(pence / 100).toFixed(2)}`;
}

function yearlyMonthly(yearPrice) {
  // yearPrice is in pence; show effective monthly rate
  return `£${(yearPrice / 100 / 12).toFixed(2)}`;
}

function yearlySavingPct(monthlyPence, yearlyPence) {
  const annualMonthly = monthlyPence * 12;
  return Math.round(((annualMonthly - yearlyPence) / annualMonthly) * 100);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ACCENT = {
  neutral: { ring: "border-light-border dark:border-dark-border", badge: "", dot: "bg-neutral-400" },
  blue:    { ring: "border-blue-500/40 dark:border-blue-500/40",   badge: "bg-blue-500/10 text-blue-400 border border-blue-500/20", dot: "bg-blue-400" },
  violet:  { ring: "border-violet-500/50 dark:border-violet-500/50", badge: "bg-violet-500/10 text-violet-400 border border-violet-500/20", dot: "bg-violet-400" },
  amber:   { ring: "border-amber-500/40 dark:border-amber-500/40", badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20", dot: "bg-amber-400" },
};

function FeeDot({ pct }) {
  const color =
    pct <= 2 ? "bg-emerald-500" :
    pct <= 3 ? "bg-green-500" :
    pct <= 5 ? "bg-yellow-500" : "bg-orange-500";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-black/20 dark:bg-white/[0.06] border border-white/10`}>
      <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
      {pct}% fee
    </span>
  );
}

function PlanCard({ plan, monthly, yearly, isCurrent, billing, onSelect, checkoutLoading }) {
  const key = plan.name.toLowerCase();
  const meta = PLAN_META[key] ?? { highlight: "", cta: "Get started", popular: false, forSellers: false, color: "neutral", features: [] };
  const accent = ACCENT[meta.color] ?? ACCENT.neutral;

  const activePlan = billing === "yearly" && yearly ? yearly : monthly;
  const isLoading = checkoutLoading === activePlan?.id;

  // Yearly savings
  const saving = monthly && yearly ? yearlySavingPct(monthly.rawPrice, yearly.rawPrice) : null;

  // Use featuresJson from DB if available, fall back to static PLAN_META
  const featuresJsonRaw = activePlan?.featuresJson ?? monthly?.featuresJson ?? yearly?.featuresJson;
  const dbFeatures = Array.isArray(featuresJsonRaw) && featuresJsonRaw.length > 0
    ? featuresJsonRaw.map((f) => ({ label: f, live: true }))
    : null;
  const features = dbFeatures ?? meta.features;

  const priceDisplay = () => {
    if (!activePlan || activePlan.rawPrice === 0) return <span className="text-4xl font-black">Free</span>;
    if (billing === "yearly" && yearly) {
      return (
        <span>
          <span className="text-4xl font-black">{yearlyMonthly(yearly.rawPrice)}</span>
          <span className="text-sm text-light-textMuted dark:text-dark-textMuted ml-1">/mo</span>
          <div className="text-xs text-light-textMuted dark:text-dark-textMuted mt-0.5">
            Billed {fmtPrice(yearly.rawPrice)}/yr
          </div>
        </span>
      );
    }
    return (
      <span>
        <span className="text-4xl font-black">{fmtPrice(activePlan.rawPrice)}</span>
        <span className="text-sm text-light-textMuted dark:text-dark-textMuted ml-1">/mo</span>
      </span>
    );
  };

  return (
    <div className={`relative flex flex-col rounded-2xl border-2 ${accent.ring} bg-light-surface dark:bg-dark-surface p-6 transition-all duration-200 ${meta.popular ? "shadow-xl" : "shadow-sm"}`}>

      {/* Badges */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="text-lg font-bold text-light-primary dark:text-dark-primary">{plan.name}</h3>
          {meta.popular && (
            <span className={`inline-block mt-1 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${accent.badge}`}>
              Most popular
            </span>
          )}
          {meta.forSellers && (
            <span className={`inline-block mt-1 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${accent.badge}`}>
              For sellers
            </span>
          )}
        </div>
        {isCurrent && (
          <span className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
            Your plan
          </span>
        )}
        {billing === "yearly" && saving && !isCurrent && (
          <span className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
            Save {saving}%
          </span>
        )}
      </div>

      {/* Price */}
      <div className="mb-1 text-light-primary dark:text-dark-primary">
        {priceDisplay()}
      </div>

      {/* Fee pill */}
      {plan.platformFeePercent != null && (
        <div className="mb-3">
          <FeeDot pct={plan.platformFeePercent} />
        </div>
      )}

      {/* Highlight */}
      <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary mb-4 leading-relaxed">
        {meta.highlight}
      </p>

      {/* Features */}
      <ul className="flex-1 space-y-2 mb-6">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            {f.live ? (
              <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-light-textMuted dark:text-dark-textMuted shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
              </svg>
            )}
            <span className={f.live ? "text-light-text dark:text-dark-text" : "text-light-textMuted dark:text-dark-textMuted"}>
              {f.label}
              {!f.live && <span className="ml-1 text-[11px] opacity-70">(soon)</span>}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isCurrent ? (
        <button disabled className="w-full py-2.5 rounded-xl text-sm font-semibold border border-light-border dark:border-dark-border text-light-textMuted dark:text-dark-textMuted bg-light-alt dark:bg-dark-alt cursor-default">
          Current plan
        </button>
      ) : key === "free" ? (
        <button disabled className="w-full py-2.5 rounded-xl text-sm font-semibold border border-light-border dark:border-dark-border text-light-textMuted dark:text-dark-textMuted bg-light-alt dark:bg-dark-alt cursor-default">
          Free forever
        </button>
      ) : (
        <button
          onClick={() => onSelect?.(activePlan.id)}
          disabled={!!checkoutLoading}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60 disabled:cursor-wait
            ${meta.popular
              ? "bg-violet-600 hover:bg-violet-500"
              : meta.forSellers
              ? "bg-amber-600 hover:bg-amber-500"
              : "bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight"
            }`}
        >
          {isLoading ? "Redirecting…" : meta.cta}
        </button>
      )}
    </div>
  );
}

function CurrentPlanBanner({ subscription, onManage }) {
  if (!subscription) return null;
  const name = subscription.plan?.name ?? "Free";
  const status = subscription.status;
  const renews = subscription.renewsAt ? new Date(subscription.renewsAt).toLocaleDateString("en-GB") : null;
  const cancelling = status === "canceled";

  return (
    <div className={`max-w-2xl mx-auto mb-10 rounded-2xl border px-5 py-4 flex items-center justify-between gap-4 text-sm
      ${cancelling
        ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-300"
        : "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300"}`}
    >
      <div className="flex items-center gap-2.5">
        {cancelling ? (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
        <span>
          {cancelling
            ? <>Your <strong>{name}</strong> plan cancels {renews ? `on ${renews}` : "at period end"}</>
            : <>You're on the <strong>{name}</strong> plan{renews ? ` · renews ${renews}` : ""}</>}
        </span>
      </div>
      {subscription.plan?.name && subscription.plan.name !== "Free" && (
        <button
          onClick={onManage}
          className="shrink-0 text-xs font-semibold underline underline-offset-2 opacity-80 hover:opacity-100 transition"
        >
          Manage
        </button>
      )}
    </div>
  );
}

function ComparisonTable({ plans }) {
  const tiers = ["free", "collector", "trader", "vendor"];
  const cols = tiers.map((t) => plans.find((p) => p.name.toLowerCase() === t)).filter(Boolean);

  const colLabel = (name) => name;

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <h2 className="text-center text-2xl md:text-3xl font-bold mb-8 text-light-primary dark:text-dark-primary">
        Compare plans
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shadow-lg">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-light-alt dark:bg-dark-alt border-b border-light-border dark:border-dark-border">
              <th className="text-left px-5 py-3.5 font-semibold text-light-text dark:text-dark-text w-1/3">Feature</th>
              {cols.map((p) => (
                <th key={p.name} className="px-4 py-3.5 font-semibold text-center text-light-text dark:text-dark-text">
                  {colLabel(p.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-light-border dark:divide-dark-border">
            {COMPARISON_ROWS.map((row, i) => (
              <tr key={i} className="hover:bg-light-alt/50 dark:hover:bg-dark-alt/30 transition-colors">
                <td className="px-5 py-3 font-medium text-light-text dark:text-dark-text">{row.feature}</td>
                {cols.map((p) => {
                  const k = p.name.toLowerCase();
                  const val = row[k];
                  const isTick = val === "✓";
                  const isDash = val === "—";
                  return (
                    <td key={p.name} className="px-4 py-3 text-center text-light-textSecondary dark:text-dark-textSecondary">
                      {isTick ? (
                        <span className="text-emerald-500 font-bold">✓</span>
                      ) : isDash ? (
                        <span className="text-light-textMuted dark:text-dark-textMuted">—</span>
                      ) : (
                        val
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState(null);
  const [apiPlans, setApiPlans] = useState([]);
  const [billing, setBilling] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [error, setError] = useState(null);
  const [successBanner, setSuccessBanner] = useState(false);
  const [cancelledBanner, setCancelledBanner] = useState(false);

  useEffect(() => {
    if (router.query.success === "true") setSuccessBanner(true);
    if (router.query.cancelled === "true") setCancelledBanner(true);
  }, [router.query]);

  useEffect(() => {
    Promise.all([fetchUserSubscription(), fetchSubscriptionPlans()])
      .then(([sub, plans]) => {
        setSubscription(sub);
        setApiPlans(plans || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = useCallback(async (planId) => {
    setError(null);
    setCheckoutLoading(planId);
    try {
      const url = await startSubscriptionCheckout(planId);
      window.location.href = url;
    } catch (e) {
      setError(e.message || "Could not start checkout. Please try again.");
    } finally {
      setCheckoutLoading(null);
    }
  }, []);

  const handleManage = useCallback(async () => {
    try { await openBillingPortal(); }
    catch (e) { setError(e.message || "Billing portal unavailable."); }
  }, []);

  // Group plans by tier name: { "Free": { monthly: plan, yearly: plan }, ... }
  const plansByTier = apiPlans.reduce((acc, plan) => {
    const k = plan.name;
    if (!acc[k]) acc[k] = { name: k };
    if (plan.interval === "month") acc[k].monthly = { ...plan, rawPrice: Math.round(Number(plan.price) * 100), hasStripe: Boolean(plan.stripePriceIdMonthly) };
    if (plan.interval === "year")  acc[k].yearly  = { ...plan, rawPrice: Math.round(Number(plan.price) * 100), hasStripe: Boolean(plan.stripePriceIdYearly) };
    return acc;
  }, {});

  // Deduplicated tier list ordered by sortOrder
  const tiers = Object.values(plansByTier).sort((a, b) => {
    const ao = (a.monthly ?? a.yearly)?.sortOrder ?? 0;
    const bo = (b.monthly ?? b.yearly)?.sortOrder ?? 0;
    return ao - bo;
  });

  // Active plan id for current subscription check
  const currentPlanId = subscription?.plan?.id;

  // For comparison table — one plan object per tier (monthly preferred)
  const flatPlansForTable = tiers.map((t) => ({
    ...(t.monthly ?? t.yearly ?? {}),
    name: t.name,
    platformFeePercent: (t.monthly ?? t.yearly)?.platformFeePercent,
  }));

  // Yearly saving badge — use Collector as reference
  const collectorTier = plansByTier["Collector"];
  const yearlySaving = collectorTier?.monthly && collectorTier?.yearly
    ? yearlySavingPct(collectorTier.monthly.rawPrice, collectorTier.yearly.rawPrice)
    : null;

  return (
    <>
      <Head>
        <title>Pricing — SixByFive TCG</title>
        <meta name="description" content="Simple, transparent pricing. Free to start. Collector, Elite Collector and Vendor plans with lower marketplace fees and more." />
      </Head>
      <Layout noTopPadding>
        <div className="pt-20 pb-24">

          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <section className="text-center px-4 pt-12 pb-10">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-light-primary dark:text-dark-primary mb-4">
              Simple, transparent pricing
            </h1>
            <p className="max-w-xl mx-auto text-lg text-light-textSecondary dark:text-dark-textSecondary mb-8">
              Start free. Upgrade for lower marketplace fees, more listings, and power tools.
            </p>

            {/* Billing toggle */}
            <div className="inline-flex items-center rounded-xl border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt p-1 gap-1">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
                  billing === "monthly"
                    ? "bg-light-surface dark:bg-dark-surface text-light-primary dark:text-dark-primary shadow-sm"
                    : "text-light-textMuted dark:text-dark-textMuted hover:text-light-text dark:hover:text-dark-text"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                  billing === "yearly"
                    ? "bg-light-surface dark:bg-dark-surface text-light-primary dark:text-dark-primary shadow-sm"
                    : "text-light-textMuted dark:text-dark-textMuted hover:text-light-text dark:hover:text-dark-text"
                }`}
              >
                Yearly
                {yearlySaving && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
                    -{yearlySaving}%
                  </span>
                )}
              </button>
            </div>
          </section>

          {/* ── Banners ───────────────────────────────────────────────────── */}
          <div className="max-w-5xl mx-auto px-4 space-y-3 mb-4">
            {successBanner && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 text-emerald-400 text-sm font-semibold">
                🎉 Subscription activated — welcome to your new plan!
              </div>
            )}
            {cancelledBanner && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-amber-400 text-sm">
                Checkout cancelled — no charge was made.
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-5 py-3 text-rose-400 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* ── Current plan banner ───────────────────────────────────────── */}
          {subscription && (
            <div className="max-w-5xl mx-auto px-4">
              <CurrentPlanBanner subscription={subscription} onManage={handleManage} />
            </div>
          )}

          {/* ── Plan cards ───────────────────────────────────────────────── */}
          <section className="max-w-7xl mx-auto px-4">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-6 h-96 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
                {tiers.map((tier) => {
                  const ref = tier.monthly ?? tier.yearly;
                  const isCurrent =
                    (tier.monthly && tier.monthly.id === currentPlanId) ||
                    (tier.yearly  && tier.yearly.id  === currentPlanId);
                  return (
                    <PlanCard
                      key={tier.name}
                      plan={{ name: tier.name, platformFeePercent: Number(ref?.platformFeePercent) }}
                      monthly={tier.monthly}
                      yearly={tier.yearly}
                      isCurrent={isCurrent}
                      billing={billing}
                      onSelect={handleSelect}
                      checkoutLoading={checkoutLoading}
                    />
                  );
                })}
              </div>
            )}
            <p className="text-center text-xs text-light-textMuted dark:text-dark-textMuted mt-5">
              All prices in GBP. Marketplace fees apply to each completed sale.
            </p>
          </section>

          {/* ── Comparison table ─────────────────────────────────────────── */}
          {!loading && flatPlansForTable.length > 0 && (
            <ComparisonTable plans={flatPlansForTable} />
          )}

          {/* ── FAQ ──────────────────────────────────────────────────────── */}
          <SubscriptionFAQ />

          {/* ── Discord ──────────────────────────────────────────────────── */}
          <SubscriptionDiscord />
        </div>
      </Layout>
    </>
  );
}

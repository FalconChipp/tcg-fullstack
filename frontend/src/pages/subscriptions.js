"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout/Layout";
import {
  fetchUserSubscription,
  fetchSubscriptionPlans,
  startSubscriptionCheckout,
  openBillingPortal,
} from "@/utils/subscriptionsApi";
import SubscriptionStatus from "@/components/Subscriptions/subscriptionStatus";
import SubscriptionPlans from "@/components/Subscriptions/subscriptionPlans";
import SubscriptionFAQ from "@/components/Subscriptions/subscriptionFaq";
import SubscriptionDiscord from "@/components/Subscriptions/subscriptionDiscord";
import SubscriptionComparisonTable from "@/components/Subscriptions/subscriptionTable";

// ─── Local feature content ────────────────────────────────────────────────────
// Plans are fetched dynamically from the API (name, price, interval).
// Features, CTAs, and highlights live here — they're marketing copy, not DB data.
// Keyed by lowercase plan name to match what the API returns.

const PLAN_CONTENT = {
  free: {
    badge: "Beta",
    highlight: "Start collecting — core features, no payment required.",
    cta: "Start free",
    features: [
      { label: "Collection tracking (unlimited cards)", state: "live" },
      { label: "Digital binders (up to 3)", state: "live" },
      { label: "Advanced card search", state: "live" },
      { label: "Wishlist", state: "live" },
      { label: "Public profile & shareable binders", state: "live" },
      { label: "Price tracking (regular refresh)", state: "live" },
      { label: "Discord community access", state: "live" },
      { label: "CSV import (basic)", state: "soon" },
      { label: "Trading & Marketplace access", state: "soon" },
    ],
  },
  collector: {
    badge: null,
    highlight: "Unlimited binders + power features for everyday collectors.",
    cta: "Upgrade to Collector",
    features: [
      { label: "Everything in Free", state: "live" },
      { label: "Digital binders (unlimited)", state: "live" },
      { label: "Saved searches & filters", state: "live" },
      { label: "CSV import (enhanced) & CSV export", state: "soon" },
      { label: "Price change alerts (daily)", state: "soon" },
      { label: "Early access to new features", state: "live" },
      { label: "Trading access priority", state: "soon" },
      { label: "Marketplace fee reduction (–1%)", state: "soon" },
      { label: "Priority support (Discord role)", state: "live" },
    ],
  },
  "elite collector": {
    badge: null,
    highlight: "Advanced insights for serious collectors.",
    cta: "Go Elite",
    features: [
      { label: "Everything in Collector", state: "live" },
      { label: "Historical value charts & stats", state: "soon" },
      { label: "Price change alerts (hourly)", state: "soon" },
      { label: "Custom binder themes & covers (advanced)", state: "live" },
      { label: "Marketplace fee reduction (–2%)", state: "soon" },
      { label: "Priority betas & feedback sessions", state: "live" },
    ],
  },
  vendor: {
    badge: null,
    highlight: "Tools for sellers and shops when marketplace launches.",
    cta: "Apply for Vendor",
    features: [
      { label: "Seller profile & storefront", state: "soon" },
      { label: "Inventory tools & bulk import", state: "soon" },
      { label: "List-from-collection (1-click)", state: "soon" },
      { label: "Order management & shipping labels", state: "soon" },
      { label: "Seller analytics & insights", state: "soon" },
      { label: "Marketplace fee reduction (–3%)", state: "soon" },
      { label: "Priority support", state: "live" },
    ],
  },
};

const COMPARISON_ROWS = [
  { feature: "Price", free: "£0", plus: "£4.99/mo", pro: "£9.99/mo" },
  { feature: "Collection tracking", free: "Unlimited", plus: "Unlimited", pro: "Unlimited" },
  { feature: "Digital binders", free: "Up to 3", plus: "Unlimited", pro: "Unlimited" },
  { feature: "Advanced card search", free: "✓", plus: "✓", pro: "✓" },
  { feature: "Saved searches & filters", free: "—", plus: "✓", pro: "✓" },
  { feature: "Wishlist", free: "✓", plus: "✓", pro: "✓" },
  { feature: "Public profile & share links", free: "✓", plus: "✓", pro: "✓" },
  { feature: "Price tracking", free: "Regular refresh", plus: "Regular + alerts (daily, soon)", pro: "Regular + alerts (hourly, soon)" },
  { feature: "CSV import/export", free: "Import (basic)", plus: "Import (enhanced) + export", pro: "Import/export + charts (soon)" },
  { feature: "Early access features", free: "—", plus: "✓", pro: "✓ (priority)" },
  { feature: "Trading access", free: "When live", plus: "Priority (soon)", pro: "Priority (soon)" },
  { feature: "Marketplace fee reduction", free: "—", plus: "–1% (soon)", pro: "–2% (soon)" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(plan) {
  if (!plan.price || Number(plan.price) === 0) return "£0";
  return `£${Number(plan.price).toFixed(2)}/${plan.interval === "year" ? "yr" : "mo"}`;
}

/** Merge API plan data with local feature/marketing content. */
function buildDisplayPlans(apiPlans) {
  return apiPlans
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((plan) => {
      const key = plan.name.toLowerCase();
      const content = PLAN_CONTENT[key] ?? {};
      return {
        id: plan.id,
        name: plan.name,
        priceText: formatPrice(plan),
        badge: content.badge ?? null,
        highlight: content.highlight ?? plan.description ?? "",
        cta: content.cta ?? "Get started",
        features: content.features ?? [],
        hasStripe: Boolean(plan.stripePriceId),
      };
    });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState(null);
  const [apiPlans, setApiPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null); // planId being processed
  const [successBanner, setSuccessBanner] = useState(false);
  const [cancelledBanner, setCancelledBanner] = useState(false);
  const [error, setError] = useState(null);

  // Show success/cancelled banners on return from Stripe Checkout
  useEffect(() => {
    if (router.query.success === "true") setSuccessBanner(true);
    if (router.query.cancelled === "true") setCancelledBanner(true);
  }, [router.query]);

  useEffect(() => {
    Promise.all([fetchUserSubscription(), fetchSubscriptionPlans()])
      .then(([sub, plans]) => {
        setSubscription(sub);
        setApiPlans(plans);
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
    setError(null);
    try {
      await openBillingPortal();
    } catch (e) {
      setError(e.message || "Billing portal unavailable. Please try again.");
    }
  }, []);

  const displayPlans = buildDisplayPlans(apiPlans);
  const currentPlanId = subscription?.plan?.id;

  const seo = {
    title: "Subscriptions — SixByFive TCG",
    description:
      "Free to start. Collector (£4.99/mo) unlocks unlimited binders and power tools. Elite Collector adds advanced insights. Vendor is for shops and sellers.",
    canonical: "/subscriptions",
  };

  return (
    <Layout noTopPadding seo={seo}>
      <div className="pt-20">
        {/* HERO */}
        <section className="w-full px-4 pt-4 pb-10 bg-gradient-to-br from-light-alt via-light-background to-[#e5f1ff] dark:from-[#191923] dark:via-dark-surface dark:to-dark-background border-b border-light-border dark:border-dark-border relative overflow-hidden">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-light-primary dark:text-dark-primary mb-4 tracking-tight">
              Subscriptions
            </h1>
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-light-textSecondary dark:text-dark-textSecondary mb-6">
              Start free today. Collector and Elite memberships unlock more binders, alerts, and lower fees.
              Vendor is for shops and sellers.
            </p>
          </div>
        </section>

        {/* SUCCESS / CANCELLED BANNERS */}
        {successBanner && (
          <div className="max-w-3xl mx-auto mt-6 px-4">
            <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-5 py-4 text-green-400 text-sm font-semibold">
              🎉 Subscription activated — welcome to your new plan!
            </div>
          </div>
        )}
        {cancelledBanner && (
          <div className="max-w-3xl mx-auto mt-6 px-4">
            <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-5 py-4 text-yellow-400 text-sm">
              Checkout cancelled — no charge was made.
            </div>
          </div>
        )}
        {error && (
          <div className="max-w-3xl mx-auto mt-6 px-4">
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-400 text-sm">
              {error}
            </div>
          </div>
        )}

        {/* MAIN CARD */}
        <section className="max-w-7xl mx-auto py-12 px-4">
          <div className="bg-dark-alt dark:bg-[#202032] rounded-xl shadow-lg border border-light-border dark:border-dark-border px-7 py-9 md:py-12 md:px-12">
            <h2 className="text-2xl font-bold mb-2 text-light-accent dark:text-dark-accent text-center">
              Your Subscription
            </h2>
            <p className="text-base md:text-lg text-light-textSecondary dark:text-dark-textSecondary text-center mb-8">
              {subscription
                ? "Manage your current plan or explore upgrades."
                : "Choose the plan that fits your collecting style."}
            </p>

            {loading ? (
              <div className="mb-8">
                <div className="h-14 w-1/2 bg-light-alt dark:bg-dark-alt mx-auto mb-6 rounded-lg animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="bg-dark-alt dark:bg-[#181822] border border-light-border dark:border-dark-border rounded-xl shadow p-7 h-[330px] flex flex-col animate-pulse"
                    >
                      <div className="w-2/3 h-7 bg-light-alt dark:bg-dark-alt rounded mb-4" />
                      <div className="w-full h-4 bg-light-alt dark:bg-dark-alt rounded mb-2" />
                      <div className="w-1/2 h-4 bg-light-alt dark:bg-dark-alt rounded mb-4" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <SubscriptionStatus
                  subscription={subscription}
                  onManage={handleManage}
                />
                {displayPlans.length > 0 && (
                  <div className="mt-10">
                    <SubscriptionPlans
                      currentPlanId={currentPlanId}
                      plansData={displayPlans}
                      checkoutLoading={checkoutLoading}
                      onSelect={handleSelect}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* COMPARISON TABLE */}
        {displayPlans.length > 0 && (
          <SubscriptionComparisonTable
            plansData={displayPlans.filter((p) =>
              ["free", "collector", "elite collector"].includes(p.name.toLowerCase())
            )}
            rows={COMPARISON_ROWS}
          />
        )}

        <SubscriptionFAQ />
        <SubscriptionDiscord />
      </div>
    </Layout>
  );
}

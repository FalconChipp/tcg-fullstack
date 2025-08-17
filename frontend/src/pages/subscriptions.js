"use client";
import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout/Layout";
import { fetchUserSubscription } from "@/utils/subscriptionsApi";
import SubscriptionStatus from "@/components/Subscriptions/subscriptionStatus";
import SubscriptionPlans from "@/components/Subscriptions/subscriptionPlans";
import SubscriptionFAQ from "@/components/Subscriptions/subscriptionFaq";
import SubscriptionDiscord from "@/components/Subscriptions/subscriptionDiscord";
import SubscriptionComparisonTable from "@/components/Subscriptions/subscriptionTable";

// Replace with your real auth token logic if you have global context/provider
function useAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

/* ---------------------------------------------
   SINGLE SOURCE OF TRUTH FOR PLAN CONTENT
   Accurate to your Stripe products/prices.
   - Free (live)
   - Collector (£4.99/mo or £49.99/yr)        -> coming soon
   - Elite Collector (£9.99/mo or £99.99/yr)  -> coming soon
   - Vendor (£14.99/mo or £149.99/yr)         -> coming soon
----------------------------------------------*/
const PLANS = [
  {
    id: "free",
    name: "Free",
    // CHANGED: show price text directly for consistency with paid tiers
    priceText: "£0",
    badge: "Beta",
    comingSoon: false, // CHANGED: live now
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
      { label: "Trading & Marketplace access", state: "soon" }, // CHANGED: honest status
    ],
  },
  {
    id: "collector",
    name: "Collector",
    // NEW: exact prices from Stripe
    priceText: "£4.99/mo or £49.99/yr",
    badge: "Coming Soon", // NEW: visible badge
    comingSoon: true, // NEW: disables CTA
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
  {
    id: "elite",
    name: "Elite Collector",
    // NEW: exact prices from Stripe
    priceText: "£9.99/mo or £99.99/yr",
    badge: "Coming Soon", // NEW
    comingSoon: true, // NEW
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
  {
    id: "vendor",
    name: "Vendor",
    // NEW: exact prices from Stripe
    priceText: "£14.99/mo or £149.99/yr",
    badge: "Coming Soon", // NEW
    comingSoon: true, // NEW
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
];

/* ---------------------------------------------
   COMPARISON TABLE ROWS
----------------------------------------------*/
const COMPARISON_ROWS = [
  { feature: "Price", free: "£0", plus: "£4.99/mo or £49.99/yr", pro: "£9.99/mo or £99.99/yr" }, // CHANGED labels to match our ids mapping below
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

/* NOTE:
   The comparison table shows Free / Collector / Elite Collector (not the Vendor plan).
   Vendor is specialised and will be marketed separately on launch.
*/

export default function SubscriptionsPage() {
  const token = useAuthToken();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return setLoading(false);
    fetchUserSubscription(token).then(setSubscription).finally(() => setLoading(false));
  }, [token]);

  // NEW: Centralised SEO via Layout
  const seo = {
    title: "Subscriptions — SixByFive TCG",
    description:
      "Free to start. Collector (£4.99/mo or £49.99/yr) unlocks unlimited binders and power tools. Elite Collector adds advanced insights. Vendor is for shops and sellers — coming soon.",
    canonical: "/subscriptions",
    extraJsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "SixByFive TCG Subscriptions",
        itemListElement: PLANS.map((p, i) => ({
          "@type": "Service",
          position: i + 1,
          name: p.name,
          description: p.highlight,
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://tcg.sixbyfive.com/" },
          { "@type": "ListItem", position: 2, name: "Subscriptions", item: "https://tcg.sixbyfive.com/subscriptions" },
        ],
      },
    ],
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
              Start free today. Collector and Elite Collector memberships are planned and will roll out during beta.
              Vendor is for shops and sellers when the marketplace launches.
            </p>
          </div>
        </section>

        {/* MAIN SUBSCRIPTIONS CARD */}
        <section className="max-w-7xl mx-auto py-12 px-4">
          <div className="bg-dark-alt dark:bg-[#202032] rounded-xl shadow-lg border border-light-border dark:border-dark-border px-7 py-9 md:py-12 md:px-12">
            <h2 className="text-2xl font-bold mb-2 text-light-accent dark:text-dark-accent text-center">
              Your Subscription
            </h2>
            <p className="text-base md:text-lg text-light-textSecondary dark:text-dark-textSecondary text-center mb-8">
              Check your current plan and preview what’s coming next.
            </p>

            {loading ? (
              // Skeleton
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
                      <div className="flex-1" />
                      <div className="w-1/2 h-8 bg-light-alt dark:bg-dark-alt rounded mb-2" />
                      <div className="w-full h-12 bg-light-accent/20 dark:bg-dark-accent/20 rounded-xl" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <SubscriptionStatus subscription={subscription} />
                <div className="mt-10">
                  {/* NEW: Pass all plans (incl. Vendor) */}
                  <SubscriptionPlans
                    currentPlanId={subscription?.plan?.id}
                    token={token}
                    plansData={PLANS}
                  />
                </div>
              </>
            )}
          </div>
        </section>

        {/* COMPARISON TABLE (Free / Collector / Elite Collector) */}
        <SubscriptionComparisonTable
          // CHANGED: pass only the three consumer plans to the table
          plansData={PLANS.filter((p) => ["free", "collector", "elite"].includes(p.id))}
          rows={COMPARISON_ROWS}
        />

        {/* FAQ + Discord */}
        <SubscriptionFAQ />
        <SubscriptionDiscord />
      </div>
    </Layout>
  );
}

"use client";
import React, { useEffect, useState } from "react";
import Head from "next/head";
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

export default function SubscriptionsPage() {
  const token = useAuthToken();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return setLoading(false);
    fetchUserSubscription(token)
      .then(setSubscription)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <>
      <Head>
        <title>Subscriptions – SixByFive TCG</title>
        <meta
          name="description"
          content="Unlock advanced features and support SixByFive TCG with a paid subscription. Enjoy unlimited binders, lower fees, and more."
        />
        <link rel="canonical" href="https://tcg.sixbyfive.com/subscriptions" />
        <meta property="og:title" content="Subscriptions – SixByFive TCG" />
        <meta
          property="og:description"
          content="Unlock advanced features and support SixByFive TCG with a paid subscription. Enjoy unlimited binders, lower fees, and more."
        />
        <meta property="og:url" content="https://tcg.sixbyfive.com/subscriptions" />
        <meta property="og:image" content="https://tcg.sixbyfive.com/og-image.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Subscriptions – SixByFive TCG" />
        <meta
          name="twitter:description"
          content="Unlock advanced features and support SixByFive TCG with a paid subscription. Enjoy unlimited binders, lower fees, and more."
        />
        <meta name="twitter:image" content="https://tcg.sixbyfive.com/og-image.png" />
      </Head>
      <Layout noTopPadding>
        <div className="pt-20">

          {/* HERO SECTION - styled like homepage hero, adapted for subscriptions */}
          <section className="w-full px-4 pt-4 pb-10 bg-gradient-to-br from-light-alt via-light-background to-[#e5f1ff] dark:from-[#191923] dark:via-dark-surface dark:to-dark-background border-b border-light-border dark:border-dark-border relative overflow-hidden">
            <div className="max-w-2xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-light-primary dark:text-dark-primary mb-4 tracking-tight">
                Subscriptions
              </h1>
              <p className="max-w-2xl mx-auto text-lg md:text-xl text-light-textSecondary dark:text-dark-textSecondary mb-6">
                Get more out of SixByFive TCG. Upgrade for unlimited binders, lower marketplace fees, early features, and to support development.<br />
                Start free, upgrade any time—no lock-in.
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
                Check your current plan and see what’s available.
              </p>
              {loading ? (
                // Loading skeleton, styled like the homepage cards
                <div className="mb-8">
                  <div className="h-14 w-1/2 bg-light-alt dark:bg-dark-alt mx-auto mb-6 rounded-lg animate-pulse" />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, idx) => (
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
                    <SubscriptionPlans currentPlanId={subscription?.plan?.id} token={token} />
                  </div>
                </>
              )}
            </div>
          </section>

          <SubscriptionFAQ />
          <SubscriptionComparisonTable />
          <SubscriptionDiscord />
        </div>
      </Layout>
    </>
  );
}

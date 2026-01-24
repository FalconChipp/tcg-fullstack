// pages/index.js
// NOTE: "use client" is App Router only. Not harmful here, but unnecessary in /pages.
// "use client";

import React, { useState } from "react";
import Layout from "@/components/Layout/Layout";
import HeroSection from "@/components/Layout/Hero";
import CardSearch from "@/components/Collection/CardSearch";
import KeyFeatures from "@/components/Layout/KeyFeatures";
import FAQ /* , { FAQ_ITEMS } */ from "@/components/Layout/FAQ";
import DiscordJoinBar from "@/components/Layout/DiscordBar";
import AuthModal from "@/components/Auth/AuthModal";

// Homepage modules
import IntroFeatureCards from "@/components/Home/IntroFeatureCards";
import OnboardingQuickStart from "@/components/Home/OnboardingQuickStart";
import MobileAppPromo from "@/components/Home/AppBanner";
import LiveStats from "@/components/Home/LiveStats"; // ✅ NEW: real/fake stats section
import EvolvedProtectionSpotlight from "@/components/Partners/EvolvedSpotlight";

// ❌ REMOVED UNUSED IMPORTS:
// import ProofStrip from "@/components/Home/ProofStrip";
// import SearchIntro from "@/components/Home/SearchIntro";
import Landing from "@/components/Layout/Landing";
// import EvolvedProtectionSpotlight from "@/components/Partners/EvolvedSpotlight";

export default function Home() {
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <>
      <Layout
        noTopPadding
        seo={{
          // ✅ Tweaked to match the newer positioning we discussed
          title: "SixByFive TCG — Track, value, and own your Pokémon collection",
          description:
            "All your Pokémon cards in one place — organised, valued, and ready to grow. Track your collection, build shareable binders, and see real pricing insights. Free to start — built for UK collectors.",
          canonical: "/", // resolved to full URL by SEO component
          // faqItems: FAQ_ITEMS, // OPTIONAL: enable FAQ rich results if you export FAQ_ITEMS
          // ogImage: "https://tcg.sixbyfive.com/og-image.png", // OPTIONAL override
        }}
      >
        <div className="pt-20 bg-transparent">
          <HeroSection onOpenAuthModal={() => setAuthModalOpen(true)} />

          <MobileAppPromo />

          <section
            id="card-search"
            className="scroll-mt-28 border-b border-light-border/40 dark:border-dark-border/40 bg-light-surfaceAlt dark:bg-dark-surfaceAlt"
          >
            <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12 lg:py-14">
              <CardSearch />
            </div>
          </section>

          <IntroFeatureCards />


          <OnboardingQuickStart />

          <KeyFeatures />
          <DiscordJoinBar />
          <FAQ />

        </div>

        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={() => setAuthModalOpen(false)}
        />
      </Layout>

      {/* Maintenance landing page (for special cases) */}
      {/* <Landing /> */}
    </>
  );
}
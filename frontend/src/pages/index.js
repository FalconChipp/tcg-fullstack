"use client";
import React, { useState } from "react";
// import Head from "next/head"; // REMOVED: SEO now handled via Layout <SEO />
import Layout from "@/components/Layout/Layout";
import HeroSection from "@/components/Layout/Hero";
import CardSearch from "@/components/Collection/CardSearch";
import KeyFeatures from "@/components/Layout/KeyFeatures";
import FAQ /* , { FAQ_ITEMS } */ from "@/components/Layout/FAQ"; 
import DiscordJoinBar from "@/components/Layout/DiscordBar";
import AuthModal from "@/components/Auth/AuthModal";
// import Landing from "@/components/Layout/Landing"; 

// Modular homepage sections for acquisition focus
import ProofStrip from "@/components/Home/ProofStrip";
import IntroFeatureCards from "@/components/Home/IntroFeatureCards";
import SearchIntro from "@/components/Home/SearchIntro";
import OnboardingQuickStart from "@/components/Home/OnboardingQuickStart";
import Landing from "@/components/Layout/Landing";
import EvolvedProtectionSpotlight from "@/components/Partners/EvolvedSpotlight";
import MobileAppPromo from "@/components/Home/AppBanner";

export default function Home() {
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <Layout
      noTopPadding
      seo={{
        title: "SixByFive TCG — Track, value, and show off your Pokémon collection",
        description:
          "Add cards in seconds. Build shareable binders. Stay on top of prices. Free to start — built for UK collectors.",
        canonical: "/", // resolved to full URL by SEO component
        // faqItems: FAQ_ITEMS, // OPTIONAL: enable FAQ rich results if you export FAQ_ITEMS
        // ogImage: "https://tcg.sixbyfive.com/og-image.png", // OPTIONAL override
      }}
    >
      <div className="pt-20">
        <HeroSection onOpenAuthModal={() => setAuthModalOpen(true)} />

        <MobileAppPromo />

        {/* id + scroll-mt so links (e.g., from nav or hero) can jump here cleanly */}
        <section id="card-search" className="scroll-mt-28">
          <CardSearch />
        </section>

        {/* <EvolvedProtectionSpotlight /> */}
        <IntroFeatureCards />

        {/* 3-step “quick start” onboarding to drive first-session success */}
        <OnboardingQuickStart />

        {/* Deeper features/FAQ */}
        <KeyFeatures />
        <DiscordJoinBar />
        {/* <EvolvedProtectionSpotlight mode="banner"/> */}
        <FAQ />
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={() => setAuthModalOpen(false)}
      />
    </Layout>
    // <Landing />
  );
}

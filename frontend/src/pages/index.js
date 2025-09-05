"use client";
import React, { useState } from "react";
// import Head from "next/head"; // REMOVED: SEO now handled via Layout <SEO />
import Layout from "@/components/Layout/Layout";
import HeroSection from "@/components/Layout/Hero";
import CardSearch from "@/components/Collection/CardSearch";
import KeyFeatures from "@/components/Layout/KeyFeatures";
import FAQ /* , { FAQ_ITEMS } */ from "@/components/Layout/FAQ"; // If you exported FAQ_ITEMS, uncomment it
import DiscordJoinBar from "@/components/Layout/DiscordBar";
import AuthModal from "@/components/Auth/AuthModal";
// import Landing from "@/components/Layout/Landing"; // REMOVED (unused)

// Modular homepage sections for acquisition focus
import ProofStrip from "@/components/Home/ProofStrip";
import IntroFeatureCards from "@/components/Home/IntroFeatureCards";
import SearchIntro from "@/components/Home/SearchIntro";
import OnboardingQuickStart from "@/components/Home/OnboardingQuickStart";
import Landing from "@/components/Layout/Landing";

export default function Home() {
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <Layout
      noTopPadding
      /* NEW: Centralised SEO via Layout */
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
        {/* HERO SECTION — copy-only recommendations (no structural changes)
           Headline: "Track, value, and show off your Pokémon collection."
           Subhead:  "Add cards in seconds. Build shareable binders. Stay on top of prices. Free to start."
           Primary CTA: "Start free" → onOpenAuthModal()
           Secondary CTA (quiet): "Browse public collections" → your public route
        */}
        <HeroSection onOpenAuthModal={() => setAuthModalOpen(true)} />

        {/* Proof / trust cues directly under the hero */}
        <ProofStrip />

        {/* ===== SEARCH MOVED UP ===== */}
        {/* id + scroll-mt so links (e.g., from nav or hero) can jump here cleanly */}
        <section id="card-search" className="my-8 scroll-mt-28">
          <SearchIntro />
          <CardSearch />
        </section>
        {/* ===== /SEARCH ===== */}

        {/* Intro features remain for scrollers */}
        <IntroFeatureCards />

        {/* 3-step “quick start” onboarding to drive first-session success */}
        <OnboardingQuickStart />

        {/* Deeper features/FAQ */}
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
    // <Landing />
  );
}

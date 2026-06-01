// pages/index.js

import React from "react";
import Layout from "@/components/Layout/Layout";
import HeroSection from "@/components/Layout/Hero";
import CardSearch from "@/components/Collection/CardSearch";
import FAQ from "@/components/Layout/FAQ";
import DiscordJoinBar from "@/components/Layout/DiscordBar";

import MobileAppPromo from "@/components/Home/AppBanner";
import ProductPillars from "@/components/Home/ProductPillars";
import BinderShowcaseSection from "@/components/Home/BinderShowcaseSection";
import MarketplaceTeaser from "@/components/Home/MarketplaceTeaser";

export default function Home() {
  return (
    <Layout
      noTopPadding
      seo={{
        title: "SixByFive TCG — Track, value, and own your Pokémon collection",
        description:
          "All your Pokémon cards in one place — organised, valued, and ready to grow. Track your collection, build shareable binders, and see real pricing insights. Free to start — built for UK collectors.",
        canonical: "/",
      }}
    >
      <div className="pt-20 bg-dark-background">
        <HeroSection />

        <section id="card-search" className="scroll-mt-28 bg-dark-background">
          <CardSearch variant="home" />
        </section>

        <ProductPillars />

        <BinderShowcaseSection />

        <MarketplaceTeaser />

        <MobileAppPromo />

        <DiscordJoinBar />

        <FAQ />
      </div>
    </Layout>
  );
}
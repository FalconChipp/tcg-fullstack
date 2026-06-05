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
import EvolvedProtectionSpotlight from "@/components/Partners/EvolvedSpotlight";

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

        <section className="px-4 py-8 max-w-7xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-light-textMuted dark:text-dark-textMuted mb-4">
            Our Partners
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EvolvedProtectionSpotlight
              partnerName="Evolved Protection"
              tagline="Evolve the way you protect your cards"
              blurb="Trusted sleeves, toploaders & shields for serious collectors."
              bullets={[
                "Sleeves that actually fit",
                "Toploaders you can trust",
              ]}
              ctaLabel="Shop Evolved"
              ctaHref="https://evolvedcardprotection.co.uk?sca_ref=9820478.MfkcaLj4ToIM"
              heroSrc="/assets/partners/evolved.png"
              mode="card"
            />
            <EvolvedProtectionSpotlight
              partnerName="Leo's Poké Vault"
              tagline={null}
              blurb="A family-run store built on a shared love of Pokémon and Trading Card Games. Here to help you find the perfect cards, accessories, and supplies."
              bullets={[]}
              ctaLabel="Shop Sealed"
              ctaHref="https://www.leospokevault.co.uk"
              heroSrc="/assets/partners/leos.png"
              mode="card"
            />
          </div>
        </section>

        <MobileAppPromo />

        <DiscordJoinBar />

        <FAQ />
      </div>
    </Layout>
  );
}
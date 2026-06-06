// pages/index.js

import React from "react";
import Image from "next/image";
import Layout from "@/components/Layout/Layout";
import HeroSection from "@/components/Layout/Hero";
import CardSearch from "@/components/Collection/CardSearch";
import FAQ from "@/components/Layout/FAQ";
import DiscordJoinBar from "@/components/Layout/DiscordBar";

import MobileAppPromo from "@/components/Home/AppBanner";
import ProductPillars from "@/components/Home/ProductPillars";
import BinderShowcaseSection from "@/components/Home/BinderShowcaseSection";
import MarketplaceTeaser from "@/components/Home/MarketplaceTeaser";

function PartnerCard({ name, tagline, blurb, imageSrc, ctaLabel, ctaHref }) {
  return (
    <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface overflow-hidden shadow-sm flex flex-col">
      {/* Hero image */}
      <div className="relative h-48 w-full shrink-0">
        <Image
          src={imageSrc}
          alt={name}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
        <p className="absolute bottom-3 left-4 text-[10px] font-bold uppercase tracking-widest text-white/60">
          In partnership with SixByFive TCG
        </p>
      </div>

      {/* Copy */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-light-textMuted dark:text-dark-textMuted mb-1">
            {name}
          </p>
          <h3 className="text-xl font-extrabold tracking-tight leading-snug">
            {tagline}
          </h3>
        </div>
        <p className="text-sm text-light-textMuted dark:text-dark-textMuted leading-relaxed">
          {blurb}
        </p>
        <div className="mt-auto pt-2">
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold bg-light-accent dark:bg-dark-accent text-white hover:opacity-90 transition"
          >
            {ctaLabel}
          </a>
        </div>
      </div>
    </div>
  );
}

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

        <section className="px-4 py-10 max-w-7xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-light-textMuted dark:text-dark-textMuted mb-5">
            Our Partners
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PartnerCard
              name="Evolved Protection"
              tagline="Evolve the way you protect your cards"
              blurb="Trusted sleeves, toploaders & shields built for serious collectors. UK-based and collector-first."
              imageSrc="/assets/partners/evolved.png"
              ctaLabel="Shop Evolved"
              ctaHref="https://evolvedcardprotection.co.uk?sca_ref=9820478.MfkcaLj4ToIM"
            />
            <PartnerCard
              name="Leo's Poké Vault"
              tagline="A family-run store for Pokémon fans"
              blurb="Sealed product, singles, accessories and supplies — built by collectors, for collectors."
              imageSrc="/assets/partners/leos.png"
              ctaLabel="Visit Leo's"
              ctaHref="https://www.leospokevault.co.uk"
            />
          </div>
        </section>

        <DiscordJoinBar />

        <FAQ />
      </div>
    </Layout>
  );
}

"use client";
import React from "react";
import Head from "next/head";
import Layout from "@/components/Layout/Layout";
import MarketplaceListingGrid from "./marketListingGrid";
// import MarketplaceFilters from "./MarketplaceFilters"; // Add later

export default function MarketplacePage() {
  return (
    <>
      <Head>
        <title>Marketplace – SixByFive TCG</title>
        <meta name="description" content="Buy and sell Pokémon cards with UK collectors on the SixByFive TCG Marketplace." />
        <link rel="canonical" href="https://tcg.sixbyfive.com/marketplace" />
      </Head>
      <Layout>
        <div className="min-h-screen bg-light-background dark:bg-dark-background text-light-text dark:text-dark-text pt-[92px] md:pt-[110px] pb-16 transition-colors">
          <section className="max-w-6xl mx-auto px-4">
            <h1 className="text-4xl font-bold mb-2 tracking-tight text-center text-light-primary dark:text-dark-primary">
              Marketplace
            </h1>
            <p className="text-lg text-center mb-10 text-light-textMuted dark:text-dark-textMuted">
              Buy and sell authentic Pokémon cards, with proof of ownership and instant price updates.
            </p>
            {/* <MarketplaceFilters /> */}
            <MarketplaceListingGrid />
          </section>
        </div>
      </Layout>
    </>
  );
}

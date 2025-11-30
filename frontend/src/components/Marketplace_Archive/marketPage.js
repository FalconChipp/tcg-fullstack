// /pages/marketplace.js
"use client";
import React, { useState } from "react";
import Head from "next/head";
import Layout from "@/components/Layout/Layout";
import MarketplaceHeader from "./marketHeader";
import MarketplaceListingGrid from "./marketListingGrid";
import SellCardModal from "./marketSellModal";
import { CartProvider } from "./CartProvider";
import MarketCartDrawer from "./marketCartDrawer";

export default function MarketplacePage() {
  const [showSellModal, setShowSellModal] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  return (
    <>
      <Head>
        <title>Marketplace – SixByFive TCG</title>
        <meta name="description" content="Buy and sell Pokémon cards with UK collectors on the SixByFive TCG Marketplace." />
        <link rel="canonical" href="https://tcg.sixbyfive.com/marketplace" />
      </Head>
      <CartProvider>
        <Layout>
          {/* ---- Marketplace header with Cart icon/trigger ---- */}
          <MarketplaceHeader onCartClick={() => setCartDrawerOpen(true)} />

          <div className="min-h-screen bg-light-background dark:bg-dark-background text-light-text dark:text-dark-text pt-[92px] md:pt-[110px] pb-16 transition-colors">
            <section className="max-w-6xl mx-auto px-4">
              <h1 className="text-4xl font-bold mb-2 tracking-tight text-center text-light-primary dark:text-dark-primary">
                Marketplace
              </h1>
              <p className="text-lg text-center mb-10 text-light-textMuted dark:text-dark-textMuted">
                Buy and sell authentic Pokémon cards, with proof of ownership and instant price updates.
              </p>
              <div className="flex justify-center mb-8">
                <button
                  className="px-6 py-3 rounded-xl font-bold text-lg shadow bg-light-accent dark:bg-dark-accent text-white dark:text-dark-surface hover:bg-light-accentLight dark:hover:bg-dark-accentLight border-2 border-light-accent dark:border-dark-accent hover:border-light-accentLight dark:hover:border-dark-accentLight transition"
                  onClick={() => setShowSellModal(true)}
                >
                  + Sell a Card
                </button>
              </div>
              <SellCardModal open={showSellModal} onClose={() => setShowSellModal(false)} />
              <MarketplaceListingGrid />
            </section>
          </div>
          {/* Cart Drawer, always present but only visible when open */}
          <MarketCartDrawer open={cartDrawerOpen} onClose={() => setCartDrawerOpen(false)} />
        </Layout>
      </CartProvider>
    </>
  );
}

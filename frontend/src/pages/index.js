"use client";
import React, { useState } from "react";
import Head from "next/head";
import Layout from "@/components/Layout/Layout";
import CardSearch from "@/components/Collection/CardSearch";
import HeroSection from "@/components/Layout/Hero";
import AuthModal from "@/components/Auth/AuthModal";
import HowItWorks from "@/components/Layout/HowItWorks";
import KeyFeatures from "@/components/Layout/KeyFeatures";
import FAQ from "@/components/Layout/FAQ";
import DiscordJoinBar from "@/components/Layout/DiscordBar";
import Landing from "@/components/Layout/Landing";

// This is the top-level home page component
export default function Home() {
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <>
    <Head>
        <title>SixByFive TCG – UK Trading Card Collection & Marketplace</title>
        <meta name="description" content="Manage your trading card collection, trade with other players, and get notified when SixByFive TCG launches. Join the UK’s next-gen TCG platform today!" />
        {/* Canonical */}
        <link rel="canonical" href="https://tcg.sixbyfive.com/" />
        {/* OG (Facebook/Discord previews) */}
        <meta property="og:title" content="SixByFive TCG – UK Trading Card Collection & Marketplace" />
        <meta property="og:description" content="Build your collection, trade, and connect with the community. Sign up now to be first when SixByFive TCG goes live!" />
        <meta property="og:url" content="https://tcg.sixbyfive.com/" />
        <meta property="og:image" content="https://tcg.sixbyfive.com/og-image.png" />
        <meta property="og:type" content="website" />
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SixByFive TCG – UK Trading Card Collection & Marketplace" />
        <meta name="twitter:description" content="Build your collection, trade, and connect with the community. Sign up now for launch updates!" />
        <meta name="twitter:image" content="https://tcg.sixbyfive.com/og-image.png" />
      </Head>
    <Layout noTopPadding>
      <div className="pt-20">

        <HeroSection onOpenAuthModal={() => setAuthModalOpen(true)} />
        <CardSearch />
        <HowItWorks />
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
    {/* <Landing /> */}
    </>
  );
}

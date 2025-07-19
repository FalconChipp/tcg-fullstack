"use client";
import React, { useState } from "react";
import Head from "next/head";
import Layout from "@/components/Layout/Layout";
import HeroSection from "@/components/Layout/Hero";
import CardSearch from "@/components/Collection/CardSearch";
import HowItWorks from "@/components/Layout/HowItWorks";
import KeyFeatures from "@/components/Layout/KeyFeatures";
import FAQ from "@/components/Layout/FAQ";
import DiscordJoinBar from "@/components/Layout/DiscordBar";
import AuthModal from "@/components/Auth/AuthModal";
import Landing from "@/components/Layout/Landing";

export default function Home() {
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <>
      <Head>
        <title>SixByFive TCG – UK Trading Card Collection & Marketplace</title>
        <meta
          name="description"
          content="The UK’s next-gen Pokémon TCG collection app. Manage your cards, build digital binders, track values, and connect with collectors. Sign up free for launch rewards."
        />
        <link rel="canonical" href="https://tcg.sixbyfive.com/" />
        <meta property="og:title" content="SixByFive TCG – UK Trading Card Collection & Marketplace" />
        <meta property="og:description" content="Join the new home for UK Pokémon TCG collectors. Track your collection, get price updates, and join our Discord community. Early achievements for pre-launch signups!" />
        <meta property="og:url" content="https://tcg.sixbyfive.com/" />
        <meta property="og:image" content="https://tcg.sixbyfive.com/og-image.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SixByFive TCG – UK Trading Card Collection & Marketplace" />
        <meta name="twitter:description" content="Build your collection, get price updates, and join the UK's newest TCG community. Sign up now for launch rewards!" />
        <meta name="twitter:image" content="https://tcg.sixbyfive.com/og-image.png" />
      </Head>
      {/* <Layout noTopPadding>
        <div className="pt-20"> */}

          {/* HERO SECTION */}
          {/* <HeroSection onOpenAuthModal={() => setAuthModalOpen(true)} />

          <section className="max-w-3xl mx-auto py-10 px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Take Your Collection Online?</h2>
            <p className="text-lg mb-6">
              SixByFive TCG is a new platform for UK collectors to track, organise, and value their Pokémon card collections. 
              <br />No spreadsheets, no hassle. Fast, free, and community-powered.
            </p>
            <div className="flex flex-col md:flex-row gap-6 justify-center">
              <div className="bg-dark-alt rounded-xl p-6 shadow-md flex-1">
                <h3 className="font-semibold text-lg mb-2 text-light-accent">🗃️ Digital Collection Manager</h3>
                <p>Add cards, create wishlists, and view collection value at a glance.</p>
              </div>
              <div className="bg-dark-alt rounded-xl p-6 shadow-md flex-1">
                <h3 className="font-semibold text-lg mb-2 text-light-accent">📒 Custom Binders</h3>
                <p>Organise cards in digital binders—mimic your real binders online, share, and show off.</p>
              </div>
              <div className="bg-dark-alt rounded-xl p-6 shadow-md flex-1">
                <h3 className="font-semibold text-lg mb-2 text-light-accent">💬 Community & Achievements</h3>
                <p>Join our Discord for trading, advice, and exclusive early adopter badges.</p>
              </div>
            </div>
          </section>

          <section className="my-8">
            <CardSearch />
          </section>

          <HowItWorks
            steps={[
              {
                title: "Create Your Account",
                description: "Sign up in seconds and join the SixByFive community.",
              },
              {
                title: "Add Your Cards",
                description: "Use instant search to build your collection and wishlist.",
              },
              {
                title: "Organise with Binders",
                description: "Group, sort, and display your cards just like your real-world binders.",
              },
              {
                title: "Track Values",
                description: "See up-to-date collection value based on real market prices.",
              },
              {
                title: "Join the Community",
                description: "Connect with collectors, get advice, and unlock achievements.",
              },
            ]}
          />

          <KeyFeatures />

          <DiscordJoinBar />

          <FAQ /> */}

          <Landing />

        {/* </div>

        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={() => setAuthModalOpen(false)}
        />
      </Layout> */}
    </>
  );
}

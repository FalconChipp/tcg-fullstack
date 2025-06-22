"use client";
import Layout from "@/components/Layout/Layout";
import Head from "next/head";
import Link from "next/link";
import {
  FaDiscord,
  FaRegStar,
  FaSearch,
  FaRegFolderOpen,
  FaRegUserCircle,
  FaRegChartBar,
  FaExchangeAlt,
  FaStoreAlt,
} from "react-icons/fa";

// --- Features ---

const liveFeatures = [
  {
    icon: (
      <FaRegFolderOpen className="text-3xl text-light-accent dark:text-dark-accent" />
    ),
    title: "Collection Management",
    desc: "Track every Pokémon card you own by set, number, and language. Keep your collection up to date and always at your fingertips.",
  },
  {
    icon: (
      <FaSearch className="text-3xl text-light-accent dark:text-dark-accent" />
    ),
    title: "Advanced Card Search",
    desc: "Find cards instantly by name, set, or number. Browse high-res scans, set icons, and up-to-date price data.",
  },
  {
    icon: (
      <FaRegFolderOpen className="text-3xl text-light-accent dark:text-dark-accent" />
    ),
    title: "Digital Binders",
    desc: "Create custom binders—just like real life. Choose layouts, add covers, and show off your collection.",
  },
  {
    icon: (
      <FaRegStar className="text-3xl text-light-accent dark:text-dark-accent" />
    ),
    title: "Wishlists",
    desc: "Add cards to your wishlist and keep track of your top chases and grails.",
  },
  {
    icon: (
      <FaRegUserCircle className="text-3xl text-light-accent dark:text-dark-accent" />
    ),
    title: "Public Profiles",
    desc: "Share your collection, binders, and progress—every collector gets a beautiful, unique public profile.",
  },
];

const comingSoon = [
  {
    icon: (
      <FaExchangeAlt className="text-2xl text-light-secondary dark:text-dark-secondary" />
    ),
    title: "Trading Platform",
    desc: "Trade securely with other UK collectors. Shipping, privacy, and tracking all built in.",
  },
  {
    icon: (
      <FaStoreAlt className="text-2xl text-light-secondary dark:text-dark-secondary" />
    ),
    title: "Marketplace",
    desc: "Buy and sell cards securely. List directly from your collection, get instant price suggestions.",
  },
  {
    icon: (
      <FaRegChartBar className="text-2xl text-light-secondary dark:text-dark-secondary" />
    ),
    title: "Achievements & Stats",
    desc: "Showcase your best pulls, track binder completion, and compare stats over time.",
  },
  {
    icon: (
      <FaRegStar className="text-2xl text-light-secondary dark:text-dark-secondary" />
    ),
    title: "Support for More TCGs",
    desc: "Magic: The Gathering and Disney Lorcana up next—plus voting for future games.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About – SixByFive TCG</title>
        <meta
          name="description"
          content="Learn more about SixByFive TCG and our mission to build the ultimate Pokémon TCG collection and trading platform."
        />
        <link rel="canonical" href="https://tcg.sixbyfive.com/about" />
        <meta property="og:title" content="About – SixByFive TCG" />
        <meta
          property="og:description"
          content="Learn more about SixByFive TCG and our mission to build the ultimate Pokémon TCG collection and trading platform."
        />
        <meta property="og:url" content="https://tcg.sixbyfive.com/about" />
        <meta property="og:image" content="https://tcg.sixbyfive.com/og-image.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="About – SixByFive TCG" />
        <meta
          name="twitter:description"
          content="Learn more about SixByFive TCG and our mission to build the ultimate Pokémon TCG collection and trading platform."
        />
        <meta name="twitter:image" content="https://tcg.sixbyfive.com/og-image.png" />
      </Head>
      <Layout>
      <div className="min-h-screen bg-light-background dark:bg-dark-background text-light-text dark:text-dark-text transition-colors pt-[92px] md:pt-[110px] pb-12">
        {/* HERO */}
        <section className="w-full px-4 pb-12 pt-8 bg-gradient-to-br from-light-alt via-light-background to-[#e5f1ff] dark:from-[#191923] dark:via-dark-surface dark:to-dark-background border-b border-light-border dark:border-dark-border relative overflow-hidden">
          <div className="max-w-2xl mx-auto text-center">
            <img
              src="/logo-sbf-tcg.svg"
              alt="SixByFive TCG Logo"
              className="mx-auto mb-5 w-32 h-16 object-contain"
              draggable={false}
              style={{ pointerEvents: "none" }}
            />
            <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-light-primary dark:text-dark-primary mb-4 tracking-tight">
              About SixByFive TCG
            </h1>
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-light-textSecondary dark:text-dark-textSecondary mb-6">
              The modern home for your Pokémon TCG collection and digital binders.<br />
              Built for UK collectors, open to everyone.
            </p>
            <div className="flex justify-center gap-3 mt-6 mb-2">
              {/* Accent CTA button */}
              <Link
                href="/"
                className="
                  bg-light-accent dark:bg-dark-accent
                  text-white dark:text-dark-surface
                  px-6 py-3 rounded-xl font-bold shadow
                  hover:bg-light-accentLight dark:hover:bg-dark-accentLight
                  focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
                  border-2 border-light-accent dark:border-dark-accent
                  hover:border-light-accentLight dark:hover:border-dark-accentLight
                  transition
                "
              >
                Start Collecting
              </Link>
              {/* Discord button (uses Discord brand color) */}
              <Link
                href="https://discord.gg/pAnGVBb2Dc"
                target="_blank"
                rel="noopener noreferrer"
                className="
                  inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold
                  bg-[#5865F2] text-white
                  hover:bg-[#4352c3]
                  focus:outline-none focus:ring-2 focus:ring-[#5865F2]
                  shadow
                  transition
                "
                aria-label="Join our Discord"
              >
                <FaDiscord /> Join Discord
              </Link>
            </div>
          </div>
        </section>

        {/* WHY */}
        <section className="max-w-4xl mx-auto px-4 py-16">
          <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-3xl shadow-lg px-7 py-9 md:py-12 md:px-12 mb-10">
            <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4 text-light-primary dark:text-dark-primary text-center">
              Why SixByFive TCG?
            </h2>
            <p className="text-base md:text-lg text-light-textSecondary dark:text-dark-textSecondary text-center max-w-3xl mx-auto">
              SixByFive TCG was created by passionate collectors who wanted a better way to organise, track, and enjoy their collections—without relying on spreadsheets or clunky tools that never quite “got it.” We set out to build a modern, intuitive platform focused on the real needs of TCG collectors, starting with the UK community but welcoming fans everywhere.<br /><br />
              Our goal is to make collection management, binder building, and trading easier and more rewarding than ever. Whether you’re just starting out or chasing your next master set, SixByFive TCG brings together powerful search, digital binders, wishlists, and a vibrant collector community—all in one place.<br /><br />
              We’re committed to offering a robust free tier for every collector, with optional subscription plans for those who want advanced features, exclusive tools, or to support the project’s ongoing development.
            </p>
          </div>
        </section>

        {/* WHAT'S LIVE */}
        <section className="max-w-5xl mx-auto px-4 py-6 md:py-12">
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-10 text-light-primary dark:text-dark-primary text-center">
            What’s Live Right Now
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {liveFeatures.map((f, i) => (
              <div
                key={f.title}
                className="flex flex-col items-center p-7 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow transition"
              >
                <div className="mb-3">{f.icon}</div>
                <div className="text-lg font-bold text-light-primary dark:text-dark-primary mb-2 text-center">{f.title}</div>
                <div className="text-[15px] text-center text-light-textSecondary dark:text-dark-textSecondary">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* COMING SOON */}
        <section className="max-w-5xl mx-auto px-4 py-14">
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-10 text-light-secondary dark:text-dark-secondary text-center">
            Coming Soon
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {comingSoon.map((f, i) => (
              <div
                key={f.title}
                className="flex flex-col items-start p-7 rounded-2xl bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border shadow-sm transition"
              >
                <div className="mb-2">{f.icon}</div>
                <div className="text-lg font-bold text-light-secondary dark:text-dark-secondary mb-2">{f.title}</div>
                <div className="text-[15px] text-light-textSecondary dark:text-dark-textSecondary">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* COMMUNITY */}
        <section className="max-w-4xl mx-auto px-4 py-14">
          <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-3xl shadow-lg px-7 py-9 md:py-12 md:px-12">
            <h2 className="font-heading text-2xl font-bold mb-4 text-light-primary dark:text-dark-primary text-center">
              For the Community, By the Community
            </h2>
            <p className="text-base text-light-textSecondary dark:text-dark-textSecondary mb-3 text-center">
              SixByFive TCG is built for collectors, by collectors. If you have ideas, feature requests, or want to help test new features,{" "}
              <Link href="https://discord.gg/pAnGVBb2Dc" target="_blank" className="underline text-light-accent dark:text-dark-accent font-semibold">join our Discord</Link>{" "}
              or reach out any time.
            </p>
            <p className="text-base text-light-textMuted dark:text-dark-textMuted text-center">
              Questions? Feedback? Want to help shape the future of UK TCG collecting? You’re in the right place.
            </p>
          </div>
        </section>
      </div>
    </Layout>
    </>
  );
}

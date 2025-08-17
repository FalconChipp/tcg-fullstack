"use client";
import Layout from "@/components/Layout/Layout";
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

/* LIVE FEATURES (unchanged content) */
const liveFeatures = [
  {
    icon: <FaRegFolderOpen className="text-3xl text-light-accent dark:text-dark-accent" />,
    title: "Collection Management",
    desc: "Track every Pokémon card by set, number, and language — always up to date.",
  },
  {
    icon: <FaSearch className="text-3xl text-light-accent dark:text-dark-accent" />,
    title: "Advanced Card Search",
    desc: "Find cards instantly by name, set, or number. Browse scans and set icons.",
  },
  {
    icon: <FaRegFolderOpen className="text-3xl text-light-accent dark:text-dark-accent" />,
    title: "Digital Binders",
    desc: "Create binders that feel real. Pick layouts, add covers, and share pages.",
  },
  {
    icon: <FaRegStar className="text-3xl text-light-accent dark:text-dark-accent" />,
    title: "Wishlists",
    desc: "Keep your chase list front and centre so you never miss a pickup.",
  },
  {
    icon: <FaRegUserCircle className="text-3xl text-light-accent dark:text-dark-accent" />,
    title: "Public Profiles",
    desc: "Share your collection and binders — every collector gets a public profile.",
  },
];

/* COMING SOON (unchanged content) */
const comingSoon = [
  { icon: <FaExchangeAlt className="text-2xl text-light-secondary dark:text-dark-secondary" />, title: "Trading Platform", desc: "Secure trades with tracked shipping and privacy by default." },
  { icon: <FaStoreAlt className="text-2xl text-light-secondary dark:text-dark-secondary" />, title: "Marketplace", desc: "List from your collection with smart price suggestions." },
  { icon: <FaRegChartBar className="text-2xl text-light-secondary dark:text-dark-secondary" />, title: "Achievements & Stats", desc: "Showcase pulls, track binder completion, and watch your stats grow." },
  { icon: <FaRegStar className="text-2xl text-light-secondary dark:text-dark-secondary" />, title: "Support for More TCGs", desc: "MTG and Disney Lorcana up next — vote on what comes after." },
];

export default function AboutPage() {
  // SEO via Layout
  const seo = {
    title: "About — SixByFive TCG",
    description:
      "What is SixByFive TCG? The modern home for Pokémon TCG collectors: track your cards, build digital binders, and connect with the UK community.",
    canonical: "/about",
    extraJsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "About SixByFive TCG",
        url: "https://tcg.sixbyfive.com/about",
        isPartOf: { "@type": "WebSite", name: "SixByFive TCG", url: "https://tcg.sixbyfive.com" },
        description:
          "SixByFive TCG is a modern platform for Pokémon TCG collectors to track cards, build digital binders, and join the UK community.",
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://tcg.sixbyfive.com/" },
          { "@type": "ListItem", position: 2, name: "About", item: "https://tcg.sixbyfive.com/about" },
        ],
      },
    ],
  };

  return (
    <Layout seo={seo}>
      <div className="min-h-screen bg-light-background dark:bg-dark-background text-light-text dark:text-dark-text transition-colors pb-12">
        {/* HERO */}
        <section className="w-full px-4 pb-12 pt-8 bg-gradient-to-br from-light-alt via-light-background to-[#e5f1ff] dark:from-[#191923] dark:via-dark-surface dark:to-dark-background border-b border-light-border dark:border-dark-border relative overflow-hidden">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-light-primary dark:text-dark-primary mb-4 tracking-tight">
              About SixByFive TCG
            </h1>
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-light-textSecondary dark:text-dark-textSecondary mb-6">
              The modern home for your Pokémon TCG collection and digital binders.
              <br />
              Built for UK collectors — open to everyone.
            </p>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              <span className="text-xs px-3 py-1 rounded-full border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface">🇬🇧 UK-focused</span>
              <span className="text-xs px-3 py-1 rounded-full border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface">Free to start</span>
              <span className="text-xs px-3 py-1 rounded-full border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface">Community-driven</span>
            </div>

            <div className="flex justify-center gap-3 mt-4 mb-2 flex-wrap">
              {/* PRIMARY CTA — FIXED CONTRAST */}
              <Link
                href="/"
                className="
                  flex items-center gap-2 px-6 py-3 rounded-full border-2
                  bg-light-accent hover:bg-light-accentLight
                  dark:bg-dark-accent dark:hover:bg-dark-accentLight
                  border-light-accent dark:border-dark-accent
                  shadow-lg transition-all duration-150 focus:outline-none
                  focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
                  text-white dark:text-white hover:text-white dark:hover:text-white  /* CHANGED: force readable text */
                "
              >
                {/* CHANGED: explicit label to ensure it renders */}
                <span className="font-semibold text-lg leading-none">Start free</span>
              </Link>

              {/* SECONDARY CTA (kept readable on both themes) */}
              <Link
                href="https://discord.gg/PRMbMbRE2H"
                target="_blank"
                rel="noopener noreferrer"
                className="
                  flex items-center gap-2 px-6 py-3 rounded-full border-2
                  bg-light-alt dark:bg-dark-alt
                  hover:bg-light-surface dark:hover:bg-dark-surface
                  border-light-border dark:border-dark-border
                  text-light-text dark:text-dark-text
                  shadow-lg transition-all duration-150 focus:outline-none
                  focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
                "
                aria-label="Join our Discord"
              >
                <FaDiscord aria-hidden="true" />
                <span className="font-semibold text-lg leading-none">Join Discord</span>
              </Link>
            </div>

            <div className="mt-3 text-sm text-light-textMuted dark:text-dark-textMuted">
              <Link href="#live-now" className="underline underline-offset-4 mr-3">
                What’s live now
              </Link>
              <Link href="#coming-soon" className="underline underline-offset-4">
                Coming soon
              </Link>
            </div>
          </div>
        </section>

        {/* WHY */}
        <section className="max-w-4xl mx-auto px-4 py-16">
          <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-3xl shadow-lg px-7 py-10 md:py-14 md:px-14 mb-10">
            <h2 className="font-heading text-2xl md:text-3xl font-bold mb-5 text-light-primary dark:text-dark-primary text-center">
              Why SixByFive TCG?
            </h2>
            <p className="text-base md:text-lg text-light-textSecondary dark:text-dark-textSecondary text-center max-w-3xl mx-auto leading-relaxed">
              We’re collectors who wanted a better way to organise, track, and enjoy collections — without spreadsheets or clunky tools.
              SixByFive TCG brings fast search, digital binders, wishlists, and a friendly UK community together in one place.
              <br /><br />
              There’s a robust free tier for everyone, with optional subscriptions for advanced tools and to support ongoing development.
            </p>
          </div>
        </section>

        {/* WHAT'S LIVE */}
        <section id="live-now" className="max-w-5xl mx-auto px-4 py-6 md:py-12 scroll-mt-28">
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-10 text-light-primary dark:text-dark-primary text-center">
            What’s Live Right Now
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {liveFeatures.map((f) => (
              <div
                key={f.title}
                className="flex flex-col items-center p-7 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow ring-1 ring-black/5 dark:ring-black/20 transition"
              >
                <div className="mb-3" aria-hidden="true">{f.icon}</div>
                <div className="text-lg font-bold text-light-primary dark:text-dark-primary mb-2 text-center">{f.title}</div>
                <div className="text-[15px] text-center text-light-textSecondary dark:text-dark-textSecondary">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* COMING SOON */}
        <section id="coming-soon" className="max-w-5xl mx-auto px-4 py-14 scroll-mt-28" aria-labelledby="coming-soon-heading">
          <h2 id="coming-soon-heading" className="font-heading text-2xl md:text-3xl font-bold mb-10 text-light-secondary dark:text-dark-secondary text-center">
            Coming Soon
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {comingSoon.map((f) => (
              <div
                key={f.title}
                className="flex flex-col items-start p-7 rounded-2xl bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border shadow-sm grayscale opacity-90 transition"
                aria-disabled="true"
              >
                <div className="mb-2" aria-hidden="true">{f.icon}</div>
                <div className="text-lg font-bold text-light-secondary dark:text-dark-secondary mb-2">{f.title}</div>
                <div className="text-[15px] text-light-textSecondary dark:text-dark-textSecondary">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* COMMUNITY */}
        <section className="max-w-4xl mx-auto px-4 py-14">
          <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-3xl shadow-lg px-7 py-10 md:py-14 md:px-14">
            <h2 className="font-heading text-2xl font-bold mb-5 text-light-primary dark:text-dark-primary text-center">
              For the Community, By the Community
            </h2>
            <p className="text-base text-light-textSecondary dark:text-dark-textSecondary mb-4 text-center">
              Have ideas or want to help test new features?{" "}
              <Link href="https://discord.gg/PRMbMbRE2H" target="_blank" className="underline text-light-accent dark:text-dark-accent font-semibold">
                Join our Discord
              </Link>{" "}
              or reach out any time.
            </p>
            <p className="text-base text-light-textMuted dark:text-dark-textMuted text-center">
              Questions? Feedback? Want to help shape the future of UK TCG collecting? You’re in the right place.
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}

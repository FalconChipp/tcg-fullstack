// src/pages/about.js
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

/* -------------------------------------------------------------------------- */
/* LIVE FEATURES — what you can actually do today                             */
/* -------------------------------------------------------------------------- */
const liveFeatures = [
  {
    icon: (
      <FaRegFolderOpen className="text-3xl text-light-accent dark:text-dark-accent" />
    ),
    title: "Track Your Collection",
    desc: "Add cards by set, number, or name. See everything you own in one place.",
  },
  {
    icon: (
      <FaSearch className="text-3xl text-light-accent dark:text-dark-accent" />
    ),
    title: "Fast Card Search",
    desc: "Search every English set with clean results, card images, and set icons.",
  },
  {
    icon: (
      <FaRegFolderOpen className="text-3xl text-light-accent dark:text-dark-accent" />
    ),
    title: "Digital Binders",
    desc: "Recreate your real binders online with layouts, covers, and shareable pages.",
  },
  {
    icon: (
      <FaRegStar className="text-3xl text-light-accent dark:text-dark-accent" />
    ),
    title: "Wishlists & Wantlists",
    desc: "Keep chase cards front and centre so you never forget what you’re hunting.",
  },
  {
    icon: (
      <FaRegUserCircle className="text-3xl text-light-accent dark:text-dark-accent" />
    ),
    title: "Public Profiles",
    desc: "Show off binders, recent pickups, and collections on your own profile.",
  },
];

/* -------------------------------------------------------------------------- */
/* ROADMAP / COMING SOON                                                      */
/* -------------------------------------------------------------------------- */
const roadmapItems = [
  {
    title: "Marketplace",
    icon: (
      <FaStoreAlt className="text-2xl text-light-secondary dark:text-dark-secondary" />
    ),
    when: "In development",
    desc: "List cards directly from your collection with smart price suggestions.",
  },
  {
    title: "Trading Platform",
    icon: (
      <FaExchangeAlt className="text-2xl text-light-secondary dark:text-dark-secondary" />
    ),
    when: "In Planning",
    desc: "Secure, tracked trades between collectors with privacy by default.",
  },
  {
    title: "Achievements & Stats",
    icon: (
      <FaRegChartBar className="text-2xl text-light-secondary dark:text-dark-secondary" />
    ),
    when: "Planned",
    desc: "Completion badges, collection milestones, and personal stats.",
  },
  {
    title: "More TCGs",
    icon: (
      <FaRegStar className="text-2xl text-light-secondary dark:text-dark-secondary" />
    ),
    when: "Future",
    desc: "MTG and Disney Lorcana up next — with community input on what follows.",
  },
];

export default function AboutPage() {
  const seo = {
    title: "About — SixByFive TCG",
    description:
      "What is SixByFive TCG? A collector-built home for Pokémon TCG: track your cards, build digital binders, and connect with the UK community.",
    canonical: "/about",
    extraJsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "About SixByFive TCG",
        url: "https://tcg.sixbyfive.com/about",
        isPartOf: {
          "@type": "WebSite",
          name: "SixByFive TCG",
          url: "https://tcg.sixbyfive.com",
        },
        description:
          "SixByFive TCG is a modern platform for Pokémon TCG collectors to track cards, build digital binders, and join the UK community.",
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://tcg.sixbyfive.com/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "About",
            item: "https://tcg.sixbyfive.com/about",
          },
        ],
      },
    ],
  };

  return (
    <Layout seo={seo}>
      <div className="min-h-screen bg-light-background dark:bg-dark-background text-light-text dark:text-dark-text transition-colors pb-16">
        {/* ------------------------------------------------------------------ */}
        {/* HERO: what this is in one glance                                   */}
        {/* ------------------------------------------------------------------ */}
        <section className="w-full px-4 pb-14 pt-10 bg-gradient-to-br from-light-alt via-light-background to-[#e5f1ff] dark:from-[#191923] dark:via-dark-surface dark:to-dark-background border-b border-light-border dark:border-dark-border relative overflow-hidden">
          <div className="max-w-5xl mx-auto flex flex-col gap-8 md:flex-row md:items-center">
            {/* Left: main story */}
            <div className="md:w-3/5 text-center md:text-left">
              <p className="uppercase tracking-[0.22em] text-[11px] font-semibold text-light-textMuted dark:text-dark-textMuted mb-2">
                BUILT FOR COLLECTORS
              </p>
              <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-light-primary dark:text-dark-primary mb-4 tracking-tight">
                A collector-built home for your Pokémon cards.
              </h1>
              <p className="max-w-xl text-base md:text-lg text-light-textSecondary dark:text-dark-textSecondary mb-5 leading-relaxed">
                SixByFive TCG is a project by a UK collector who wanted a faster,
                cleaner way to track cards, build binders that feel real, and stay
                on top of prices — without spreadsheets or marketplaces getting in
                the way.
              </p>

              {/* Small “why it’s different” bullets */}
              <ul className="space-y-2 text-sm md:text-[15px] text-light-textSecondary dark:text-dark-textSecondary mb-6">
                <li>• UK-focused pricing and releases, open to collectors everywhere.</li>
                <li>• Digital binders that look and feel like real pages.</li>
                <li>• Roadmap shaped with feedback from early users and Discord.</li>
              </ul>

              {/* CTAs */}
              <div className="flex justify-center md:justify-start gap-3 flex-wrap">
                <Link
                  href="/"
                  className="
                    flex items-center gap-2 px-6 py-3 rounded-full border-2
                    bg-light-accent hover:bg-light-accentLight
                    dark:bg-dark-accent dark:hover:bg-dark-accentLight
                    border-light-accent dark:border-dark-accent
                    shadow-lg transition-all duration-150 focus:outline-none
                    focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
                    text-white dark:text-white hover:text-white dark:hover:text-white
                  "
                >
                  <span className="font-semibold text-lg leading-none">
                    Start free
                  </span>
                </Link>

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
                  <span className="font-semibold text-lg leading-none">
                    Join Discord
                  </span>
                </Link>
              </div>

              <div className="mt-3 text-[12px] text-light-textMuted dark:text-dark-textMuted">
                <Link
                  href="#live-now"
                  className="underline underline-offset-4 mr-3"
                >
                  What’s live now
                </Link>
                <Link
                  href="#roadmap"
                  className="underline underline-offset-4"
                >
                  Where this is going
                </Link>
              </div>
            </div>

            {/* Right: “Quick snapshot” card */}
            <div className="md:w-2/5">
              <div className="mx-auto max-w-sm rounded-3xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-xl p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-light-primary dark:text-dark-primary">
                  The short version
                </h2>
                <div className="space-y-3 text-sm text-light-textSecondary dark:text-dark-textSecondary">
                  <p>
                    <span className="font-semibold">What it is:</span> a place to
                    track your collection, build digital binders, and soon, trade and
                    sell cards.
                  </p>
                  <p>
                    <span className="font-semibold">Who it’s for:</span> Pokémon TCG
                    collectors who care about organisation, value, and showing their
                    collection off.
                  </p>
                  <p>
                    <span className="font-semibold">Stage:</span> live beta — core
                    tools are ready, and the big systems (trading, marketplace,
                    achievements) are in active development.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* WHY / STORY                                                        */}
        {/* ------------------------------------------------------------------ */}
        <section className="max-w-5xl mx-auto px-4 py-14">
          <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-3xl shadow-lg px-7 py-10 md:px-10 md:py-12">
            <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4 text-light-primary dark:text-dark-primary text-center">
              Why does SixByFive TCG exist?
            </h2>
            <p className="text-base md:text-[15px] text-light-textSecondary dark:text-dark-textSecondary max-w-3xl mx-auto text-center leading-relaxed">
              The project started as a simple idea:{" "}
              <strong className="font-semibold">
                “What if I could see my whole collection like a binder, but on a
                screen?”
              </strong>{" "}
              From there it grew into fast card search, digital binders, wishlists,
              and live pricing — built around how collectors actually talk about
              their cards.
            </p>
            <p className="mt-4 text-sm md:text-[15px] text-light-textMuted dark:text-dark-textMuted max-w-3xl mx-auto text-center leading-relaxed">
              Everything is being built in the open. Features ship, get tested by
              early users, then iterated on with real feedback from the UK
              community and beyond.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* WHAT’S LIVE RIGHT NOW                                              */}
        {/* ------------------------------------------------------------------ */}
        <section
          id="live-now"
          className="max-w-5xl mx-auto px-4 py-6 md:py-10 scroll-mt-24"
        >
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-3 text-light-primary dark:text-dark-primary text-center">
            What you can do today
          </h2>
          <p className="text-sm md:text-[15px] text-light-textSecondary dark:text-dark-textSecondary text-center mb-8 max-w-2xl mx-auto">
            SixByFive is already a full collection manager. Here’s what’s live right
            now and ready to use.
          </p>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {liveFeatures.map((f) => (
              <div
                key={f.title}
                className="flex flex-col items-center text-center p-7 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-lg ring-1 ring-black/5 dark:ring-black/20 transition"
              >
                <div className="mb-3" aria-hidden="true">
                  {f.icon}
                </div>
                <div className="text-lg font-bold text-light-primary dark:text-dark-primary mb-2">
                  {f.title}
                </div>
                <div className="text-[15px] text-light-textSecondary dark:text-dark-textSecondary">
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* SIMPLE ONBOARDING FLOW (optional but nice)                         */}
        {/* ------------------------------------------------------------------ */}
        <section className="max-w-5xl mx-auto px-4 py-12">
          <div className="rounded-3xl bg-light-alt dark:bg-dark-surface border border-light-border dark:border-dark-border px-6 py-8 md:px-10 md:py-10">
            <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4 text-light-primary dark:text-dark-primary text-center">
              How it fits into your collecting
            </h2>
            <p className="text-sm md:text-[15px] text-light-textSecondary dark:text-dark-textSecondary text-center mb-6 max-w-2xl mx-auto">
              The goal is to quietly sit alongside your binders, storage boxes, and
              top loaders — and make everything easier to track.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="rounded-2xl bg-light-surface dark:bg-dark-surface px-5 py-6 border border-light-border dark:border-dark-border">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-light-accent text-white text-xs font-semibold mb-3">
                  1
                </div>
                <h3 className="font-semibold mb-2 text-light-primary dark:text-dark-primary">
                  Add your first few cards
                </h3>
                <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
                  Use Advanced Search to find a set and card number, then add copies
                  into your collection.
                </p>
              </div>
              <div className="rounded-2xl bg-light-surface dark:bg-dark-surface px-5 py-6 border border-light-border dark:border-dark-border">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-light-accent text-white text-xs font-semibold mb-3">
                  2
                </div>
                <h3 className="font-semibold mb-2 text-light-primary dark:text-dark-primary">
                  Build a digital binder
                </h3>
                <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
                  Create a binder for a favourite set, pick a layout, and start
                  dropping cards into pages.
                </p>
              </div>
              <div className="rounded-2xl bg-light-surface dark:bg-dark-surface px-5 py-6 border border-light-border dark:border-dark-border">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-light-accent text-white text-xs font-semibold mb-3">
                  3
                </div>
                <h3 className="font-semibold mb-2 text-light-primary dark:text-dark-primary">
                  Share & refine
                </h3>
                <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
                  Share your profile or binder link with friends, then keep adding
                  cards, binders, and wishlist entries as your collection grows.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* ROADMAP / COMING SOON                                              */}
        {/* ------------------------------------------------------------------ */}
        <section
          id="roadmap"
          className="max-w-5xl mx-auto px-4 py-12 scroll-mt-24"
          aria-labelledby="roadmap-heading"
        >
          <h2
            id="roadmap-heading"
            className="font-heading text-2xl md:text-3xl font-bold mb-3 text-light-secondary dark:text-dark-secondary text-center"
          >
            Where this is going next
          </h2>
          <p className="text-sm md:text-[15px] text-light-textSecondary dark:text-dark-textSecondary text-center mb-8 max-w-2xl mx-auto">
            The goal is a complete ecosystem: collection management, trading,
            selling, achievements, and more — all built around UK collectors’
            needs.
          </p>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {roadmapItems.map((item) => (
              <div
                key={item.title}
                className="flex gap-4 p-6 rounded-2xl bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border shadow-sm grayscale opacity-95"
                aria-disabled="true"
              >
                <div className="mt-1" aria-hidden="true">
                  {item.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base md:text-lg font-semibold text-light-secondary dark:text-dark-secondary">
                      {item.title}
                    </h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-light-surface dark:bg-dark-surface text-light-textMuted dark:text-dark-textMuted border border-light-border/70 dark:border-dark-border/70">
                      {item.when}
                    </span>
                  </div>
                  <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* COMMUNITY BLOCK                                                     */}
        {/* ------------------------------------------------------------------ */}
        <section className="max-w-4xl mx-auto px-4 py-10">
          <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-3xl shadow-lg px-7 py-9 md:px-10 md:py-11 text-center">
            <h2 className="font-heading text-2xl font-bold mb-4 text-light-primary dark:text-dark-primary">
              Built with the community, not for it.
            </h2>
            <p className="text-sm md:text-[15px] text-light-textSecondary dark:text-dark-textSecondary mb-4">
              SixByFive TCG is being shaped by real collectors — feature requests,
              early testing, and honest feedback all happen out in the open.
            </p>
            <p className="text-sm md:text-[15px] text-light-textSecondary dark:text-dark-textSecondary mb-5">
              If you want to influence how the tools evolve, help test new features,
              or just talk cards, you’re invited.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Link
                href="https://discord.gg/PRMbMbRE2H"
                target="_blank"
                rel="noopener noreferrer"
                className="
                  inline-flex items-center gap-2 rounded-full
                  bg-light-accent text-white
                  dark:bg-dark-accent dark:text-white
                  px-5 py-2.5 text-sm font-semibold
                  shadow hover:bg-light-accentLight dark:hover:bg-dark-accentLight
                  transition
                "
              >
                <FaDiscord aria-hidden="true" />
                <span>Join the Discord</span>
              </Link>
              <Link
                href="/contact"
                className="
                  inline-flex items-center gap-2 rounded-full
                  bg-light-alt dark:bg-dark-alt
                  hover:bg-light-surface dark:hover:bg-dark-surface
                  border border-light-border dark:border-dark-border
                  px-5 py-2.5 text-sm font-semibold
                  text-light-text dark:text-dark-text
                "
              >
                <span>Contact / feedback</span>
              </Link>
            </div>
            <p className="mt-3 text-[11px] text-light-textMuted dark:text-dark-textMuted">
              Questions? Feature ideas? Bug reports? They all help make this better
              for every collector who uses it.
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}

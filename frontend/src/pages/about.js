// src/pages/about.js
"use client";

import React from "react";
import Link from "next/link";
import Layout from "@/components/Layout/Layout";
import {
  FaBell,
  FaBoxOpen,
  FaCamera,
  FaCertificate,
  FaDiscord,
  FaExchangeAlt,
  FaRegFolderOpen,
  FaRegStar,
  FaRegUserCircle,
  FaSearch,
  FaStoreAlt,
  FaUsers,
} from "react-icons/fa";

const DISCORD_INVITE = "https://discord.gg/PRMbMbRE2H";

/* -------------------------------------------------------------------------- */
/* LIVE FEATURES                                                              */
/* -------------------------------------------------------------------------- */

const liveFeatures = [
  {
    icon: <FaSearch />,
    title: "Fast Card Search",
    desc: "Search Pokémon cards by name, set, number, or expansion and quickly find the exact version you mean.",
  },
  {
    icon: <FaRegFolderOpen />,
    title: "Collection Tracking",
    desc: "Add cards to your collection, keep quantities organised, and track what you already own.",
  },
  {
    icon: <FaRegFolderOpen />,
    title: "Digital Binders",
    desc: "Build digital binders for master sets, themes, trades, wishlists, or real physical binder planning.",
  },
  {
    icon: <FaRegStar />,
    title: "Wishlist Tools",
    desc: "Keep chase cards, missing cards, and future pickups visible as your collection grows.",
  },
  {
    icon: <FaStoreAlt />,
    title: "Marketplace",
    desc: "List cards, browse collector listings, and buy from other collectors with wallet, orders, and seller tools built in.",
  },
  {
    icon: <FaExchangeAlt />,
    title: "Collector Trading",
    desc: "Propose, counter, and complete safe collector-to-collector trades with clear workflows and full trade history on your profile.",
  },
  {
    icon: <FaBell />,
    title: "Price Alerts",
    desc: "Get notified when wishlist cards hit a target price, or when something you own moves sharply up or down.",
  },
  {
    icon: <FaRegUserCircle />,
    title: "Public Profiles",
    desc: "Share your collection, binders, trade history, and reputation with other collectors through your profile.",
  },
];

/* -------------------------------------------------------------------------- */
/* ROADMAP                                                                    */
/* -------------------------------------------------------------------------- */

const roadmapItems = [
  {
    title: "Collector Social Feed",
    icon: <FaUsers />,
    status: "In development",
    desc: "Follow other collectors, see new pulls, listings, and completed trades, and keep up with the people whose collections you care about.",
  },
  {
    title: "Pull Tracker",
    icon: <FaBoxOpen />,
    status: "In planning",
    desc: "Log sealed product openings, track pull rates and chase hits over time, and build a real history of your luck pack by pack.",
  },
  {
    title: "Card Scanner",
    icon: <FaCamera />,
    status: "In planning",
    desc: "Add cards to your collection by scanning them with your phone — bulk inventory without typing a single name.",
  },
  {
    title: "Grading Tracker",
    icon: <FaCertificate />,
    status: "In planning",
    desc: "Log graded cards, track PSA and CGC submissions end-to-end, and surface pop report data next to your collection.",
  },
  {
    title: "More TCGs",
    icon: <FaRegStar />,
    status: "Future",
    desc: "Pokémon comes first, with MTG and Disney Lorcana planned as the platform grows.",
  },
];

/* -------------------------------------------------------------------------- */
/* SMALL UI                                                                   */
/* -------------------------------------------------------------------------- */

function Badge({ children }) {
  return (
    <div className="inline-flex rounded-full border border-dark-border bg-dark-surface px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-dark-textMuted">
      {children}
    </div>
  );
}

function PrimaryLink({ href, children, external = false }) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="inline-flex h-12 items-center justify-center rounded-2xl bg-dark-accent px-6 text-sm font-black text-white shadow-xl shadow-dark-accent/20 transition hover:bg-dark-accentLight"
    >
      {children}
    </Link>
  );
}

function SecondaryLink({ href, children, external = false }) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="inline-flex h-12 items-center justify-center rounded-2xl border border-dark-border bg-dark-surface px-6 text-sm font-black text-dark-strong transition hover:border-dark-accent hover:bg-dark-alt"
    >
      {children}
    </Link>
  );
}

function FeatureCard({ feature }) {
  return (
    <article className="rounded-3xl border border-dark-border bg-dark-surface p-6 shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:border-dark-accent/70 hover:shadow-2xl hover:shadow-black/20">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-dark-accent/15 text-2xl text-dark-accentLight">
        {feature.icon}
      </div>

      <h3 className="text-lg font-black text-dark-strong">{feature.title}</h3>

      <p className="mt-3 text-sm leading-6 text-dark-textMuted">
        {feature.desc}
      </p>
    </article>
  );
}

function RoadmapCard({ item }) {
  return (
    <article className="rounded-3xl border border-dashed border-dark-border bg-dark-alt p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dark-border bg-dark-surface text-xl text-dark-accentLight">
          {item.icon}
        </div>

        <span className="rounded-full border border-dark-border bg-dark-surface px-3 py-1 text-xs font-bold text-dark-textMuted">
          {item.status}
        </span>
      </div>

      <h3 className="text-lg font-black text-dark-strong">{item.title}</h3>

      <p className="mt-3 text-sm leading-6 text-dark-textMuted">{item.desc}</p>
    </article>
  );
}

function TimelineStep({ number, title, text }) {
  return (
    <div className="rounded-3xl border border-dark-border bg-dark-surface p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-dark-accent/15 text-sm font-black text-dark-accentLight">
        {number}
      </div>

      <h3 className="text-base font-black text-dark-strong">{title}</h3>

      <p className="mt-3 text-sm leading-6 text-dark-textMuted">{text}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

export default function AboutPage() {
  const seo = {
    title: "About — SixByFive TCG",
    description:
      "SixByFive TCG is a collector-built platform for Pokémon TCG collectors to search cards, track collections, build digital binders, and connect with the community.",
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
          "SixByFive TCG is a modern platform for Pokémon TCG collectors to search cards, track collections, build digital binders, and connect with the community.",
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
      <main className="min-h-screen bg-dark-background text-dark-text">
        {/* ------------------------------------------------------------------ */}
        {/* HERO                                                               */}
        {/* ------------------------------------------------------------------ */}
        <section className="relative isolate overflow-hidden border-b border-dark-border bg-dark-background px-5 py-20 sm:px-7 lg:py-24">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-200px] h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-dark-accent/12 blur-3xl" />
            <div className="absolute bottom-[-260px] right-[-180px] h-[520px] w-[520px] rounded-full bg-purple-500/10 blur-3xl" />

            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)",
                backgroundSize: "56px 56px",
              }}
            />
          </div>

          <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 lg:grid-cols-[1fr_420px] lg:items-center">
            <div>
              <Badge>Built for collectors</Badge>

              <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight text-dark-strong sm:text-5xl lg:text-6xl">
                A collector-built home for your Pokémon cards.
              </h1>

              <p className="mt-6 max-w-3xl text-base leading-8 text-dark-textMuted sm:text-lg">
                SixByFive TCG started from a simple collector problem: keeping a
                real collection organised without relying on spreadsheets,
                screenshots, or scattered notes. It is being built as a proper
                home for searching cards, tracking what you own, building
                digital binders, and planning what comes next.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PrimaryLink href="/">Start free</PrimaryLink>

                <SecondaryLink href={DISCORD_INVITE} external>
                  <span className="inline-flex items-center gap-2">
                    <FaDiscord />
                    Join Discord
                  </span>
                </SecondaryLink>
              </div>

              <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold text-dark-textMuted">
                <Link
                  href="#live-now"
                  className="underline underline-offset-4 transition hover:text-dark-strong"
                >
                  What’s live now
                </Link>

                <Link
                  href="#story"
                  className="underline underline-offset-4 transition hover:text-dark-strong"
                >
                  Why it exists
                </Link>

                <Link
                  href="#roadmap"
                  className="underline underline-offset-4 transition hover:text-dark-strong"
                >
                  Roadmap
                </Link>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-dark-border bg-dark-surface p-6 shadow-2xl shadow-black/30">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-dark-textMuted">
                    The short version
                  </p>
                  <h2 className="mt-1 text-xl font-black text-dark-strong">
                    SixByFive TCG
                  </h2>
                </div>

                <span className="rounded-full bg-dark-accent/15 px-3 py-1 text-xs font-black text-dark-accentLight">
                  Beta
                </span>
              </div>

              <div className="space-y-4 text-sm leading-6 text-dark-textMuted">
                <p>
                  <span className="font-black text-dark-strong">What it is:</span>{" "}
                  a collector platform for tracking cards, building binders, and
                  organising your Pokémon TCG collection.
                </p>

                <p>
                  <span className="font-black text-dark-strong">Who it is for:</span>{" "}
                  collectors who care about sets, binders, wishlists, value, and
                  having a better way to manage everything.
                </p>

                <p>
                  <span className="font-black text-dark-strong">Where it is going:</span>{" "}
                  a collector social feed, pull-rate tracking, camera-based
                  scanning, grading tracking, and support for more TCGs — shaped
                  by user feedback.
                </p>
              </div>
            </aside>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* STORY                                                              */}
        {/* ------------------------------------------------------------------ */}
        <section
          id="story"
          className="scroll-mt-28 bg-dark-background px-5 py-20 sm:px-7"
        >
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <Badge>Why it exists</Badge>

              <h2 className="mt-5 text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
                Built from the way collectors actually organise cards.
              </h2>
            </div>

            <div className="rounded-[2rem] border border-dark-border bg-dark-surface p-6 shadow-xl shadow-black/10 sm:p-8">
              <p className="text-base leading-8 text-dark-textMuted">
                The original idea was simple:{" "}
                <span className="font-black text-dark-strong">
                  what if your digital collection felt more like a real binder?
                </span>{" "}
                That idea grew into card search, collection tracking, digital
                binders, wishlists, and eventually marketplace and trading tools.
              </p>

              <p className="mt-5 text-base leading-8 text-dark-textMuted">
                The aim is not to replace physical collecting. It is to support
                it. SixByFive TCG is designed to sit alongside binders, sleeves,
                top loaders, storage boxes, trades, and chase cards — giving you
                a cleaner way to understand what you have and what you are still
                looking for.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* LIVE NOW                                                           */}
        {/* ------------------------------------------------------------------ */}
        <section
          id="live-now"
          className="scroll-mt-28 bg-dark-background px-5 py-20 sm:px-7"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-3xl">
              <Badge>Available now</Badge>

              <h2 className="mt-5 text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
                What you can do today.
              </h2>

              <p className="mt-4 text-base leading-7 text-dark-textMuted">
                SixByFive TCG is already usable as a collection manager. These
                are the core tools available now.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {liveFeatures.map((feature) => (
                <FeatureCard key={feature.title} feature={feature} />
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* HOW IT FITS                                                        */}
        {/* ------------------------------------------------------------------ */}
        <section className="bg-dark-background px-5 py-20 sm:px-7">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-3xl">
              <Badge>Collector workflow</Badge>

              <h2 className="mt-5 text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
                Designed to sit alongside your real collection.
              </h2>

              <p className="mt-4 text-base leading-7 text-dark-textMuted">
                The goal is to make collection management feel natural, whether
                you are logging a new purchase, planning a binder page, checking
                what you still need, or sharing progress.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <TimelineStep
                number="1"
                title="Search and add cards"
                text="Find cards by name, set, or number, then add them to your collection or wishlist."
              />

              <TimelineStep
                number="2"
                title="Build binders around goals"
                text="Create binders for master sets, themes, trade cards, favourite Pokémon, or real binder planning."
              />

              <TimelineStep
                number="3"
                title="Buy, sell, and trade"
                text="Pick up missing cards from other collectors on the marketplace, or set up safe collector-to-collector trades straight from a profile or binder."
              />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* ROADMAP                                                            */}
        {/* ------------------------------------------------------------------ */}
        <section
          id="roadmap"
          className="scroll-mt-28 bg-dark-background px-5 py-20 sm:px-7"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-3xl">
              <Badge>Roadmap</Badge>

              <h2 className="mt-5 text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
                Where this is going next.
              </h2>

              <p className="mt-4 text-base leading-7 text-dark-textMuted">
                Collection tools, marketplace, and trading are already live. These
                are the pieces still ahead — alerts, smarter capture, deeper
                stats, and support for more TCGs.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {roadmapItems.map((item) => (
                <RoadmapCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* COMMUNITY CTA                                                       */}
        {/* ------------------------------------------------------------------ */}
        <section className="relative overflow-hidden bg-dark-background px-5 py-20 sm:px-7">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-10 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-[#5865F2]/10 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-7xl">
            <div className="rounded-[2rem] border border-dark-border bg-dark-surface p-6 shadow-2xl shadow-black/25 sm:p-8 lg:p-10">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <Badge>Community</Badge>

                  <h2 className="mt-5 text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
                    Built with collectors, not just for them.
                  </h2>

                  <p className="mt-4 max-w-3xl text-base leading-7 text-dark-textMuted">
                    SixByFive TCG is being shaped by real collector feedback.
                    Feature requests, early testing, roadmap discussions, bug
                    reports, and community chat all help guide what gets built
                    next.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <PrimaryLink href={DISCORD_INVITE} external>
                    <span className="inline-flex items-center gap-2">
                      <FaDiscord />
                      Join Discord
                    </span>
                  </PrimaryLink>

                  <SecondaryLink href="/contact">
                    Contact / feedback
                  </SecondaryLink>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
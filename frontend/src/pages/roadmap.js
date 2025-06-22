// /src/pages/roadmap.js
"use client";
import Layout from "@/components/Layout/Layout";
import React from "react";

// ---- Improved Milestone Data ----
const milestones = [
  {
    label: "Q2 2025",
    phase: "Now",
    progress: 2, // All complete
    total: 4,
    features: [
      {
        title: "Collection Management",
        description: "Search, add, and organize your Pokémon cards in digital binders. Track quantities and completion progress.",
        status: "done",
        icon: "🗃️",
      },
      {
        title: "Profile & Wishlist",
        description: "Custom profiles, wishlists, and binder showcase features.",
        status: "done",
        icon: "👤",
      },
      {
        title: "Achievements & Gamification",
        description: "Earn badges for collection milestones, event participation, and trading activity.",
        status: "progress",
        icon: "🏆",
      },
      {
        title: "Binder Customization",
        description: "Themes, covers, and binder stickers to personalize your collection.",
        status: "progress",
        icon: "🎨",
      },
    ],
  },
  {
    label: "Q3 2025",
    phase: "Next",
    progress: 0, // 2/3 features in progress or done
    total: 3,
    features: [
      {
        title: "Basic Trading",
        description: "Direct, secure card-for-card trades with notification system.",
        status: "upcoming",
        icon: "🔄",
      },
      {
        title: "Subscription Tiers",
        description: "Enhanced features and perks for premium users.",
        status: "upcoming",
        icon: "💎",
      },
      {
        title: "Mobile App Beta",
        description: "Native app for iOS & Android. Manage your collection and trade from anywhere.",
        status: "upcoming",
        icon: "📱",
      },
    ],
  },
  {
    label: "Q4 2025",
    phase: "Upcoming",
    progress: 0,
    total: 3,
    features: [
      {
        title: "Marketplace",
        description: "List cards for sale, buy from others, and track purchases. Secure checkout & payment integration.",
        status: "upcoming",
        icon: "🛒",
      },
      {
        title: "Trust & Reputation",
        description: "Reputation system, trade feedback, and safety enhancements for users.",
        status: "upcoming",
        icon: "🔒",
      },
            {
        title: "Trade Automation",
        description: "Royal Mail tracking, address privacy, and automatic trade status updates.",
        status: "upcoming",
        icon: "🚚",
      },
    ],
  },
  {
    label: "2026+",
    phase: "Future",
    progress: 0,
    total: 3,
    features: [
      {
        title: "Multi-TCG Support",
        description: "Expand platform to Magic: The Gathering, Lorcana, and Yu-Gi-Oh!",
        status: "upcoming",
        icon: "🃏",
      },
      {
        title: "Card Scanning (AI)",
        description: "Scan cards with your phone camera and auto-match to database.",
        status: "upcoming",
        icon: "🤖",
      },
    ],
  },
];

// ---- Status Visuals ----
const statusStyles = {
  done: {
    badge: (
      <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 dark:bg-green-900/60 dark:text-green-200 font-semibold px-2 py-0.5 rounded-full text-xs">
        <span>✓</span> Complete
      </span>
    ),
  },
  progress: {
    badge: (
      <span className="inline-flex items-center gap-1 text-yellow-700 bg-yellow-100 dark:bg-yellow-900/60 dark:text-yellow-200 font-semibold px-2 py-0.5 rounded-full text-xs">
        <span className="animate-pulse">⏳</span> In Progress
      </span>
    ),
  },
  upcoming: {
    badge: (
      <span className="inline-flex items-center gap-1 text-blue-700 bg-light-accent/10 dark:bg-dark-accent/10 font-semibold px-2 py-0.5 rounded-full text-xs">
        <span>⏱️</span> Upcoming
      </span>
    ),
  },
};

// ---- Phase Ribbon ----
function PhaseRibbon({ phase }) {
  let color =
    phase === "Now"
      ? "bg-green-600"
      : phase === "Next"
      ? "bg-yellow-400 text-yellow-900"
      : phase === "Upcoming"
      ? "bg-light-accent text-white"
      : "bg-gray-400 text-white";
  return (
    <span className={`absolute -top-5 left-1/2 -translate-x-1/2 text-xs px-3 py-1 font-bold rounded-full shadow ${color} z-10`}>
      {phase}
    </span>
  );
}

export default function RoadmapPage() {
  return (
    <Layout>
      <main className="max-w-8xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-heading font-extrabold mb-4 text-light-accent dark:text-dark-accent text-center">
          Platform Roadmap
        </h1>
        <p className="mb-12 text-lg text-light-textSecondary dark:text-dark-textSecondary text-center max-w-2xl mx-auto">
          Track our progress and see what’s planned for SixByFive TCG. Feature priorities and timeframes are subject to change based on user feedback.
        </p>

        {/* ---- Horizontal Scroll/Timeline ---- */}
        <div className="w-full overflow-x-auto pb-10">
          <div className="flex flex-row md:grid md:grid-cols-4 gap-10 min-w-[800px] md:min-w-0 relative">
            {milestones.map((ms, idx) => (
              <div
                key={ms.label}
                className="flex-1 min-w-[340px] max-w-xs mx-auto md:min-w-0 md:max-w-none relative"
              >
                {/* Phase Ribbon */}
                <PhaseRibbon phase={ms.phase} />

                {/* Quarter Header */}
                <div className="mb-7 mt-8 flex flex-col items-center md:items-start">
                  <span className="inline-block rounded-full px-5 py-2 text-base font-bold bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent shadow">
                    {ms.label}
                  </span>
                  {/* Progress Bar if relevant */}
                  {(ms.progress > 0 && ms.progress < ms.total) && (
                    <div className="w-full mt-2 bg-light-border dark:bg-dark-border h-2 rounded">
                      <div
                        className="h-2 rounded bg-yellow-400 dark:bg-yellow-600 transition-all"
                        style={{ width: `${(ms.progress / ms.total) * 100}%` }}
                      />
                    </div>
                  )}
                  {(ms.progress === ms.total) && (
                    <div className="w-full mt-2 bg-green-500 h-2 rounded" />
                  )}
                </div>
                {/* Features */}
                <div className="flex flex-col gap-7">
                  {ms.features.map((feat, j) => (
                    <div
                      key={feat.title}
                      className="relative bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl p-5 shadow hover:shadow-lg transition"
                    >
                      {/* Icon */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 md:left-6 md:top-6 md:-translate-x-0 text-3xl bg-white dark:bg-dark-background rounded-full shadow-md border border-light-border dark:border-dark-border p-2">
                        {feat.icon}
                      </div>
                      <div className="pt-7 md:pt-0 md:pl-16">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-semibold font-heading text-light-text dark:text-dark-text">{feat.title}</span>
                          {statusStyles[feat.status].badge}
                        </div>
                        <div className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
                          {feat.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {/* --- Timeline arrow (optional) --- */}
            <div className="hidden md:block absolute top-10 left-0 right-0 h-4 pointer-events-none">
              <svg height="24" width="100%" className="absolute left-0 right-0 w-full" style={{ zIndex: -1 }}>
                <line x1="7%" y1="10" x2="93%" y2="10" stroke="#2963FF33" strokeWidth="4" strokeDasharray="12,8" />
              </svg>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center text-sm text-light-textMuted dark:text-dark-textMuted">
          💡 Want to suggest a feature?{" "}
          <a
            href="mailto:support@sixbyfive.co.uk"
            className="text-light-accent dark:text-dark-accent underline"
          >
            Email us
          </a>
          {" or "}
          <a
            href="https://discord.gg/pAnGVBb2Dc"
            className="text-light-accent dark:text-dark-accent underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            join the Discord
          </a>
        </div>
      </main>
    </Layout>
  );
}

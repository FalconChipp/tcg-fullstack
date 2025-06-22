"use client";
import React from "react";

const features = [
  {
    icon: "📦",
    title: "Collection Tracking",
    desc: "Add, manage, and view every card you own, including set and quantity.",
  },
  {
    icon: "🗂️",
    title: "Digital Binders",
    desc: "Organise your cards into custom digital binders—just like in real life.",
  },
  {
    icon: "💡",
    title: "Wishlist",
    desc: "Keep an eye on cards you want to add next with your personal wishlist.",
  },
  {
    icon: "🌐",
    title: "Public Profiles",
    desc: "Every collector gets a profile and public showcase of their collection.",
  },
];

const comingSoon = [
  {
    icon: "🏷️",
    title: "Marketplace",
    desc: "Buy and sell cards safely with trusted payments and UK-focused features.",
  },
  {
    icon: "🔄",
    title: "Trading",
    desc: "Trade cards securely with other collectors—tracked shipping and address privacy built in.",
  },
  {
    icon: "📈",
    title: "Price Alerts",
    desc: "Get notified when the value of your cards changes, or set up custom price alerts.",
  },
  {
    icon: "🏆",
    title: "Achievements",
    desc: "Unlock digital badges as you complete sets and grow your collection.",
  },
];

export default function KeyFeatures() {
  return (
    <section className="py-12 px-2 sm:px-4 bg-light-background dark:bg-dark-background transition-colors">
      <h2 className="text-3xl font-bold text-center mb-10 text-light-text dark:text-dark-text drop-shadow">
        Features
      </h2>

      {/* MVP Features */}
      <div className="flex flex-col md:flex-row flex-wrap justify-center gap-6 max-w-5xl mx-auto mb-12">
        {features.map((f, i) => (
          <div
            key={i}
            className="
              flex-1 flex flex-col items-center 
              bg-light-surface dark:bg-dark-surface
              rounded-2xl p-7
              shadow-lg transition-transform hover:-translate-y-1 hover:shadow-2xl
              border border-light-border dark:border-dark-border
              min-w-[220px] max-w-xs
            "
          >
            <div className="text-4xl md:text-5xl mb-3">{f.icon}</div>
            <div className="font-semibold text-lg md:text-xl text-light-accent dark:text-dark-accent mb-2 text-center">{f.title}</div>
            <div className="text-light-textSecondary dark:text-dark-textSecondary text-base text-center">{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Coming Soon Features */}
      <h3 className="text-xl font-bold text-center mb-5 text-light-textMuted dark:text-dark-textMuted tracking-wide">
        Coming Soon
      </h3>
      <div className="flex flex-col md:flex-row flex-wrap justify-center gap-6 max-w-5xl mx-auto">
        {comingSoon.map((f, i) => (
          <div
            key={i}
            className="
              flex-1 flex flex-col items-center
              bg-light-alt dark:bg-dark-alt
              rounded-2xl p-7
              shadow-md opacity-70
              border border-light-border dark:border-dark-border
              min-w-[220px] max-w-xs
              grayscale
              cursor-not-allowed
            "
            aria-disabled="true"
          >
            <div className="text-4xl md:text-5xl mb-3">{f.icon}</div>
            <div className="font-semibold text-lg md:text-xl text-light-textMuted dark:text-dark-textMuted mb-2 text-center">{f.title}</div>
            <div className="text-light-textMuted dark:text-dark-textMuted text-base text-center">{f.desc}</div>
            <div className="mt-2 text-xs text-light-textMuted dark:text-dark-textMuted uppercase tracking-wider">Coming Soon</div>
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";
import React, { useState } from "react";

const faqs = [
  {
    q: "What does the marketplace fee mean?",
    a: "When you sell a card, SixByFive takes a small percentage of the sale price as a platform fee. Free users pay 7%, Collector 5%, Elite Collector 3%, and Vendor 2%. The fee is deducted from your earnings when a buyer confirms receipt — you never pay upfront.",
  },
  {
    q: "Can I try before I subscribe?",
    a: "Yes — the Free plan has no time limit and includes collection tracking, up to 3 binders, card search, wishlist, and full marketplace access. You only need to upgrade if you want lower fees, more listings, or power tools.",
  },
  {
    q: "What happens to my listings and binders if I downgrade?",
    a: "Your existing listings and binders stay intact. If you exceed the lower tier's limits, you won't be able to create new ones until you're under the limit — but nothing gets deleted.",
  },
  {
    q: "Is billing monthly or yearly?",
    a: "Both. Monthly billing gives you flexibility to cancel anytime. Yearly billing saves you around 17% — you pay for 10 months and get 12.",
  },
  {
    q: "How do I cancel?",
    a: "You can cancel anytime from your Account → Subscription page. You keep access until the end of your current billing period, then you move to the Free plan automatically.",
  },
  {
    q: "Are there fees on top of the subscription?",
    a: "No hidden fees. The subscription covers your lower marketplace rate. Shipping label costs (if applicable) are separate and are either deducted from your sale proceeds or charged to the buyer at checkout, depending on your listing settings.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We use Stripe for all payments, so you can pay with any major credit or debit card. Apple Pay and Google Pay are also supported where available.",
  },
];

export default function SubscriptionFAQ() {
  const [open, setOpen] = useState(null);

  return (
    <section className="max-w-2xl mx-auto px-4 py-16">
      <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-light-primary dark:text-dark-primary">
        Frequently asked questions
      </h2>
      <div className="space-y-3">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className={`rounded-2xl border transition-all duration-200 bg-light-surface dark:bg-dark-surface
                ${isOpen
                  ? "border-light-accent/50 dark:border-dark-accent/50 shadow-sm"
                  : "border-light-border dark:border-dark-border"}`}
            >
              <button
                className="w-full text-left flex items-center justify-between gap-4 px-5 py-4 focus:outline-none"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
              >
                <span className={`text-sm font-semibold ${isOpen ? "text-light-accent dark:text-dark-accent" : "text-light-text dark:text-dark-text"}`}>
                  {f.q}
                </span>
                <svg
                  className={`w-4 h-4 shrink-0 text-light-textMuted dark:text-dark-textMuted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${isOpen ? "max-h-48 pb-4" : "max-h-0"}`}
              >
                <p className="px-5 text-sm text-light-textSecondary dark:text-dark-textSecondary leading-relaxed">
                  {f.a}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

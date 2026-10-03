"use client";
import React, { useState } from "react";

// Changed: fee copy uses the same loaded plans as the cards, preventing stale tier names.
const buildFaqs = (plans) => {
  const fees = plans
    .filter((plan) => plan.platformFeePercent != null && Number.isFinite(Number(plan.platformFeePercent)))
    .map((plan) => `${plan.name} ${Number(plan.platformFeePercent)}%`)
    .join(", ");
  return [
  {
    q: "What does the marketplace fee mean?",
    a: `A marketplace platform fee applies to completed sales, in addition to any paid subscription. ${fees ? `Current plan rates: ${fees}.` : "See the plan cards for the current rates."} Compare the fee and subscription together when choosing a plan.`,
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
    a: "Both. Select Monthly or Yearly above to see the current prices. Yearly plans show the total billed for the year and the equivalent monthly cost. Any saving is calculated from the displayed monthly and yearly prices.",
  },
  {
    q: "How do I cancel?",
    a: "You can cancel anytime from your Account → Subscription page. You keep access until the end of your current billing period, then you move to the Free plan automatically.",
  },
  {
    q: "Are there fees on top of the subscription?",
    a: "Yes. A paid subscription lowers your marketplace platform fee; it does not remove it. The plan's percentage still applies to completed sales. Shipping label costs, where applicable, are separate. Review the amounts shown at checkout before paying.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We use Stripe for all payments, so you can pay with any major credit or debit card. Apple Pay and Google Pay are also supported where available.",
  },
];
};

export default function SubscriptionFAQ({ plans = [] }) {
  const [open, setOpen] = useState(null);
  const faqs = buildFaqs(plans);

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

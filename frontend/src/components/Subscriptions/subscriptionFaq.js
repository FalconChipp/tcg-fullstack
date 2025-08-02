"use client";
import React, { useState } from "react";

const faqs = [
  {
    q: "Can I subscribe or upgrade yet?",
    a: "Not yet—subscriptions are coming soon! All features are free right now, and upgrades will be available in the next release.",
  },
  {
    q: "How many binders can I create on the free tier?",
    a: "Free tier users can create up to 3 digital binders. Paid plans (coming soon) will allow unlimited binders.",
  },
  {
    q: "Will I lose my collection if I never upgrade?",
    a: "Never. Your cards and binders stay on your account, even if you never subscribe.",
  },
  {
    q: "Will new features come to all tiers?",
    a: "Most big features roll out to all users, but subscribers may get early access or special tools.",
  },
  {
    q: "How do I change or cancel my subscription?",
    a: "Upgrading/downgrading will be instant and self-service once subscriptions launch.",
  },
];

export default function SubscriptionFAQ() {
  const [open, setOpen] = useState(null);

  return (
    <section className="py-12 px-2 sm:px-4 bg-light-background dark:bg-dark-background transition-colors">
      <h2 className="text-3xl font-bold text-center mb-10 text-light-text dark:text-dark-text drop-shadow">
        Subscription FAQ
      </h2>
      <div className="max-w-2xl mx-auto space-y-4">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className={`
                rounded-2xl border transition-all
                bg-light-surface dark:bg-dark-surface
                ${isOpen
                  ? "border-light-accent dark:border-dark-accent shadow-xl"
                  : "border-light-border dark:border-dark-border"}
                ${isOpen ? "ring-2 ring-light-accent dark:ring-dark-accent" : "hover:border-light-accent dark:hover:border-dark-accent"}
                ${isOpen ? "z-10" : ""}
              `}
              style={{
                position: isOpen ? 'relative' : undefined
              }}
            >
              <button
                className={`
                  w-full text-left flex justify-between items-center px-6 py-4
                  font-semibold text-lg focus:outline-none focus:ring-2 rounded-2xl
                  transition-colors
                  ${isOpen
                    ? "text-light-accent dark:text-dark-accent bg-light-alt dark:bg-dark-alt"
                    : "text-light-text dark:text-dark-text bg-transparent"}
                `}
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-body-${i}`}
              >
                <span>{f.q}</span>
                <span className="ml-4 text-xl">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {/* Animated answer */}
              <div
                id={`faq-body-${i}`}
                className={`
                  px-6 text-light-textSecondary dark:text-dark-textSecondary overflow-hidden
                  transition-all duration-300 ease-in-out
                  ${isOpen ? "max-h-40 opacity-100 pb-4" : "max-h-0 opacity-0 pb-0"}
                `}
                style={{
                  maxHeight: isOpen ? "400px" : "0px",
                  opacity: isOpen ? 1 : 0,
                }}
              >
                {f.a}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

"use client";
import React from "react";
import { FaCheckCircle, FaMinus } from "react-icons/fa";

// ---- PLAN AND FEATURE DATA ----
const plans = [
  {
    name: "Free",
    color: "border-gray-300 dark:border-gray-700",
    highlight: false,
    cta: null,
  },
  {
    name: "Collection",
    color: "border-light-accent dark:border-dark-accent",
    highlight: true, // Most Popular
    cta: { text: "Upgrade", href: "/subscriptions?upgrade=collection" },
  },
  {
    name: "Business",
    color: "border-yellow-400 dark:border-yellow-500",
    highlight: false,
    cta: { text: "Upgrade to Business", href: "/subscriptions?upgrade=business" },
  },
];

const features = [
  { label: "Unlimited Collection Size", tiers: [true, true, true] },
  { label: "Digital Binders", tiers: [true, true, true] },
  { label: "Advanced Analytics", tiers: [false, true, true] },
  { label: "Unlimited Binders", tiers: [false, true, true] },
  { label: "Marketplace Listings", tiers: ["5 per month", "50 per month", "Unlimited"] },
  { label: "Lower Marketplace Fees", tiers: ["2.5%", "1.5%", "1%"] },
  { label: "Early Access Features", tiers: [false, true, true] },
  { label: "Business Tools (Invoices, VAT, etc.)", tiers: [false, false, true] },
  { label: "Priority Support", tiers: [false, false, true] },
];

// ---- COMPONENT ----
export default function SubscriptionComparisonTable() {
  return (
    <section className="max-w-7xl mx-auto my-16 px-2">
      <h3 className="text-2xl font-bold text-center mb-7 text-light-primary dark:text-dark-primary">
        Compare Subscription Tiers
      </h3>
      <div className="overflow-x-auto">
        <table
          className="
            min-w-full 
            bg-light-surface dark:bg-dark-surface
            rounded-2xl shadow-xl border border-light-border dark:border-dark-border
            overflow-hidden
          "
          style={{ borderCollapse: "separate", borderSpacing: 0 }}
        >
          {/* ---- HEADER ---- */}
          <thead>
            <tr>
              <th className="w-1/3 py-5 rounded-tl-2xl"></th>
              {plans.map((plan, idx) => (
                <th
                  key={plan.name}
                  className={`
                    py-5 px-3 text-lg font-bold text-center align-bottom
                    ${plan.highlight ? "text-light-accent dark:text-dark-accent" : "text-light-text dark:text-dark-text"}
                    ${plan.highlight ? "bg-light-alt dark:bg-dark-alt" : ""}
                    border-b-2 ${plan.color}
                    transition
                    ${idx === plans.length - 1 ? "rounded-tr-2xl" : ""}
                  `}
                >
                  <span className="inline-block mb-1">{plan.name}</span>
                  {plan.highlight && (
                    <div className="text-xs font-semibold bg-light-accent dark:bg-dark-accent text-white dark:text-dark-surface px-3 py-1 rounded-xl mt-2 shadow inline-block">
                      Most Popular
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* ---- FEATURES ---- */}
          <tbody>
            {features.map((f, i) => (
              <tr key={f.label} className={i % 2 === 1 ? "bg-light-alt dark:bg-dark-alt/60" : ""}>
                <td className="py-4 px-3 font-medium text-light-text dark:text-dark-text text-left">
                  {f.label}
                </td>
                {plans.map((plan, colIdx) => {
                  const value = f.tiers[colIdx];
                  let display;
                  if (value === true) {
                    display = (
                      <FaCheckCircle className="text-xl mx-auto text-light-accent dark:text-dark-accent" />
                    );
                  } else if (value === false) {
                    display = (
                      <FaMinus className="text-lg mx-auto text-gray-400 dark:text-gray-600" />
                    );
                  } else if (typeof value === "string") {
                    display = (
                      <span className="text-base font-semibold block text-center">{value}</span>
                    );
                  }
                  return (
                    <td
                      key={plan.name + i}
                      className={`
                        py-4 px-3 text-center align-middle border-l border-light-border dark:border-dark-border
                        ${plan.highlight ? "bg-light-alt/80 dark:bg-dark-alt/80 font-bold" : ""}
                      `}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          {/* ---- CTA BUTTONS ---- */}
          <tfoot>
            <tr>
              <td className="py-5 px-3 bg-transparent border-none rounded-bl-2xl"></td>
              {plans.map((plan, idx) => (
                <td
                  key={plan.name + "-cta"}
                  className={`
                    py-5 px-3 text-center border-l border-light-border dark:border-dark-border 
                    ${plan.highlight ? "bg-light-alt/80 dark:bg-dark-alt/80" : ""}
                    ${idx === plans.length - 1 ? "rounded-br-2xl" : ""}
                  `}
                >
                  {plan.cta ? (
                    <a
                      href={plan.cta.href}
                      className={`
                        inline-flex items-center justify-center
                        px-7 py-3 rounded-full font-bold text-base
                        shadow-lg
                        transition-all duration-150
                        focus:outline-none
                        bg-light-accent dark:bg-dark-accent
                        hover:bg-light-accentLight dark:hover:bg-dark-accentLight
                        text-light-surface dark:text-dark-surface
                        border-2 border-light-accent dark:border-dark-accent
                        hover:border-light-accentLight dark:hover:border-dark-accentLight
                        whitespace-nowrap
                      `}
                    >
                      {plan.cta.text}
                    </a>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-600 font-semibold">Current Plan</span>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
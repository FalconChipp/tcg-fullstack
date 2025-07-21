"use client";

import React from "react";
import { FaCheckCircle } from "react-icons/fa";

/**
 * SubscriptionCard
 * - Displays a single subscription plan, styled for SixByFive TCG
 * - Props:
 *   - plan: The plan object ({ id, name, description, price, interval, features[] })
 *   - currentPlanId: The plan ID the user currently has (for "Current Plan" state)
 *   - onSelect: (planId) => void, called when user selects/changes plan
 */
export default function SubscriptionCard({ plan, currentPlanId, onSelect }) {
  const isActive = plan.id === currentPlanId;

  return (
    <div
      className={`
        bg-light-surface dark:bg-dark-surface
        border border-light-border dark:border-dark-border
        rounded-2xl shadow-xl
        p-7 flex flex-col h-full
        transition
        ${isActive ? "ring-2 ring-light-accent dark:ring-dark-accent" : ""}
      `}
      tabIndex={0}
      aria-label={isActive ? `${plan.name} (current plan)` : plan.name}
    >
      <div className="mb-2 flex items-center gap-3">
        <span className="text-2xl font-heading font-bold text-light-primary dark:text-dark-primary">
          {plan.name}
        </span>
        {isActive && (
          <FaCheckCircle className="ml-1 text-lg text-green-600 dark:text-green-400" title="Current Plan" />
        )}
      </div>
      <div className="mb-3 text-base text-light-textSecondary dark:text-dark-textSecondary">{plan.description}</div>
      <ul className="flex-1 mb-5 mt-1 space-y-2">
        {(plan.features || []).map((feature, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2 text-[15px] text-light-text dark:text-dark-text"
          >
            <FaCheckCircle className="mt-0.5 text-light-accent dark:text-dark-accent text-sm" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mb-4 flex items-center">
        <span className="text-2xl font-bold text-light-primary dark:text-dark-primary">
          {plan.price ? `£${plan.price.toFixed(2)}` : "Free"}
        </span>
        {plan.interval && (
          <span className="ml-2 text-sm text-light-textSecondary dark:text-dark-textSecondary">
            /{plan.interval}
          </span>
        )}
      </div>
      <button
        className={`
          w-full py-3 rounded-xl font-bold
          ${isActive
            ? "bg-light-accent dark:bg-dark-accent text-white cursor-not-allowed opacity-80"
            : "bg-light-primary hover:bg-light-accent dark:bg-dark-primary dark:hover:bg-dark-accent text-white transition"
          }
          shadow
        `}
        type="button"
        onClick={() => !isActive && onSelect(plan.id)}
        disabled={isActive}
        aria-disabled={isActive}
      >
        {isActive ? "Current Plan" : "Select"}
      </button>
    </div>
  );
}

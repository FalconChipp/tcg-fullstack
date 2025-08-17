// components/Subscriptions/subscriptionPlans.js
"use client";
import React from "react";

/**
 * CHANGED: Single badge component so every chip looks identical
 */
function PlanBadge({ text }) {
  if (!text) return null;
  return (
    <span
      className="
        text-[11px] uppercase tracking-wide
        px-2.5 py-1 rounded-full
        border border-light-border dark:border-dark-border
        bg-light-alt dark:bg-dark-alt
        text-light-textMuted dark:text-dark-textMuted
        select-none
        whitespace-nowrap
      "
    >
      {text}
    </span>
  );
}

/**
 * CHANGED: Small helper so all dots share the exact same size
 */
function StatusDot({ state = "live" }) {
  const color =
    state === "live"
      ? "bg-green-500"
      : state === "beta"
      ? "bg-amber-500"
      : "bg-light-textMuted dark:bg-dark-textMuted"; // 'soon'
  return (
    <span
      className={`h-3 w-3 rounded-full ${color} block`} // CHANGED: fixed 12px dot
      aria-hidden="true"
    />
  );
}

/**
 * CHANGED: Feature row uses a fixed two-column grid so dots + text line up perfectly
 */
function FeatureItem({ label, state }) {
  return (
    <li className="grid grid-cols-[14px_1fr] gap-2 items-start">
      <div className="mt-[3px] shrink-0">
        <StatusDot state={state} />
      </div>
      <span className="text-sm leading-6 text-light-textSecondary dark:text-dark-textSecondary">
        {label}{" "}
        {state === "soon" && (
          <em className="text-xs text-light-textMuted dark:text-dark-textMuted">
            (coming soon)
          </em>
        )}
        {state === "beta" && (
          <em className="text-xs text-light-textMuted dark:text-dark-textMuted">
            (beta)
          </em>
        )}
      </span>
    </li>
  );
}

/**
 * Props:
 * - currentPlanId?: string
 * - token?: string
 * - plansData: Array<{
 *     id, name, priceText, badge?, comingSoon?: boolean,
 *     highlight, cta, features:[{label,state:'live'|'beta'|'soon'}]
 *   }>
 * - onSelect?: (planId) => void   // optional; falls back to a simple redirect stub
 */
export default function SubscriptionPlans({
  currentPlanId,
  token,
  plansData = [],
  onSelect,
}) {
  const handleSelect = (planId) => {
    if (onSelect) return onSelect(planId);
    // TODO: wire to your Stripe/checkout when live
    const target = `/checkout?plan=${encodeURIComponent(planId)}${
      token ? `&token=${encodeURIComponent(token)}` : ""
    }`;
    if (typeof window !== "undefined") window.location.href = target;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
      {plansData.map((plan) => {
        const isCurrent = plan.id === currentPlanId;
        const disabled = plan.comingSoon && !isCurrent;

        return (
          <div
            key={plan.id}
            className="
              h-full
              rounded-2xl border border-light-border dark:border-dark-border
              bg-light-surface dark:bg-dark-surface
              shadow-lg ring-1 ring-black/5 dark:ring-black/20
              p-7 flex flex-col
            "
          >
            {/* CHANGED: Header uses grid so the badge stays aligned even when the title wraps */}
            <div className="grid grid-cols-[1fr_auto] items-start gap-3 mb-3">
              <h3 className="text-xl font-bold text-light-primary dark:text-dark-primary leading-tight">
                {plan.name}
              </h3>
              <PlanBadge text={plan.badge || (plan.comingSoon ? "Coming soon" : null)} />
            </div>

            {/* Price */}
            <div className="text-2xl md:text-3xl font-extrabold text-light-primary dark:text-dark-primary">
              {plan.priceText}
            </div>

            {/* CHANGED: content grows to push CTA to the bottom */}
            <div className="flex-1 flex flex-col">
              <p className="mt-2 text-sm leading-6 text-light-textSecondary dark:text-dark-textSecondary">
                {plan.highlight}
              </p>

              {/* CHANGED: features now use FeatureItem with fixed dot box + consistent line-height */}
              <ul className="mt-4 space-y-2">
                {plan.features.map((f, idx) => (
                  <FeatureItem key={idx} label={f.label} state={f.state} />
                ))}
              </ul>
            </div>

            {/* CTA row — identical across all cards and bottom-aligned */}
            <div className="mt-6 pt-4 border-t border-light-border dark:border-dark-border">
              {isCurrent ? (
                <button
                  disabled
                  className="
                    w-full px-4 py-2 rounded-xl text-base font-semibold
                    bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text
                    border border-light-border dark:border-dark-border
                    cursor-default
                  "
                >
                  Current plan
                </button>
              ) : disabled ? (
                <button
                  disabled
                  aria-disabled="true"
                  title="Coming soon"
                  className="
                    w-full px-4 py-2 rounded-xl text-base font-semibold
                    bg-light-alt dark:bg-dark-alt
                    text-light-textMuted dark:text-dark-textMuted
                    border border-light-border dark:border-dark-border
                    cursor-not-allowed
                  "
                >
                  Coming soon
                </button>
              ) : (
                <button
                  onClick={() => handleSelect(plan.id)}
                  className="
                    w-full px-4 py-2 rounded-xl text-base font-semibold
                    bg-light-accent hover:bg-light-accentLight text-white
                    dark:bg-dark-accent dark:hover:bg-dark-accentLight dark:text-white
                    border-2 border-light-accent dark:border-dark-accent
                    transition
                  "
                >
                  {plan.cta}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

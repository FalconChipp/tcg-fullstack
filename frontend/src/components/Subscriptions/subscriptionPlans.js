"use client";

import React, { useEffect, useState } from "react";
import { fetchSubscriptionPlans, startSubscriptionCheckout } from "@/utils/subscriptionsApi";
import SubscriptionCard from "./subscriptionCard";

/**
 * SubscriptionPlans
 * - Shows all subscription plans as a responsive grid of SubscriptionCard
 * - Handles plan selection and redirects to Stripe checkout
 * - Follows SixByFive TCG UI conventions (heading, accent, loading, error)
 */
export default function SubscriptionPlans({ currentPlanId, token }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSubscriptionPlans()
      .then(setPlans)
      .catch(() => setError("Failed to load subscription plans. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  // Handler for selecting a plan (start Stripe checkout)
  const handleSelect = async (planId) => {
    setSubmitting(true);
    setError(null);
    try {
      const url = await startSubscriptionCheckout(planId, token);
      // Redirect to Stripe checkout or dummy URL
      window.location.href = url;
    } catch {
      setError("Could not start checkout. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- UI ---

  return (
    <div className="w-full">
      <h2 className="text-2xl md:text-3xl font-bold mb-7 text-light-primary dark:text-dark-primary text-center">
        Choose Your Plan
      </h2>

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="
                bg-light-surface dark:bg-dark-surface
                border border-light-border dark:border-dark-border
                rounded-2xl shadow-xl p-7 h-[350px] flex flex-col
                animate-pulse
              "
            >
              <div className="w-2/3 h-7 bg-light-alt dark:bg-dark-alt rounded mb-4" />
              <div className="w-full h-4 bg-light-alt dark:bg-dark-alt rounded mb-2" />
              <div className="w-full h-4 bg-light-alt dark:bg-dark-alt rounded mb-2" />
              <div className="w-1/2 h-4 bg-light-alt dark:bg-dark-alt rounded mb-4" />
              <div className="flex-1" />
              <div className="w-1/2 h-8 bg-light-alt dark:bg-dark-alt rounded mb-2" />
              <div className="w-full h-12 bg-light-accent/20 dark:bg-dark-accent/20 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Error Message */}
      {!loading && error && (
        <div className="
          mt-6 px-4 py-3 rounded-lg text-center font-medium border
          bg-red-100 text-red-800 border-red-300
          dark:bg-red-900/70 dark:text-red-100 dark:border-red-700
        ">
          {error}
        </div>
      )}

      {/* Plans Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
          {plans.map((plan) => (
            <SubscriptionCard
              key={plan.id}
              plan={plan}
              currentPlanId={currentPlanId}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {/* Submitting State */}
      {submitting && (
        <div className="
          mt-8 px-4 py-3 rounded-lg text-center font-semibold border
          bg-blue-50 text-blue-700 border-blue-200
          dark:bg-blue-900/60 dark:text-blue-100 dark:border-blue-600
        ">
          Redirecting to checkout...
        </div>
      )}
    </div>
  );
}

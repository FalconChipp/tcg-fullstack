"use client";

import React, { useEffect, useState } from "react";
import { fetchSubscriptionPlans } from "@/utils/subscriptionsApi";
import SubscriptionCard from "./subscriptionCard";

/**
 * SubscriptionPlans
 * - Shows all subscription plans as a responsive grid of SubscriptionCard
 * - Handles plan selection (disabled until launch)
 */
export default function SubscriptionPlans({ currentPlanId }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSubscriptionPlans()
      .then(setPlans)
      .catch(() => setError("Failed to load subscription plans. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full">
      <h2 className="text-2xl md:text-3xl font-bold mb-7 text-light-primary dark:text-dark-primary text-center">
        Choose Your Plan <span className="ml-2 text-base bg-light-accent dark:bg-dark-accent text-white px-3 py-1 rounded-xl">Coming Soon</span>
      </h2>
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
      {!loading && error && (
        <div className="
          mt-6 px-4 py-3 rounded-lg text-center font-medium border
          bg-red-100 text-red-800 border-red-300
          dark:bg-red-900/70 dark:text-red-100 dark:border-red-700
        ">
          {error}
        </div>
      )}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
          {plans.map((plan) => (
            <SubscriptionCard
              key={plan.id}
              plan={plan}
              currentPlanId={currentPlanId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

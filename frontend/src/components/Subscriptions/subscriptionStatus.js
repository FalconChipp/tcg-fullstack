// /components/subscriptions/SubscriptionStatus.js

import React from "react";

export default function SubscriptionStatus({ subscription }) {
  if (!subscription) return null;
  return (
    <div className="p-4 mb-6 rounded-lg bg-gray-100 border border-gray-200">
      <h2 className="text-lg font-semibold">Your Subscription</h2>
      <div>
        <span className="font-bold">{subscription.plan.name}</span>
        {subscription.status === "active" && (
          <span className="ml-2 text-green-600">(Active)</span>
        )}
        {subscription.status !== "active" && (
          <span className="ml-2 text-red-600">({subscription.status})</span>
        )}
      </div>
      {subscription.renewsAt && (
        <div className="text-sm text-gray-600">Renews at: {new Date(subscription.renewsAt).toLocaleDateString()}</div>
      )}
    </div>
  );
}

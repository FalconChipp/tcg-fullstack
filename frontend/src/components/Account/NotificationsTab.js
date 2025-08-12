import React from "react";

export default function NotificationsTab({ user }) {
  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl px-6 py-8 shadow">
      <h2 className="text-xl font-bold mb-6 text-light-primary dark:text-dark-primary">
        Notification Settings
      </h2>
      <form className="space-y-4">
        <div>
          <label className="font-semibold">Email Notifications</label>
          <div className="flex items-center gap-3 mt-2">
            <input type="checkbox" id="marketplaceEmails" defaultChecked />
            <label htmlFor="marketplaceEmails">Marketplace updates</label>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <input type="checkbox" id="tradingEmails" defaultChecked />
            <label htmlFor="tradingEmails">Trading updates</label>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <input type="checkbox" id="siteNewsEmails" />
            <label htmlFor="siteNewsEmails">Site news/promotions</label>
          </div>
        </div>
        <div>
          <label className="font-semibold">Push Notifications</label>
          <div className="flex items-center gap-3 mt-2">
            <input type="checkbox" id="pushMarketplace" />
            <label htmlFor="pushMarketplace">Enable push notifications (coming soon)</label>
          </div>
        </div>
        <button
          type="submit"
          className="bg-light-accent dark:bg-dark-accent text-white dark:text-black px-6 py-2.5 rounded-xl font-bold hover:bg-light-primary dark:hover:bg-dark-primary transition"
        >
          Save Preferences
        </button>
      </form>
    </div>
  );
}

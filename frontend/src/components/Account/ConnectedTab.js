import React, { useState } from "react";
import StatusMessage from "@/components/UI/StatusMessage";

// Example props for user OAuth info:
// user.oauthProvider: 'google' or 'discord' or null
// user.discordId: string | null
// user.googleId: string | null

export default function ConnectedAccountsTab({ user, token }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(null);

  // ---- Dummy link/unlink functions: replace with real mutations ----
  async function handleLink(provider) {
    setLoading(provider);
    setStatus(null);
    // Example: Show OAuth flow or popup
    setTimeout(() => {
      setLoading(null);
      setStatus({ type: "success", msg: `Linked with ${provider}!` });
      // refetch user/account info after real linking!
    }, 1000);
  }
  async function handleUnlink(provider) {
    setLoading(provider);
    setStatus(null);
    // Example: Confirm unlink, then call GraphQL mutation
    setTimeout(() => {
      setLoading(null);
      setStatus({ type: "success", msg: `Unlinked from ${provider}.` });
      // refetch user/account info after real unlink!
    }, 1000);
  }

  // You can expand this array if you add more providers in future
  const providers = [
    {
      id: "discord",
      name: "Discord",
      connected: !!user.discordId,
    },
    {
      id: "google",
      name: "Google",
      connected: !!user.googleId,
    },
  ];

  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl px-6 py-8 shadow">
      <h2 className="text-xl font-bold mb-6 text-light-primary dark:text-dark-primary">
        Connected Accounts
      </h2>
      <ul className="divide-y divide-light-border dark:divide-dark-border">
        {providers.map((provider) => (
          <li key={provider.id} className="flex items-center justify-between py-5">
            <div className="flex items-center gap-3">
              {/* Add icons if you want */}
              <span className="font-semibold">{provider.name}</span>
              <span className={provider.connected ? "text-green-600" : "text-light-textMuted dark:text-dark-textMuted"}>
                {provider.connected ? "Connected" : "Not Connected"}
              </span>
            </div>
            {provider.connected ? (
              <button
                type="button"
                className="px-5 py-2 rounded-lg font-bold bg-light-error/80 dark:bg-dark-error/80 text-white dark:text-black hover:bg-light-error dark:hover:bg-dark-error transition disabled:opacity-50"
                disabled={loading === provider.id}
                onClick={() => handleUnlink(provider.id)}
              >
                {loading === provider.id ? "Unlinking..." : "Unlink"}
              </button>
            ) : (
              <button
                type="button"
                className="px-5 py-2 rounded-lg font-bold bg-light-accent dark:bg-dark-accent text-white dark:text-black hover:bg-light-primary dark:hover:bg-dark-primary transition disabled:opacity-50"
                disabled={loading === provider.id}
                onClick={() => handleLink(provider.id)}
              >
                {loading === provider.id ? "Linking..." : "Link"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {status && (
        <div className="mt-4">
          <StatusMessage
            type={status.type}
            message={status.msg}
            onClose={() => setStatus(null)}
          />
        </div>
      )}
    </div>
  );
}

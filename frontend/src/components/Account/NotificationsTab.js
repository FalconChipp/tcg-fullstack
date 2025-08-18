// src/components/Account/NotificationsTab.js
"use client";

import React, { useEffect, useMemo, useState } from "react";
import StatusMessage from "@/components/UI/StatusMessage";

/* ---------- small helpers ---------- */
const LS_KEY = "sixbyfive:notif_prefs:v1";

const defaultPrefs = {
  email: {
    marketplace: true,
    trading: true,
    news: false,
  },
  inapp: {
    sales: true,        // e.g., "Card sold!", offers, etc.
    messages: true,     // DMs / chat
    priceAlerts: true,  // price change alerts
    system: true,       // releases, maintenance
  },
  dnd: {
    enabled: false,
    start: "22:00",
    end: "07:00",
  },
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultPrefs;
    const parsed = JSON.parse(raw);
    // merge with defaults to survive future keys
    return {
      ...defaultPrefs,
      ...parsed,
      email: { ...defaultPrefs.email, ...(parsed.email || {}) },
      inapp: { ...defaultPrefs.inapp, ...(parsed.inapp || {}) },
      dnd: { ...defaultPrefs.dnd, ...(parsed.dnd || {}) },
    };
  } catch {
    return defaultPrefs;
  }
}

function savePrefs(prefs) {
  localStorage.setItem(LS_KEY, JSON.stringify(prefs));
}

/* Accessible toggle (button-based, keyboard friendly) */
function Toggle({ checked, onChange, disabled = false, label, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition 
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${checked ? "bg-light-accent dark:bg-dark-accent" : "bg-light-border dark:bg-dark-border"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition
          ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

/* ---------- main component ---------- */
export default function NotificationsTab({ user }) {
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [savedPrefs, setSavedPrefs] = useState(defaultPrefs);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = loadPrefs();
    setPrefs(p);
    setSavedPrefs(p);
  }, []);

  const dirty = useMemo(() => JSON.stringify(prefs) !== JSON.stringify(savedPrefs), [prefs, savedPrefs]);

  function setEmail(key, val) {
    setPrefs((p) => ({ ...p, email: { ...p.email, [key]: val } }));
  }
  function setInapp(key, val) {
    setPrefs((p) => ({ ...p, inapp: { ...p.inapp, [key]: val } }));
  }
  function setDnd(key, val) {
    setPrefs((p) => ({ ...p, dnd: { ...p.dnd, [key]: val } }));
  }

  async function handleSave(e) {
    e?.preventDefault?.();
    setSaving(true);
    setStatus(null);
    try {
      // Persist locally
      savePrefs(prefs);

      // OPTIONAL: Wire to API (example GraphQL shape)
      // if (process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT && token) {
      //   await fetch(process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT, {
      //     method: "POST",
      //     headers: {
      //       "Content-Type": "application/json",
      //       Authorization: `Bearer ${token}`,
      //     },
      //     body: JSON.stringify({
      //       query: `mutation UpdateNotifications($prefs: NotificationPrefsInput!) {
      //         updateNotificationPreferences(prefs: $prefs)
      //       }`,
      //       variables: { prefs },
      //     }),
      //   }).then(r => r.json()).then(j => {
      //     if (j.errors?.length) throw new Error(j.errors[0].message);
      //   });
      // }

      setSavedPrefs(prefs);
      setStatus({ type: "success", message: "Notification preferences saved." });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Could not save preferences." });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    const p = loadPrefs();
    setPrefs(p);
    setSavedPrefs(p);
    setStatus({ type: "success", message: "Reverted to last saved preferences." });
  }

  return (
    <div className="space-y-6">
      {/* Header / summary */}
      <section className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-6 md:p-7 shadow">
        <h2 className="text-xl font-bold mb-2 text-light-primary dark:text-dark-primary">
          Notification Settings
        </h2>
        <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
          We’ll only send essential account emails (security, receipts) regardless of your preferences.
        </p>
        <p className="mt-2 text-sm">
          Signed in as:{" "}
          <span className="font-semibold">{user?.email || "—"}</span>{" "}
          <a
            href="/account?tab=security"
            className="ml-2 text-light-accent dark:text-dark-accent underline underline-offset-2"
          >
            Change email
          </a>
        </p>
      </section>

      {/* Email preferences */}
      <section className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-6 md:p-7 shadow">
        <h3 className="text-lg font-bold mb-4">Email notifications</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PrefRow
            title="Marketplace updates"
            desc="Sales, offers, and listing reminders."
            control={
              <Toggle
                checked={prefs.email.marketplace}
                onChange={(v) => setEmail("marketplace", v)}
                label="Marketplace emails"
              />
            }
          />
          <PrefRow
            title="Trading updates"
            desc="Trade requests and status changes."
            control={
              <Toggle
                checked={prefs.email.trading}
                onChange={(v) => setEmail("trading", v)}
                label="Trading emails"
              />
            }
          />
          <PrefRow
            title="News & promotions"
            desc="Product updates and occasional offers."
            control={
              <Toggle
                checked={prefs.email.news}
                onChange={(v) => setEmail("news", v)}
                label="News emails"
              />
            }
          />
        </div>
      </section>

      {/* In-app preferences */}
      <section className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-6 md:p-7 shadow">
        <h3 className="text-lg font-bold mb-4">In-app notifications</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PrefRow
            title="Sales & marketplace"
            desc="Card sold, offer received, checkout issues."
            control={
              <Toggle
                checked={prefs.inapp.sales}
                onChange={(v) => setInapp("sales", v)}
                label="In-app sales"
              />
            }
          />
          <PrefRow
            title="Messages"
            desc="Direct messages and replies."
            control={
              <Toggle
                checked={prefs.inapp.messages}
                onChange={(v) => setInapp("messages", v)}
                label="In-app messages"
              />
            }
          />
          <PrefRow
            title="Price alerts"
            desc="Tracked card price changes."
            control={
              <Toggle
                checked={prefs.inapp.priceAlerts}
                onChange={(v) => setInapp("priceAlerts", v)}
                label="In-app price alerts"
              />
            }
          />
          <PrefRow
            title="System"
            desc="Service updates and maintenance."
            control={
              <Toggle
                checked={prefs.inapp.system}
                onChange={(v) => setInapp("system", v)}
                label="In-app system"
              />
            }
          />
        </div>
      </section>

      {/* Push (coming soon) + Quiet hours */}
      <section className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-6 md:p-7 shadow">
        <h3 className="text-lg font-bold mb-4">Delivery & quiet hours</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Push — coming soon */}
          <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Browser push notifications</div>
                <div className="text-sm text-light-textMuted dark:text-dark-textMuted">
                  Coming soon
                </div>
              </div>
              <Toggle checked={false} onChange={() => {}} disabled label="Push notifications (coming soon)" />
            </div>
          </div>

          {/* Quiet hours */}
          <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-semibold">Do Not Disturb</div>
                <div className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
                  Mute in-app notifications during these hours.
                </div>
              </div>
              <Toggle
                checked={prefs.dnd.enabled}
                onChange={(v) => setDnd("enabled", v)}
                label="Enable quiet hours"
              />
            </div>

            <div className={`grid grid-cols-2 gap-3 ${!prefs.dnd.enabled ? "opacity-50" : ""}`}>
              <div>
                <label className="block text-xs mb-1 text-light-textMuted dark:text-dark-textMuted">
                  Start
                </label>
                <input
                  type="time"
                  value={prefs.dnd.start}
                  disabled={!prefs.dnd.enabled}
                  onChange={(e) => setDnd("start", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
                />
              </div>
              <div>
                <label className="block text-xs mb-1 text-light-textMuted dark:text-dark-textMuted">
                  End
                </label>
                <input
                  type="time"
                  value={prefs.dnd.end}
                  disabled={!prefs.dnd.enabled}
                  onChange={(e) => setDnd("end", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="bg-light-accent dark:bg-dark-accent text-white px-6 py-2.5 rounded-xl font-bold hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={!dirty || saving}
          className="px-6 py-2.5 rounded-xl font-bold border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt disabled:opacity-50"
        >
          Revert changes
        </button>
      </div>

      {status && (
        <div className="mt-2">
          <StatusMessage
            type={status.type || (status.message?.toLowerCase().includes("error") ? "error" : "success")}
            message={status.message || ""}
            onClose={() => setStatus(null)}
          />
        </div>
      )}
    </div>
  );
}

/* row layout for each preference */
function PrefRow({ title, desc, control }) {
  return (
    <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
          {desc}
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

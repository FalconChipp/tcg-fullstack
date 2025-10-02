// src/components/Account/NotificationsTab.js
// REWRITE: wire to backend GraphQL (myNotificationPrefs / setNotificationPrefs)
// - Preserves previous styling + layout
// - Keeps local dirty state and StatusMessage
// - Removes localStorage-only logic; still falls back to defaults if API fails

"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import StatusMessage from "@/components/UI/StatusMessage";
import { AuthContext } from "@/components/Auth/AuthProvider";
import { fetchPrefs, setPrefs } from "@/graphql/notifications";

const defaultPrefs = {
  inappEnabled: true,
  emailEnabled: true,
  pushEnabled: false,
  digest: "instant",
  quietStart: null,
  quietEnd: null,
};

export default function NotificationsTab() {
  const { token } = useContext(AuthContext);
  const [prefs, setPrefsState] = useState(defaultPrefs);
  const [initial, setInitial] = useState(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const dirty = useMemo(() => JSON.stringify(prefs) !== JSON.stringify(initial), [prefs, initial]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setStatus(null);
      try {
        if (!token) {
          setLoading(false);
          return;
        }
        const server = await fetchPrefs({ token });
        const merged = { ...defaultPrefs, ...(server || {}) };
        if (!cancelled) {
          setPrefsState(merged);
          setInitial(merged);
        }
      } catch (e) {
        console.error('Load prefs failed', e);
        setStatus({ type: 'error', message: e.message || 'Failed to load notification preferences' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  function setBool(key, val) {
    setPrefsState((p) => ({ ...p, [key]: !!val }));
  }
  function setDigest(val) {
    setPrefsState((p) => ({ ...p, digest: val }));
  }
  function setQuiet(key, val) {
    setPrefsState((p) => ({ ...p, [key]: val || null }));
  }

  async function handleSave(e) {
    e?.preventDefault?.();
    if (!token) return;
    setSaving(true);
    setStatus(null);
    try {
      const ok = await setPrefs({ token, input: { ...prefs } });
      if (ok) {
        setInitial(prefs);
        setStatus({ type: 'success', message: 'Notification preferences saved' });
      } else {
        setStatus({ type: 'error', message: 'Failed to save preferences' });
      }
    } catch (e) {
      setStatus({ type: 'error', message: e.message || 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {status ? (
        <StatusMessage type={status.type} message={status.message} onClose={() => setStatus(null)} />
      ) : null}

      {/* Channel toggles */}
      <section className="rounded-xl border border-light-border dark:border-dark-border p-5 bg-light-surface dark:bg-dark-surface">
        <h2 className="text-lg font-semibold mb-1">Channels</h2>
        <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary mb-4">
          Choose how you want to receive alerts and updates.
        </p>
        <div className="space-y-3">
          <PrefRow
            title="In-app notifications"
            desc="Show alerts in the notification bell."
            control={(
              <input
                type="checkbox"
                className="toggle-checkbox"
                checked={!!prefs.inappEnabled}
                onChange={(e) => setBool('inappEnabled', e.target.checked)}
                disabled={loading || saving}
              />
            )}
          />
          <PrefRow
            title="Email"
            desc="Send an email for important alerts."
            control={(
              <input
                type="checkbox"
                className="toggle-checkbox"
                checked={!!prefs.emailEnabled}
                onChange={(e) => setBool('emailEnabled', e.target.checked)}
                disabled={loading || saving}
              />
            )}
          />
          <PrefRow
            title="Push (beta)"
            desc="Enable web push for real-time alerts (coming soon)."
            control={(
              <input
                type="checkbox"
                className="toggle-checkbox"
                checked={!!prefs.pushEnabled}
                onChange={(e) => setBool('pushEnabled', e.target.checked)}
                disabled={loading || saving}
              />
            )}
          />
        </div>
      </section>

      {/* Delivery */}
      <section className="rounded-xl border border-light-border dark:border-dark-border p-5 bg-light-surface dark:bg-dark-surface">
        <h2 className="text-lg font-semibold mb-1">Delivery</h2>
        <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary mb-4">
          Send alerts instantly or as a periodic digest.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="digest"
              value="instant"
              checked={prefs.digest === "instant"}
              onChange={() => setDigest("instant")}
              disabled={loading || saving}
            />
            <span>Instant</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="digest"
              value="daily"
              checked={prefs.digest === "daily"}
              onChange={() => setDigest("daily")}
              disabled={loading || saving}
            />
            <span>Daily</span>
          </label>
        </div>
      </section>

      {/* Quiet hours */}
      <section className="rounded-xl border border-light-border dark:border-dark-border p-5 bg-light-surface dark:bg-dark-surface">
        <h2 className="text-lg font-semibold mb-1">Quiet hours</h2>
        <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary mb-4">
          Suppress non-critical alerts between these local times.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-sm mb-1">Start</div>
            <input
              type="time"
              value={prefs.quietStart || ""}
              onChange={(e) => setQuiet("quietStart", e.target.value)}
              disabled={loading || saving}
              className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
            />
          </div>
          <div>
            <div className="text-sm mb-1">End</div>
            <input
              type="time"
              value={prefs.quietEnd || ""}
              onChange={(e) => setQuiet("quietEnd", e.target.value)}
              disabled={loading || saving}
              className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
            />
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!dirty || saving || loading}
          className="bg-light-accent dark:bg-dark-accent text-white px-4 py-2 rounded-lg font-semibold hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
        <button
          onClick={() => setPrefsState(initial)}
          disabled={!dirty || saving}
          className="px-4 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text hover:bg-light-surface dark:hover:bg-dark-surface transition disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      <style jsx>{`
        /* Maintain same checkbox aesthetics as elsewhere */
        .toggle-checkbox {
          width: 1.25rem; height: 1.25rem;
          accent-color: var(--accent, #7c3aed);
        }
      `}</style>
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

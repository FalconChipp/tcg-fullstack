// src/components/Account/NotificationsTab.js

"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import { devError } from "@/utils/devLog";
import StatusMessage from "@/components/UI/StatusMessage";
import { AuthContext } from "@/components/Auth/AuthProvider";
import { fetchPrefs, setPrefs } from "@/graphql/notifications";
import { enableWebPush, disableWebPush, isPushSupported, getCurrentPushSubscription } from "@/utils/webPush";

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
  const [pushBusy, setPushBusy] = useState(false);

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
        const [server, browserSub] = await Promise.all([
          fetchPrefs({ token }),
          getCurrentPushSubscription(),
        ]);
        // If there's no active browser subscription, override pushEnabled to false
        // so the toggle reflects the true state regardless of stored pref
        const merged = {
          ...defaultPrefs,
          ...(server || {}),
          pushEnabled: !!(server?.pushEnabled && browserSub),
        };
        if (!cancelled) {
          setPrefsState(merged);
          setInitial(merged);
        }
      } catch (e) {
        devError('Load prefs failed', e);
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

  async function handlePushToggle(enabled) {
    if (!isPushSupported()) {
      setStatus({ type: 'error', message: 'Push notifications are not supported in this browser.' });
      return;
    }
    setPushBusy(true);
    setStatus(null);
    try {
      if (enabled) {
        await enableWebPush(token);
        setBool('pushEnabled', true);
        setStatus({ type: 'success', message: 'Browser push notifications enabled.' });
      } else {
        await disableWebPush(token);
        setBool('pushEnabled', false);
        setStatus({ type: 'success', message: 'Browser push notifications disabled.' });
      }
    } catch (e) {
      devError('Push toggle failed', e);
      const msg = e.message?.includes('denied')
        ? 'Notification permission was denied. Please allow notifications in your browser settings.'
        : (e.message || 'Failed to update push notification settings.');
      setStatus({ type: 'error', message: msg });
    } finally {
      setPushBusy(false);
    }
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
      // pushEnabled is managed by handlePushToggle (requires browser permission flow)
      // but we still persist its current value along with the other prefs
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
      <section className="rounded-[10px] border border-vault-border p-5 bg-vault-surface">
        <h2 className="text-lg font-semibold mb-1">Channels</h2>
        <p className="text-sm text-vault-textSecondary mb-4">
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
            title="Browser push"
            desc={
              !isPushSupported()
                ? "Not supported in this browser."
                : "Receive real-time alerts even when the tab is closed."
            }
            control={(
              <input
                type="checkbox"
                className="toggle-checkbox"
                checked={!!prefs.pushEnabled}
                onChange={(e) => handlePushToggle(e.target.checked)}
                disabled={loading || saving || pushBusy || !isPushSupported()}
              />
            )}
          />
        </div>
      </section>

      {/* Delivery */}
      <section className="rounded-[10px] border border-vault-border p-5 bg-vault-surface">
        <h2 className="text-lg font-semibold mb-1">Delivery</h2>
        <p className="text-sm text-vault-textSecondary mb-4">
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
      <section className="rounded-[10px] border border-vault-border p-5 bg-vault-surface">
        <h2 className="text-lg font-semibold mb-1">Quiet hours</h2>
        <p className="text-sm text-vault-textSecondary mb-4">
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
              className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-surface"
            />
          </div>
          <div>
            <div className="text-sm mb-1">End</div>
            <input
              type="time"
              value={prefs.quietEnd || ""}
              onChange={(e) => setQuiet("quietEnd", e.target.value)}
              disabled={loading || saving}
              className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-surface"
            />
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!dirty || saving || loading}
          className="bg-vault-accent text-white px-4 py-2 rounded-[6px] font-semibold hover:bg-vault-accentHover transition disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
        <button
          onClick={() => setPrefsState(initial)}
          disabled={!dirty || saving}
          className="px-4 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text hover:bg-vault-surface dark:hover:bg-vault-surface transition disabled:opacity-50"
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
    <div className="rounded-[10px] border border-vault-border bg-vault-raised p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-vault-textSecondary">
          {desc}
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

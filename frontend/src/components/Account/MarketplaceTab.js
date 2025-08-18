// src/components/Account/MarketplaceTab.js
"use client";

import React, { useEffect, useMemo, useState } from "react";
import StatusMessage from "@/components/UI/StatusMessage";

/* =========================================================
   CHANGED/ADDED:
   - Structured sections: Seller profile, Payout (coming soon),
     Shipping profiles, Vacation mode, Trade rules, Blocked users
   - Accessible toggles and radios, consistent card UI
   - Local persistence via localStorage (swap to API later)
   - Clear "Coming soon" disabled actions where backend is needed
   ========================================================= */

const LS_KEY = "sixbyfive:marketplace_prefs:v1";

const defaultState = (user) => ({
  seller: {
    displayName: user?.username || "",
    shopNote: "",
  },
  payout: {
    stripeConnected: false, // backend required
  },
  shipping: {
    defaultProfile: "standard_uk",
    profiles: [
      { id: "standard_uk", name: "UK Standard (2–3 days)", price: 1.99, eta: "2–3 days", tracked: false },
      { id: "uk_tracked", name: "UK Tracked 24/48", price: 3.99, eta: "1–2 days", tracked: true },
      { id: "intl_tracked", name: "International Tracked", price: 9.99, eta: "5–9 days", tracked: true },
    ],
  },
  vacation: {
    enabled: false,
    endDate: "",
    autoResume: false,
    message: "Thanks for your interest — my shop is on vacation and will reopen soon!",
  },
  trade: {
    allowOffers: true,
    minValue: 5, // £
    allowPWE: false,
    acceptFrom: "uk_only", // 'uk_only' | 'uk_eu' | 'worldwide'
  },
  blocked: {
    users: [], // list of usernames
  },
});

function loadState(user) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState(user);
    const parsed = JSON.parse(raw);
    // Merge to survive future keys
    const d = defaultState(user);
    return {
      ...d,
      ...parsed,
      seller: { ...d.seller, ...(parsed.seller || {}) },
      payout: { ...d.payout, ...(parsed.payout || {}) },
      shipping: {
        ...d.shipping,
        ...(parsed.shipping || {}),
        profiles: (parsed.shipping?.profiles || d.shipping.profiles),
      },
      vacation: { ...d.vacation, ...(parsed.vacation || {}) },
      trade: { ...d.trade, ...(parsed.trade || {}) },
      blocked: { ...d.blocked, ...(parsed.blocked || {}) },
    };
  } catch {
    return defaultState(user);
  }
}

function saveState(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

/* ---------- Small UI primitives to keep code tidy ---------- */
function Card({ title, subtitle, children, tone, className = "" }) {
  const toneBorder =
    tone === "danger"
      ? "border-red-400/50"
      : tone === "brand"
      ? "border-light-accent/50 dark:border-dark-accent/50"
      : "border-light-border dark:border-dark-border";
  const toneBg =
    tone === "muted"
      ? "bg-light-alt dark:bg-dark-alt"
      : "bg-light-surface dark:bg-dark-surface";
  return (
    <section className={`rounded-2xl ${toneBg} border ${toneBorder} p-6 md:p-7 shadow ${className}`}>
      {title && (
        <div className="mb-3">
          <h3 className="text-lg font-bold text-light-primary dark:text-dark-primary">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-sm text-light-textSecondary dark:text-dark-textSecondary">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label, id, disabled }) {
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
      title={label}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition
        ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition ${className}`}
    />
  );
}

function Select({ className = "", ...props }) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition ${className}`}
    />
  );
}

function SmallBadge({ children, tone = "brand" }) {
  const style =
    tone === "soon"
      ? "bg-light-textMuted/15 text-light-textMuted dark:bg-dark-textMuted/15 dark:text-dark-textMuted"
      : "bg-light-accent text-white dark:bg-dark-accent dark:text-black";
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${style}`}>
      {children}
    </span>
  );
}

/* ============================
   MAIN TAB
   ============================ */
export default function MarketplaceTab({ user, token }) {
  const [state, setState] = useState(() => loadState(user));
  const [saved, setSaved] = useState(() => loadState(user));
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  // derive
  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(saved),
    [state, saved]
  );

  useEffect(() => {
    // If user changes (rare on this page), ensure seller displayName defaults
    if (!state.seller.displayName && user?.username) {
      setState((s) => ({ ...s, seller: { ...s.seller, displayName: user.username } }));
      setSaved((s) => ({ ...s, seller: { ...s.seller, displayName: user.username } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  // actions
  function onSave() {
    setSaving(true);
    try {
      // TODO: Replace with API call when backend is ready.
      saveState(state);
      setSaved(state);
      setStatus({ type: "success", msg: "Marketplace preferences saved." });
    } catch (err) {
      setStatus({ type: "error", msg: err.message || "Could not save preferences." });
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    const s = loadState(user);
    setState(s);
    setSaved(s);
    setStatus({ type: "success", msg: "Reverted to last saved preferences." });
  }

  // UI helpers
  const fmtPrice = (n) => `£${Number(n).toFixed(2)}`;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card
        title="Marketplace & Trading Settings"
        subtitle="Configure your shop details, shipping defaults, vacation mode, and trading rules. Some tools require backend integration and are marked as Coming soon."
      />

      {/* Seller & payout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Seller profile">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Display name</label>
              <Input
                value={state.seller.displayName}
                onChange={(e) =>
                  setState((s) => ({ ...s, seller: { ...s.seller, displayName: e.target.value } }))
                }
                placeholder="How your shop name appears"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Shop note (optional)</label>
              <textarea
                value={state.seller.shopNote}
                onChange={(e) =>
                  setState((s) => ({ ...s, seller: { ...s.seller, shopNote: e.target.value } }))
                }
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition"
                placeholder="E.g., Shipping days, grading notes, or a short welcome."
              />
            </div>
          </div>
        </Card>

        <Card title="Payouts" subtitle="Connect Stripe to get paid for sales." tone="muted">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-semibold">
                Stripe status:{" "}
                <span className={`${state.payout.stripeConnected ? "text-green-600" : "text-light-textMuted dark:text-dark-textMuted"}`}>
                  {state.payout.stripeConnected ? "Connected" : "Not connected"}
                </span>
              </div>
              <div className="text-light-textSecondary dark:text-dark-textSecondary">
                Required to receive payouts from marketplace sales.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SmallBadge tone="soon">Coming soon</SmallBadge>
              <button
                type="button"
                disabled
                className="px-4 py-2 rounded-lg font-semibold border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt opacity-60 cursor-not-allowed"
                title="Coming soon"
              >
                Connect Stripe
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Shipping profiles */}
      <Card
        title="Default shipping"
        subtitle="Choose your default shipping profile for new listings. Manage profiles below."
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {state.shipping.profiles.map((p) => {
            const isDefault = state.shipping.defaultProfile === p.id;
            return (
              <div
                key={p.id}
                className={`rounded-xl border p-4 ${isDefault ? "border-light-accent dark:border-dark-accent bg-light-accent/5 dark:bg-dark-accent/10" : "border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
                      {p.tracked ? "Tracked • " : ""}{p.eta}
                    </div>
                  </div>
                  {isDefault && <SmallBadge>Default</SmallBadge>}
                </div>
                <div className="mt-3 text-2xl font-extrabold">{fmtPrice(p.price)}</div>
                {!isDefault && (
                  <div className="mt-3">
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg font-semibold bg-light-accent dark:bg-dark-accent text-white dark:text-black hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition"
                      onClick={() => setState((s) => ({ ...s, shipping: { ...s.shipping, defaultProfile: p.id } }))}
                    >
                      Set as default
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Manage (coming soon) */}
        <div className="mt-4 flex items-center gap-3">
          <SmallBadge tone="soon">Coming soon</SmallBadge>
          <button
            type="button"
            disabled
            className="px-4 py-2 rounded-lg font-semibold border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface opacity-60 cursor-not-allowed"
            title="Coming soon"
          >
            Add shipping profile
          </button>
          <button
            type="button"
            disabled
            className="px-4 py-2 rounded-lg font-semibold border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface opacity-60 cursor-not-allowed"
            title="Coming soon"
          >
            Edit profiles
          </button>
        </div>
      </Card>

      {/* Vacation mode & Trade rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Vacation mode" subtitle="Pause new orders and show a shop banner while you’re away.">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">Enable vacation mode</div>
            <Toggle
              checked={state.vacation.enabled}
              onChange={(v) => setState((s) => ({ ...s, vacation: { ...s.vacation, enabled: v } }))}
              label="Enable vacation mode"
            />
          </div>

          <div className={`space-y-3 ${!state.vacation.enabled ? "opacity-50" : ""}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1 text-light-textMuted dark:text-dark-textMuted">End date (optional)</label>
                <Input
                  type="date"
                  value={state.vacation.endDate}
                  disabled={!state.vacation.enabled}
                  onChange={(e) =>
                    setState((s) => ({ ...s, vacation: { ...s.vacation, endDate: e.target.value } }))
                  }
                />
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="flex-1">
                  <label className="block text-xs mb-1 text-light-textMuted dark:text-dark-textMuted">
                    Auto-resume on end date
                  </label>
                  <div className="h-10 flex items-center">
                    <Toggle
                      checked={state.vacation.autoResume}
                      onChange={(v) => setState((s) => ({ ...s, vacation: { ...s.vacation, autoResume: v } }))}
                      label="Auto resume"
                      disabled={!state.vacation.enabled}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1 text-light-textMuted dark:text-dark-textMuted">Banner message</label>
              <textarea
                rows={3}
                disabled={!state.vacation.enabled}
                className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt"
                value={state.vacation.message}
                onChange={(e) =>
                  setState((s) => ({ ...s, vacation: { ...s.vacation, message: e.target.value } }))
                }
              />
            </div>
          </div>
        </Card>

        <Card title="Default trade rules" subtitle="We’ll use these as defaults when you start a new trade.">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Allow trade offers</div>
              <Toggle
                checked={state.trade.allowOffers}
                onChange={(v) => setState((s) => ({ ...s, trade: { ...s.trade, allowOffers: v } }))}
                label="Allow trade offers"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Minimum trade value</label>
              <div className="flex items-center gap-2">
                <span>£</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={state.trade.minValue}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      trade: { ...s.trade, minValue: Math.max(0, Number(e.target.value || 0)) },
                    }))
                  }
                  className="max-w-[140px]"
                />
              </div>
              <p className="text-xs text-light-textMuted dark:text-dark-textMuted mt-1">
                Trades below this value will be auto-declined.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="font-semibold">Allow PWE (Plain White Envelope)</div>
              <Toggle
                checked={state.trade.allowPWE}
                onChange={(v) => setState((s) => ({ ...s, trade: { ...s.trade, allowPWE: v } }))}
                label="Allow PWE"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Accept trades from</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: "uk_only", label: "UK only" },
                  { id: "uk_eu", label: "UK + EU" },
                  { id: "worldwide", label: "Worldwide" },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`rounded-lg border px-3 py-2 text-sm cursor-pointer
                      ${state.trade.acceptFrom === opt.id
                        ? "border-light-accent dark:border-dark-accent bg-light-accent/5 dark:bg-dark-accent/10"
                        : "border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt"}`}
                  >
                    <input
                      type="radio"
                      name="acceptFrom"
                      value={opt.id}
                      checked={state.trade.acceptFrom === opt.id}
                      onChange={() => setState((s) => ({ ...s, trade: { ...s.trade, acceptFrom: opt.id } }))}
                      className="mr-2 accent-light-accent dark:accent-dark-accent"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Blocked users */}
      <Card title="Blocked users" subtitle="Users on this list can’t message you or initiate trades.">
        <BlockedUsers
          users={state.blocked.users}
          onAdd={(username) =>
            setState((s) => ({
              ...s,
              blocked: { ...s.blocked, users: Array.from(new Set([...s.blocked.users, username])) },
            }))
          }
          onRemove={(username) =>
            setState((s) => ({
              ...s,
              blocked: { ...s.blocked, users: s.blocked.users.filter((u) => u !== username) },
            }))
          }
        />
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="bg-light-accent dark:bg-dark-accent text-white px-6 py-2.5 rounded-xl font-bold hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={!dirty || saving}
          className="px-6 py-2.5 rounded-xl font-bold border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt disabled:opacity-50"
        >
          Revert
        </button>
      </div>

      {status && (
        <div className="mt-2">
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

/* ---------- Blocked users subcomponent ---------- */
function BlockedUsers({ users, onAdd, onRemove }) {
  const [val, setVal] = useState("");

  function add() {
    const v = (val || "").trim();
    if (!v) return;
    onAdd(v);
    setVal("");
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Username to block"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1"
        />
        <button
          type="button"
          onClick={add}
          className="px-4 py-2 rounded-lg font-semibold bg-light-accent dark:bg-dark-accent text-white dark:text-black hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition"
        >
          Block
        </button>
      </div>
      {users.length === 0 ? (
        <div className="text-sm text-light-textMuted dark:text-dark-textMuted">No blocked users.</div>
      ) : (
        <ul className="divide-y divide-light-border dark:divide-dark-border rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt">
          {users.map((u) => (
            <li key={u} className="flex items-center justify-between px-3 py-2">
              <span className="font-medium">{u}</span>
              <button
                type="button"
                className="text-sm px-3 py-1 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface hover:bg-light-alt dark:hover:bg-dark-alt"
                onClick={() => onRemove(u)}
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// src/components/Account/MarketplaceTab.js
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Wallet, Store, Truck, Palmtree, ArrowLeftRight,
  UserX, CheckCircle2, AlertCircle,
  Loader2, ExternalLink,
} from "lucide-react";

/* ─── GQL / API helper ───────────────────────────────────────────────────────── */

import { gqlFetch } from "@/utils/apiClient";
const gql = (token, query, variables = {}) => gqlFetch(query, variables, token);

const SELLER_STATUS_QUERY = `
  query SellerStatus {
    sellerStatus { connected complete url }
    myWallet(limit: 1) { balance currency }
    myCapabilities { platformFeePercent maxActiveListings }
    sellerAddress { name line1 line2 city postcode country phone email }
    myDeliveryAddress { address1 address2 city postcode state country }
  }
`;

const UPDATE_SELLER_ADDRESS = `
  mutation UpdateSellerAddress($input: SellerAddressInput!) {
    updateSellerAddress(input: $input)
  }
`;

const LS_KEY = "sixbyfive:marketplace_prefs:v2";

function loadPrefs(user) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      seller:   { displayName: user?.username || "", shopNote: "", ...(parsed.seller || {}) },
      shipping: {
        defaultProfile: "standard_uk",
        profiles: [
          { id: "standard_uk",  name: "UK Standard",          price: 1.99, eta: "2–3 days", tracked: false },
          { id: "uk_tracked",   name: "UK Tracked 24/48",     price: 3.99, eta: "1–2 days", tracked: true  },
          { id: "intl_tracked", name: "International Tracked", price: 9.99, eta: "5–9 days", tracked: true  },
        ],
        ...(parsed.shipping || {}),
        profiles: parsed.shipping?.profiles || [
          { id: "standard_uk",  name: "UK Standard",          price: 1.99, eta: "2–3 days", tracked: false },
          { id: "uk_tracked",   name: "UK Tracked 24/48",     price: 3.99, eta: "1–2 days", tracked: true  },
          { id: "intl_tracked", name: "International Tracked", price: 9.99, eta: "5–9 days", tracked: true  },
        ],
      },
      vacation: {
        enabled: false, endDate: "", autoResume: false,
        message: "My shop is on vacation and will reopen soon — thanks for your patience!",
        ...(parsed.vacation || {}),
      },
      trade: {
        allowOffers: true, minValue: 5, allowPWE: false, acceptFrom: "uk_only",
        ...(parsed.trade || {}),
      },
      blocked: { users: [], ...(parsed.blocked || {}) },
    };
  } catch {
    return loadPrefs.__defaults(user);
  }
}
loadPrefs.__defaults = (user) => ({
  seller:   { displayName: user?.username || "", shopNote: "" },
  shipping: { defaultProfile: "standard_uk", profiles: [
    { id: "standard_uk",  name: "UK Standard",          price: 1.99, eta: "2–3 days", tracked: false },
    { id: "uk_tracked",   name: "UK Tracked 24/48",     price: 3.99, eta: "1–2 days", tracked: true  },
    { id: "intl_tracked", name: "International Tracked", price: 9.99, eta: "5–9 days", tracked: true  },
  ]},
  vacation: { enabled: false, endDate: "", autoResume: false, message: "My shop is on vacation — back soon!" },
  trade:    { allowOffers: true, minValue: 5, allowPWE: false, acceptFrom: "uk_only" },
  blocked:  { users: [] },
});

/* ─── Primitives ─────────────────────────────────────────────────────────────── */

function SectionCard({ title, subtitle, icon: Icon, children, accent = false }) {
  return (
    <div className={`rounded-2xl border ${accent ? "border-light-accent/30 dark:border-dark-accent/30" : "border-light-border dark:border-dark-border"} bg-light-surface dark:bg-dark-surface overflow-hidden`}>
      <div className={`px-6 py-4 border-b border-light-border dark:border-dark-border flex items-center gap-3 ${accent ? "bg-light-accent/5 dark:bg-dark-accent/5" : "bg-light-alt/50 dark:bg-dark-alt/50"}`}>
        {Icon && <Icon className={`w-4.5 h-4.5 shrink-0 ${accent ? "text-light-accent dark:text-dark-accent" : "text-light-textMuted dark:text-dark-textMuted"}`} />}
        <div>
          <h3 className="text-sm font-bold text-light-text dark:text-dark-text">{title}</h3>
          {subtitle && <p className="text-xs text-light-textMuted dark:text-dark-textMuted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition shrink-0
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        ${checked ? "bg-light-accent dark:bg-dark-accent" : "bg-light-border dark:bg-dark-border"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition
        ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-light-text dark:text-dark-text">{label}</label>
      {hint && <p className="text-xs text-light-textMuted dark:text-dark-textMuted">{hint}</p>}
      {children}
    </div>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-sm focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50 transition ${className}`}
    />
  );
}

function Textarea({ className = "", ...props }) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-sm focus:outline-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50 transition resize-none ${className}`}
    />
  );
}

function RowToggle({ label, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-light-border/50 dark:border-dark-border/50 last:border-0">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {description && <p className="text-xs text-light-textMuted dark:text-dark-textMuted mt-0.5">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}


/* ─── Payout section ─────────────────────────────────────────────────────────── */

function PayoutsSection({ walletBalance, walletCurrency, token }) {
  const bal = walletBalance != null
    ? `£${Number(walletBalance).toFixed(2)}`
    : "—";

  return (
    <SectionCard
      icon={Wallet}
      title="Payouts"
      subtitle="How you receive earnings from sales"
    >
      {/* Model explanation */}
      <div className="rounded-xl bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border p-4 mb-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">No Stripe account needed to sell</p>
            <p className="text-xs text-light-textSecondary dark:text-dark-textSecondary mt-1 leading-relaxed">
              When a buyer confirms receipt, your earnings (sale price minus platform fee) are credited
              directly to your SixByFive wallet. No external account setup required.
            </p>
          </div>
        </div>
      </div>

      {/* Current balance */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-light-textMuted dark:text-dark-textMuted uppercase tracking-wide font-semibold mb-1">
            Wallet balance
          </p>
          <p className="text-3xl font-black text-light-text dark:text-dark-text">{bal}</p>
          <p className="text-xs text-light-textMuted dark:text-dark-textMuted mt-1">
            Available to spend or withdraw
          </p>
        </div>
        <Link
          href="/account?tab=wallet"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-light-border dark:border-dark-border hover:bg-light-alt dark:hover:bg-dark-alt text-sm font-semibold transition"
        >
          View wallet <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Withdrawal — handled in Wallet tab */}
      <div className="rounded-xl border border-light-border dark:border-dark-border p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Withdraw to bank</p>
          <p className="text-xs text-light-textMuted dark:text-dark-textMuted mt-0.5">
            Transfer your balance — minimum £10, arrives within 1–3 business days
          </p>
        </div>
        <Link
          href="/account?tab=wallet"
          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl border border-light-border dark:border-dark-border hover:bg-light-alt dark:hover:bg-dark-alt text-sm font-semibold transition whitespace-nowrap"
        >
          Go to Wallet <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </SectionCard>
  );
}

/* ─── Delivery address section ───────────────────────────────────────────────── */

const UPDATE_DELIVERY_ADDRESS = `
  mutation UpdateDeliveryAddress(
    $address1: String $address2: String $city: String $postcode: String $state: String $country: String
  ) {
    updateProfile(address1: $address1 address2: $address2 city: $city postcode: $postcode state: $state country: $country) {
      address1 address2 city postcode state country
    }
  }
`;

function DeliveryAddressSection({ token, initialAddress }) {
  const empty = { address1: "", address2: "", city: "", postcode: "", country: "GB" };
  const [addr, setAddr] = useState(() => ({ ...empty, ...(initialAddress || {}) }));
  const [synced, setSynced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  if (!synced && initialAddress && Object.values(initialAddress).some(Boolean)) {
    setAddr({ ...empty, ...initialAddress });
    setSynced(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!addr.address1.trim() || !addr.city.trim() || !addr.postcode.trim()) {
      setMsg({ ok: false, text: "Address line 1, city, and postcode are required." });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await gql(token, UPDATE_DELIVERY_ADDRESS, {
        address1: addr.address1.trim(),
        address2: addr.address2.trim() || null,
        city: addr.city.trim(),
        postcode: addr.postcode.trim(),
        state: addr.state?.trim() || null,
        country: addr.country || "GB",
      });
      setMsg({ ok: true, text: "Delivery address saved." });
    } catch (err) {
      setMsg({ ok: false, text: err.message || "Could not save address." });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3500);
    }
  }

  const f = (field) => (e) => setAddr((a) => ({ ...a, [field]: e.target.value }));

  return (
    <SectionCard icon={Truck} title="Delivery address" subtitle="Used when buying cards — pre-filled at checkout and on offers">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <Field label="Address line 1">
            <Input value={addr.address1} onChange={f("address1")} placeholder="123 Example Street" />
          </Field>
          <Field label="Address line 2 (optional)">
            <Input value={addr.address2 || ""} onChange={f("address2")} placeholder="Flat, apartment, etc." />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <Input value={addr.city} onChange={f("city")} placeholder="London" />
            </Field>
            <Field label="Postcode">
              <Input value={addr.postcode} onChange={f("postcode")} placeholder="SW1A 1AA" />
            </Field>
          </div>
        </div>
        {msg && (
          <p className={`text-xs font-medium flex items-center gap-1.5 ${msg.ok ? "text-emerald-500" : "text-rose-400"}`}>
            {msg.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />} {msg.text}
          </p>
        )}
        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-light-accent dark:bg-dark-accent text-white hover:opacity-90 disabled:opacity-50 transition">
            {saving ? "Saving…" : "Save address"}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

/* ─── Return address section ─────────────────────────────────────────────────── */

function ReturnAddressSection({ token, initialAddress }) {
  const empty = { name: "", line1: "", line2: "", city: "", postcode: "", country: "GB", phone: "", email: "" };
  const [addr, setAddr]       = useState(() => ({ ...empty, ...(initialAddress || {}) }));
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState(null);

  // Sync when initialAddress loads from API
  const [synced, setSynced]   = useState(false);
  if (!synced && initialAddress && Object.values(initialAddress).some(Boolean)) {
    setAddr({ ...empty, ...initialAddress });
    setSynced(true);
  }

  function set(k, v) { setAddr((a) => ({ ...a, [k]: v })); }

  async function save(e) {
    e.preventDefault();
    if (!addr.name || !addr.line1 || !addr.city || !addr.postcode) {
      setMsg({ ok: false, text: "Name, line 1, city and postcode are required." });
      return;
    }
    setSaving(true); setMsg(null);
    try {
      await gql(token, UPDATE_SELLER_ADDRESS, {
        input: {
          name: addr.name, line1: addr.line1, line2: addr.line2 || null,
          city: addr.city, postcode: addr.postcode.toUpperCase(),
          country: addr.country || "GB", phone: addr.phone || null, email: addr.email || null,
        },
      });
      setMsg({ ok: true, text: "Return address saved." });
    } catch (err) {
      setMsg({ ok: false, text: err.message || "Could not save." });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  return (
    <SectionCard icon={Truck} title="Return address" subtitle="Used on shipping labels — must match your P2G account">
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Full name / company">
            <Input value={addr.name} onChange={(e) => set("name", e.target.value)} placeholder="Jane Smith" />
          </Field>
          <Field label="Phone (optional)">
            <Input value={addr.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+44 7700 900000" />
          </Field>
        </div>
        <Field label="Address line 1">
          <Input value={addr.line1} onChange={(e) => set("line1", e.target.value)} placeholder="12 Example Street" />
        </Field>
        <Field label="Address line 2 (optional)">
          <Input value={addr.line2} onChange={(e) => set("line2", e.target.value)} placeholder="Flat 3" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City / Town">
            <Input value={addr.city} onChange={(e) => set("city", e.target.value)} placeholder="London" />
          </Field>
          <Field label="Postcode">
            <Input value={addr.postcode} onChange={(e) => set("postcode", e.target.value.toUpperCase())} placeholder="SW1A 1AA" />
          </Field>
        </div>
        <Field label="Return email (optional)" hint="Included on label for carrier contact">
          <Input type="email" value={addr.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
        </Field>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="px-5 py-2 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-bold hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition disabled:opacity-40 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Saving…" : "Save address"}
          </button>
          {msg && (
            <span className={`text-sm font-medium flex items-center gap-1.5 ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {msg.text}
            </span>
          )}
        </div>
        <p className="text-xs text-light-textMuted dark:text-dark-textMuted">
          Labels must always be tracked — P2G Parcel2Go is used automatically when you ship an order.
        </p>
      </form>
    </SectionCard>
  );
}

/* ─── Vacation section ───────────────────────────────────────────────────────── */

function VacationSection({ state, setState }) {
  return (
    <SectionCard
      icon={Palmtree}
      title="Vacation mode"
      subtitle="Pause your shop while you're away"
    >
      <RowToggle
        label="Enable vacation mode"
        description="Hides your listings and shows a banner to buyers"
        checked={state.vacation.enabled}
        onChange={(v) => setState((s) => ({ ...s, vacation: { ...s.vacation, enabled: v } }))}
      />

      <div className={`space-y-4 mt-4 transition-opacity ${!state.vacation.enabled ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="End date" hint="Leave blank for indefinite">
            <Input
              type="date"
              value={state.vacation.endDate}
              onChange={(e) => setState((s) => ({ ...s, vacation: { ...s.vacation, endDate: e.target.value } }))}
            />
          </Field>
          <Field label="Auto-resume on end date">
            <div className="h-[38px] flex items-center">
              <Toggle
                checked={state.vacation.autoResume}
                onChange={(v) => setState((s) => ({ ...s, vacation: { ...s.vacation, autoResume: v } }))}
              />
            </div>
          </Field>
        </div>
        <Field label="Buyer banner message">
          <Textarea
            rows={3}
            value={state.vacation.message}
            onChange={(e) => setState((s) => ({ ...s, vacation: { ...s.vacation, message: e.target.value } }))}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

/* ─── Trade rules section ────────────────────────────────────────────────────── */

function TradeSection({ state, setState }) {
  return (
    <SectionCard icon={ArrowLeftRight} title="Trade rules" subtitle="Defaults for incoming trade requests">
      <RowToggle
        label="Accept trade offers"
        description="Other users can propose card trades with you"
        checked={state.trade.allowOffers}
        onChange={(v) => setState((s) => ({ ...s, trade: { ...s.trade, allowOffers: v } }))}
      />
      <RowToggle
        label="Allow plain white envelope (PWE)"
        description="Accept untracked letter-post shipments for low-value trades"
        checked={state.trade.allowPWE}
        onChange={(v) => setState((s) => ({ ...s, trade: { ...s.trade, allowPWE: v } }))}
      />

      <div className="mt-4 space-y-4">
        <Field label="Minimum trade value" hint="Trades below this are auto-declined">
          <div className="flex items-center gap-2 max-w-[180px]">
            <span className="text-light-textMuted">£</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={state.trade.minValue}
              onChange={(e) => setState((s) => ({ ...s, trade: { ...s.trade, minValue: Math.max(0, Number(e.target.value || 0)) } }))}
            />
          </div>
        </Field>

        <Field label="Accept trades from">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "uk_only",   label: "UK only" },
              { id: "uk_eu",     label: "UK + EU" },
              { id: "worldwide", label: "Worldwide" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setState((s) => ({ ...s, trade: { ...s.trade, acceptFrom: opt.id } }))}
                className={`py-2 px-3 rounded-lg border text-sm font-medium transition
                  ${state.trade.acceptFrom === opt.id
                    ? "border-light-accent dark:border-dark-accent bg-light-accent/5 dark:bg-dark-accent/5 text-light-accent dark:text-dark-accent"
                    : "border-light-border dark:border-dark-border hover:bg-light-alt dark:hover:bg-dark-alt"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </SectionCard>
  );
}

/* ─── Blocked users section ──────────────────────────────────────────────────── */

function BlockedSection({ state, setState }) {
  const [val, setVal] = useState("");

  function add() {
    const v = val.trim();
    if (!v) return;
    setState((s) => ({
      ...s,
      blocked: { ...s.blocked, users: Array.from(new Set([...s.blocked.users, v])) },
    }));
    setVal("");
  }

  return (
    <SectionCard icon={UserX} title="Blocked users" subtitle="These users can't message you or initiate trades">
      <div className="flex gap-2 mb-4">
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
          className="px-4 py-2 rounded-lg bg-light-accent dark:bg-dark-accent text-white text-sm font-semibold hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition"
        >
          Block
        </button>
      </div>

      {state.blocked.users.length === 0 ? (
        <p className="text-sm text-light-textMuted dark:text-dark-textMuted">No blocked users.</p>
      ) : (
        <ul className="divide-y divide-light-border dark:divide-dark-border rounded-xl border border-light-border dark:border-dark-border overflow-hidden">
          {state.blocked.users.map((u) => (
            <li key={u} className="flex items-center justify-between px-4 py-2.5 bg-light-alt/50 dark:bg-dark-alt/50">
              <span className="text-sm font-medium">{u}</span>
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, blocked: { ...s.blocked, users: s.blocked.users.filter((x) => x !== u) } }))}
                className="text-xs px-3 py-1 rounded-lg border border-light-border dark:border-dark-border hover:bg-light-surface dark:hover:bg-dark-surface transition"
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/* ─── Main tab ───────────────────────────────────────────────────────────────── */

export default function MarketplaceTab({ user, token }) {
  const [prefs, setPrefs]       = useState(() => loadPrefs(user));
  const [saved, setSaved]       = useState(() => loadPrefs(user));
  const [saveMsg, setSaveMsg]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [apiData, setApiData]   = useState(null);
  const [apiLoading, setApiLoading] = useState(true);

  // Fetch live seller status + wallet balance
  useEffect(() => {
    if (!token) return;
    gql(token, SELLER_STATUS_QUERY)
      .then((d) => setApiData(d))
      .catch(() => {})
      .finally(() => setApiLoading(false));
  }, [token]);

  // Ensure displayName matches username on first load
  useEffect(() => {
    if (!prefs.seller.displayName && user?.username) {
      setPrefs((s) => ({ ...s, seller: { ...s.seller, displayName: user.username } }));
      setSaved((s) => ({ ...s, seller: { ...s.seller, displayName: user.username } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  const dirty = useMemo(() => JSON.stringify(prefs) !== JSON.stringify(saved), [prefs, saved]);

  function onSave() {
    setSaving(true);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(prefs));
      setSaved(prefs);
      setSaveMsg({ ok: true, text: "Preferences saved." });
    } catch (err) {
      setSaveMsg({ ok: false, text: err.message || "Could not save." });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3500);
    }
  }

  const feePercent       = apiData?.myCapabilities?.platformFeePercent ?? 8;
  const walletBalance    = apiData?.myWallet?.balance;
  const sellerAddress    = apiData?.sellerAddress ?? null;
  const deliveryAddress  = apiData?.myDeliveryAddress ?? null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold">Marketplace Settings</h2>
        <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary mt-0.5">
          Configure your shop, payouts, shipping, and trading preferences
        </p>
      </div>

      {/* Platform fee banner */}
      {!apiLoading && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            Your platform fee:{" "}
            <span className="font-bold">{feePercent}%</span>
            {feePercent < 8 && (
              <span className="ml-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                (subscriber discount applied)
              </span>
            )}
            {" · "}
            <Link href="/account?tab=subscriptions" className="underline hover:no-underline">
              Upgrade plan
            </Link>{" "}
            to reduce your fee
          </span>
        </div>
      )}

      {/* Payouts */}
      <PayoutsSection walletBalance={walletBalance} token={token} />

      {/* Shop profile */}
      <SectionCard icon={Store} title="Shop profile" subtitle="How your shop appears to buyers">
        <div className="space-y-4">
          <Field label="Display name">
            <Input
              value={prefs.seller.displayName}
              onChange={(e) => setPrefs((s) => ({ ...s, seller: { ...s.seller, displayName: e.target.value } }))}
              placeholder="Your shop name"
            />
          </Field>
          <Field label="Shop note" hint="Shown on your listing page — grading notes, shipping schedule, etc.">
            <Textarea
              rows={3}
              value={prefs.seller.shopNote}
              onChange={(e) => setPrefs((s) => ({ ...s, seller: { ...s.seller, shopNote: e.target.value } }))}
              placeholder="e.g. I ship every Tuesday and Thursday. Cards graded per PSA guidelines."
            />
          </Field>
        </div>
      </SectionCard>

      {/* Delivery address */}
      <DeliveryAddressSection token={token} initialAddress={deliveryAddress} />

      {/* Return address */}
      <ReturnAddressSection token={token} initialAddress={sellerAddress} />

      {/* Vacation + Trade rules — side by side on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <VacationSection state={prefs} setState={setPrefs} />
        <TradeSection state={prefs} setState={setPrefs} />
      </div>

      {/* Blocked users */}
      <BlockedSection state={prefs} setState={setPrefs} />

      {/* Save bar */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="px-6 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white font-bold hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition disabled:opacity-40 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? "Saving…" : "Save settings"}
        </button>
        <button
          type="button"
          onClick={() => { const s = loadPrefs(user); setPrefs(s); setSaved(s); }}
          disabled={!dirty || saving}
          className="px-6 py-2.5 rounded-xl border border-light-border dark:border-dark-border font-bold disabled:opacity-40 hover:bg-light-alt dark:hover:bg-dark-alt transition"
        >
          Revert
        </button>
        {saveMsg && (
          <span className={`text-sm font-medium flex items-center gap-1.5 ${saveMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
            {saveMsg.ok
              ? <CheckCircle2 className="w-4 h-4" />
              : <AlertCircle className="w-4 h-4" />}
            {saveMsg.text}
          </span>
        )}
      </div>
    </div>
  );
}

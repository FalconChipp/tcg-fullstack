// src/components/Account/PriceAlertsTab.js
// NEW: Manage your price alerts (list + create/edit/delete).
// Uses backend GraphQL resolvers we added earlier.

"use client";

import React, { useContext, useEffect, useState } from "react";
import StatusMessage from "@/components/UI/StatusMessage";
import { AuthContext } from "@/components/Auth/AuthProvider";
import { fetchMyAlerts, upsertAlert, deleteAlert, toggleAlert } from "@/graphql/priceAlerts";

const CONDITIONS = [
  { value: "above", label: "Price ≥ threshold" },
  { value: "below", label: "Price ≤ threshold" },
  { value: "pct_up", label: "↑ Percentage over window" },
  { value: "pct_down", label: "↓ Percentage over window" },
];

function emptyForm() {
  return {
    id: null,
    cardId: "",
    variation: "",
    condition: "pct_up",
    value: 10,
    windowHours: 24,
    cooldownHours: 12,
    isActive: true,
  };
}

export default function PriceAlertsTab() {
  const { token } = useContext(AuthContext);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    setStatus(null);
    try {
      const list = await fetchMyAlerts({ token });
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      setStatus({ type: "error", message: e.message || "Failed to load alerts" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  function startCreate() {
    setForm(emptyForm());
    setShowForm(true);
  }
  function startEdit(row) {
    setForm({ ...row, variation: row.variation || "" });
    setShowForm(true);
  }

  async function handleSave(e) {
    e?.preventDefault?.();
    if (!token) return;
    setSaving(true);
    setStatus(null);
    try {
      const input = {
        id: form.id || undefined,
        cardId: form.cardId.trim(),
        variation: form.variation.trim() || undefined,
        condition: form.condition,
        value: Number(form.value),
        windowHours: Number(form.windowHours),
        cooldownHours: Number(form.cooldownHours) || undefined,
        isActive: !!form.isActive,
      };
      if (!input.cardId) throw new Error("Card ID is required");

      await upsertAlert({ token, input });
      setStatus({ type: "success", message: "Alert saved" });
      setShowForm(false);
      await load();
    } catch (e) {
      setStatus({ type: "error", message: e.message || "Failed to save alert" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    if (!token) return;
    if (!confirm("Delete this alert?")) return;
    try {
      await deleteAlert({ token, id: row.id });
      setRows(prev => prev.filter(x => x.id !== row.id));
      setStatus({ type: "success", message: "Alert deleted" });
    } catch (e) {
      setStatus({ type: "error", message: e.message || "Failed to delete alert" });
    }
  }

  async function handleToggle(row) {
    if (!token) return;
    try {
      await toggleAlert({ token, id: row.id, isActive: !row.isActive });
      setRows(prev => prev.map(x => x.id === row.id ? { ...x, isActive: !x.isActive } : x));
    } catch (e) {
      setStatus({ type: "error", message: e.message || "Failed to toggle alert" });
    }
  }

  return (
    <div className="space-y-6">
      {status ? (
        <StatusMessage type={status.type} message={status.message} onClose={() => setStatus(null)} />
      ) : null}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Price alerts</h2>
        <button
          onClick={startCreate}
          className="px-3 py-2 rounded-lg bg-light-accent dark:bg-dark-accent text-white font-semibold hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition"
        >
          New alert
        </button>
      </div>

      {/* List */}
      <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-light-alt dark:bg-dark-alt text-left">
            <tr>
              <th className="px-4 py-3 border-b border-light-border dark:border-dark-border">Card ID</th>
              <th className="px-4 py-3 border-b border-light-border dark:border-dark-border">Variation</th>
              <th className="px-4 py-3 border-b border-light-border dark:border-dark-border">Condition</th>
              <th className="px-4 py-3 border-b border-light-border dark:border-dark-border">Value</th>
              <th className="px-4 py-3 border-b border-light-border dark:border-dark-border">Window</th>
              <th className="px-4 py-3 border-b border-light-border dark:border-dark-border">Cooldown</th>
              <th className="px-4 py-3 border-b border-light-border dark:border-dark-border">Active</th>
              <th className="px-4 py-3 border-b border-light-border dark:border-dark-border"></th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && !loading ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-light-textSecondary dark:text-dark-textSecondary">No alerts yet.</td></tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                <td className="px-4 py-2">{r.cardId}</td>
                <td className="px-4 py-2">{r.variation || <span className="text-light-textMuted dark:text-dark-textMuted">default</span>}</td>
                <td className="px-4 py-2">{CONDITIONS.find(c => c.value === r.condition)?.label || r.condition}</td>
                <td className="px-4 py-2">{(r.condition === 'pct_up' || r.condition === 'pct_down') ? `${r.value}%` : `£${Number(r.value).toFixed(2)}`}</td>
                <td className="px-4 py-2">{r.windowHours}h</td>
                <td className="px-4 py-2">{r.cooldownHours ?? 0}h</td>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={!!r.isActive} onChange={() => handleToggle(r)} />
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => startEdit(r)} className="px-2 py-1 rounded border border-light-border dark:border-dark-border hover:bg-black/5 dark:hover:bg:white/5">Edit</button>
                    <button onClick={() => handleDelete(r)} className="px-2 py-1 rounded bg-light-error text-white dark:bg-dark-error hover:bg-light-error/90 dark:hover:bg-dark-error/90">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4">
          <h3 className="font-semibold mb-3">{form.id ? "Edit alert" : "New alert"}</h3>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSave}>
            <div>
              <label className="block text-sm mb-1">Card ID</label>
              <input
                type="text"
                value={form.cardId}
                onChange={(e) => setForm((f) => ({ ...f, cardId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
                placeholder="e.g. sv05-052"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Variation</label>
              <input
                type="text"
                value={form.variation}
                onChange={(e) => setForm((f) => ({ ...f, variation: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
                placeholder="normal | reverse | holo ..."
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Condition</label>
              <select
                value={form.condition}
                onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
              >
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Value</label>
              <input
                type="number"
                step="0.01"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Window hours</label>
              <input
                type="number"
                value={form.windowHours}
                min={1}
                onChange={(e) => setForm((f) => ({ ...f, windowHours: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Cooldown hours</label>
              <input
                type="number"
                value={form.cooldownHours}
                min={0}
                onChange={(e) => setForm((f) => ({ ...f, cooldownHours: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="active"
                type="checkbox"
                checked={!!form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              <label htmlFor="active">Active</label>
            </div>
            <div className="md:col-span-2 flex gap-2 mt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-light-accent dark:bg-dark-accent text-white font-semibold hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save alert"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt hover:bg-light-surface dark:hover:bg-dark-surface"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

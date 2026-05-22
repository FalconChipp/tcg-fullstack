"use client";

import React, { useState } from "react";
import { gql, useQuery, useMutation } from "@apollo/client";

// ─── GQL ─────────────────────────────────────────────────────────────────────

const SUBSCRIPTIONS_QUERY = gql`
  query AdminSubscriptions($status: String, $page: Int, $pageSize: Int) {
    adminSubscriptions(status: $status, page: $page, pageSize: $pageSize) {
      total
      page
      pageSize
      subscriptions {
        id
        userId
        status
        cancelAtPeriodEnd
        currentPeriodStart
        currentPeriodEnd
        cancelledAt
        stripeSubscriptionId
        createdAt
        plan {
          id
          name
          price
          interval
        }
      }
    }
  }
`;

const PLANS_QUERY = gql`
  query AdminPlans {
    adminPlans {
      id
      name
      price
      interval
      active
      platformFeePercent
      maxBinders
      maxActiveListings
      maxActiveTrades
    }
  }
`;

const CANCEL_SUB    = gql`mutation AdminCancelSub($id: ID!) { adminCancelSubscription(id: $id) }`;
const RESUME_SUB    = gql`mutation AdminResumeSub($id: ID!) { adminResumeSubscription(id: $id) }`;
const CHANGE_PLAN   = gql`mutation AdminChangePlan($id: ID!, $planId: ID!) { adminChangePlan(id: $id, planId: $planId) }`;
const GRANT_SUB     = gql`mutation AdminGrantSub($userId: ID!, $planId: ID!, $periodDays: Int) { adminGrantSubscription(userId: $userId, planId: $planId, periodDays: $periodDays) }`;
const REVOKE_SUB    = gql`mutation AdminRevokeSub($id: ID!) { adminRevokeSubscription(id: $id) }`;
const UPDATE_PLAN   = gql`
  mutation AdminUpdatePlan($id: ID!, $input: PlanInput!) {
    adminUpdatePlan(id: $id, input: $input) {
      id name price interval active platformFeePercent maxBinders maxActiveListings maxActiveTrades
    }
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function gbp(n) {
  if (n == null) return "—";
  return `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function titleCase(v) {
  return v ? String(v).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";
}

// ─── Sub status badge ─────────────────────────────────────────────────────────

function SubBadge({ status, cancelAtPeriodEnd }) {
  if (status === "active" && cancelAtPeriodEnd) {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">Cancels at period end</span>;
  }
  const map = {
    active:   "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    trialing: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    past_due: "bg-orange-500/10 text-orange-300 border-orange-500/30",
    cancelled:"bg-neutral-500/10 text-neutral-400 border-white/10",
    expired:  "bg-neutral-500/10 text-neutral-500 border-white/10",
  };
  const cls = map[status] ?? "bg-neutral-500/10 text-neutral-400 border-white/10";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${cls}`}>{titleCase(status)}</span>;
}

// ─── Change plan modal ────────────────────────────────────────────────────────

function ChangePlanModal({ sub, plans, onConfirm, onCancel, loading }) {
  const [selectedPlanId, setSelectedPlanId] = useState(sub.plan?.id ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="bg-[#0d0f17] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-sm font-semibold text-neutral-50">Change plan</h3>
          <p className="text-xs text-neutral-500 mt-1">User: <span className="font-mono text-neutral-300">{sub.userId}</span></p>
          <p className="text-xs text-neutral-500">Current plan: <span className="text-neutral-200">{sub.plan?.name ?? "—"}</span></p>
        </div>
        <div className="space-y-2">
          {plans.filter((p) => p.active).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPlanId(p.id)}
              className={[
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs transition",
                selectedPlanId === p.id
                  ? "bg-indigo-500/15 border-indigo-500/40 text-neutral-50"
                  : "border-white/10 text-neutral-400 hover:bg-white/5 hover:text-neutral-200",
              ].join(" ")}
            >
              <span className="font-medium">{p.name}</span>
              <span>{gbp(p.price)} / {p.interval}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={loading} className="flex-1 py-2 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-50 transition">Cancel</button>
          <button type="button" disabled={loading || !selectedPlanId || selectedPlanId === sub.plan?.id} onClick={() => onConfirm(selectedPlanId)} className="flex-1 py-2 rounded-lg text-xs font-medium bg-indigo-600/80 border border-indigo-500/50 text-white hover:bg-indigo-600 disabled:opacity-50 transition">
            {loading ? "Changing…" : "Change plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Grant modal ──────────────────────────────────────────────────────────────

function GrantModal({ plans, onConfirm, onCancel, loading }) {
  const [userId, setUserId]       = useState("");
  const [planId, setPlanId]       = useState("");
  const [days, setDays]           = useState("30");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="bg-[#0d0f17] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-sm font-semibold text-neutral-50">Grant subscription</h3>
          <p className="text-xs text-neutral-500 mt-1">Grants a plan without a Stripe payment. Cancels any existing active subscription first.</p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] text-neutral-400 font-medium">User ID <span className="text-red-400">*</span></label>
            <input className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-700 focus:outline-none focus:ring-1 focus:ring-white/20 font-mono" placeholder="UUID…" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-neutral-400 font-medium">Plan <span className="text-red-400">*</span></label>
            <select className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:ring-1 focus:ring-white/20" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">Select a plan…</option>
              {plans.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} — {gbp(p.price)}/{p.interval}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-neutral-400 font-medium">Period (days)</label>
            <input type="number" min="1" max="3650" className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:ring-1 focus:ring-white/20" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={loading} className="flex-1 py-2 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-50 transition">Cancel</button>
          <button type="button" disabled={loading || !userId.trim() || !planId} onClick={() => onConfirm({ userId: userId.trim(), planId, periodDays: Number(days) })} className="flex-1 py-2 rounded-lg text-xs font-medium bg-emerald-600/80 border border-emerald-500/50 text-white hover:bg-emerald-600 disabled:opacity-50 transition">
            {loading ? "Granting…" : "Grant"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan editor modal ────────────────────────────────────────────────────────

function EditPlanModal({ plan, onConfirm, onCancel, loading }) {
  const [form, setForm] = useState({
    name:               plan.name ?? "",
    platformFeePercent: String(plan.platformFeePercent ?? 8),
    maxBinders:         String(plan.maxBinders ?? ""),
    maxActiveListings:  String(plan.maxActiveListings ?? ""),
    maxActiveTrades:    String(plan.maxActiveTrades ?? ""),
    active:             plan.active ?? true,
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="bg-[#0d0f17] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-sm font-semibold text-neutral-50">Edit plan: {plan.name}</h3>
          <p className="text-xs text-neutral-500 mt-1">{gbp(plan.price)} / {plan.interval}</p>
        </div>
        <div className="space-y-3">
          {[
            { label: "Display name", key: "name", type: "text" },
            { label: "Platform fee %", key: "platformFeePercent", type: "number" },
            { label: "Max binders (blank = unlimited)", key: "maxBinders", type: "number" },
            { label: "Max active listings (blank = unlimited)", key: "maxActiveListings", type: "number" },
            { label: "Max active trades (blank = unlimited)", key: "maxActiveTrades", type: "number" },
          ].map(({ label, key, type }) => (
            <div key={key} className="space-y-1">
              <label className="text-[11px] text-neutral-400 font-medium">{label}</label>
              <input type={type} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:ring-1 focus:ring-white/20" value={form[key]} onChange={set(key)} />
            </div>
          ))}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={set("active")} className="rounded" />
            <span className="text-[11px] text-neutral-300">Plan is active (visible to users)</span>
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={loading} className="flex-1 py-2 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-50 transition">Cancel</button>
          <button type="button" disabled={loading} onClick={() => onConfirm({
            name: form.name || undefined,
            platformFeePercent: form.platformFeePercent ? Number(form.platformFeePercent) : undefined,
            maxBinders:        form.maxBinders !== "" ? Number(form.maxBinders) : null,
            maxActiveListings: form.maxActiveListings !== "" ? Number(form.maxActiveListings) : null,
            maxActiveTrades:   form.maxActiveTrades !== "" ? Number(form.maxActiveTrades) : null,
            active: form.active,
          })} className="flex-1 py-2 rounded-lg text-xs font-medium bg-white/10 border border-white/20 text-neutral-100 hover:bg-white/15 disabled:opacity-50 transition">
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Subscriptions tab ────────────────────────────────────────────────────────

function SubscriptionsTab() {
  const [statusFilter, setStatusFilter] = useState("active");
  const [changePlanTarget, setChangePlanTarget] = useState(null);
  const [grantOpen, setGrantOpen] = useState(false);

  const { data: sd, loading: sl, error: se, refetch: sRefetch } = useQuery(SUBSCRIPTIONS_QUERY, {
    variables: { status: statusFilter === "all" ? null : statusFilter, page: 1, pageSize: 100 },
    fetchPolicy: "network-only",
  });
  const { data: pd } = useQuery(PLANS_QUERY, { fetchPolicy: "cache-first" });

  const [cancelSub,  { loading: cancelling }]  = useMutation(CANCEL_SUB,  { onCompleted: () => sRefetch() });
  const [resumeSub,  { loading: resuming }]    = useMutation(RESUME_SUB,  { onCompleted: () => sRefetch() });
  const [changePlan, { loading: changing }]    = useMutation(CHANGE_PLAN, { onCompleted: () => { sRefetch(); setChangePlanTarget(null); } });
  const [grantSub,   { loading: granting }]    = useMutation(GRANT_SUB,   { onCompleted: () => { sRefetch(); setGrantOpen(false); } });
  const [revokeSub,  { loading: revoking }]    = useMutation(REVOKE_SUB,  { onCompleted: () => sRefetch() });

  const subs  = sd?.adminSubscriptions?.subscriptions ?? [];
  const total = sd?.adminSubscriptions?.total ?? 0;
  const plans = pd?.adminPlans ?? [];
  const busy  = cancelling || resuming || changing || granting || revoking;

  const handleCancel = (sub) => {
    if (!confirm(`Force-cancel subscription ${sub.id}? This is immediate and will cancel in Stripe if wired.`)) return;
    cancelSub({ variables: { id: sub.id } });
  };
  const handleRevoke = (sub) => {
    if (!confirm(`Revoke subscription ${sub.id}?`)) return;
    revokeSub({ variables: { id: sub.id } });
  };

  const STATUS_FILTERS = ["active", "past_due", "cancelled", "expired", "all"];

  return (
    <div className="space-y-4">
      {changePlanTarget && (
        <ChangePlanModal
          sub={changePlanTarget}
          plans={plans}
          loading={changing}
          onConfirm={(planId) => changePlan({ variables: { id: changePlanTarget.id, planId } })}
          onCancel={() => setChangePlanTarget(null)}
        />
      )}
      {grantOpen && (
        <GrantModal
          plans={plans}
          loading={granting}
          onConfirm={({ userId, planId, periodDays }) => grantSub({ variables: { userId, planId, periodDays } })}
          onCancel={() => setGrantOpen(false)}
        />
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-neutral-50">Subscriptions</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {sl ? "Loading…" : `${total} subscription${total !== 1 ? "s" : ""} (${statusFilter}).`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden text-[11px]">
            {STATUS_FILTERS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setStatusFilter(opt)}
                className={["px-3 py-1.5 font-medium transition", statusFilter === opt ? "bg-white/10 text-neutral-100" : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"].join(" ")}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setGrantOpen(true)}
            className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium bg-emerald-600/70 border border-emerald-500/40 text-white hover:bg-emerald-600 transition"
          >
            + Grant subscription
          </button>
          <button
            type="button"
            onClick={() => sRefetch()}
            disabled={busy}
            className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-50 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {se && <div className="border border-red-500/30 rounded-xl p-3 bg-red-950/20 text-xs text-red-300">{se.message}</div>}

      {sl && !sd ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border border-white/[0.06] rounded-xl p-4 animate-pulse flex gap-4">
              <div className="flex-1 space-y-2"><div className="h-3 w-40 rounded bg-white/10" /><div className="h-3 w-24 rounded bg-white/[0.06]" /></div>
            </div>
          ))}
        </div>
      ) : subs.length === 0 ? (
        <div className="border border-white/[0.06] rounded-2xl p-8 text-center text-sm text-neutral-400">No subscriptions found.</div>
      ) : (
        <div className="overflow-x-auto border border-white/[0.08] rounded-2xl bg-black/30">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["User ID", "Plan", "Status", "Period", "Stripe ID", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {subs.map((sub) => {
                const isActive = sub.status === "active" || sub.status === "trialing";
                const isGranted = !sub.stripeSubscriptionId && isActive;
                return (
                  <tr key={sub.id} className="hover:bg-white/[0.03] transition align-top">
                    <td className="px-3 py-3">
                      <p className="font-mono text-[10px] text-neutral-400 truncate max-w-[130px]">{sub.userId}</p>
                      {isGranted && <span className="text-[9px] text-amber-400 mt-0.5 block">Manually granted</span>}
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-neutral-200 font-medium">{sub.plan?.name ?? "—"}</p>
                      <p className="text-neutral-500 text-[10px]">{sub.plan ? `${gbp(sub.plan.price)} / ${sub.plan.interval}` : ""}</p>
                    </td>
                    <td className="px-3 py-3">
                      <SubBadge status={sub.status} cancelAtPeriodEnd={sub.cancelAtPeriodEnd} />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <p className="text-neutral-400 text-[10px]">{fmt(sub.currentPeriodStart)} →</p>
                      <p className="text-neutral-300 text-[11px]">{fmt(sub.currentPeriodEnd)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-mono text-[10px] text-neutral-600 truncate max-w-[120px]">{sub.stripeSubscriptionId || <span className="text-neutral-700">none</span>}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {isActive && (
                          <>
                            <button
                              type="button"
                              onClick={() => setChangePlanTarget(sub)}
                              disabled={busy}
                              className="px-2 py-1 rounded-md text-[10px] border border-indigo-400/40 text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50 transition"
                            >
                              Change plan
                            </button>
                            {isGranted ? (
                              <button
                                type="button"
                                onClick={() => handleRevoke(sub)}
                                disabled={busy}
                                className="px-2 py-1 rounded-md text-[10px] border border-red-400/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50 transition"
                              >
                                Revoke
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCancel(sub)}
                                disabled={busy}
                                className="px-2 py-1 rounded-md text-[10px] border border-red-400/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50 transition"
                              >
                                Cancel now
                              </button>
                            )}
                          </>
                        )}
                        {(sub.status === "cancelled" || sub.cancelAtPeriodEnd) && sub.stripeSubscriptionId && (
                          <button
                            type="button"
                            onClick={() => resumeSub({ variables: { id: sub.id } })}
                            disabled={busy}
                            className="px-2 py-1 rounded-md text-[10px] border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 transition"
                          >
                            Resume
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Plans tab ────────────────────────────────────────────────────────────────

function PlansTab() {
  const [editTarget, setEditTarget] = useState(null);

  const { data, loading, error, refetch } = useQuery(PLANS_QUERY, { fetchPolicy: "network-only" });
  const [updatePlan, { loading: saving }] = useMutation(UPDATE_PLAN, {
    onCompleted: () => { refetch(); setEditTarget(null); },
  });

  const plans = data?.adminPlans ?? [];

  return (
    <div className="space-y-4">
      {editTarget && (
        <EditPlanModal
          plan={editTarget}
          loading={saving}
          onConfirm={(input) => updatePlan({ variables: { id: editTarget.id, input } })}
          onCancel={() => setEditTarget(null)}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-neutral-50">Subscription Plans</h2>
          <p className="text-xs text-neutral-500 mt-0.5">{plans.length} plan{plans.length !== 1 ? "s" : ""}. Prices are set in Stripe and cannot be changed here.</p>
        </div>
        <button type="button" onClick={() => refetch()} disabled={loading} className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-50 transition">Refresh</button>
      </div>

      {error && <div className="border border-red-500/30 rounded-xl p-3 bg-red-950/20 text-xs text-red-300">{error.message}</div>}

      {loading && !data ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="border border-white/[0.06] rounded-xl p-4 animate-pulse h-16" />)}</div>
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => (
            <div key={plan.id} className={`border rounded-xl p-4 flex items-center justify-between gap-4 ${plan.active ? "border-white/[0.08] bg-white/[0.02]" : "border-white/[0.04] bg-black/20 opacity-60"}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${plan.active ? "bg-emerald-400" : "bg-neutral-600"}`} />
                <div>
                  <p className="text-sm font-semibold text-neutral-100">{plan.name}</p>
                  <p className="text-[11px] text-neutral-500">{gbp(plan.price)} / {plan.interval} · {plan.platformFeePercent}% fee · {plan.maxBinders ?? "∞"} binders · {plan.maxActiveListings ?? "∞"} listings</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(plan)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 transition"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "subscriptions", label: "Subscriptions" },
  { id: "plans",         label: "Plans" },
];

export default function AdminSubscriptionsPanel() {
  const [tab, setTab] = useState("subscriptions");

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "px-4 py-2.5 text-sm font-medium border-b-2 transition",
              tab === t.id
                ? "border-white text-neutral-50"
                : "border-transparent text-neutral-500 hover:text-neutral-300",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "subscriptions" && <SubscriptionsTab />}
      {tab === "plans"         && <PlansTab />}
    </div>
  );
}

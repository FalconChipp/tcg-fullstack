"use client";
import React, { useEffect, useState, useCallback } from "react";
import {
  fetchSubscriptionPlans,
  fetchUserSubscription,
  fetchUserCapabilities,
  startSubscriptionCheckout,
  updateUserSubscription,
  cancelUserSubscription,
  reactivateUserSubscription,
  fetchUserTransactions,
  openBillingPortal,
} from "@/utils/subscriptionsApi";
import StatusMessage from "@/components/UI/StatusMessage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(price) {
  if (!price || Number(price) === 0) return "Free";
  return `£${Number(price).toFixed(2)}`;
}

function fmtInterval(interval) {
  if (!interval) return "";
  return interval === "year" ? "/yr" : "/mo";
}

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function yearlySavingPct(monthlyPrice, yearlyPrice) {
  const annual = Number(monthlyPrice) * 12;
  return Math.round(((annual - Number(yearlyPrice)) / annual) * 100);
}

// ─── Fee pill ─────────────────────────────────────────────────────────────────

function FeeDot({ pct }) {
  const color =
    pct <= 2 ? "bg-emerald-500" :
    pct <= 3 ? "bg-green-500"   :
    pct <= 5 ? "bg-yellow-500"  : "bg-orange-500";
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-xs font-semibold bg-vault-raised border border-vault-border">
      <span className={`w-2 h-2 rounded-[6px] ${color} shrink-0`} />
      {pct}% marketplace fee
    </span>
  );
}

// ─── Confirmation modal ───────────────────────────────────────────────────────

function Modal({ open, type, plan, onConfirm, onClose, loading }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[10px]  border border-vault-border bg-vault-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {type === "cancel" && (
          <>
            <h3 className="text-lg font-bold mb-2 text-vault-accent dark:text-vault-accent">Cancel subscription?</h3>
            <p className="text-sm text-vault-textSecondary mb-5">
              You'll keep access until the end of your current billing period, then move to the free tier automatically.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onConfirm}
                disabled={loading}
                className="px-4 py-2 rounded-[6px] bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition disabled:opacity-60"
              >
                {loading ? "Cancelling…" : "Yes, cancel"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-[6px] border border-vault-border text-sm font-semibold hover:bg-vault-raised dark:hover:bg-vault-raised transition"
              >
                Go back
              </button>
            </div>
          </>
        )}

        {type === "reactivate" && (
          <>
            <h3 className="text-lg font-bold mb-2 text-vault-accent dark:text-vault-accent">Reactivate subscription?</h3>
            <p className="text-sm text-vault-textSecondary mb-5">
              Your subscription will continue as normal with no interruption.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onConfirm}
                disabled={loading}
                className="px-4 py-2 rounded-[6px] bg-vault-accent hover:bg-vault-accentHover dark:bg-vault-accent dark:hover:bg-vault-accentHover text-white text-sm font-semibold transition disabled:opacity-60"
              >
                {loading ? "Reactivating…" : "Reactivate"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-[6px] border border-vault-border text-sm font-semibold hover:bg-vault-raised dark:hover:bg-vault-raised transition"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {type === "changePlan" && plan && (
          <>
            <h3 className="text-lg font-bold mb-1 text-vault-accent dark:text-vault-accent">
              Switch to {plan.name}?
            </h3>
            <p className="text-sm text-vault-textSecondary mb-1">
              {fmtPrice(plan.price)}{fmtInterval(plan.interval)} · {plan.platformFeePercent}% marketplace fee
            </p>
            <p className="text-xs text-vault-textTertiary mb-5">
              Your plan updates immediately. Any billing difference will be prorated on your next invoice.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onConfirm}
                disabled={loading}
                className="px-4 py-2 rounded-[6px] bg-vault-accent hover:bg-vault-accentHover dark:bg-vault-accent dark:hover:bg-vault-accentHover text-white text-sm font-semibold transition disabled:opacity-60"
              >
                {loading ? "Switching…" : "Confirm switch"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-[6px] border border-vault-border text-sm font-semibold hover:bg-vault-raised dark:hover:bg-vault-raised transition"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Current plan card ────────────────────────────────────────────────────────

function CurrentPlanCard({ subscription, capabilities, onCancel, onReactivate, onManageBilling }) {
  const planName    = subscription?.plan?.name ?? "Free";
  const isActive    = subscription?.status === "active";
  const isCancelling = Boolean(subscription?.cancelAtPeriodEnd);
  const renewsAt    = subscription?.currentPeriodEnd;
  const fee         = subscription?.plan?.platformFeePercent ?? capabilities?.platformFeePercent;

  return (
    <div className={`rounded-[10px] border p-5 ${
      isCancelling
        ? "border-amber-500/30 bg-amber-500/[0.04]"
        : "border-vault-border bg-vault-surface"
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          {/* Plan name + status badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-vault-accent dark:text-vault-accent">{planName}</span>
            {isActive && !isCancelling && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[6px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Active
              </span>
            )}
            {isCancelling && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[6px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Cancelling
              </span>
            )}
          </div>

          {/* Fee */}
          {fee != null && <FeeDot pct={fee} />}

          {/* Renewal / access info */}
          <p className="text-sm text-vault-textSecondary">
            {isCancelling && renewsAt
              ? <span className="text-amber-400">Access until {fmtDate(renewsAt)}</span>
              : isActive && renewsAt
              ? `Renews ${fmtDate(renewsAt)}`
              : !subscription
              ? "You're on the free plan — no charge, ever."
              : null}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 shrink-0">
          {subscription && planName !== "Free" && (
            <button
              onClick={onManageBilling}
              className="text-xs font-semibold px-3 py-1.5 rounded-[6px] border border-vault-border hover:bg-vault-raised dark:hover:bg-vault-raised transition"
            >
              Manage billing
            </button>
          )}
          {isActive && !isCancelling && planName !== "Free" && (
            <button
              onClick={onCancel}
              className="text-xs font-semibold px-3 py-1.5 rounded-[6px] border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition"
            >
              Cancel
            </button>
          )}
          {isCancelling && (
            <button
              onClick={onReactivate}
              className="text-xs font-semibold px-3 py-1.5 rounded-[6px] bg-vault-accent hover:bg-vault-accentHover dark:bg-vault-accent dark:hover:bg-vault-accentHover text-white transition"
            >
              Reactivate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Plan picker ──────────────────────────────────────────────────────────────

const TIER_ORDER = ["Free", "Collector", "Trader", "Vendor"];

const FALLBACK_FEATURES = {
  free:      ["Collection tracking (unlimited cards)", "Up to 3 digital binders", "Advanced card search", "Wishlist"],
  collector: ["Everything in Free", "Unlimited digital binders", "Saved searches & filters", "5% marketplace fee"],
  trader:    ["Everything in Collector", "Historical value charts & stats", "Price change alerts (hourly)", "4% marketplace fee"],
  vendor:    ["Everything in Trader", "Unlimited active listings", "Seller profile & storefront", "2% marketplace fee"],
};

function PlanPicker({ plans, currentPlanId, hasActiveSub, billing, onBillingChange, onSelect, selectLoading }) {
  // Group plans by tier name (Free only has monthly)
  const byTier = plans.reduce((acc, p) => {
    if (!acc[p.name]) acc[p.name] = {};
    if (Number(p.price) === 0) { acc[p.name].monthly = p; return acc; }
    if (p.interval === "month") acc[p.name].monthly = p;
    if (p.interval === "year")  acc[p.name].yearly  = p;
    return acc;
  }, {});

  const tiers = TIER_ORDER.map((n) => byTier[n]).filter(Boolean);

  const collectorTier = byTier["Collector"];
  const saving = collectorTier?.monthly && collectorTier?.yearly
    ? yearlySavingPct(collectorTier.monthly.price, collectorTier.yearly.price)
    : null;

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-semibold text-vault-text">Billing</span>
        <div className="inline-flex items-center rounded-[6px] border border-vault-border bg-vault-raised p-0.5 gap-0.5">
          <button
            onClick={() => onBillingChange("monthly")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
              billing === "monthly"
                ? "bg-vault-surface text-vault-accent dark:text-vault-accent "
                : "text-vault-textTertiary hover:text-vault-text dark:hover:text-vault-text"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => onBillingChange("yearly")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
              billing === "yearly"
                ? "bg-vault-surface text-vault-accent dark:text-vault-accent "
                : "text-vault-textTertiary hover:text-vault-text dark:hover:text-vault-text"
            }`}
          >
            Yearly
            {saving && (
              <span className="text-[10px] font-bold px-1 py-0.5 rounded-[6px] bg-emerald-500/15 text-emerald-500">
                -{saving}%
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {tiers.map((tier) => {
          const plan    = (billing === "yearly" && tier.yearly) ? tier.yearly : tier.monthly;
          if (!plan) return null;

          const isCurrent = tier.monthly?.id === currentPlanId || tier.yearly?.id === currentPlanId;
          const isFree    = Number(plan.price) === 0;
          const isLoading = selectLoading === plan.id;
          const features  = (() => {
            const raw = plan.featuresJson;
            if (Array.isArray(raw) && raw.length > 0) return raw.slice(0, 4);
            if (typeof raw === 'string') { try { const p = JSON.parse(raw); if (p.length) return p.slice(0, 4); } catch {} }
            return FALLBACK_FEATURES[(plan.name || "").toLowerCase()] ?? [];
          })();

          return (
            <div
              key={plan.name}
              className={`rounded-[10px] border p-4 flex flex-col transition ${
                isCurrent
                  ? "border-vault-accent/50 dark:border-vault-accent/50 bg-vault-accent/[0.04] dark:bg-vault-accent/[0.06]"
                  : "border-vault-border bg-vault-surface"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-bold text-sm text-vault-accent dark:text-vault-accent">{plan.name}</span>
                {isCurrent && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[6px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap">
                    Current
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="mb-2">
                <span className="text-xl font-extrabold text-vault-accent dark:text-vault-accent">
                  {isFree ? "Free" : fmtPrice(plan.price)}
                </span>
                {!isFree && (
                  <span className="text-xs text-vault-textTertiary ml-1">
                    {fmtInterval(plan.interval)}
                  </span>
                )}
              </div>

              {/* Fee */}
              <div className="mb-3">
                <FeeDot pct={plan.platformFeePercent} />
              </div>

              {/* Top features */}
              {features.length > 0 && (
                <ul className="flex-1 mb-3 space-y-1">
                  {features.map((f, i) => (
                    <li key={i} className="text-xs text-vault-textSecondary flex gap-1.5">
                      <span className="text-emerald-500 shrink-0 mt-px">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* CTA */}
              {isCurrent ? (
                <button
                  disabled
                  className="mt-auto w-full py-1.5 rounded-[6px] text-xs font-semibold border border-vault-border text-vault-textTertiary bg-vault-raised cursor-default"
                >
                  Current plan
                </button>
              ) : isFree ? (
                <button
                  disabled
                  className="mt-auto w-full py-1.5 rounded-[6px] text-xs font-semibold border border-vault-border text-vault-textTertiary bg-vault-raised cursor-default"
                >
                  Free forever
                </button>
              ) : (
                <button
                  onClick={() => onSelect(plan, !hasActiveSub)}
                  disabled={!!selectLoading}
                  className="mt-auto w-full py-1.5 rounded-[6px] text-xs font-semibold bg-vault-accent hover:bg-vault-accentHover dark:bg-vault-accent dark:hover:bg-vault-accentHover text-white transition disabled:opacity-60 disabled:cursor-wait"
                >
                  {isLoading ? "…" : hasActiveSub ? `Switch to ${plan.name}` : `Choose ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Transaction history ──────────────────────────────────────────────────────

function TransactionHistory({ transactions }) {
  if (!transactions.length) {
    return (
      <p className="text-sm text-vault-textTertiary">No billing history yet.</p>
    );
  }

  return (
    <div className="rounded-[10px] border border-vault-border bg-vault-surface overflow-hidden">
      <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-vault-border text-xs font-semibold text-vault-textTertiary uppercase tracking-wide">
        <div>Description</div>
        <div>Date</div>
        <div>Amount</div>
        <div>Status</div>
      </div>
      <ul className="divide-y divide-vault-border dark:divide-vault-border">
        {transactions.map((t) => (
          <li
            key={t.id}
            className="px-5 py-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-1 sm:gap-4 items-center text-sm"
          >
            <div className="font-medium text-vault-text">
              {t.description || t.type}
            </div>
            <div className="text-xs text-vault-textTertiary">
              {fmtDate(t.createdAt)}
            </div>
            <div className="text-vault-text">
              £{Number(t.amount).toFixed(2)}
            </div>
            <div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-[6px] border ${
                t.status === "completed"
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  : t.status === "pending"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-vault-raised text-vault-textTertiary border-vault-border"
              }`}>
                {t.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionTab() {
  const [plans,        setPlans]        = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [billing,      setBilling]      = useState("monthly");
  const [loading,      setLoading]      = useState(true);
  const [status,       setStatus]       = useState(null);
  const [modal,        setModal]        = useState({ type: null, plan: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [selectLoading, setSelectLoading] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchSubscriptionPlans(),
      fetchUserSubscription(),
      fetchUserCapabilities(),
      fetchUserTransactions(),
    ])
      .then(([p, s, c, t]) => {
        setPlans(p || []);
        setSubscription(s || null);
        setCapabilities(c || null);
        setTransactions(t || []);
      })
      .catch((err) => setStatus({ type: "error", msg: err?.message || "Failed to load subscription data." }))
      .finally(() => setLoading(false));
  }, []);

  const closeModal = useCallback(() => {
    setModal({ type: null, plan: null });
    setActionLoading(false);
  }, []);

  // New subscriber → Stripe checkout; existing → inline switch with modal
  const handleSelectPlan = useCallback(async (plan, isNew) => {
    if (isNew) {
      setSelectLoading(plan.id);
      try {
        const url = await startSubscriptionCheckout(plan.id);
        window.location.href = url;
      } catch (err) {
        setStatus({ type: "error", msg: err?.message || "Could not start checkout." });
        setSelectLoading(null);
      }
    } else {
      setModal({ type: "changePlan", plan });
    }
  }, []);

  const handleChangePlanConfirm = useCallback(async () => {
    setActionLoading(true);
    setStatus(null);
    try {
      const updated = await updateUserSubscription(modal.plan.id);
      setSubscription(updated);
      setStatus({ type: "success", msg: `Switched to ${modal.plan.name}!` });
      closeModal();
    } catch (err) {
      setStatus({ type: "error", msg: err?.message || "Could not switch plan." });
      setActionLoading(false);
    }
  }, [modal.plan, closeModal]);

  const handleCancelConfirm = useCallback(async () => {
    setActionLoading(true);
    setStatus(null);
    try {
      await cancelUserSubscription();
      setSubscription((s) => s ? { ...s, cancelAtPeriodEnd: true } : s);
      setStatus({ type: "success", msg: "Subscription cancelled. You'll keep access until your renewal date." });
      closeModal();
    } catch (err) {
      setStatus({ type: "error", msg: err?.message || "Could not cancel subscription." });
      setActionLoading(false);
    }
  }, [closeModal]);

  const handleReactivateConfirm = useCallback(async () => {
    setActionLoading(true);
    setStatus(null);
    try {
      const updated = await reactivateUserSubscription();
      setSubscription(updated);
      setStatus({ type: "success", msg: "Subscription reactivated!" });
      closeModal();
    } catch (err) {
      setStatus({ type: "error", msg: err?.message || "Could not reactivate." });
      setActionLoading(false);
    }
  }, [closeModal]);

  const handleManageBilling = useCallback(async () => {
    try {
      await openBillingPortal();
    } catch (err) {
      setStatus({ type: "error", msg: err?.message || "Billing portal unavailable." });
    }
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 py-4">
        <div className="h-24 rounded-[10px] bg-vault-border/30 dark:bg-vault-border/30" />
        <div className="h-52 rounded-[10px] bg-vault-border/30 dark:bg-vault-border/30" />
      </div>
    );
  }

  const hasActiveSub  = Boolean(subscription?.status === "active" && !subscription?.cancelAtPeriodEnd);
  const currentPlanId = subscription?.plan?.id;

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-extrabold text-vault-accent dark:text-vault-accent">
        Subscription & Billing
      </h2>

      {status && (
        <StatusMessage type={status.type} message={status.msg} onClose={() => setStatus(null)} />
      )}

      {/* Current plan */}
      <CurrentPlanCard
        subscription={subscription}
        capabilities={capabilities}
        onCancel={() => setModal({ type: "cancel", plan: null })}
        onReactivate={() => setModal({ type: "reactivate", plan: null })}
        onManageBilling={handleManageBilling}
      />

      {/* Plan picker */}
      <section>
        <h3 className="text-base font-bold mb-3 text-vault-accent dark:text-vault-accent">Plans</h3>
        <PlanPicker
          plans={plans}
          currentPlanId={currentPlanId}
          hasActiveSub={hasActiveSub}
          billing={billing}
          onBillingChange={setBilling}
          onSelect={handleSelectPlan}
          selectLoading={selectLoading}
        />
        <p className="mt-3 text-xs text-vault-textTertiary">
          All prices in GBP.{" "}
          <a href="/subscriptions" className="underline underline-offset-2 hover:text-vault-text dark:hover:text-vault-text transition">
            View full plan comparison →
          </a>
        </p>
      </section>

      {/* Billing history */}
      <section>
        <h3 className="text-base font-bold mb-3 text-vault-accent dark:text-vault-accent">Billing History</h3>
        <TransactionHistory transactions={transactions} />
      </section>

      <Modal
        open={modal.type !== null}
        type={modal.type}
        plan={modal.plan}
        onConfirm={
          modal.type === "cancel"      ? handleCancelConfirm     :
          modal.type === "reactivate"  ? handleReactivateConfirm :
          handleChangePlanConfirm
        }
        onClose={closeModal}
        loading={actionLoading}
      />
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  fetchSubscriptionPlans,
  fetchUserSubscription,
  updateUserSubscription,
  cancelUserSubscription,
  reactivateUserSubscription,
  fetchUserInvoices,
} from "@/utils/subscriptionsApi";
import StatusMessage from "@/components/UI/StatusMessage";

/* =========================
   Helpers
   ========================= */
// NEW: consistent currency formatter
function formatGBP(valueInPence) {
  if (typeof valueInPence !== "number") return valueInPence || "";
  return `£${(valueInPence / 100).toFixed(2)}`;
}
// NEW: normalize interval copy
function intervalLabel(interval) {
  if (!interval) return "";
  if (interval.toLowerCase() === "month" || interval.toLowerCase() === "mo") return "/mo";
  if (interval.toLowerCase() === "year" || interval.toLowerCase() === "yr") return "/yr";
  return `/${interval}`;
}
// NEW: safe array
const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/* =========================
   Modal (accessible)
   ========================= */
// CHANGED: a11y attributes, clearer copy, consistent buttons
function SubscriptionModal({ open, type, plan, onConfirm, onClose, loading }) {
  if (!open) return null;

  const titleId = "sub-modal-title";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {type === "subscribe" && plan && (
          <>
            <h3 id={titleId} className="text-xl font-extrabold mb-2">
              {plan.price === 0 ? "Switch to" : "Subscribe to"} {plan.name}
            </h3>

            <div className="mb-4 text-sm text-light-textSecondary dark:text-dark-textSecondary">
              <div className="text-2xl font-extrabold text-light-primary dark:text-dark-primary mb-1">
                {plan.price === 0 ? (
                  "Free"
                ) : (
                  <>
                    {formatGBP(plan.price)}
                    <span className="text-base font-medium text-light-textMuted dark:text-dark-textMuted">
                      {" "}{intervalLabel(plan.interval)}
                    </span>
                  </>
                )}
              </div>
              {plan.description && <div className="mb-3">{plan.description}</div>}
              {toArray(plan.features).length > 0 && (
                <ul className="list-disc ml-5 space-y-1">
                  {toArray(plan.features).map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={onConfirm}
                disabled={loading}
                className="inline-flex items-center justify-center px-5 py-2 rounded-lg bg-light-accent hover:bg-light-accentLight text-white dark:bg-dark-accent dark:hover:bg-dark-accentLight font-semibold transition"
              >
                {loading ? "Processing…" : plan.price === 0 ? "Confirm" : "Confirm & Checkout"}
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center px-5 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt hover:bg-light-surface dark:hover:bg-dark-surface transition"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {type === "cancel" && (
          <>
            <h3 id={titleId} className="text-xl font-extrabold mb-2">Cancel subscription?</h3>
            <p className="mb-4 text-sm text-light-textSecondary dark:text-dark-textSecondary">
              You’ll keep access until the end of your current billing period.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onConfirm}
                disabled={loading}
                className="inline-flex items-center justify-center px-5 py-2 rounded-lg bg-light-error hover:bg-light-error/90 text-white font-semibold transition"
              >
                {loading ? "Cancelling…" : "Yes, cancel"}
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center px-5 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt hover:bg-light-surface dark:hover:bg-dark-surface transition"
              >
                Go back
              </button>
            </div>
          </>
        )}

        {type === "reactivate" && (
          <>
            <h3 id={titleId} className="text-xl font-extrabold mb-2">Reactivate subscription?</h3>
            <p className="mb-4 text-sm text-light-textSecondary dark:text-dark-textSecondary">
              Your subscription will continue with no interruption.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onConfirm}
                disabled={loading}
                className="inline-flex items-center justify-center px-5 py-2 rounded-lg bg-light-accent hover:bg-light-accentLight text-white dark:bg-dark-accent dark:hover:bg-dark-accentLight font-semibold transition"
              >
                {loading ? "Reactivating…" : "Reactivate"}
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center px-5 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt hover:bg-light-surface dark:hover:bg-dark-surface transition"
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

/* =========================
   Presentational bits
   ========================= */
// NEW: clean badge
function Chip({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-light-alt dark:bg-dark-alt text-light-textMuted dark:text-dark-textMuted border-light-border dark:border-dark-border",
    green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border-green-200/60 dark:border-green-900",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 border-amber-200/60 dark:border-amber-900",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border ${tones[tone]}`}>
      {children}
    </span>
  );
}

// NEW: current plan overview
function CurrentPlanCard({ current, onCancel, onReactivate }) {
  const isActive = current?.status === "active";
  const isCanceled = current?.status === "canceled";
  const renews = current?.renewsAt ? new Date(current.renewsAt) : null;

  return (
    <section className="p-6 rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shadow">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">
            Current plan:{" "}
            <span className="text-light-accent dark:text-dark-accent">
              {current?.plan?.name || "—"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-light-textMuted dark:text-dark-textMuted">
            Status:
            {isActive && <Chip tone="green">Active</Chip>}
            {isCanceled && <Chip tone="amber">Cancelling at period end</Chip>}
            {!isActive && !isCanceled && <Chip> {current?.status || "Unknown"} </Chip>}
            {renews && (
              <span className="ml-2">
                | Renews: {renews.toLocaleDateString("en-GB")}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isActive && current?.plan?.id !== "free" && (
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-light-error hover:bg-light-error/90 text-white font-semibold transition"
            >
              Cancel subscription
            </button>
          )}
          {isCanceled && (
            <button
              onClick={onReactivate}
              className="px-4 py-2 rounded-lg bg-light-accent hover:bg-light-accentLight text-white font-semibold transition dark:bg-dark-accent dark:hover:bg-dark-accentLight"
            >
              Reactivate
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// NEW: plan card with consistent styles
function PlanCard({ plan, isCurrent, onChoose }) {
  return (
    <div
      className={`p-6 rounded-2xl border shadow transition
        ${isCurrent
          ? "border-light-accent dark:border-dark-accent bg-light-accent/5 dark:bg-dark-accent/10"
          : "border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface hover:shadow-md"}
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg font-bold">{plan.name}</span>
        {isCurrent && <Chip tone="green">Current</Chip>}
      </div>

      {plan.description && (
        <div className="text-sm text-light-textMuted dark:text-dark-textMuted mb-2">
          {plan.description}
        </div>
      )}

      <div className="text-2xl font-extrabold mb-4">
        {plan.price === 0 ? (
          "Free"
        ) : (
          <>
            {typeof plan.price === "number" ? formatGBP(plan.price) : plan.price}
            <span className="text-base font-medium text-light-textMuted dark:text-dark-textMuted">
              {" "}{intervalLabel(plan.interval)}
            </span>
          </>
        )}
      </div>

      {toArray(plan.features).length > 0 && (
        <ul className="mb-4 text-sm space-y-1">
          {toArray(plan.features).map((f, i) => (
            <li key={i}>• {f}</li>
          ))}
        </ul>
      )}

      {!isCurrent ? (
        <button
          onClick={() => onChoose(plan)}
          className="mt-auto px-4 py-2 rounded-lg bg-light-accent hover:bg-light-accentLight text-white font-semibold transition dark:bg-dark-accent dark:hover:bg-dark-accentLight"
        >
          {plan.price === 0 ? "Switch to Free" : `Choose ${plan.name}`}
        </button>
      ) : (
        <button
          disabled
          className="mt-auto px-4 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-textMuted dark:text-dark-textMuted cursor-not-allowed"
        >
          Selected
        </button>
      )}
    </div>
  );
}

// NEW: invoice list (table-like but responsive)
function InvoiceList({ invoices = [] }) {
  if (!invoices.length) {
    return <div className="text-sm text-light-textMuted dark:text-dark-textMuted">No invoices found.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface">
      <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-light-border dark:border-dark-border text-sm font-semibold">
        <div>Description</div>
        <div>Date</div>
        <div>Amount</div>
        <div>Status</div>
      </div>

      <ul className="divide-y divide-light-border dark:divide-dark-border">
        {invoices.map((inv) => (
          <li key={inv.id} className="px-5 py-3 grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-sm">
            <div className="font-medium">{inv.description}</div>
            <div className="text-light-textMuted dark:text-dark-textMuted">
              {new Date(inv.date).toLocaleDateString("en-GB")}
            </div>
            <div>{formatGBP(inv.amount)} <span className="uppercase">{inv.currency}</span></div>
            <div>
              <Chip tone={inv.status === "paid" ? "green" : "amber"}>{inv.status}</Chip>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* =========================
   Main component
   ========================= */
export default function SubscriptionTab({ user, token }) {
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [status, setStatus] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ type: null, plan: null });
  const [actionLoading, setActionLoading] = useState(false);

  // CHANGED: load all data together + error safety
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [plansRes, currentRes, invoicesRes] = await Promise.all([
          fetchSubscriptionPlans(),
          fetchUserSubscription(token),
          fetchUserInvoices(),
        ]);
        if (!mounted) return;
        setPlans(plansRes || []);
        setCurrent(currentRes || null);
        setInvoices(invoicesRes || []);
      } catch (err) {
        setStatus({ type: "error", msg: err?.message || "Failed to load subscription data." });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [token]);

  // Modal handlers
  const openSubscribeModal = (plan) => setModal({ type: "subscribe", plan });
  const openCancelModal = () => setModal({ type: "cancel", plan: null });
  const openReactivateModal = () => setModal({ type: "reactivate", plan: null });
  const closeModal = () => { setModal({ type: null, plan: null }); setActionLoading(false); };

  // Actions
  async function handleSubscribeConfirm() {
    setActionLoading(true);
    setStatus(null);
    try {
      const newSub = await updateUserSubscription(modal.plan.id);
      setCurrent(newSub);
      setStatus({ type: "success", msg: `Switched to ${modal.plan.name} plan!` });
      closeModal();
    } catch (err) {
      setStatus({ type: "error", msg: err?.message || "Could not update plan." });
      setActionLoading(false);
    }
  }

  async function handleCancelConfirm() {
    setActionLoading(true);
    setStatus(null);
    try {
      await cancelUserSubscription();
      setCurrent((old) => ({ ...(old || {}), status: "canceled" }));
      setStatus({ type: "success", msg: "Subscription cancelled. You’ll keep access until your renewal date." });
      closeModal();
    } catch (err) {
      setStatus({ type: "error", msg: err?.message || "Could not cancel subscription." });
      setActionLoading(false);
    }
  }

  async function handleReactivateConfirm() {
    setActionLoading(true);
    setStatus(null);
    try {
      const sub = await reactivateUserSubscription();
      setCurrent(sub);
      setStatus({ type: "success", msg: "Subscription reactivated!" });
      closeModal();
    } catch (err) {
      setStatus({ type: "error", msg: err?.message || "Could not reactivate subscription." });
      setActionLoading(false);
    }
  }

  /* =========================
     Render
     ========================= */
  if (loading) {
    return (
      <div className="py-12">
        <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-8 shadow">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-64 bg-light-border/50 dark:bg-dark-border/50 rounded" />
            <div className="h-36 w-full bg-light-border/30 dark:bg-dark-border/30 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // CHANGED: single spaced layout (no nested heavy frames)
  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-extrabold text-light-primary dark:text-dark-primary">Subscription & Billing</h2>
      </div>

      {status && (
        <StatusMessage type={status.type} message={status.msg} onClose={() => setStatus(null)} />
      )}

      {/* Current Plan */}
      <CurrentPlanCard
        current={current}
        onCancel={openCancelModal}
        onReactivate={openReactivateModal}
      />

      {/* Plans */}
      <section>
        <h3 className="text-lg font-bold mb-3">Plans & Upgrades</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === current?.plan?.id}
              onChoose={openSubscribeModal}
            />
          ))}
        </div>
      </section>

      {/* Billing History */}
      <section>
        <h3 className="text-lg font-bold mb-3">Billing History</h3>
        <InvoiceList invoices={invoices} />
      </section>

      {/* Modal */}
      <SubscriptionModal
        open={modal.type !== null}
        type={modal.type}
        plan={modal.plan}
        onConfirm={
          modal.type === "subscribe"
            ? handleSubscribeConfirm
            : modal.type === "cancel"
            ? handleCancelConfirm
            : handleReactivateConfirm
        }
        onClose={closeModal}
        loading={actionLoading}
      />
    </div>
  );
}

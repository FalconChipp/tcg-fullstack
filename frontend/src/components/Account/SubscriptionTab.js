import React, { useEffect, useState } from "react";
import {
  fetchSubscriptionPlans,
  fetchUserSubscription,
  updateUserSubscription,
  cancelUserSubscription,
  reactivateUserSubscription,
  fetchUserInvoices,
} from "@/utils/subscriptionsApi"; // <- adjust path as needed!
import StatusMessage from "@/components/UI/StatusMessage";

// --- Modal component for all actions ---
function SubscriptionModal({ open, type, plan, onConfirm, onClose, loading }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center">
      <div className="bg-white dark:bg-dark-surface p-8 rounded-2xl shadow-xl max-w-md w-full">
        {type === "subscribe" && plan && (
          <>
            <h3 className="text-xl font-bold mb-3">
              {plan.price === 0 ? "Switch to" : "Subscribe to"} {plan.name}
            </h3>
            <div className="mb-4">
              <div className="font-semibold text-2xl mb-1">
                {plan.price === 0
                  ? "Free"
                  : typeof plan.price === "number"
                  ? `£${(plan.price / 100).toFixed(2)} / ${plan.interval}`
                  : plan.price}
              </div>
              <div className="mb-3">{plan.description}</div>
              <ul className="list-disc ml-5 mb-3">
                {plan.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="bg-light-accent dark:bg-dark-accent text-white dark:text-black px-6 py-2 rounded-lg font-bold mr-2"
            >
              {loading ? "Processing..." : "Confirm & Checkout"}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg border ml-2"
            >
              Cancel
            </button>
          </>
        )}
        {type === "cancel" && (
          <>
            <h3 className="text-xl font-bold mb-3">Cancel Subscription?</h3>
            <p className="mb-4">
              You’ll keep access until the end of your billing period.
              <br />
              Are you sure you want to cancel?
            </p>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="bg-light-error text-white px-6 py-2 rounded-lg font-bold mr-2"
            >
              {loading ? "Cancelling..." : "Yes, Cancel"}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg border ml-2"
            >
              Go Back
            </button>
          </>
        )}
        {type === "reactivate" && (
          <>
            <h3 className="text-xl font-bold mb-3">
              Reactivate Subscription?
            </h3>
            <p className="mb-4">
              Your subscription will continue with no interruption.
              <br />
              Reactivate now?
            </p>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="bg-light-accent dark:bg-dark-accent text-white dark:text-black px-6 py-2 rounded-lg font-bold mr-2"
            >
              {loading ? "Reactivating..." : "Reactivate"}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg border ml-2"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function SubscriptionTab({ user, token }) {
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [status, setStatus] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ type: null, plan: null }); // Modal state
  const [actionLoading, setActionLoading] = useState(false);

  // Load data on mount
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchSubscriptionPlans(),
      fetchUserSubscription(token),
      fetchUserInvoices(),
    ]).then(([plans, current, invoices]) => {
      setPlans(plans);
      setCurrent(current);
      setInvoices(invoices);
      setLoading(false);
    });
  }, [token]);

  // Modal handlers
  function openSubscribeModal(plan) {
    setModal({ type: "subscribe", plan });
  }
  function openCancelModal() {
    setModal({ type: "cancel" });
  }
  function openReactivateModal() {
    setModal({ type: "reactivate" });
  }
  function closeModal() {
    setModal({ type: null, plan: null });
    setActionLoading(false);
  }

  // Action handlers
  async function handleSubscribeConfirm() {
    setActionLoading(true);
    setStatus(null);
    try {
      const newSub = await updateUserSubscription(modal.plan.id);
      setCurrent(newSub);
      setStatus({
        type: "success",
        msg: `Switched to ${modal.plan.name} plan!`,
      });
      closeModal();
    } catch (err) {
      setStatus({ type: "error", msg: err.message });
      setActionLoading(false);
    }
  }

  async function handleCancelConfirm() {
    setActionLoading(true);
    setStatus(null);
    try {
      await cancelUserSubscription();
      setCurrent((old) => ({ ...old, status: "canceled" }));
      setStatus({
        type: "success",
        msg: "Subscription cancelled. You’ll keep access until your renewal date.",
      });
      closeModal();
    } catch (err) {
      setStatus({ type: "error", msg: err.message });
      setActionLoading(false);
    }
  }

  async function handleReactivateConfirm() {
    setActionLoading(true);
    setStatus(null);
    try {
      const sub = await reactivateUserSubscription();
      setCurrent(sub);
      setStatus({
        type: "success",
        msg: "Subscription reactivated!",
      });
      closeModal();
    } catch (err) {
      setStatus({ type: "error", msg: err.message });
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-lg text-light-text dark:text-dark-text">
        Loading subscription details…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold mb-2 text-light-primary dark:text-dark-primary">
        Subscription & Plan
      </h2>

      {status && (
        <StatusMessage
          type={status.type}
          message={status.msg}
          onClose={() => setStatus(null)}
        />
      )}

      {/* Current Plan Overview */}
      <div className="mb-6 p-6 rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shadow">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">
              Current Plan:{" "}
              <span className="text-light-accent dark:text-dark-accent">
                {current?.plan?.name}
              </span>
            </div>
            <div className="text-sm text-light-textMuted dark:text-dark-textMuted mt-1">
              Status:{" "}
              <span
                className={
                  current?.status === "active"
                    ? "text-green-600"
                    : "text-yellow-600"
                }
              >
                {current?.status === "active"
                  ? "Active"
                  : current?.status === "canceled"
                  ? "Cancelled (will end on renewal)"
                  : current?.status}
              </span>
              {current?.renewsAt && (
                <>
                  {" "}
                  | Renews:{" "}
                  {new Date(current.renewsAt).toLocaleDateString("en-GB")}
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {current?.status === "active" && current.plan.id !== "free" && (
              <button
                onClick={openCancelModal}
                className="rounded-lg px-4 py-2 font-semibold bg-light-error text-white dark:bg-red-700 dark:text-white hover:bg-red-600 dark:hover:bg-red-600 transition"
              >
                Cancel Subscription
              </button>
            )}
            {current?.status === "canceled" && (
              <button
                onClick={openReactivateModal}
                className="rounded-lg px-4 py-2 font-semibold bg-light-accent dark:bg-dark-accent text-white dark:text-black hover:bg-light-primary dark:hover:bg-dark-primary transition"
              >
                Reactivate Subscription
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Plans Table */}
      <div>
        <h3 className="text-lg font-bold mb-2">Plans & Upgrades</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.id === current?.plan?.id;
            return (
              <div
                key={plan.id}
                className={`p-6 rounded-2xl border shadow flex flex-col ${
                  isCurrent
                    ? "border-light-accent dark:border-dark-accent bg-light-accent/5 dark:bg-dark-accent/10"
                    : "border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold">{plan.name}</span>
                  {isCurrent && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-light-accent dark:bg-dark-accent text-white dark:text-black">
                      Current
                    </span>
                  )}
                </div>
                <div className="text-sm text-light-textMuted dark:text-dark-textMuted mb-2">
                  {plan.description}
                </div>
                <div className="text-2xl font-extrabold mb-4">
                  {plan.price === 0 ? (
                    "Free"
                  ) : (
                    <>
                      {typeof plan.price === "number"
                        ? `£${(plan.price / 100).toFixed(2)}`
                        : plan.price}
                      <span className="text-base font-medium text-light-textMuted dark:text-dark-textMuted">
                        {plan.interval ? ` / ${plan.interval}` : ""}
                      </span>
                    </>
                  )}
                </div>
                <ul className="mb-4 text-sm space-y-1">
                  {plan.features.map((f, i) => (
                    <li key={i}>• {f}</li>
                  ))}
                </ul>
                {!isCurrent && (
                  <button
                    onClick={() => openSubscribeModal(plan)}
                    className="rounded-lg px-4 py-2 font-semibold bg-light-accent dark:bg-dark-accent text-white dark:text-black hover:bg-light-primary dark:hover:bg-dark-primary transition"
                  >
                    {plan.price === 0 ? "Switch to Free" : `Choose ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing History */}
      <div>
        <h3 className="text-lg font-bold mb-2 mt-6">Billing History</h3>
        {invoices.length === 0 ? (
          <div className="text-sm text-light-textMuted dark:text-dark-textMuted">
            No invoices found.
          </div>
        ) : (
          <ul className="divide-y divide-light-border dark:divide-dark-border text-sm">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="py-2 flex justify-between items-center"
              >
                <span>
                  {inv.description} (
                  {new Date(inv.date).toLocaleDateString("en-GB")})
                </span>
                <span>
                  £{(inv.amount / 100).toFixed(2)}{" "}
                  <span className="uppercase">{inv.currency}</span>
                  <span
                    className={`ml-2 px-2 py-0.5 rounded text-xs ${
                      inv.status === "paid"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {inv.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* MODAL for subscribe/cancel/reactivate */}
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

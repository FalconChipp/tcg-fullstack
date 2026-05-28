"use client";

import React, { useState, useEffect, useCallback, useContext } from "react";
import { getGraphqlUrl } from "@/utils/apiClient";
import { AuthContext } from "@/components/Auth/AuthProvider";

/* ─── GQL ────────────────────────────────────────────────────────────────── */

const ADMIN_WITHDRAWALS_QUERY = `
  query AdminWithdrawals($status: String, $limit: Int, $offset: Int) {
    adminWithdrawals(status: $status, limit: $limit, offset: $offset) {
      total
      withdrawals {
        id userId amountPence amount status description
        sortCode accountNumber accountName createdAt
      }
    }
  }
`;

const COMPLETE_MUTATION = `
  mutation AdminCompleteWithdrawal($id: ID!) {
    adminCompleteWithdrawal(id: $id)
  }
`;

const REJECT_MUTATION = `
  mutation AdminRejectWithdrawal($id: ID!, $reason: String) {
    adminRejectWithdrawal(id: $id, reason: $reason)
  }
`;

async function gql(query, variables, token) {
  const res = await fetch(getGraphqlUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const GBP     = "£";
const fmt     = (n) => `${GBP}${Number(n).toFixed(2)}`;
const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
};
const fmtSC   = (sc) => sc ? String(sc).replace(/(\d{2})(\d{2})(\d{2})/, "$1-$2-$3") : "—";

const PAGE_SIZE = 20;

const STATUS_TABS = [
  { id: "pending",   label: "Pending"   },
  { id: "completed", label: "Completed" },
  { id: "failed",    label: "Rejected"  },
  { id: "all",       label: "All"       },
];

/* ─── Reject modal ───────────────────────────────────────────────────────── */

function RejectModal({ withdrawal, onConfirm, onCancel, busy }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#0f1117] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-sm font-bold text-neutral-50">Reject withdrawal</h3>
        <p className="text-xs text-neutral-400">
          Rejecting <span className="font-semibold text-white">{fmt(withdrawal.amount)}</span> will refund the
          balance back to the user's wallet.
        </p>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">
            Reason <span className="opacity-60">(optional — shown to user)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Invalid account details"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-white/[0.08] text-neutral-400 hover:text-neutral-200 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={busy}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50"
          >
            {busy ? "Rejecting…" : "Reject & refund"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main panel ─────────────────────────────────────────────────────────── */

export default function AdminWithdrawalsPanel() {
  const { token } = useContext(AuthContext);

  const [status,      setStatus]      = useState("pending");
  const [page,        setPage]        = useState(0);
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [actionBusy,  setActionBusy]  = useState(null); // id being acted on
  const [rejectItem,  setRejectItem]  = useState(null); // withdrawal being rejected
  const [toastMsg,    setToastMsg]    = useState(null);

  const toast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 4000); };

  const load = useCallback(async (pg = 0) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await gql(ADMIN_WITHDRAWALS_QUERY, {
        status,
        limit:  PAGE_SIZE,
        offset: pg * PAGE_SIZE,
      }, token);
      setData(res.adminWithdrawals);
      setPage(pg);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, status]);

  useEffect(() => { load(0); }, [load]);

  async function handleComplete(id) {
    setActionBusy(id);
    try {
      await gql(COMPLETE_MUTATION, { id }, token);
      toast("Marked as completed.");
      await load(page);
    } catch (e) {
      toast(`Error: ${e.message}`);
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRejectConfirm(reason) {
    const id = rejectItem.id;
    setActionBusy(id);
    try {
      await gql(REJECT_MUTATION, { id, reason: reason || undefined }, token);
      setRejectItem(null);
      toast("Withdrawal rejected and balance refunded.");
      await load(page);
    } catch (e) {
      toast(`Error: ${e.message}`);
    } finally {
      setActionBusy(null);
    }
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-neutral-50">Withdrawals</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Review pending requests, send in Monzo, then mark complete.
          </p>
        </div>
        {data && (
          <span className="text-xs text-neutral-500">
            {data.total} total
          </span>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setStatus(t.id); setPage(0); }}
            className={[
              "px-3 py-1 rounded-lg text-xs font-semibold transition",
              status === t.id
                ? "bg-white/10 text-neutral-50"
                : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-4 py-2">
          {toastMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs px-4 py-2">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : !data?.withdrawals?.length ? (
          <div className="p-10 text-center text-sm text-neutral-500">
            No withdrawals with status <span className="font-semibold">{status}</span>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-600 border-b border-white/[0.06]">
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Account name</th>
                  <th className="px-4 py-3 font-semibold">Sort code</th>
                  <th className="px-4 py-3 font-semibold">Acc. number</th>
                  <th className="px-4 py-3 font-semibold">User ID</th>
                  <th className="px-4 py-3 font-semibold">Requested</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 font-bold text-emerald-400 whitespace-nowrap tabular-nums">
                      {fmt(w.amount)}
                    </td>
                    <td className="px-4 py-3 text-neutral-200 whitespace-nowrap">
                      {w.accountName || <span className="text-neutral-600">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-300 whitespace-nowrap">
                      {fmtSC(w.sortCode)}
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-300 whitespace-nowrap">
                      {w.accountNumber || "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs font-mono max-w-[120px] truncate">
                      {w.userId}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                      {fmtDate(w.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={[
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                        w.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                        w.status === "pending"   ? "bg-amber-500/10  text-amber-400"   :
                                                   "bg-rose-500/10   text-rose-400",
                      ].join(" ")}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {w.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleComplete(w.id)}
                            disabled={actionBusy === w.id}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
                          >
                            {actionBusy === w.id ? "…" : "Complete"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectItem(w)}
                            disabled={!!actionBusy}
                            className="px-3 py-1 rounded-lg text-xs font-semibold border border-white/[0.08] text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => load(page - 1)}
              disabled={page === 0 || loading}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/[0.06] text-neutral-500 hover:text-neutral-200 transition disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-xs text-neutral-600">Page {page + 1} of {totalPages}</span>
            <button
              type="button"
              onClick={() => load(page + 1)}
              disabled={page >= totalPages - 1 || loading}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/[0.06] text-neutral-500 hover:text-neutral-200 transition disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectItem && (
        <RejectModal
          withdrawal={rejectItem}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectItem(null)}
          busy={actionBusy === rejectItem.id}
        />
      )}
    </div>
  );
}

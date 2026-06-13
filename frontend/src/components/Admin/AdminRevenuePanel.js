"use client";

import React from "react";
import { gql, useQuery } from "@apollo/client";

// ─── GQL ─────────────────────────────────────────────────────────────────────

const REVENUE_SUMMARY_QUERY = gql`
  query AdminRevenueSummary {
    adminRevenueSummary {
      totalRevenue
      revenue30d
      revenue7d
      subRevenue
      productRevenue
      refunds
      currency
    }
    adminMarketplaceRevenue {
      gmv
      platformFees
      shippingCollected
      walletUsed
      refundedTotal
      stripeFeeEstimate
      gmv30d
      gmv7d
      platformFees30d
      totalOrders
      completedOrders
      openDisputes
      resolvedDisputes
      monthly { month gmv fees orders }
      currency
    }
  }
`;

const TRANSACTIONS_QUERY = gql`
  query AdminAllTransactions($page: Int, $pageSize: Int, $type: String) {
    adminAllTransactions(page: $page, pageSize: $pageSize, type: $type) {
      total
      transactions {
        id
        userId
        type
        amount
        currency
        status
        description
        stripePaymentIntentId
        createdAt
      }
    }
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Revenue card ─────────────────────────────────────────────────────────────

function RevenueCard({ label, value, sub, accent }) {
  const borders = { green: "border-emerald-500/20", blue: "border-sky-500/20", red: "border-red-500/20", amber: "border-amber-500/20", default: "border-white/[0.08]" };
  const bgs     = { green: "bg-emerald-500/[0.04]", blue: "bg-sky-500/[0.04]",  red: "bg-red-500/[0.04]",  amber: "bg-amber-500/[0.04]", default: "bg-white/[0.02]" };
  const colors  = { green: "text-emerald-300",       blue: "text-sky-300",        red: "text-red-300",        amber: "text-amber-300",       default: "text-neutral-50" };
  return (
    <div className={`border rounded-xl p-4 ${borders[accent] ?? borders.default} ${bgs[accent] ?? bgs.default}`}>
      <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${colors[accent] ?? colors.default}`}>{value}</p>
      {sub && <p className="text-[11px] text-neutral-500 mt-1.5">{sub}</p>}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="border border-white/[0.06] rounded-xl p-4 animate-pulse">
      <div className="h-3 w-20 rounded bg-white/10 mb-3" />
      <div className="h-7 w-24 rounded bg-white/10 mb-2" />
      <div className="h-2.5 w-32 rounded bg-white/[0.06]" />
    </div>
  );
}

// ─── Monthly bar chart (CSS only) ─────────────────────────────────────────────

function MonthlyChart({ monthly }) {
  if (!monthly?.length) return null;
  const maxGmv = Math.max(...monthly.map((m) => m.gmv), 1);
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1.5 h-20">
        {monthly.map((m) => {
          const pct    = (m.gmv / maxGmv) * 100;
          const feePct = m.gmv > 0 ? (m.fees / m.gmv) * 100 : 0;
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                <div className="bg-[#1a1c26] border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] whitespace-nowrap shadow-xl">
                  <p className="text-neutral-300 font-medium">{m.month}</p>
                  <p className="text-emerald-300">GMV: {gbp(m.gmv)}</p>
                  <p className="text-sky-300">Fees: {gbp(m.fees)}</p>
                  <p className="text-neutral-500">{m.orders} orders</p>
                </div>
                <div className="w-2 h-2 bg-[#1a1c26] border-r border-b border-white/10 rotate-45 -mt-1" />
              </div>
              <div className="w-full flex flex-col justify-end" style={{ height: "72px" }}>
                <div
                  className="w-full rounded-t-sm bg-emerald-500/20 border-t border-emerald-500/40 relative overflow-hidden"
                  style={{ height: `${Math.max(pct, 2)}%` }}
                >
                  <div className="absolute bottom-0 left-0 right-0 bg-sky-500/40" style={{ height: `${feePct}%` }} />
                </div>
              </div>
              <p className="text-[9px] text-neutral-600 truncate w-full text-center">{m.month.slice(5)}</p>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-[10px] text-neutral-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30 border border-emerald-500/50 inline-block" /> GMV</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-sky-500/40 inline-block" /> Platform fees</span>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function AdminRevenuePanel() {
  // adminRevenueSummary, adminMarketplaceRevenue, adminAllTransactions do not
  // yet exist in the gateway schema — skip queries to prevent 400 errors.
  const { data: rd, loading: rl, error: re, refetch: rRefetch } = useQuery(REVENUE_SUMMARY_QUERY, { fetchPolicy: "network-only", skip: true });
  const { data: td, loading: tl, refetch: tRefetch } = useQuery(TRANSACTIONS_QUERY, { variables: { page: 1, pageSize: 50 }, fetchPolicy: "network-only", skip: true });

  const sub    = rd?.adminRevenueSummary;
  const mkt    = rd?.adminMarketplaceRevenue;
  const txs    = td?.adminAllTransactions?.transactions ?? [];
  const txTotal = td?.adminAllTransactions?.total ?? 0;

  const txTypeColors = {
    subscription_payment: "text-emerald-300",
    subscription_refund:  "text-red-300",
    product_purchase:     "text-sky-300",
    product_refund:       "text-red-300",
  };

  const netRevenue = sub && mkt
    ? (sub.subRevenue ?? 0) + (sub.productRevenue ?? 0) + (mkt.platformFees ?? 0) - (sub.refunds ?? 0) - (mkt.refundedTotal ?? 0)
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-neutral-50">Revenue Overview</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Split across subscriptions, marketplace fees, and card sales.</p>
        </div>
        <button
          type="button"
          onClick={() => { rRefetch(); tRefetch(); }}
          disabled={rl || tl}
          className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-50 transition"
        >
          Refresh
        </button>
      </div>

      <div className="border border-amber-500/20 rounded-xl px-4 py-3 bg-amber-500/[0.04] flex gap-3 items-start">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 mt-0.5 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p className="text-xs text-amber-300/90">
          ⚠️ Revenue queries (<code className="font-mono text-amber-200">adminRevenueSummary</code>,{" "}
          <code className="font-mono text-amber-200">adminMarketplaceRevenue</code>,{" "}
          <code className="font-mono text-amber-200">adminAllTransactions</code>) have not yet been implemented
          in the gateway. Figures below are placeholders — data will populate once these operations are added to the schema.
        </p>
      </div>

      {re && <div className="border border-red-500/30 rounded-xl p-3 bg-red-950/20 text-xs text-red-300">{re.message}</div>}

      {/* ── Summary strip ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-600">Platform net revenue</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {rl && !rd ? (
            <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
          ) : (
            <>
              <RevenueCard
                label="Net revenue (all time)"
                value={netRevenue != null ? gbp(netRevenue) : "—"}
                sub="Subscriptions + marketplace fees − refunds"
                accent="green"
              />
              <RevenueCard
                label="Last 30 days (GMV)"
                value={mkt ? gbp((sub?.revenue30d ?? 0) + (mkt.platformFees30d ?? 0)) : "—"}
                sub={`${gbp(mkt?.gmv30d)} in card sales`}
                accent="amber"
              />
              <RevenueCard
                label="Last 7 days (GMV)"
                value={mkt ? gbp(mkt.gmv7d ?? 0) : "—"}
                sub="Gross card sale volume"
                accent="amber"
              />
            </>
          )}
        </div>
      </section>

      {/* ── Subscriptions section ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-600">Subscriptions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {rl && !sub ? (
            Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          ) : sub ? (
            <>
              <RevenueCard label="Subscription revenue" value={gbp(sub.subRevenue)} sub="All completed payments" accent="blue" />
              <RevenueCard label="Product revenue" value={gbp(sub.productRevenue)} sub="One-off product purchases" accent="blue" />
              <RevenueCard label="Sub refunds" value={gbp(sub.refunds)} sub="Subscription + product refunds" accent={sub.refunds > 0 ? "red" : "default"} />
              <RevenueCard label="Total (subs + products)" value={gbp(sub.totalRevenue)} accent="default" />
            </>
          ) : null}
        </div>
      </section>

      {/* ── Marketplace section ── */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-600">Marketplace — card sales</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {rl && !mkt ? (
            Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)
          ) : mkt ? (
            <>
              <RevenueCard label="Gross merch. value" value={gbp(mkt.gmv)} sub={`${mkt.totalOrders} orders total`} accent="green" />
              <RevenueCard label="Platform fees earned" value={gbp(mkt.platformFees)} sub="Our cut from card sales" accent="blue" />
              <RevenueCard label="Shipping collected" value={gbp(mkt.shippingCollected)} sub="Shipping charged at checkout" accent="default" />
              <RevenueCard label="Wallet used" value={gbp(mkt.walletUsed)} sub="Paid via platform wallet" accent="default" />
              <RevenueCard label="Card sale refunds" value={gbp(mkt.refundedTotal)} sub="From refunded orders" accent={mkt.refundedTotal > 0 ? "red" : "default"} />
              <RevenueCard
                label="Est. Stripe fees"
                value={gbp(mkt.stripeFeeEstimate)}
                sub="~1.4% + 20p per order (EU rate estimate)"
                accent={mkt.stripeFeeEstimate > 0 ? "red" : "default"}
              />
              <RevenueCard label="Completed orders" value={mkt.completedOrders} sub={`of ${mkt.totalOrders} total`} accent="default" />
              <RevenueCard
                label="Open disputes"
                value={mkt.openDisputes}
                sub={`${mkt.resolvedDisputes} resolved`}
                accent={mkt.openDisputes > 0 ? "amber" : "default"}
              />
            </>
          ) : null}
        </div>

        {mkt?.monthly?.length > 0 && (
          <div className="border border-white/[0.08] rounded-2xl p-4 bg-black/30">
            <p className="text-[11px] font-semibold text-neutral-400 mb-4">Monthly GMV — last 6 months</p>
            <MonthlyChart monthly={mkt.monthly} />
          </div>
        )}

        <div className="border border-amber-500/15 rounded-xl px-4 py-3 bg-amber-500/[0.03] flex gap-3 items-start">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 mt-0.5 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-[11px] text-amber-300/80">
            Stripe processing fees are estimated at EU card rates (1.4% + £0.20 per order). Actual fees depend on card type and country — check your{" "}
            <span className="underline underline-offset-2 cursor-pointer">Stripe Dashboard → Payouts</span>{" "}
            for exact figures. Stripe fees are not stored in the platform database.
          </p>
        </div>
      </section>

      {/* ── Transaction log ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-600">
          Transaction log{txTotal > 0 && <span className="normal-case font-normal text-neutral-600 ml-1.5">({txTotal} total)</span>}
        </h3>
        {tl && !td ? (
          <div className="border border-white/[0.06] rounded-2xl p-4 space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-3 rounded bg-white/[0.06]" />)}
          </div>
        ) : txs.length === 0 ? (
          <div className="border border-white/[0.06] rounded-2xl p-6 text-center text-sm text-neutral-500">No transactions yet.</div>
        ) : (
          <div className="overflow-x-auto border border-white/[0.08] rounded-2xl bg-black/30">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Date", "Type", "Amount", "Status", "Description", "User"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {txs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.03] transition">
                    <td className="px-3 py-2.5 text-neutral-400 whitespace-nowrap">{fmt(tx.createdAt)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`font-medium ${txTypeColors[tx.type] ?? "text-neutral-300"}`}>{titleCase(tx.type)}</span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-neutral-100 whitespace-nowrap">{gbp(tx.amount)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                        tx.status === "completed" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                        : tx.status === "failed"  ? "bg-red-500/10 text-red-300 border-red-500/30"
                        : "bg-neutral-500/10 text-neutral-400 border-white/10"
                      }`}>
                        {titleCase(tx.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-400 max-w-[200px] truncate">{tx.description || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-neutral-600 max-w-[120px] truncate">{tx.userId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { devError } from "@/utils/devLog";
import { ADMIN_ORDERS_QUERY, ADMIN_UPDATE_FULFILMENT, ADMIN_DISPUTES_QUERY, ADMIN_RESOLVE_DISPUTE } from '@/graphql/admin';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function titleCase(value) {
  if (!value) return "—";
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const FULFILMENT_OPTIONS = [
  { value: "pending",           label: "Pending" },
  { value: "awaiting_shipment", label: "Awaiting shipment" },
  { value: "shipped",           label: "Shipped" },
  { value: "completed",         label: "Completed" },
  { value: "disputed",          label: "Disputed" },
  { value: "cancelled",         label: "Cancelled" },
];

// ─── Badges ──────────────────────────────────────────────────────────────────

function PaymentBadge({ value }) {
  const v = String(value ?? "").toLowerCase();
  const map = {
    captured:   "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    paid:       "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    authorised: "bg-teal-500/10 text-teal-300 border-teal-500/30",
    pending:    "bg-amber-500/10 text-amber-300 border-amber-500/30",
    refunded:   "bg-sky-500/10 text-sky-300 border-sky-500/30",
    failed:     "bg-red-500/10 text-red-300 border-red-500/30",
    cancelled:  "bg-red-500/10 text-red-300 border-red-500/30",
  };
  const cls = map[v] ?? "bg-neutral-500/10 text-neutral-400 border-white/10";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${cls}`}>
      {titleCase(value)}
    </span>
  );
}

function FulfilmentBadge({ value }) {
  const v = String(value ?? "").toLowerCase();
  const map = {
    pending:           "bg-neutral-500/10 text-neutral-400 border-white/10",
    awaiting_shipment: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    shipped:           "bg-sky-500/10 text-sky-300 border-sky-500/30",
    completed:         "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    disputed:          "bg-orange-500/10 text-orange-300 border-orange-500/30",
    cancelled:         "bg-red-500/10 text-red-300 border-red-500/30",
  };
  const cls = map[v] ?? "bg-neutral-500/10 text-neutral-400 border-white/10";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${cls}`}>
      {titleCase(value)}
    </span>
  );
}

// ─── Address ──────────────────────────────────────────────────────────────────

function Address({ json }) {
  if (!json) return <span className="text-neutral-600 text-[11px]">No address</span>;
  let a = json;
  if (typeof a === "string") { try { a = JSON.parse(a); } catch { return <span className="text-neutral-600 text-[11px]">Invalid</span>; } }
  const { line1, address1, line2, address2, city, region, postalCode, postcode, country } = a;
  const l1 = line1 || address1;
  const l2 = line2 || address2;
  const pc = postalCode || postcode;
  return (
    <div className="text-[11px] space-y-0.5">
      {l1 && <p className="text-neutral-200">{l1}</p>}
      {l2 && <p className="text-neutral-400">{l2}</p>}
      {city && <p className="text-neutral-400">{[city, region].filter(Boolean).join(", ")}</p>}
      {(pc || country) && <p className="text-neutral-400">{[pc, country].filter(Boolean).join(", ")}</p>}
      {!l1 && !city && !pc && <span className="text-neutral-600">Incomplete</span>}
    </div>
  );
}

// ─── Listing summary ──────────────────────────────────────────────────────────

function ListingSummary({ listing }) {
  if (!listing) return <span className="text-neutral-600 text-[11px]">—</span>;
  const type = String(listing.type || listing.__typename || "").toUpperCase();
  if (type === "PRODUCT") {
    return (
      <div className="text-[11px]">
        <p className="text-neutral-200 font-medium">{listing.title || "Product"}</p>
        <p className="text-neutral-500">{listing.fulfilmentType || "Product"}</p>
      </div>
    );
  }
  return (
    <div className="text-[11px]">
      <p className="text-neutral-200 font-medium">{listing.cardId || "Card"}</p>
      <p className="text-neutral-500">{[listing.variation, listing.condition].filter(Boolean).join(" · ") || "Card listing"}</p>
    </div>
  );
}

// ─── Orders section ───────────────────────────────────────────────────────────

function OrdersSection() {
  const { data, loading, error, refetch } = useQuery(ADMIN_ORDERS_QUERY, {
    variables: { limit: 100, offset: 0 },
    fetchPolicy: "cache-first",
  });

  const [updateFulfilment, { loading: updating }] = useMutation(ADMIN_UPDATE_FULFILMENT);

  const orders = data?.adminOrders ?? [];

  const handleChangeFulfilment = async (orderId, status) => {
    try {
      await updateFulfilment({ variables: { orderId, status } });
      refetch();
    } catch (err) {
      devError("[AdminOrdersPanel] fulfilment update failed:", err);
    }
  };

  if (loading && !data) {
    return (
      <div className="border border-white/[0.06] rounded-2xl p-4 animate-pulse">
        <div className="h-4 w-32 bg-white/10 rounded mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 py-3 border-t border-white/[0.04]">
            <div className="h-3 w-20 bg-white/[0.06] rounded" />
            <div className="h-3 w-16 bg-white/[0.06] rounded" />
            <div className="h-3 w-12 bg-white/[0.06] rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-500/30 rounded-2xl p-4 bg-red-950/20">
        <p className="text-sm text-red-300 font-medium mb-1">Failed to load orders</p>
        <p className="text-xs text-red-400 mb-3">{error.message}</p>
        <button type="button" onClick={() => refetch()} className="text-xs border border-red-400/50 text-red-200 px-3 py-1.5 rounded-lg hover:bg-red-500/10">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-neutral-50">Orders</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {orders.length} most recent orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {updating && <span className="text-[11px] text-neutral-500">Saving…</span>}
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="border border-white/[0.06] rounded-2xl p-8 bg-white/[0.01] text-center">
          <p className="text-sm text-neutral-400">No orders yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-white/[0.08] rounded-2xl bg-black/30">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Order", "Buyer", "Seller", "Listing", "Address", "Total", "Payment", "Fulfilment", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-white/[0.03] transition">
                  <td className="px-3 py-3 align-top">
                    <p className="text-[11px] font-semibold text-neutral-100">{order.orderNumber || "—"}</p>
                    <p className="text-[10px] text-neutral-500">{fmt(order.createdAt)}</p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <p className="text-[11px] text-neutral-200">{order.buyer?.username || order.buyerEmail || "Guest"}</p>
                    {order.buyer?.id && <p className="text-[10px] text-neutral-600 font-mono truncate max-w-[90px]">{order.buyer.id}</p>}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <p className="text-[11px] text-neutral-200">{order.seller?.username || "—"}</p>
                  </td>
                  <td className="px-3 py-3 align-top max-w-[140px]">
                    <ListingSummary listing={order.listing} />
                  </td>
                  <td className="px-3 py-3 align-top max-w-[140px]">
                    <Address json={order.shippingAddressJson} />
                  </td>
                  <td className="px-3 py-3 align-top whitespace-nowrap">
                    <p className="text-[11px] font-medium text-neutral-100">
                      {order.totalAmount != null
                        ? `£${Number(order.totalAmount).toFixed(2)}`
                        : "—"}
                    </p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <PaymentBadge value={order.paymentStatus} />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <FulfilmentBadge value={order.fulfilmentStatus} />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <select
                      className="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-neutral-200 focus:outline-none focus:ring-1 focus:ring-white/20 transition"
                      value={order.fulfilmentStatus || "pending"}
                      disabled={updating}
                      onChange={(e) => handleChangeFulfilment(order.id, e.target.value)}
                    >
                      {FULFILMENT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Disputes section ─────────────────────────────────────────────────────────
// NOTE: adminOrderDisputes and adminResolveDispute have not yet been added to
// the gateway schema. This section renders a placeholder until they are.

function DisputesSection() {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-neutral-50">Order Disputes</h2>
        <p className="text-xs text-neutral-500 mt-0.5">Dispute management for marketplace orders.</p>
      </div>
      <div className="border border-amber-500/20 rounded-xl px-4 py-3 bg-amber-500/[0.04] flex gap-3 items-start">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 mt-0.5 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p className="text-xs text-amber-300/90">
          Order dispute queries (<code className="font-mono text-amber-200">adminOrderDisputes</code>,{" "}
          <code className="font-mono text-amber-200">adminResolveDispute</code>) have not yet been implemented in
          the gateway. This section will become active once those operations are added to the schema.
        </p>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function AdminOrdersPanel() {
  return (
    <div className="space-y-10">
      <OrdersSection />
      <DisputesSection />
    </div>
  );
}

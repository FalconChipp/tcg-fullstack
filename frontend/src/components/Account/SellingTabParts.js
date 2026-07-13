"use client";

import React from "react";
import Link from "next/link";
import { Lock, Star } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

export function fmt(amount, currency = "GBP") {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency?.toUpperCase() || "GBP",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function relativeDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const CARRIERS = [
  "Royal Mail",
  "Evri",
  "DPD",
  "ParcelForce",
  "DHL",
  "UPS",
  "FedEx",
  "Other",
];

export const FULFILMENT_LABELS = {
  pending: "Pending",
  pending_payment: "Awaiting payment",
  pending_dispatch: "Ready to ship",
  dispatched: "Dispatched",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

/* ─── Small UI pieces ──────────────────────────────────────────────────────── */

export function FulfilmentBadge({ status }) {
  const map = {
    pending_dispatch: "bg-amber-500/15 text-amber-400",
    dispatched: "bg-blue-500/15 text-blue-400",
    delivered: "bg-teal-500/15 text-teal-400",
    completed: "bg-green-500/15 text-green-400",
    cancelled: "bg-red-500/15 text-red-400",
    disputed: "bg-red-600/20 text-red-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-[6px] px-2.5 py-0.5 text-xs font-semibold ${
        map[status] || "bg-vault-raised text-vault-textTertiary"
      }`}
    >
      {FULFILMENT_LABELS[status] || status}
    </span>
  );
}

export function ListingStatusBadge({ status }) {
  const map = {
    ACTIVE: "bg-green-500/15 text-green-400",
    PENDING_PROOF: "bg-amber-500/15 text-amber-400",
    SOLD: "bg-blue-500/15 text-blue-400",
    CANCELLED: "bg-red-500/15 text-red-400",
    REMOVED: "bg-vault-raised text-vault-textTertiary",
  };
  return (
    <span
      className={`inline-flex items-center rounded-[6px] px-2 py-0.5 text-xs font-semibold ${
        map[status] || "bg-vault-raised text-vault-textTertiary"
      }`}
    >
      {status}
    </span>
  );
}

export function SectionCard({ title, action, children }) {
  return (
    <div className="rounded-[10px] border border-vault-border bg-vault-raised/30 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-vault-text">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ─── Revenue chart ────────────────────────────────────────────────────────── */

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border border-vault-border bg-vault-surface px-3 py-2 text-xs ">
      <p className="mb-1.5 font-semibold text-vault-textTertiary">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill }} className="font-semibold">
          {p.dataKey === "gross" ? "Gross" : "Net"}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

export function RevenueBarChart({ orders }) {
  const DAYS = 30;
  const now = new Date();
  const dayMap = {};
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (DAYS - 1 - i));
    const key = d.toISOString().slice(0, 10);
    dayMap[key] = { date: key, gross: 0, fee: 0 };
  }

  orders
    .filter((o) =>
      ["paid", "captured"].includes((o.paymentStatus || "").toLowerCase())
    )
    .forEach((o) => {
      const day = (o.completedAt || o.createdAt || "").slice(0, 10);
      if (dayMap[day]) {
        dayMap[day].gross += o.salePrice || o.total || 0;
        dayMap[day].fee += o.platformFee || 0;
      }
    });

  const chartData = Object.values(dayMap).map((d) => ({
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    }),
    gross: parseFloat(d.gross.toFixed(2)),
    net: parseFloat(Math.max(d.gross - d.fee, 0).toFixed(2)),
  }));

  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={chartData} barGap={1} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
          tickLine={false}
          axisLine={false}
          interval={6}
        />
        <YAxis hide />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey="gross" fill="rgba(139,92,246,0.3)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="net" fill="rgba(139,92,246,0.8)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ConditionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border border-vault-border bg-vault-surface px-3 py-2 text-xs ">
      <p className="font-semibold text-vault-textTertiary">{payload[0]?.payload?.condition}</p>
      <p className="font-bold text-violet-300">{fmt(payload[0]?.value)}</p>
    </div>
  );
}

export function ConditionBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 32, 80)}>
      <BarChart
        data={data}
        layout="vertical"
        barCategoryGap="25%"
        margin={{ left: 0, right: 8, top: 0, bottom: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="condition"
          tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          content={<ConditionTooltip />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey="revenue" fill="rgba(139,92,246,0.7)" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ─── Vendor gate ──────────────────────────────────────────────────────────── */

export function VendorGate({ isVendor, children }) {
  return (
    <div className="relative">
      <div
        className={
          isVendor
            ? ""
            : "pointer-events-none select-none blur-[3px] opacity-50"
        }
      >
        {children}
      </div>
      {!isVendor && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[10px]">
          <div className="rounded-[6px] bg-vault-surface p-3  ring-1 ring-vault-border">
            <Lock className="h-5 w-5 text-vault-accent" />
          </div>
          <p className="text-sm font-bold text-vault-text">Vendor plan required</p>
          <p className="px-8 text-center text-xs text-vault-textTertiary">
            Advanced analytics are available on the Vendor plan.
          </p>
          <Link
            href="/subscriptions"
            className="mt-1 rounded-[10px] bg-vault-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-vault-accentHover"
          >
            Upgrade to Vendor
          </Link>
        </div>
      )}
    </div>
  );
}

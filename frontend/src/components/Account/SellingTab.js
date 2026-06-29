// src/components/Account/SellingTab.js
"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  Tag,
  TrendingUp,
  Star,
  Lock,
  Truck,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { gqlFetch } from "@/utils/apiClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/* ─── GQL ──────────────────────────────────────────────────────────────────── */

const SELLING_QUERY = `
  query SellingTab($userId: ID!) {
    myListings(limit: 200) {
      id cardId title condition variant price currency quantity status
      pendingOfferCount createdAt updatedAt
      cardInfo { name number setName imageSmall }
    }
    myOrders(role: "seller", limit: 200) {
      id orderNumber total salePrice platformFee currency
      paymentStatus fulfilmentStatus trackingNumber trackingCarrier
      createdAt completedAt shippedAt
      buyer { id username }
      listing {
        ... on CardListing { id cardId condition cardInfo { name } }
      }
    }
    myIncomingOffers { id status }
    sellerReputation(userId: $userId) {
      score positive negative neutral completedMarketplace flagged
    }
    sellerReviews(userId: $userId, limit: 10) {
      cardId rating review createdAt
    }
    myCapabilities {
      planName platformFeePercent maxActiveListings
    }
    sellerStatus { connected complete url }
  }
`;

const UPDATE_LISTING_MUTATION = `
  mutation UpdateListing($id: ID!, $input: UpdateListingInput!) {
    updateListing(id: $id, input: $input) { id price quantity status }
  }
`;

const DELETE_LISTING_MUTATION = `
  mutation DeleteListing($id: ID!) {
    deleteListing(id: $id)
  }
`;

const SUBMIT_TRACKING_MUTATION = `
  mutation SubmitTracking($id: ID!, $trackingNumber: String!, $carrier: String) {
    submitOrderTracking(id: $id, trackingNumber: $trackingNumber, carrier: $carrier) {
      id trackingNumber trackingCarrier fulfilmentStatus
    }
  }
`;

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function fmt(amount, currency = "GBP") {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency?.toUpperCase() || "GBP",
    minimumFractionDigits: 2,
  }).format(amount);
}

function relativeDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const CARRIERS = [
  "Royal Mail",
  "Evri",
  "DPD",
  "ParcelForce",
  "DHL",
  "UPS",
  "FedEx",
  "Other",
];

const FULFILMENT_LABELS = {
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

function FulfilmentBadge({ status }) {
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

function ListingStatusBadge({ status }) {
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

function SectionCard({ title, action, children }) {
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

function RevenueBarChart({ orders }) {
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

function ConditionBarChart({ data }) {
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

function VendorGate({ isVendor, children }) {
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

/* ─── Main component ───────────────────────────────────────────────────────── */

export default function SellingTab({ token, myId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Inline editing
  const [editingPrice, setEditingPrice] = useState({});
  const [savingPrice, setSavingPrice] = useState({});
  const [deletingListing, setDeletingListing] = useState({});
  const [trackingInputs, setTrackingInputs] = useState({});
  const [submittingTracking, setSubmittingTracking] = useState({});
  const [toast, setToast] = useState(null);

  // Recharts needs the DOM — defer until after first paint
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadData = useCallback(
    async (quiet = false) => {
      if (!token || !myId) return;
      if (!quiet) setLoading(true);
      else setRefreshing(true);
      try {
        const result = await gqlFetch(SELLING_QUERY, { userId: myId }, token);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, myId]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ── Derived ── */
  const listings = data?.myListings ?? [];
  const orders = data?.myOrders ?? [];
  const reputation = data?.sellerReputation ?? null;
  const reviews = data?.sellerReviews ?? [];
  const capabilities = data?.myCapabilities ?? null;
  const sellerStatus = data?.sellerStatus ?? null;

  const isVendor = capabilities?.planName?.toLowerCase() === "vendor";
  const feePercent = capabilities?.platformFeePercent ?? 7;
  const activeListings = listings.filter((l) => l.status === "ACTIVE").length;
  const pendingDispatch = orders.filter(
    (o) =>
      (o.paymentStatus === "paid" || o.paymentStatus === "captured") &&
      ["pending_dispatch", "pending"].includes(o.fulfilmentStatus)
  );

  const paidOrders = orders.filter((o) =>
    ["paid", "captured"].includes((o.paymentStatus || "").toLowerCase())
  );
  const grossRevenue = paidOrders.reduce(
    (s, o) => s + (o.salePrice || o.total || 0),
    0
  );
  const totalFees = paidOrders.reduce((s, o) => s + (o.platformFee || 0), 0);
  const netRevenue = grossRevenue - totalFees;
  const completedCount = orders.filter(
    (o) => o.fulfilmentStatus === "completed"
  ).length;
  const completionRate =
    orders.length > 0
      ? Math.round((completedCount / orders.length) * 100)
      : 0;

  const cardSales = {};
  paidOrders.forEach((o) => {
    const name = o.listing?.cardInfo?.name || "Unknown card";
    cardSales[name] = (cardSales[name] || 0) + (o.salePrice || o.total || 0);
  });
  const topCards = Object.entries(cardSales)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Month-over-month revenue
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonthRevenue = paidOrders
    .filter((o) => new Date(o.completedAt || o.createdAt) >= thisMonthStart)
    .reduce((s, o) => s + (o.salePrice || o.total || 0), 0);
  const lastMonthRevenue = paidOrders
    .filter((o) => {
      const d = new Date(o.completedAt || o.createdAt);
      return d >= lastMonthStart && d < thisMonthStart;
    })
    .reduce((s, o) => s + (o.salePrice || o.total || 0), 0);
  const momChange =
    lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : null;

  // Average order value
  const avgOrderValue =
    paidOrders.length > 0 ? grossRevenue / paidOrders.length : 0;

  // Average days to dispatch
  const dispatchTimes = orders
    .filter((o) => o.shippedAt && o.createdAt)
    .map((o) => (new Date(o.shippedAt) - new Date(o.createdAt)) / 86400000);
  const avgDaysToDispatch =
    dispatchTimes.length > 0
      ? dispatchTimes.reduce((s, d) => s + d, 0) / dispatchTimes.length
      : null;

  // Offer conversion rate
  const incomingOffers = data?.myIncomingOffers ?? [];
  const activeOffers = incomingOffers.filter((o) => o.status !== "withdrawn");
  const acceptedOffers = incomingOffers.filter((o) => o.status === "accepted");
  const offerConversionRate =
    activeOffers.length > 0
      ? Math.round((acceptedOffers.length / activeOffers.length) * 100)
      : null;

  // Sales by condition
  const conditionMap = {};
  paidOrders.forEach((o) => {
    const cond = o.listing?.condition || "Unknown";
    conditionMap[cond] = (conditionMap[cond] || 0) + (o.salePrice || o.total || 0);
  });
  const conditionData = Object.entries(conditionMap)
    .sort(([, a], [, b]) => b - a)
    .map(([condition, revenue]) => ({
      condition,
      revenue: parseFloat(revenue.toFixed(2)),
    }));

  /* ── Handlers ── */

  async function handleUpdatePrice(listingId) {
    const newPrice = parseFloat(editingPrice[listingId]);
    if (isNaN(newPrice) || newPrice <= 0) return;
    setSavingPrice((p) => ({ ...p, [listingId]: true }));
    try {
      await gqlFetch(
        UPDATE_LISTING_MUTATION,
        { id: listingId, input: { price: newPrice } },
        token
      );
      setData((prev) => ({
        ...prev,
        myListings: prev.myListings.map((l) =>
          l.id === listingId ? { ...l, price: newPrice } : l
        ),
      }));
      setEditingPrice((p) => {
        const n = { ...p };
        delete n[listingId];
        return n;
      });
      showToast("Price updated");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSavingPrice((p) => {
        const n = { ...p };
        delete n[listingId];
        return n;
      });
    }
  }

  async function handleDeleteListing(listingId) {
    if (!window.confirm("Delete this listing? This cannot be undone.")) return;
    setDeletingListing((p) => ({ ...p, [listingId]: true }));
    try {
      await gqlFetch(DELETE_LISTING_MUTATION, { id: listingId }, token);
      setData((prev) => ({
        ...prev,
        myListings: prev.myListings.filter((l) => l.id !== listingId),
      }));
      showToast("Listing deleted");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setDeletingListing((p) => {
        const n = { ...p };
        delete n[listingId];
        return n;
      });
    }
  }

  async function handleSubmitTracking(orderId) {
    const ti = trackingInputs[orderId] || {};
    const trackingNumber = ti.number?.trim();
    if (!trackingNumber) return;
    setSubmittingTracking((p) => ({ ...p, [orderId]: true }));
    try {
      const result = await gqlFetch(
        SUBMIT_TRACKING_MUTATION,
        { id: orderId, trackingNumber, carrier: ti.carrier || null },
        token
      );
      const updated = result.submitOrderTracking;
      setData((prev) => ({
        ...prev,
        myOrders: prev.myOrders.map((o) =>
          o.id === orderId ? { ...o, ...updated } : o
        ),
      }));
      setTrackingInputs((p) => {
        const n = { ...p };
        delete n[orderId];
        return n;
      });
      showToast("Tracking submitted");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmittingTracking((p) => {
        const n = { ...p };
        delete n[orderId];
        return n;
      });
    }
  }

  /* ── Render ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-vault-textTertiary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Inline toast */}
      {toast && (
        <div
          className={`flex items-center gap-3 rounded-[10px] px-4 py-3 text-sm font-semibold ${
            toast.type === "error"
              ? "bg-red-500/15 text-red-400"
              : "bg-green-500/15 text-green-400"
          }`}
        >
          {toast.type === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle className="h-4 w-4 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}

      {error && (
        <div className="rounded-[10px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {sellerStatus && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-bold ${
                sellerStatus.complete
                  ? "bg-green-500/15 text-green-400"
                  : "bg-amber-500/15 text-amber-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-[6px] ${
                  sellerStatus.complete ? "bg-green-400" : "bg-amber-400"
                }`}
              />
              {sellerStatus.complete
                ? "Stripe connected"
                : sellerStatus.connected
                ? "Stripe incomplete"
                : "Stripe not connected"}
            </span>
          )}
          {capabilities && (
            <span className="inline-flex items-center rounded-[6px] bg-vault-raised px-3 py-1.5 text-xs font-bold text-vault-textTertiary">
              {capabilities.planName} · {feePercent}% fee
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-vault-raised px-3 py-2 text-xs font-bold text-vault-textTertiary transition hover:text-vault-text disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            icon: Tag,
            label: "Active listings",
            value: activeListings,
            sub: capabilities?.maxActiveListings
              ? `of ${capabilities.maxActiveListings} max`
              : undefined,
            color: "bg-violet-500/15 text-violet-300",
            iconCls: "bg-violet-500/15 text-violet-400",
            border: "border-violet-500/20",
          },
          {
            icon: Package,
            label: "Pending dispatch",
            value: pendingDispatch.length,
            sub:
              pendingDispatch.length > 0
                ? "Orders ready to ship"
                : "All up to date",
            color: "bg-amber-500/15 text-amber-300",
            iconCls: "bg-amber-500/15 text-amber-400",
            border: "border-amber-500/20",
          },
          {
            icon: TrendingUp,
            label: "Platform fee",
            value: `${feePercent}%`,
            sub: "Per completed sale",
            color: "bg-teal-500/15 text-teal-300",
            iconCls: "bg-teal-500/15 text-teal-400",
            border: "border-teal-500/20",
          },
          {
            icon: Star,
            label: "Reputation",
            value: reputation?.score ?? 0,
            sub: reputation
              ? `${reputation.positive}+ / ${reputation.negative}−`
              : "No sales yet",
            color: "bg-blue-500/15 text-blue-300",
            iconCls: "bg-blue-500/15 text-blue-400",
            border: "border-blue-500/20",
          },
        ].map(({ icon: Icon, label, value, sub, color, iconCls, border }) => (
          <div
            key={label}
            className={`rounded-[10px] border ${border} bg-vault-raised/50 p-4`}
          >
            <div
              className={`mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] ${iconCls}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="mt-0.5 text-xs font-semibold text-vault-text">
              {label}
            </p>
            {sub && (
              <p className="mt-0.5 text-xs text-vault-textTertiary">{sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left (2/3) */}
        <div className="space-y-5 lg:col-span-2">
          {/* Dispatch queue */}
          <SectionCard
            title={
              <span>
                Dispatch queue
                {pendingDispatch.length > 0 && (
                  <span className="ml-2 rounded-[6px] bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400">
                    {pendingDispatch.length}
                  </span>
                )}
              </span>
            }
          >
            {pendingDispatch.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Package className="h-7 w-7 text-vault-border" />
                <p className="text-sm font-semibold text-vault-text">
                  No orders awaiting dispatch
                </p>
                <p className="text-xs text-vault-textTertiary">
                  New paid orders will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingDispatch.map((order) => {
                  const ti = trackingInputs[order.id] || {};
                  const submitting = submittingTracking[order.id];
                  const cardName = order.listing?.cardInfo?.name || "Card";
                  return (
                    <div
                      key={order.id}
                      className="rounded-[10px] border border-vault-border bg-vault-surface p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-vault-text">
                            #{order.orderNumber || order.id.slice(-8)}
                          </p>
                          <p className="text-xs text-vault-textTertiary">
                            {cardName} · Buyer:{" "}
                            {order.buyer?.username || "—"} ·{" "}
                            {relativeDate(order.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <FulfilmentBadge status={order.fulfilmentStatus} />
                          <span className="text-sm font-bold text-vault-text">
                            {fmt(order.total, order.currency)}
                          </span>
                        </div>
                      </div>

                      {!order.trackingNumber ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            placeholder="Tracking number"
                            value={ti.number || ""}
                            onChange={(e) =>
                              setTrackingInputs((prev) => ({
                                ...prev,
                                [order.id]: { ...ti, number: e.target.value },
                              }))
                            }
                            className="min-w-[130px] flex-1 rounded-[10px] border border-vault-border bg-vault-surface px-3 py-2 text-sm text-vault-text placeholder-vault-textTertiary outline-none focus:border-vault-accent"
                          />
                          <select
                            value={ti.carrier || ""}
                            onChange={(e) =>
                              setTrackingInputs((prev) => ({
                                ...prev,
                                [order.id]: {
                                  ...ti,
                                  carrier: e.target.value,
                                },
                              }))
                            }
                            className="rounded-[10px] border border-vault-border bg-vault-surface px-3 py-2 text-sm text-vault-text outline-none focus:border-vault-accent"
                          >
                            <option value="">Carrier</option>
                            {CARRIERS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleSubmitTracking(order.id)}
                            disabled={submitting || !ti.number?.trim()}
                            className="inline-flex items-center gap-1.5 rounded-[10px] bg-vault-accent px-4 py-2 text-sm font-bold text-white transition hover:bg-vault-accentHover disabled:opacity-50"
                          >
                            {submitting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Truck className="h-3.5 w-3.5" />
                            )}
                            Ship
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-teal-400">
                          <Truck className="mr-1 inline h-3 w-3" />
                          {order.trackingCarrier
                            ? `${order.trackingCarrier}: `
                            : ""}
                          {order.trackingNumber}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Listings manager */}
          <SectionCard
            title={
              <span>
                Your listings
                <span className="ml-1.5 text-xs font-normal text-vault-textTertiary">
                  ({listings.length})
                </span>
              </span>
            }
            action={
              <Link
                href="/marketplace"
                className="text-xs font-semibold text-vault-accent transition hover:text-vault-accentHover"
              >
                + New listing
              </Link>
            }
          >
            {listings.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Tag className="h-7 w-7 text-vault-border" />
                <p className="text-sm font-semibold text-vault-text">
                  No listings yet
                </p>
                <Link
                  href="/marketplace"
                  className="text-xs font-semibold text-vault-accent hover:underline"
                >
                  List your first card →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-vault-border text-left text-xs font-semibold text-vault-textTertiary">
                      <th className="pb-2 pr-4">Card</th>
                      <th className="pb-2 pr-3">Cond.</th>
                      <th className="pb-2 pr-3">Qty</th>
                      <th className="pb-2 pr-4">Price</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-3">Listed</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-vault-border">
                    {listings.map((listing) => {
                      const name =
                        listing.cardInfo?.name ||
                        listing.title ||
                        listing.cardId ||
                        "—";
                      const isEditing = editingPrice[listing.id] !== undefined;
                      const isSaving = savingPrice[listing.id];
                      const isDeleting = deletingListing[listing.id];
                      return (
                        <tr key={listing.id} className="group">
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              {listing.cardInfo?.imageSmall && (
                                <img
                                  src={listing.cardInfo.imageSmall}
                                  alt=""
                                  className="h-8 w-6 shrink-0 rounded object-cover"
                                />
                              )}
                              <div>
                                <p className="max-w-[130px] truncate font-semibold text-vault-text">
                                  {name}
                                </p>
                                {listing.cardInfo?.setName && (
                                  <p className="truncate text-xs text-vault-textTertiary">
                                    {listing.cardInfo.setName}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 text-xs text-vault-textTertiary">
                            {listing.condition || "—"}
                          </td>
                          <td className="py-2.5 pr-3 text-vault-textTertiary">
                            {listing.quantity ?? "—"}
                          </td>
                          <td className="py-2.5 pr-4">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editingPrice[listing.id]}
                                  onChange={(e) =>
                                    setEditingPrice((p) => ({
                                      ...p,
                                      [listing.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      handleUpdatePrice(listing.id);
                                    if (e.key === "Escape")
                                      setEditingPrice((p) => {
                                        const n = { ...p };
                                        delete n[listing.id];
                                        return n;
                                      });
                                  }}
                                  autoFocus
                                  className="w-20 rounded-[6px] border border-vault-accent bg-vault-surface px-2 py-1 text-sm text-vault-text outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdatePrice(listing.id)}
                                  disabled={isSaving}
                                  className="rounded-[6px] bg-vault-accent px-2 py-1 text-xs font-bold text-white hover:bg-vault-accentHover disabled:opacity-50"
                                >
                                  {isSaving ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "Save"
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingPrice((p) => {
                                      const n = { ...p };
                                      delete n[listing.id];
                                      return n;
                                    })
                                  }
                                  className="rounded-[6px] p-1 text-vault-textTertiary hover:text-vault-text"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingPrice((p) => ({
                                    ...p,
                                    [listing.id]:
                                      listing.price?.toFixed(2) ?? "0.00",
                                  }))
                                }
                                className="group/price flex items-center gap-1 font-semibold text-vault-text transition hover:text-vault-accent"
                              >
                                {fmt(listing.price, listing.currency)}
                                <Edit2 className="h-3 w-3 text-vault-textTertiary opacity-0 transition group-hover/price:opacity-100" />
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 pr-4">
                            <ListingStatusBadge status={listing.status} />
                          </td>
                          <td className="py-2.5 pr-3 text-xs text-vault-textTertiary">
                            {relativeDate(listing.createdAt)}
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteListing(listing.id)}
                              disabled={isDeleting}
                              title="Delete listing"
                              className="rounded-[6px] p-1.5 text-vault-textTertiary transition hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50"
                            >
                              {isDeleting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right (1/3) */}
        <div className="space-y-5">
          {/* Reputation */}
          <SectionCard title="Reputation">
            {!reputation ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Star className="h-7 w-7 text-vault-border" />
                <p className="text-sm text-vault-textTertiary">
                  No completed sales yet
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-blue-500/15">
                    <span className="text-xl font-black text-blue-300">
                      {reputation.score}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-vault-text">
                      Overall score
                    </p>
                    <p className="text-xs text-vault-textTertiary">
                      {reputation.completedMarketplace} completed sale
                      {reputation.completedMarketplace !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-[10px] bg-green-500/10 p-2">
                    <p className="text-lg font-black text-green-400">
                      {reputation.positive}
                    </p>
                    <p className="text-xs text-vault-textTertiary">Positive</p>
                  </div>
                  <div className="rounded-[10px] bg-vault-raised p-2">
                    <p className="text-lg font-black text-vault-textTertiary">
                      {reputation.neutral}
                    </p>
                    <p className="text-xs text-vault-textTertiary">Neutral</p>
                  </div>
                  <div className="rounded-[10px] bg-red-500/10 p-2">
                    <p className="text-lg font-black text-red-400">
                      {reputation.negative}
                    </p>
                    <p className="text-xs text-vault-textTertiary">Negative</p>
                  </div>
                </div>

                {reviews.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-vault-textTertiary">
                      Recent reviews
                    </p>
                    {reviews.map((r, i) => (
                      <div key={i} className="rounded-[10px] bg-vault-surface p-3">
                        <div className="mb-1 flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-3 w-3 ${
                                s <= r.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-vault-border"
                              }`}
                            />
                          ))}
                          <span className="ml-1 text-xs text-vault-textTertiary">
                            {relativeDate(r.createdAt)}
                          </span>
                        </div>
                        {r.review && (
                          <p className="text-xs text-vault-text">{r.review}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </SectionCard>

          {/* Analytics (vendor-gated) */}
          <SectionCard title="Analytics">
            <VendorGate isVendor={isVendor}>
              <div className="space-y-4">
                {/* Totals */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-[10px] bg-violet-500/10 p-3">
                    <p className="text-sm font-black text-violet-300">
                      {fmt(grossRevenue)}
                    </p>
                    <p className="text-xs text-vault-textTertiary">Gross</p>
                  </div>
                  <div className="rounded-[10px] bg-red-500/10 p-3">
                    <p className="text-sm font-black text-red-300">
                      −{fmt(totalFees)}
                    </p>
                    <p className="text-xs text-vault-textTertiary">Fees</p>
                  </div>
                  <div className="rounded-[10px] bg-green-500/10 p-3">
                    <p className="text-sm font-black text-green-300">
                      {fmt(netRevenue)}
                    </p>
                    <p className="text-xs text-vault-textTertiary">Net</p>
                  </div>
                </div>

                {/* Chart */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-vault-textTertiary">
                      Last 30 days
                    </p>
                    <div className="flex items-center gap-3 text-xs text-vault-textTertiary">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm bg-violet-500/30" />
                        Gross
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm bg-violet-500/80" />
                        Net
                      </span>
                    </div>
                  </div>
                  {mounted && <RevenueBarChart orders={orders} />}
                </div>

                {/* Completion rate */}
                <div className="flex items-center justify-between rounded-[10px] bg-vault-surface px-4 py-3">
                  <span className="text-sm font-semibold text-vault-text">
                    Completion rate
                  </span>
                  <span
                    className={`text-sm font-black ${
                      completionRate >= 90
                        ? "text-green-400"
                        : completionRate >= 70
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  >
                    {completionRate}%
                  </span>
                </div>

                {/* Month-over-month */}
                <div className="rounded-[10px] bg-vault-surface p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-vault-textTertiary">
                    Month-over-month
                  </p>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-lg font-black text-vault-text">
                        {fmt(thisMonthRevenue)}
                      </p>
                      <p className="text-xs text-vault-textTertiary">This month</p>
                    </div>
                    {momChange !== null && (
                      <span
                        className={`mb-0.5 inline-flex items-center gap-0.5 rounded-[6px] px-2 py-0.5 text-xs font-bold ${
                          momChange >= 0
                            ? "bg-green-500/15 text-green-400"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {momChange >= 0 ? "↑" : "↓"}
                        {Math.abs(momChange).toFixed(1)}%
                      </span>
                    )}
                    <div className="text-right">
                      <p className="text-sm font-semibold text-vault-textTertiary">
                        {fmt(lastMonthRevenue)}
                      </p>
                      <p className="text-xs text-vault-textTertiary">Last month</p>
                    </div>
                  </div>
                </div>

                {/* Avg order value + avg dispatch time */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[10px] bg-vault-surface px-3 py-3 text-center">
                    <p className="text-base font-black text-vault-text">
                      {paidOrders.length > 0 ? fmt(avgOrderValue) : "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-vault-textTertiary">
                      Avg. order value
                    </p>
                  </div>
                  <div className="rounded-[10px] bg-vault-surface px-3 py-3 text-center">
                    <p
                      className={`text-base font-black ${
                        avgDaysToDispatch === null
                          ? "text-vault-textTertiary"
                          : avgDaysToDispatch <= 1
                          ? "text-green-400"
                          : avgDaysToDispatch <= 3
                          ? "text-amber-400"
                          : "text-red-400"
                      }`}
                    >
                      {avgDaysToDispatch !== null
                        ? `${avgDaysToDispatch.toFixed(1)}d`
                        : "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-vault-textTertiary">
                      Avg. days to ship
                    </p>
                  </div>
                </div>

                {/* Offer conversion rate */}
                <div className="flex items-center justify-between rounded-[10px] bg-vault-surface px-4 py-3">
                  <div>
                    <span className="text-sm font-semibold text-vault-text">
                      Offer conversion
                    </span>
                    <p className="text-xs text-vault-textTertiary">
                      {acceptedOffers.length} accepted of{" "}
                      {activeOffers.length} received
                    </p>
                  </div>
                  <span
                    className={`text-sm font-black ${
                      offerConversionRate === null
                        ? "text-vault-textTertiary"
                        : offerConversionRate >= 50
                        ? "text-green-400"
                        : offerConversionRate >= 25
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  >
                    {offerConversionRate !== null
                      ? `${offerConversionRate}%`
                      : "—"}
                  </span>
                </div>

                {/* Completion rate */}
                <div className="flex items-center justify-between rounded-[10px] bg-vault-surface px-4 py-3">
                  <span className="text-sm font-semibold text-vault-text">
                    Completion rate
                  </span>
                  <span
                    className={`text-sm font-black ${
                      completionRate >= 90
                        ? "text-green-400"
                        : completionRate >= 70
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  >
                    {completionRate}%
                  </span>
                </div>

                {/* Top cards */}
                {topCards.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-vault-textTertiary">
                      Top selling cards
                    </p>
                    <div className="space-y-1.5">
                      {topCards.map(([name, revenue]) => (
                        <div
                          key={name}
                          className="flex items-center justify-between rounded-[10px] bg-vault-surface px-3 py-2"
                        >
                          <span className="max-w-[130px] truncate text-xs font-semibold text-vault-text">
                            {name}
                          </span>
                          <span className="text-xs font-bold text-vault-text">
                            {fmt(revenue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sales by condition */}
                {conditionData.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-vault-textTertiary">
                      Sales by condition
                    </p>
                    {mounted && <ConditionBarChart data={conditionData} />}
                  </div>
                )}
              </div>
            </VendorGate>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

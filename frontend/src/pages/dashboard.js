// pages/dashboard.js
"use client";

import React, { useContext, useEffect, useState, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout/Layout";
import { AuthContext } from "@/components/Auth/AuthProvider";
import { getGraphqlUrl } from "@/utils/apiClient";
import OrdersTab from "@/components/Account/OrdersTab";
import OffersTab from "@/components/Account/OffersTab";
import TradesTab from "@/components/Account/TradesTab";
import SellingTab from "@/components/Account/SellingTab";
import NotificationsInboxTab from "@/components/Account/NotificationsInboxTab";
import {
  Wallet,
  ShoppingBag,
  Tag,
  LayoutList,
  Loader2,
  ExternalLink,
  ChevronRight,
  ArrowLeftRight,
  Store,
  Bell,
} from "lucide-react";

/* ─── GQL ─────────────────────────────────────────────────────────────────── */

async function gql(token, query, variables = {}) {
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

const DASHBOARD_STATS_QUERY = `
  query DashboardStats {
    myWallet(limit: 1) { balance currency }
    myListings(status: ACTIVE, limit: 200) { id }
    myOrders(limit: 100) { id paymentStatus fulfilmentStatus }
    sellerOrders: myOrders(role: "seller", limit: 100) { id paymentStatus fulfilmentStatus }
    myIncomingOffers { id status }
    myOffers { id status }
    myTrades(pageSize: 100) { id status initiatorId lastCounterBy partyAId partyBId }
  }
`;

/* ─── Stat card ───────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, sub, href, color }) {
  const colors = {
    purple: {
      bg: "from-violet-500/10 to-purple-500/5 dark:from-violet-500/15 dark:to-purple-900/10",
      icon: "bg-violet-500/15 text-violet-500 dark:text-violet-400",
      border: "border-violet-500/20 dark:border-violet-500/20",
      value: "text-violet-600 dark:text-violet-300",
    },
    teal: {
      bg: "from-teal-500/10 to-cyan-500/5 dark:from-teal-500/15 dark:to-cyan-900/10",
      icon: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
      border: "border-teal-500/20 dark:border-teal-500/20",
      value: "text-teal-700 dark:text-teal-300",
    },
    amber: {
      bg: "from-amber-500/10 to-orange-500/5 dark:from-amber-500/15 dark:to-orange-900/10",
      icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      border: "border-amber-500/20 dark:border-amber-500/20",
      value: "text-amber-700 dark:text-amber-300",
    },
    blue: {
      bg: "from-blue-500/10 to-indigo-500/5 dark:from-blue-500/15 dark:to-indigo-900/10",
      icon: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
      border: "border-blue-500/20 dark:border-blue-500/20",
      value: "text-blue-700 dark:text-blue-300",
    },
  };

  const c = colors[color] ?? colors.blue;

  const inner = (
    <div
      className={`
        relative overflow-hidden rounded-2xl border ${c.border}
        bg-gradient-to-br ${c.bg} p-5
        ${href ? "hover:scale-[1.02] transition-transform duration-200 cursor-pointer" : ""}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        {href && (
          <ChevronRight className="w-4 h-4 text-light-textMuted dark:text-dark-textMuted mt-0.5 shrink-0" />
        )}
      </div>
      <div className="mt-4">
        <p className={`text-3xl font-black tracking-tight ${c.value}`}>{value}</p>
        <p className="text-sm font-semibold text-light-text dark:text-dark-text mt-1">{label}</p>
        {sub && (
          <p className="text-xs text-light-textMuted dark:text-dark-textMuted mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

/* ─── View tabs ───────────────────────────────────────────────────────────── */

const VIEWS = [
  { key: "orders",        label: "Orders",        icon: ShoppingBag },
  { key: "offers",        label: "Offers",        icon: Tag },
  { key: "trades",        label: "Trades",        icon: ArrowLeftRight },
  { key: "selling",       label: "Selling",       icon: Store },
  { key: "notifications", label: "Notifications", icon: Bell },
];

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const myId = user?.id ?? user?.sub ?? null;

  const [view, setView] = useState(
    VIEWS.some((v) => v.key === router.query?.view) ? router.query.view : "orders"
  );
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const switchView = useCallback(
    (v) => {
      setView(v);
      router.replace({ pathname: "/dashboard", query: { view: v } }, undefined, { shallow: true });
    },
    [router]
  );

  useEffect(() => {
    const qv = router.query?.view;
    if (VIEWS.some((v) => v.key === qv) && qv !== view) setView(qv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query?.view]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    setStatsLoading(true);
    try {
      const data = await gql(token, DASHBOARD_STATS_QUERY);
      const orders = data?.myOrders ?? [];
      const pendingOrders = orders.filter(
        (o) => o.paymentStatus === "pending" || o.fulfilmentStatus === "awaiting_shipment"
      ).length;
      const incomingPending = (data?.myIncomingOffers ?? []).filter((o) => o.status === "pending").length;
      const sentActive = (data?.myOffers ?? []).filter((o) => ["pending", "countered"].includes(o.status)).length;
      const trades = data?.myTrades ?? [];
      const incomingTrades = trades.filter(
        (t) =>
          (t.status === "INITIATED" && t.initiatorId !== myId) ||
          (t.status === "NEGOTIATING" && t.lastCounterBy !== myId)
      ).length;
      const sellerPendingDispatch = (data?.sellerOrders ?? []).filter(
        (o) =>
          (o.paymentStatus === "paid" || o.paymentStatus === "captured") &&
          ["pending_dispatch", "pending"].includes(o.fulfilmentStatus)
      ).length;
      setStats({
        balance:               data?.myWallet?.balance ?? 0,
        currency:              data?.myWallet?.currency ?? "GBP",
        activeListings:        (data?.myListings ?? []).length,
        pendingOrders,
        incomingPending,
        sentActive,
        incomingTrades,
        totalOrders:           orders.length,
        sellerPendingDispatch,
      });
    } catch (_) {
      // non-fatal
    } finally {
      setStatsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  /* ── Head ── */
  const head = (
    <Head>
      <title>Dashboard – SixByFive TCG</title>
      <meta name="robots" content="noindex, nofollow" />
    </Head>
  );

  if (authLoading) {
    return (
      <>
        {head}
        <Layout>
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-6 h-6 animate-spin text-light-textMuted dark:text-dark-textMuted" />
          </div>
        </Layout>
      </>
    );
  }

  if (!user) {
    return (
      <>
        {head}
        <Layout>
          <div className="max-w-md mx-auto px-4 py-24 text-center">
            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-10 shadow">
              <h1 className="text-2xl font-bold mb-2">Sign in required</h1>
              <p className="text-light-textSecondary dark:text-dark-textSecondary text-sm">
                You need to be logged in to view your dashboard.
              </p>
              <Link
                href="/"
                className="inline-block mt-6 px-5 py-2 rounded-xl bg-light-accent !text-white hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight"
              >
                Go to home
              </Link>
            </div>
          </div>
        </Layout>
      </>
    );
  }

  const bal = stats ? `£${Number(stats.balance).toFixed(2)}` : "—";
  const shimmer = "animate-pulse bg-light-border/40 dark:bg-dark-border/40 rounded-lg";

  return (
    <>
      {head}
      <Layout>

        {/* ── Page header ── */}
        <div className="w-full px-4 pt-8 pb-6 border-b border-light-border dark:border-dark-border">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Dashboard</h1>
            <p className="text-light-textSecondary dark:text-dark-textSecondary mt-1">
              Welcome back, <span className="font-semibold text-light-text dark:text-dark-text">{user.username}</span>
            </p>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="max-w-6xl mx-auto px-4 mt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {statsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`h-36 ${shimmer}`} />
              ))
            ) : (
              <>
                <StatCard
                  icon={Wallet}
                  label="Wallet balance"
                  value={bal}
                  sub="Available to spend"
                  href="/account?tab=wallet"
                  color="purple"
                />
                <StatCard
                  icon={LayoutList}
                  label="Active listings"
                  value={String(stats?.activeListings ?? 0)}
                  sub="Live on marketplace"
                  color="teal"
                />
                <StatCard
                  icon={ShoppingBag}
                  label="Pending orders"
                  value={String(stats?.pendingOrders ?? 0)}
                  sub={`${stats?.totalOrders ?? 0} total orders`}
                  color="amber"
                />
                <StatCard
                  icon={Tag}
                  label="Incoming offers"
                  value={String(stats?.incomingPending ?? 0)}
                  sub={stats?.sentActive ? `${stats.sentActive} sent awaiting reply` : "On your listings"}
                  color="blue"
                />
              </>
            )}
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

          {/* Tab switcher */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-2">
              {VIEWS.map(({ key, label, icon: Icon }) => {
                const active = view === key;
                const badge =
                  key === "orders"  ? stats?.pendingOrders :
                  key === "offers"  ? stats?.incomingPending :
                  key === "trades"  ? stats?.incomingTrades :
                  key === "selling"       ? stats?.sellerPendingDispatch :
                  0;
                return (
                  <button
                    key={key}
                    onClick={() => switchView(key)}
                    className={`
                      flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition
                      ${active
                        ? "bg-light-accent dark:bg-dark-accent text-white shadow-md"
                        : "bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text dark:text-dark-text hover:bg-light-alt dark:hover:bg-dark-alt"}
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {badge > 0 && (
                      <span className={`
                        inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold
                        ${active ? "bg-white/25 text-white" : "bg-light-accent/15 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent"}
                      `}>
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick links */}
            <div className="flex gap-2">
              <Link
                href="/marketplace"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface hover:bg-light-alt dark:hover:bg-dark-alt text-sm text-light-textSecondary dark:text-dark-textSecondary transition"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Marketplace
              </Link>
            </div>
          </div>

          {/* Content panel */}
          <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shadow-sm overflow-hidden">
            {view === "orders"        && <OrdersTab token={token} embedded />}
            {view === "offers"        && <OffersTab token={token} embedded />}
            {view === "trades"        && <TradesTab token={token} myId={myId} embedded />}
            {view === "selling"       && <SellingTab token={token} myId={myId} />}
            {view === "notifications" && <NotificationsInboxTab token={token} />}
          </div>

        </div>
      </Layout>
    </>
  );
}

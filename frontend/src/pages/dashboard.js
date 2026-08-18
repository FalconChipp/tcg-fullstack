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

function StatCard({ icon: Icon, label, value, sub, href }) {
  const inner = (
    <div
      className={`
        relative overflow-hidden rounded-[10px] border border-vault-border
        bg-vault-surface p-5 transition-colors
        ${href ? "hover:border-vault-borderStrong cursor-pointer" : ""}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-[6px] flex items-center justify-center shrink-0 bg-vault-raised text-vault-accent">
          <Icon className="w-5 h-5" />
        </div>
        {href && (
          <ChevronRight className="w-4 h-4 text-vault-textTertiary mt-0.5 shrink-0" />
        )}
      </div>
      <div className="mt-4">
        <p className="font-vault text-3xl font-semibold tracking-tight text-vault-text">{value}</p>
        <p className="text-sm font-semibold text-vault-text mt-1">{label}</p>
        {sub && (
          <p className="text-xs text-vault-textTertiary mt-0.5">{sub}</p>
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
          <div className="flex items-center justify-center bg-vault-bg py-32">
            <Loader2 className="w-6 h-6 animate-spin text-vault-textTertiary" />
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
          <div className="min-h-screen bg-vault-bg">
            <div className="max-w-md mx-auto px-4 py-24 text-center">
              <div className="rounded-[14px] border border-vault-border bg-vault-surface p-10">
                <h1 className="font-vault text-2xl font-semibold text-vault-text mb-2">Sign in required</h1>
                <p className="text-vault-textSecondary text-sm">
                  You need to be logged in to view your dashboard.
                </p>
                <Link
                  href="/"
                  className="inline-block mt-6 px-5 py-2 rounded-[10px] bg-vault-accent !text-vault-text hover:bg-vault-accentHover"
                >
                  Go to home
                </Link>
              </div>
            </div>
          </div>
        </Layout>
      </>
    );
  }

  const bal = stats ? `£${Number(stats.balance).toFixed(2)}` : "—";
  const shimmer = "animate-pulse bg-vault-raised rounded-[6px]";

  return (
    <>
      {head}
      <Layout>
      <div className="min-h-screen bg-vault-bg">

        {/* ── Page header ── */}
        <div className="w-full px-4 pt-8 pb-6 border-b border-vault-border">
          <div className="max-w-6xl mx-auto">
            <p className="mb-4 font-vault-body text-[11px] font-semibold uppercase tracking-[0.08em] text-vault-textTertiary">
              Account
            </p>
            <h1 className="font-vault text-[32px] font-semibold tracking-tight text-vault-text">Dashboard</h1>
            <p className="text-vault-textSecondary mt-1">
              Welcome back, <span className="font-semibold text-vault-text">{user.username}</span>
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
                />
                <StatCard
                  icon={LayoutList}
                  label="Active listings"
                  value={String(stats?.activeListings ?? 0)}
                  sub="Live on marketplace"
                />
                <StatCard
                  icon={ShoppingBag}
                  label="Pending orders"
                  value={String(stats?.pendingOrders ?? 0)}
                  sub={`${stats?.totalOrders ?? 0} total orders`}
                />
                <StatCard
                  icon={Tag}
                  label="Incoming offers"
                  value={String(stats?.incomingPending ?? 0)}
                  sub={stats?.sentActive ? `${stats.sentActive} sent awaiting reply` : "On your listings"}
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
                      flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold transition-colors
                      ${active
                        ? "bg-vault-accent text-vault-text"
                        : "border border-vault-border bg-vault-surface text-vault-textSecondary hover:border-vault-borderStrong hover:text-vault-text"}
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {badge > 0 && (
                      <span className={`
                        inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-[6px] text-[10px] font-bold
                        ${active ? "bg-vault-text/20 text-vault-text" : "bg-vault-accent/15 text-vault-accent"}
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
                className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-vault-border bg-vault-surface hover:border-vault-borderStrong text-sm text-vault-textSecondary transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Marketplace
              </Link>
            </div>
          </div>

          {/* Content panel */}
          <div className="rounded-[14px] border border-vault-border bg-vault-surface overflow-hidden">
            {view === "orders"        && <OrdersTab token={token} embedded />}
            {view === "offers"        && <OffersTab token={token} embedded />}
            {view === "trades"        && <TradesTab token={token} myId={myId} embedded />}
            {view === "selling"       && <SellingTab token={token} myId={myId} />}
            {view === "notifications" && <NotificationsInboxTab token={token} />}
          </div>

        </div>
      </div>
      </Layout>
    </>
  );
}

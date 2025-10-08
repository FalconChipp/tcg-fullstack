// pages/account.js (or src/pages/account.js)
"use client";

import React, { useContext, useEffect, useMemo, useState, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout/Layout";
import { AuthContext } from "@/components/Auth/AuthProvider";

// Tab content (kept as-is)
import SecurityTab from "@/components/Account/SecurityTab";
import NotificationsTab from "@/components/Account/NotificationsTab";
import SubscriptionTab from "@/components/Account/SubscriptionTab";
import MarketplaceTab from "@/components/Account/MarketplaceTab";
import PrivacyTab from "@/components/Account/PrivacyTab";
import SupportTab from "@/components/Account/SupportTab";

// Icons
import {
  KeyRound,
  Bell,
  UserCog,
  CreditCard,
  Store,
  Shield,
  HelpCircle,
  Lock,
} from "lucide-react";
import { FaDiscord } from "react-icons/fa";

/* =========================
   NAV MODEL
   ========================= */
const NAV = [
  { key: "security",      label: "Security",        icon: KeyRound },
  { key: "subscriptions", label: "Subscription",    icon: CreditCard, soon: true},
  { key: "marketplace",   label: "Marketplace",     icon: Store,      soon: true },
  { key: "support",       label: "Support/Help",    icon: HelpCircle },
  { key: "notifications", label: "Notifications",   icon: Bell,       soon: true },             
  { key: "privacy",       label: "Privacy & Data",  icon: Lock },
];

const VALID_TABS = NAV.map((n) => n.key);
const normalizeTab = (t) => (VALID_TABS.includes(String(t || "").toLowerCase()) ? String(t).toLowerCase() : null);

/* =========================
   BADGE
   ========================= */
function SoonBadge() {
  return (
    <span className="ml-auto text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-light-alt dark:bg-dark-alt text-light-textMuted dark:text-dark-textMuted border border-light-border dark:border-dark-border">
      Soon
    </span>
  );
}

/* =========================
   SIDEBAR BUTTON
   ========================= */
function NavButton({ active, onClick, icon: Icon, children, disabled, showSoon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
        transition
        ${active
          ? "bg-light-accent text-white dark:bg-dark-accent shadow"
          : "text-light-text dark:text-dark-text hover:bg-light-alt dark:hover:bg-dark-alt"}
        ${disabled ? "opacity-60 cursor-not-allowed" : ""}
      `}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={`w-4.5 h-4.5 ${active ? "opacity-90" : "text-light-textMuted dark:text-dark-textMuted"}`} />
      <span className={`text-[15px] font-semibold ${active ? "text-white" : ""}`}>{children}</span>
      {showSoon && !active && <SoonBadge />}
    </button>
  );
}

/* =========================
   MOBILE TAB STRIP
   ========================= */
function MobileTabs({ activeTab, setActiveTab }) {
  return (
    <div className="md:hidden sticky top-[72px] z-30 bg-light-background/80 dark:bg-dark-background/80 backdrop-blur border-b border-light-border dark:border-dark-border">
      <div className="max-w-6xl mx-auto px-4 py-3 overflow-x-auto no-scrollbar">
        <div className="flex gap-2">
          {NAV.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => !item.soon && setActiveTab(item.key)}
                disabled={item.soon}
                className={`
                  px-3 py-1.5 rounded-full text-sm whitespace-nowrap border
                  ${active
                    ? "bg-light-accent text-white border-light-accent dark:bg-dark-accent dark:border-dark-accent"
                    : "bg-light-surface/70 dark:bg-dark-surface/70 border-light-border dark:border-dark-border text-light-text dark:text-dark-text hover:bg-light-alt dark:hover:bg-dark-alt"}
                  ${item.soon ? "opacity-60 cursor-not-allowed" : ""}
                `}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* =========================
   PAGE
   ========================= */
export default function AccountPage() {
  const router = useRouter();
  const { user, token, loading } = useContext(AuthContext);

  // derive initial tab from ?tab=
  const initialTab = useMemo(() => normalizeTab(router.query?.tab) || "security", [router.query?.tab]);
  const [activeTab, setActiveTab] = useState(initialTab);

  // keep state in sync with URL
  useEffect(() => {
    if (activeTab !== initialTab) setActiveTab(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  // update the URL when tab changes (bookmarkable)
  const handleSetActiveTab = useCallback(
    (tab) => {
      const next = normalizeTab(tab) || "security";
      setActiveTab(next);
      router.replace({ pathname: "/account", query: { tab: next } }, undefined, { shallow: true });
    },
    [router]
  );

  // HEAD (noindex: account is private)
  const head = (
    <Head>
      <title>Account Settings – SixByFive TCG</title>
      <meta name="description" content="Manage your SixByFive TCG account settings, profile and preferences." />
      <link rel="canonical" href="https://tcg.sixbyfive.com/account" />
      <meta property="og:title" content="Account Settings – SixByFive TCG" />
      <meta property="og:description" content="Manage your SixByFive TCG account settings, profile and preferences." />
      <meta property="og:url" content="https://tcg.sixbyfive.com/account" />
      <meta property="og:image" content="https://tcg.sixbyfive.com/og-image.png" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Account Settings – SixByFive TCG" />
      <meta name="twitter:description" content="Manage your SixByFive TCG account settings, profile and preferences." />
      <meta name="twitter:image" content="https://tcg.sixbyfive.com/og-image.png" />
      <meta name="robots" content="noindex, nofollow" />
    </Head>
  );

  // Loading & unauth states (polished)
  if (loading) {
    return (
      <>
        {head}
        <Layout>
          <div className="max-w-6xl mx-auto px-4 py-16">
            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-8 shadow">
              <div className="animate-pulse space-y-4">
                <div className="h-8 w-64 bg-light-border/60 dark:bg-dark-border/60 rounded" />
                <div className="h-4 w-80 bg-light-border/40 dark:bg-dark-border/40 rounded" />
                <div className="h-4 w-72 bg-light-border/40 dark:bg-dark-border/40 rounded" />
              </div>
            </div>
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
          <div className="max-w-3xl mx-auto px-4 py-16 text-center">
            <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-10 shadow">
              <h1 className="text-2xl font-bold mb-2">Sign in required</h1>
              <p className="text-light-textSecondary dark:text-dark-textSecondary">
                You need to be logged in to manage your account settings.
              </p>
              <Link
                href="/"
                className="inline-block mt-6 px-5 py-2 rounded-xl bg-light-accent hover:bg-light-accentLight !text-white dark:bg-dark-accent dark:hover:bg-dark-accentLight"
              >
                Go to home
              </Link>
            </div>
          </div>
        </Layout>
      </>
    );
  }

  return (
    <>
      {head}
      <Layout>
        {/* Top header — soft gradient, no heavy borders */}
        <section className="w-full px-4 pt-6 pb-8 bg-gradient-to-br from-light-alt via-light-background to-[#eaf3ff] dark:from-[#191923] dark:via-dark-surface dark:to-dark-background">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Account settings</h1>
            <p className="text-light-textSecondary dark:text-dark-textSecondary max-w-2xl">
              Update your security, notifications, subscriptions, and more.
            </p>
          </div>
        </section>

        {/* Mobile pill tabs */}
        <MobileTabs activeTab={activeTab} setActiveTab={handleSetActiveTab} />

        {/* Main area */}
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-10">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 md:gap-8">
            {/* Sidebar */}
            <aside className="md:sticky md:top-24">
              <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shadow-sm p-4">
                <div className="px-2 pb-3">
                  <h2 className="text-lg font-extrabold">Account</h2>
                </div>
                <div className="space-y-1">
                  {NAV.map(({ key, label, icon, soon }) => (
                    <NavButton
                      key={key}
                      icon={icon}
                      active={activeTab === key}
                      onClick={() => !soon && handleSetActiveTab(key)}
                      disabled={soon}
                      showSoon={soon}
                    >
                      {label}
                    </NavButton>
                  ))}
                </div>

                {/* Side tip */}
                <div className="
                  mt-4 overflow-hidden rounded-2xl border
                  border-light-border dark:border-dark-border
                  bg-light-alt dark:bg-dark-alt shadow-sm
                ">
                  {/* Header row with soft brand tint */}
                  <div className="
                    p-4 flex items-center gap-3
                    bg-gradient-to-r from-[#5865F2]/12 to-transparent text-center
                  ">
                    <div className="min-w-0">
                      <div className="font-semibold text-light-text dark:text-dark-text pb-3">
                        Join our Discord for updates & help
                      </div>
                      <p className="text-xs text-light-textMuted dark:text-dark-textMuted">
                        Release notes, quick support & feature ideas.
                      </p>
                    </div>
                  </div>

                  {/* Action area */}
                  <div className="p-4 pt-3">
                    <a
                      href="https://discord.gg/PRMbMbRE2H"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Join the SixByFive Discord (opens in a new tab)"
                      className="
                        w-full inline-flex items-center justify-center gap-2
                        px-3.5 py-2 rounded-lg text-sm font-semibold leading-none
                        bg-[#5865F2] hover:bg-[#4c59d6]
                        !text-white hover:!text-white focus:!text-white        /* force white text */
                        shadow-sm ring-1 ring-inset ring-[#5865F2]/35
                        transition focus:outline-none focus:ring-2 focus:ring-[#5865F2]/40
                      "
                    >
                      <FaDiscord className="w-4 h-4 shrink-0 text-white" />   {/* force white + no squish */}
                      <span className="!text-white">Join Discord</span>        {/* double-ensure against global a styles */}
                    </a>
                  </div>
                </div>

              </div>
            </aside>

            {/* Content: single surface, no extra nested frames to avoid “double borders” */}
            <main className="min-w-0">
              <div className="rounded-2xl bg-light-surface/60 dark:bg-dark-surface/60">
                {activeTab === "security" && <SecurityTab user={user} token={token} />}
                {activeTab === "subscriptions" && <SubscriptionTab user={user} token={token} />}
                {activeTab === "marketplace" && <MarketplaceTab user={user} token={token} />}
                {activeTab === "support" && <SupportTab />}
                {activeTab === "notifications" && <NotificationsTab user={user} />}
                {activeTab === "preferences" && <PreferencesTab user={user} />}
                {activeTab === "privacy" && <PrivacyTab user={user} />}
                {activeTab === "profile" && <ConnectedAccountsTab user={user} token={token} />}
              </div>
            </main>
          </div>
        </div>
      </Layout>
    </>
  );
}

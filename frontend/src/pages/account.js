"use client";
import React, { useContext, useState } from "react";
import { AuthContext } from "@/components/Auth/AuthProvider";
import Head from "next/head";
import Layout from "@/components/Layout/Layout";
import AccountTabs from "@/components/Account/AccountTabs";
import ConnectedAccountsTab from "@/components/Account/ConnectedTab";
import SecurityTab from "@/components/Account/SecurityTab";
import PreferencesTab from "@/components/Account/PreferencesTab";
import NotificationsTab from "@/components/Account/NotificationsTab";
import SubscriptionTab from "@/components/Account/SubscriptionTab";
import MarketplaceTab from "@/components/Account/MarketplaceTab";
import PrivacyTab from "@/components/Account/PrivacyTab";
import SupportTab from "@/components/Account/SupportTab";

export default function AccountPage() {
  const { user, token, loading } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState("security");

  const head = (
    <Head>
      <title>Account Settings – SixByFive TCG</title>
      <meta
        name="description"
        content="Manage your SixByFive TCG account settings, profile and preferences."
      />
      <link rel="canonical" href="https://tcg.sixbyfive.com/account" />
      <meta property="og:title" content="Account Settings – SixByFive TCG" />
      <meta
        property="og:description"
        content="Manage your SixByFive TCG account settings, profile and preferences."
      />
      <meta property="og:url" content="https://tcg.sixbyfive.com/account" />
      <meta
        property="og:image"
        content="https://tcg.sixbyfive.com/og-image.png"
      />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Account Settings – SixByFive TCG" />
      <meta
        name="twitter:description"
        content="Manage your SixByFive TCG account settings, profile and preferences."
      />
      <meta
        name="twitter:image"
        content="https://tcg.sixbyfive.com/og-image.png"
      />
    </Head>
  );

  if (loading)
    return (
      <>
        {head}
        <Layout>
          <div className="p-10 text-center">Loading…</div>
        </Layout>
      </>
    );
  if (!user)
    return (
      <>
        {head}
        <Layout>
          <div className="p-10 text-center">
            You must be logged in to view account settings.
          </div>
        </Layout>
      </>
    );

  return (
    <>
      {head}
      <Layout>
        <div className="flex flex-col md:flex-row max-w-4xl mx-auto py-12 gap-8">
          {/* Sidebar Navigation */}
          <AccountTabs activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {activeTab === "profile" && (
              <ConnectedAccountsTab user={user} token={token} />
            )}
            {activeTab === "security" && (
              <SecurityTab user={user} token={token} />
            )}
            {activeTab === "preferences" && (
              <PreferencesTab user={user} />
            )}
            {activeTab === "notifications" && (
              <NotificationsTab user={user} />
            )}
            {activeTab === "subscriptions" && (
              <SubscriptionTab user={user} token={token} />
            )}
            {activeTab === "marketplace" && (
              <MarketplaceTab user={user} token={token} />
            )}
            {activeTab === "privacy" && <PrivacyTab user={user} />}
            {activeTab === "support" && <SupportTab />}
          </main>
        </div>
      </Layout>
    </>
  );
}

"use client";

import React, { useContext, useState } from "react";
import { AuthContext } from "@/components/Auth/AuthProvider";
import Head from "next/head";
import Layout from "@/components/Layout/Layout";
import StatusMessage from "@/components/UI/StatusMessage";
import {
  Cog6ToothIcon,
  UserCircleIcon,
  KeyIcon,
  EnvelopeIcon,
  BellIcon,
} from "@heroicons/react/24/outline";

// --- GraphQL Helper ---
const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";
async function graphqlRequest(query, variables, token) {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error("Network error: " + res.status);
    const json = await res.json();
    if (json.errors && json.errors.length > 0) {
      const safeMsg =
        json.errors[0].message &&
        !json.errors[0].message.includes("WordPress database error")
          ? json.errors[0].message
          : "Sorry, there was a server error. Please try again later.";
      throw new Error(safeMsg);
    }
    return json;
  } catch (err) {
    console.error("Request error:", err);
    throw new Error(
      err.message || "Sorry, there was a server error. Please try again later.",
    );
  }
}

// --- Password rule utils ---
function getPasswordRules(pw) {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[\W_]/.test(pw),
  };
}
function checkPasswordStrength(pw) {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(pw))
    return "Password must have at least one uppercase letter";
  if (!/[a-z]/.test(pw))
    return "Password must have at least one lowercase letter";
  if (!/[0-9]/.test(pw)) return "Password must have at least one number";
  if (!/[\W_]/.test(pw))
    return "Password must have at least one special character";
  return null;
}

// --- Tab config (easy to add new sections later) ---
const SETTINGS_TABS = [
  {
    key: "profile",
    label: "Profile",
    icon: UserCircleIcon,
  },
  {
    key: "security",
    label: "Security",
    icon: KeyIcon,
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: BellIcon,
    soon: true, // Demo - mark as 'coming soon'
  },
  {
    key: "preferences",
    label: "Preferences",
    icon: Cog6ToothIcon,
    soon: true,
  },
];

// --- MAIN COMPONENT ---
export default function AccountPage() {
  const { user, token, loading } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState("profile");

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

  // Block while loading user
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

  // Render sidebar layout with tabbed panel
  return (
    <>
      {head}
      <Layout>
        <div className="flex flex-col md:flex-row max-w-4xl mx-auto py-12 gap-8">
          {/* Sidebar */}
          <aside className="md:w-56 w-full flex-shrink-0 mb-4 md:mb-0">
            <nav className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shadow px-4 py-6 flex flex-row md:flex-col gap-2 md:gap-1">
              {SETTINGS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`
                  flex items-center gap-3 px-4 py-2 rounded-xl transition-colors font-semibold w-full
                  ${
                    activeTab === tab.key
                      ? "bg-light-accent text-white dark:bg-dark-accent dark:text-black"
                      : "text-light-text dark:text-dark-text hover:bg-light-alt dark:hover:bg-dark-alt"
                  }
                  ${tab.soon ? "opacity-60 cursor-not-allowed" : ""}
                `}
                  onClick={() => !tab.soon && setActiveTab(tab.key)}
                  disabled={tab.soon}
                  type="button"
                  tabIndex={tab.soon ? -1 : 0}
                  aria-current={activeTab === tab.key ? "page" : undefined}
                >
                  <tab.icon className="w-5 h-5 flex-shrink-0" />
                  <span>{tab.label}</span>
                  {tab.soon && (
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                      Soon
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main settings panel */}
          <main className="flex-1 min-w-0">
            {activeTab === "profile" && (
              <AccountProfileTab user={user} token={token} />
            )}
            {activeTab === "security" && (
              <AccountSecurityTab user={user} token={token} />
            )}
            {/* Coming soon: Add Preferences, Notifications etc. */}
          </main>
        </div>
      </Layout>
    </>
  );
}

// ================= PROFILE TAB ===================
function AccountProfileTab({ user, token }) {
  // State for email change
  const [email, setEmail] = useState(user?.email || "");
  const [emailPassword, setEmailPassword] = useState(""); // Password confirm for email change
  const [emailStatus, setEmailStatus] = useState(null);
  const isOAuth = user?.authProvider && user.authProvider !== "local";

  async function handleEmailUpdate(e) {
    e.preventDefault();
    setEmailStatus(null);

    if (!emailPassword) {
      setEmailStatus({ type: "error", msg: "Please enter your password." });
      return;
    }

    const mutation = `
      mutation UpdateCustomUserEmail($input: UpdateCustomUserEmailInput!) {
        updateCustomUserEmail(input: $input) {
          success
          error
        }
      }
    `;
    const variables = {
      input: {
        newEmail: email,
        password: emailPassword,
      },
    };

    try {
      const resp = await graphqlRequest(mutation, variables, token);
      const out = resp?.data?.updateCustomUserEmail;
      if (out?.success) {
        setEmailStatus({ type: "success", msg: "Email updated!" });
        setEmailPassword("");
      } else {
        setEmailStatus({
          type: "error",
          msg:
            out?.error ||
            "Unable to update email. Please check your password and try again.",
        });
      }
    } catch (err) {
      setEmailStatus({
        type: "error",
        msg: err.message || "A server error occurred.",
      });
    }
  }

  return (
    <form
      onSubmit={handleEmailUpdate}
      className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl px-6 py-8 shadow"
    >
      <h2 className="text-xl font-bold mb-6 text-light-primary dark:text-dark-primary">
        Profile Settings
      </h2>
      {/* Email update */}
      <div className="mb-6">
        <label className="block mb-1 font-semibold text-light-text dark:text-dark-text">
          Email
        </label>
        <input
          type="email"
          value={email}
          disabled={isOAuth}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text transition"
        />
        {isOAuth && (
          <p className="text-sm text-light-textMuted dark:text-dark-textMuted mt-1">
            Email managed by OAuth provider
          </p>
        )}
      </div>
      <div className="mb-6">
        <label className="block mb-1 font-semibold text-light-text dark:text-dark-text">
          Current Password{" "}
          <span className="text-light-error dark:text-dark-error">*</span>
        </label>
        <input
          type="password"
          value={emailPassword}
          disabled={isOAuth}
          onChange={(e) => setEmailPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text transition"
          autoComplete="current-password"
          placeholder="Enter your password to confirm"
          required
        />
      </div>
      <button
        type="submit"
        disabled={isOAuth || email === user.email || !emailPassword}
        className="bg-light-accent dark:bg-dark-accent text-white dark:text-black px-6 py-2.5 rounded-xl font-bold hover:bg-light-primary dark:hover:bg-dark-primary transition disabled:opacity-50"
      >
        Update Email
      </button>
      {emailStatus && (
        <div className="mt-4">
          <StatusMessage
            type={emailStatus.type}
            message={emailStatus.msg}
            onClose={() => setEmailStatus(null)}
          />
        </div>
      )}
    </form>
  );
}

// =============== SECURITY TAB ====================
function AccountSecurityTab({ user, token }) {
  // Password change state
  const [passwordFields, setPasswordFields] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [pwStatus, setPwStatus] = useState(null);

  // Password reset
  const [resetStatus, setResetStatus] = useState(null);

  const isOAuth = user?.authProvider && user.authProvider !== "local";
  const rules = getPasswordRules(passwordFields.new);

  // ---- Password Update
  async function handlePasswordUpdate(e) {
    e.preventDefault();
    setPwStatus(null);

    if (!passwordFields.current) {
      setPwStatus({
        type: "error",
        msg: "Please enter your current password.",
      });
      return;
    }
    if (!passwordFields.new || passwordFields.new !== passwordFields.confirm) {
      setPwStatus({ type: "error", msg: "New passwords do not match." });
      return;
    }
    const pwError = checkPasswordStrength(passwordFields.new);
    if (pwError) {
      setPwStatus({ type: "error", msg: pwError });
      return;
    }

    const mutation = `
      mutation UpdateCustomUserPassword($input: UpdateCustomUserPasswordInput!) {
        updateCustomUserPassword(input: $input) {
          success
          error
        }
      }
    `;
    const variables = {
      input: {
        currentPassword: passwordFields.current,
        newPassword: passwordFields.new,
      },
    };

    try {
      const resp = await graphqlRequest(mutation, variables, token);
      const out = resp?.data?.updateCustomUserPassword;
      if (out?.success) {
        setPwStatus({ type: "success", msg: "Password updated!" });
        setPasswordFields({ current: "", new: "", confirm: "" });
      } else {
        setPwStatus({
          type: "error",
          msg:
            out?.error ||
            "Unable to update password. Please check your current password and try again.",
        });
      }
    } catch (err) {
      setPwStatus({
        type: "error",
        msg: err.message || "A server error occurred.",
      });
    }
  }

  // ---- Password Reset (send reset email)
  async function handleRequestPasswordReset(e) {
    e.preventDefault();
    setResetStatus(null);
    const mutation = `
      mutation StartCustomUserPasswordReset($input: StartCustomUserPasswordResetInput!) {
        startCustomUserPasswordReset(input: $input) {
          success
          error
        }
      }
    `;
    const variables = {
      input: {
        email: user.email,
      },
    };
    try {
      const resp = await graphqlRequest(mutation, variables, null);
      const out = resp?.data?.startCustomUserPasswordReset;
      if (out?.success) {
        setResetStatus({
          type: "success",
          msg: "Reset link sent! Check your email.",
        });
      } else {
        setResetStatus({
          type: "error",
          msg: out?.error || "Failed to send reset link.",
        });
      }
    } catch (err) {
      setResetStatus({
        type: "error",
        msg: err.message || "Error sending reset link.",
      });
    }
  }

  return (
    <div className="space-y-10">
      {/* PASSWORD CHANGE */}
      <form
        onSubmit={handlePasswordUpdate}
        className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl px-6 py-8 shadow"
      >
        <h2 className="text-xl font-bold mb-6 text-light-primary dark:text-dark-primary">
          Security Settings
        </h2>
        <div className="mb-6">
          <label className="block mb-1 font-semibold text-light-text dark:text-dark-text">
            Current Password
          </label>
          <input
            type="password"
            value={passwordFields.current}
            disabled={isOAuth}
            onChange={(e) =>
              setPasswordFields((f) => ({ ...f, current: e.target.value }))
            }
            className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text transition"
            autoComplete="current-password"
          />
        </div>
        <div className="mb-6">
          <label className="block mb-1 font-semibold text-light-text dark:text-dark-text">
            New Password
          </label>
          <input
            type="password"
            value={passwordFields.new}
            disabled={isOAuth}
            onChange={(e) =>
              setPasswordFields((f) => ({ ...f, new: e.target.value }))
            }
            className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text transition"
            autoComplete="new-password"
          />
          {/* Dynamic rules feedback */}
          <ul className="text-sm mb-2 mt-2">
            <li
              className={
                rules.length
                  ? "text-green-600"
                  : "text-light-textMuted dark:text-dark-textMuted"
              }
            >
              {rules.length ? "✅" : "❌"} At least 8 characters
            </li>
            <li
              className={
                rules.upper
                  ? "text-green-600"
                  : "text-light-textMuted dark:text-dark-textMuted"
              }
            >
              {rules.upper ? "✅" : "❌"} At least one uppercase letter
            </li>
            <li
              className={
                rules.lower
                  ? "text-green-600"
                  : "text-light-textMuted dark:text-dark-textMuted"
              }
            >
              {rules.lower ? "✅" : "❌"} At least one lowercase letter
            </li>
            <li
              className={
                rules.number
                  ? "text-green-600"
                  : "text-light-textMuted dark:text-dark-textMuted"
              }
            >
              {rules.number ? "✅" : "❌"} At least one number
            </li>
            <li
              className={
                rules.special
                  ? "text-green-600"
                  : "text-light-textMuted dark:text-dark-textMuted"
              }
            >
              {rules.special ? "✅" : "❌"} At least one special character
            </li>
          </ul>
        </div>
        <div className="mb-6">
          <label className="block mb-1 font-semibold text-light-text dark:text-dark-text">
            Confirm New Password
          </label>
          <input
            type="password"
            value={passwordFields.confirm}
            disabled={isOAuth}
            onChange={(e) =>
              setPasswordFields((f) => ({ ...f, confirm: e.target.value }))
            }
            className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text transition"
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={isOAuth}
          className="bg-light-accent dark:bg-dark-accent text-white dark:text-black px-6 py-2.5 rounded-xl font-bold hover:bg-light-primary dark:hover:bg-dark-primary transition disabled:opacity-50"
        >
          Change Password
        </button>
        {pwStatus && (
          <div className="mt-4">
            <StatusMessage
              type={pwStatus.type}
              message={pwStatus.msg}
              onClose={() => setPwStatus(null)}
            />
          </div>
        )}
      </form>
    </div>
  );
}

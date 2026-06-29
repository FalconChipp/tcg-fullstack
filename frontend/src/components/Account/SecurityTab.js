// src/components/Account/SecurityTab.js

"use client";

import React, { useState, useEffect, useContext, useCallback } from "react";
import StatusMessage from "@/components/UI/StatusMessage";
import { FaDiscord } from "react-icons/fa";
import { AuthContext } from "../Auth/AuthProvider";
import { getApiBase, getGraphqlUrl } from "@/utils/apiClient";
import { devError } from "@/utils/devLog";

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
  if (!/[A-Z]/.test(pw)) return "Password must have at least one uppercase letter";
  if (!/[a-z]/.test(pw)) return "Password must have at least one lowercase letter";
  if (!/[0-9]/.test(pw)) return "Password must have at least one number";
  if (!/[\W_]/.test(pw)) return "Password must have at least one special character";
  return null;
}

// --- Query param helpers ---
function getQueryParam(param) {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  return url.searchParams.get(param);
}
function removeQueryParam(param) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete(param);
  window.history.replaceState({}, document.title, url.toString());
}

/* =========================
   Helpers
========================= */

function toInputDateValue(dateLike) {
  // Converts Date/ISO/string into YYYY-MM-DD for <input type="date">
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTime(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function computeFrontendRestriction({ dob, backendLevel }) {
  // Trust backend if present (source of truth when available)
  if (backendLevel) return backendLevel;

  // No DOB => safe default
  if (!dob) return "full";

  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "full";

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;

  if (age < 13) return "child";
  if (age < 16) return "teen";
  return "none";
}

async function gqlRequest({ token, query, variables }) {
  const res = await fetch(getGraphqlUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json().catch(() => null);
  if (!json) throw new Error("Invalid server response");
  if (json.errors?.length) throw new Error(json.errors[0]?.message || "Request failed");
  return json.data;
}

export default function SecurityTab({ user: userProp, token: tokenProp }) {
  // Prefer AuthContext, fall back to props if this component is used elsewhere
  const auth = useContext(AuthContext);
  const user = auth?.user ?? userProp ?? null;
  const token = auth?.token ?? tokenProp ?? null;
  const setAuthUser = auth?.setUser;

  // =========================
  // PASSWORD (existing)
  // =========================
  const [pwFields, setPwFields] = useState({ current: "", new: "", confirm: "" });
  const [pwStatus, setPwStatus] = useState(null);
  const isOAuth = user?.oauthProvider && user.oauthProvider !== "local";
  const pwRules = getPasswordRules(pwFields.new);

  async function handlePasswordUpdate(e) {
    e.preventDefault();
    setPwStatus(null);
    if (!pwFields.current) return setPwStatus({ type: "error", msg: "Please enter your current password." });
    if (!pwFields.new || pwFields.new !== pwFields.confirm)
      return setPwStatus({ type: "error", msg: "New passwords do not match." });
    const pwError = checkPasswordStrength(pwFields.new);
    if (pwError) return setPwStatus({ type: "error", msg: pwError });

    setPwStatus({ type: "loading", msg: "Updating..." });
    try {
      const res = await fetch(getGraphqlUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : undefined },
        body: JSON.stringify({
          query: `
            mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
              changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
            }
          `,
          variables: { currentPassword: pwFields.current, newPassword: pwFields.new },
        }),
      });
      const json = await res.json();
      if (json.data?.changePassword) {
        setPwStatus({ type: "success", msg: "Password updated!" });
        setPwFields({ current: "", new: "", confirm: "" });
      } else {
        throw new Error(json.errors?.[0]?.message || "Unknown error");
      }
    } catch (err) {
      setPwStatus({ type: "error", msg: err.message });
    }
  }

  // =======================
  // EMAIL (existing)
  // =======================
  const [emailFields, setEmailFields] = useState({ email: user?.email || "", currentPassword: "" });
  const [emailStatus, setEmailStatus] = useState(null);

  async function handleEmailUpdate(e) {
    e.preventDefault();
    setEmailStatus(null);

    if (!emailFields.email) return setEmailStatus({ type: "error", msg: "Please enter your new email." });
    if (!emailFields.currentPassword) return setEmailStatus({ type: "error", msg: "Enter your current password." });
    if (emailFields.email === user?.email)
      return setEmailStatus({ type: "error", msg: "New email cannot be the same as your current email." });

    setEmailStatus({ type: "loading", msg: "Updating email..." });
    try {
      const res = await fetch(getGraphqlUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : undefined },
        body: JSON.stringify({
          query: `
            mutation ChangeEmail($newEmail: String!, $currentPassword: String!) {
              changeEmail(newEmail: $newEmail, currentPassword: $currentPassword)
            }
          `,
          variables: { newEmail: emailFields.email, currentPassword: emailFields.currentPassword },
        }),
      });
      const json = await res.json();
      if (json.data?.changeEmail) {
        setEmailStatus({
          type: "success",
          msg: "Email changed! Please verify your new email address before using it for login.",
        });
        setEmailFields((f) => ({ ...f, currentPassword: "" }));
      } else {
        throw new Error(json.errors?.[0]?.message || "Unknown error");
      }
    } catch (err) {
      setEmailStatus({ type: "error", msg: err.message });
    }
  }

  // ==============================
  // 2FA (existing)
  // ==============================
  const [twoFA, setTwoFA] = useState({
    loading: false,
    enabled: !!(user?.mfaEnabled ?? user?.twoFactorEnabled),
    showSetup: false,
    setupUrl: "",
    qrCode: "",
    verifyCode: "",
    verifyStatus: null,
    generalStatus: null,
  });

  async function handleStart2FA() {
    setTwoFA((s) => ({ ...s, loading: true, generalStatus: null }));
    try {
      const res = await fetch(getGraphqlUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : undefined },
        body: JSON.stringify({ query: "mutation { enableTwoFactor { otpauthUrl qrCodeDataURL } }" }),
      });
      const json = await res.json();
      if (json.data?.enableTwoFactor) {
        setTwoFA((s) => ({
          ...s,
          showSetup: true,
          setupUrl: json.data.enableTwoFactor.otpauthUrl,
          qrCode: json.data.enableTwoFactor.qrCodeDataURL,
          loading: false,
        }));
      } else {
        throw new Error(json.errors?.[0]?.message || "Failed to begin 2FA setup");
      }
    } catch (err) {
      setTwoFA((s) => ({ ...s, loading: false, generalStatus: { type: "error", msg: err.message } }));
    }
  }

  async function handleVerify2FA(e) {
    e.preventDefault();
    setTwoFA((s) => ({ ...s, verifyStatus: null, loading: true }));
    try {
      const res = await fetch(getGraphqlUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : undefined },
        body: JSON.stringify({
          query: "mutation VerifyTwoFactor($code: String!) { verifyTwoFactor(code: $code) }",
          variables: { code: twoFA.verifyCode },
        }),
      });
      const json = await res.json();
      if (json.data?.verifyTwoFactor) {
        setTwoFA((s) => ({
          ...s,
          loading: false,
          enabled: true,
          showSetup: false,
          verifyCode: "",
          verifyStatus: { type: "success", msg: "2FA enabled!" },
        }));
      } else {
        throw new Error(json.errors?.[0]?.message || "Invalid 2FA code");
      }
    } catch (err) {
      setTwoFA((s) => ({ ...s, loading: false, verifyStatus: { type: "error", msg: err.message } }));
    }
  }

  async function handleDisable2FA() {
    setTwoFA((s) => ({ ...s, loading: true, generalStatus: null }));
    try {
      const res = await fetch(getGraphqlUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : undefined },
        body: JSON.stringify({ query: "mutation { disableTwoFactor }" }),
      });
      const json = await res.json();
      if (json.data?.disableTwoFactor) {
        setTwoFA({
          loading: false,
          enabled: false,
          showSetup: false,
          setupUrl: "",
          qrCode: "",
          verifyCode: "",
          verifyStatus: null,
          generalStatus: { type: "success", msg: "2FA disabled." },
        });
      } else {
        throw new Error(json.errors?.[0]?.message || "Failed to disable 2FA");
      }
    } catch (err) {
      setTwoFA((s) => ({ ...s, loading: false, generalStatus: { type: "error", msg: err.message } }));
    }
  }

  // ==========================================
  // CONNECTED ACCOUNTS — Discord
  // ==========================================
  const [discordLinked, setDiscordLinked] = useState(!!user?.discordId);
  const [discordUsername, setDiscordUsername] = useState(user?.discordUsername || null);
  const [connLoading, setConnLoading] = useState(null);
  const [connStatus, setConnStatus] = useState(null);

  const capabilities = user?.capabilities || null;
  const canConnectDiscord = capabilities?.canConnectDiscord !== undefined ? !!capabilities.canConnectDiscord : true;

  useEffect(() => {
    setDiscordLinked(!!user?.discordId);
    setDiscordUsername(user?.discordUsername || null);
  }, [user?.discordId, user?.discordUsername]);

  // ==========================
  // Safety / Parent verification state (UPDATED)
  // ==========================

  const [safetyFields, setSafetyFields] = useState({
    dob: toInputDateValue(user?.dob),
    parentEmail: user?.parentEmail || "",
  });

  const [safetyStatus, setSafetyStatus] = useState(null);
  const [safetyLoading, setSafetyLoading] = useState(false);

  const DOB_LOCK_KEY = (userId) => `sbf_dob_locked:${userId}`;
  const DOB_VALUE_KEY = (userId) => `sbf_dob_value:${userId}`;

  const [dobLocked, setDobLocked] = useState(() => {
    try {
      if (typeof window === "undefined") return !!user?.dob;
      const id = user?.id;
      if (!id) return !!user?.dob;

      const locked = window.localStorage.getItem(DOB_LOCK_KEY(id)) === "1";
      return locked || !!user?.dob;
    } catch {
      return !!user?.dob;
    }
  });

  const [dobLockedValue, setDobLockedValue] = useState(() => {
    try {
      if (typeof window === "undefined") return "";
      const id = user?.id;
      if (!id) return "";
      return window.localStorage.getItem(DOB_VALUE_KEY(id)) || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (!user?.id) return;
    if (!user?.dob) return;

    const formatted = toInputDateValue(user.dob);

    setDobLocked(true);
    setDobLockedValue(formatted);

    try {
      window.localStorage.setItem(DOB_LOCK_KEY(user.id), "1");
      window.localStorage.setItem(DOB_VALUE_KEY(user.id), formatted);
    } catch {
      // ignore storage errors (private mode etc.)
    }
  }, [user?.id, user?.dob]);

  // - If locked: prefer backend dob, else use persisted value
  // - If unlocked: use live input (safetyFields.dob)
  const dobEffective = dobLocked ? (toInputDateValue(user?.dob) || dobLockedValue || "") : safetyFields.dob;
  const hasDob = !!dobEffective;

  useEffect(() => {
    setSafetyFields((prev) => ({
      dob: dobLocked ? (toInputDateValue(user?.dob) || dobLockedValue || prev.dob) : prev.dob,
      parentEmail: user?.parentEmail || "",
    }));
  }, [user?.dob, user?.parentEmail, dobLocked, dobLockedValue]);

  const restrictionLevel = computeFrontendRestriction({
    dob: dobEffective,
    backendLevel: user?.capabilities?.restrictionLevel,
  });

  const parentVerifiedAt = user?.parentVerifiedAt || null;

  const requiresParentApproval = restrictionLevel === "teen" && !parentVerifiedAt;

  const restrictionKnown = true;

  const showParentEmail = hasDob && restrictionKnown && requiresParentApproval;

  // Small helper to refetch me and optionally push it back into AuthContext
  const refetchMe = useCallback(async () => {
    if (!token) return null;

    try {
      const data = await gqlRequest({
        token,
        query: `
          query {
            me {
              id
              username
              email
              emailVerified
              discordId
              discordUsername
              twoFactorEnabled
              lastLogin
              createdAt
              updatedAt

              # Safety fields (camelCase)
              dob
              parentEmail
              parentVerifiedAt

              # Derived permissions
              capabilities {
                restrictionLevel
                isMinor
                requiresParentApproval
                canUseCollection
                canMessage
                canTrade
                canPost
                canConnectDiscord
                canShareToDiscord
              }
            }
          }
        `,
      });

      const fresh = data?.me ?? null;
      if (fresh) {
        setDiscordLinked(!!fresh.discordId);
        setDiscordUsername(fresh.discordUsername || null);

        if (fresh.id && fresh.dob) {
          const formatted = toInputDateValue(fresh.dob);
          setDobLocked(true);
          setDobLockedValue(formatted);
          try {
            window.localStorage.setItem(DOB_LOCK_KEY(fresh.id), "1");
            window.localStorage.setItem(DOB_VALUE_KEY(fresh.id), formatted);
          } catch {
            // ignore
          }
        }

        if (setAuthUser) setAuthUser(fresh);
      }
      return fresh;
    } catch {
      return null;
    }
  }, [token, setAuthUser]);

  // Why: If AuthContext user came from a query that DIDN'T include dob, user?.dob will be null even though DB has it.
  // This fetch ensures we pull dob from backend and lock the input reliably.
  useEffect(() => {
    if (!token) return;
    refetchMe();
  }, [token, refetchMe]);

  // After OAuth callback (?linked=discord), show success, clean URL, and refetch me
  useEffect(() => {
    const linked = getQueryParam("linked");
    if (linked === "discord") {
      setConnStatus({ type: "success", msg: "Discord account linked successfully." });
      removeQueryParam("linked");
      refetchMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLinkDiscord() {
    try {
      if (!canConnectDiscord) {
        setConnStatus({
          type: "error",
          msg: "Discord linking is restricted for this account. If you're under 16, you will need parent approval first.",
        });
        return;
      }

      setConnLoading("discord");
      setConnStatus({ type: "loading", msg: "Opening Discord…" });

      const returnPath = encodeURIComponent("/account?tab=security");
      const r = await fetch(`${getApiBase()}/auth/discord/start-url?return=${returnPath}`, {
        method: "GET",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (r.ok) {
        const { url } = await r.json();
        if (url) {
          window.location.href = url;
          return;
        }
      }
      window.location.href = `${getApiBase()}/auth/discord/start?return=${returnPath}`;
    } catch (e) {
      devError(e);
      setConnStatus({ type: "error", msg: "Failed to start Discord linking." });
    } finally {
      setConnLoading(null);
    }
  }

  async function handleUnlinkDiscord() {
    try {
      setConnLoading("discord");
      setConnStatus({ type: "loading", msg: "Unlinking…" });
      const r = await fetch(`${getApiBase()}/auth/discord/unlink`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const body = r.ok ? await r.json() : null;
      const ok = r.ok && body?.ok;
      if (ok) {
        setConnStatus({ type: "success", msg: "Discord unlinked." });
        await refetchMe();
      } else {
        setConnStatus({ type: "error", msg: "Unlink failed." });
      }
    } catch {
      setConnStatus({ type: "error", msg: "Unlink failed." });
    } finally {
      setConnLoading(null);
    }
  }

  async function handleSaveSafetyProfile(e) {
    e.preventDefault();
    if (!token) {
      setSafetyStatus({ type: "error", msg: "You must be logged in." });
      return;
    }

    setSafetyStatus(null);
    setSafetyLoading(true);

    try {
      const variables = {};

      // Only include DOB if not locked yet
      if (!dobLocked) {
        variables.dob = safetyFields.dob ? safetyFields.dob : null;
      }

      // Only send parentEmail if we are actually showing it (i.e. required)
      variables.parentEmail = showParentEmail && safetyFields.parentEmail ? safetyFields.parentEmail.trim() : null;

      const data = await gqlRequest({
        token,
        query: `
          mutation UpdateSafetyProfile($dob: String, $parentEmail: String) {
            updateSafetyProfile(dob: $dob, parentEmail: $parentEmail) {
              ok
              error
              user {
                id
                dob
                parentEmail
                parentVerifiedAt
                capabilities {
                  restrictionLevel
                  isMinor
                  requiresParentApproval
                  canMessage
                  canTrade
                  canPost
                  canConnectDiscord
                  canShareToDiscord
                }
              }
            }
          }
        `,
        variables,
      });

      const payload = data?.updateSafetyProfile;
      if (!payload?.ok) throw new Error(payload?.error || "Failed to save");

      if (payload?.user?.id && payload?.user?.dob) {
        const formatted = toInputDateValue(payload.user.dob);

        setDobLocked(true);
        setDobLockedValue(formatted);

        try {
          window.localStorage.setItem(DOB_LOCK_KEY(payload.user.id), "1");
          window.localStorage.setItem(DOB_VALUE_KEY(payload.user.id), formatted);
        } catch {
          // ignore
        }
      }

      if (payload?.user && setAuthUser) {
        setAuthUser({ ...(user || {}), ...payload.user });
      }

      setSafetyStatus({ type: "success", msg: "Saved." });
      await refetchMe();
    } catch (err) {
      setSafetyStatus({ type: "error", msg: err.message || "Failed to save" });
    } finally {
      setSafetyLoading(false);
    }
  }

  async function handleRequestParentVerification() {
    if (!token) {
      setSafetyStatus({ type: "error", msg: "You must be logged in." });
      return;
    }

    setSafetyStatus(null);
    setSafetyLoading(true);

    try {
      const data = await gqlRequest({
        token,
        query: `
          mutation RequestParentVerification {
            requestParentVerification {
              ok
              error
              user {
                id
                parentEmail
                parentVerifiedAt
                capabilities {
                  restrictionLevel
                  requiresParentApproval
                  canConnectDiscord
                  canMessage
                }
              }
            }
          }
        `,
      });

      const payload = data?.requestParentVerification;
      if (!payload?.ok) throw new Error(payload?.error || "Failed to send email");

      if (payload?.user && setAuthUser) setAuthUser({ ...(user || {}), ...payload.user });

      setSafetyStatus({
        type: "success",
        msg: "Verification email sent to your parent/guardian. Ask them to click the approval link.",
      });

      await refetchMe();
    } catch (err) {
      setSafetyStatus({ type: "error", msg: err.message || "Failed to send email" });
    } finally {
      setSafetyLoading(false);
    }
  }

  // =======================
  // RENDER
  // =======================
  return (
    <div className="space-y-10">
      {/* SAFETY / PARENT APPROVAL */}
      <section className="bg-vault-surface border border-vault-border rounded-[10px] px-6 py-8 ">
        <h2 className="text-xl font-bold mb-2 text-vault-accent dark:text-vault-accent">Safety & Parent Approval</h2>

        <p className="text-sm text-vault-textTertiary mb-6">
          Some community features (messaging, trading, Discord linking/sharing) will require parent/guardian approval for
          under-16 accounts.
        </p>

        <div className="mb-4 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <span className="text-vault-textTertiary">Restriction level:</span>{" "}
              <span className="font-semibold">{restrictionLevel}</span>
            </div>

            <div>
              <span className="text-vault-textTertiary">Parent verified:</span>{" "}
              <span className="font-semibold">{parentVerifiedAt ? `Yes (${formatDateTime(parentVerifiedAt)})` : "No"}</span>
            </div>

            {requiresParentApproval && !parentVerifiedAt && (
              <div className="text-amber-600 dark:text-amber-400 font-semibold">
                Parent approval required to unlock community features.
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveSafetyProfile} className="space-y-5">
          {/* DOB */}
          <div>
            <label className="block mb-1 font-semibold text-vault-text">
              Date of birth {dobLocked ? "(locked)" : "(optional)"}
            </label>

            <input
              type="date"
              value={dobLocked ? (toInputDateValue(user?.dob) || dobLockedValue || "") : safetyFields.dob}
              disabled={dobLocked}
              onChange={(e) => setSafetyFields((f) => ({ ...f, dob: e.target.value }))}
              className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text transition disabled:opacity-60"
            />

            {dobLocked ? (
              <div className="mt-1 text-xs text-vault-textTertiary">
                Your date of birth is locked once set. If this is incorrect, contact support.
              </div>
            ) : (
              <div className="mt-1 text-xs text-vault-textTertiary">
                If you leave this blank, your account will be treated as restricted by default.
              </div>
            )}
          </div>

          {/* Parent email (only show when actually required + known) */}
          {showParentEmail ? (
            <div>
              <label className="block mb-1 font-semibold text-vault-text">
                Parent/guardian email (only required if under 16)
              </label>
              <input
                type="email"
                value={safetyFields.parentEmail}
                onChange={(e) => setSafetyFields((f) => ({ ...f, parentEmail: e.target.value }))}
                placeholder="parent@example.com"
                className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text transition"
              />
            </div>
          ) : (
            <div className="text-xs text-vault-textTertiary">
              {!hasDob
                ? "Add your date of birth first to determine if parent/guardian approval is required."
                : requiresParentApproval
                ? "Parent/guardian approval is required for this account."
                : "Parent/guardian approval is not required for this account."}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={safetyLoading}
              className="bg-vault-accent text-white px-6 py-2.5 rounded-[10px] font-bold hover:bg-vault-accent dark:hover:bg-vault-accentHover transition disabled:opacity-50"
            >
              {safetyLoading ? "Saving…" : "Save"}
            </button>

            <button
              type="button"
              disabled={safetyLoading || !showParentEmail || !safetyFields.parentEmail || !!parentVerifiedAt}
              onClick={handleRequestParentVerification}
              className="px-6 py-2.5 rounded-[10px] font-bold border border-vault-border bg-vault-raised text-vault-text hover:bg-vault-surface dark:hover:bg-vault-surface transition disabled:opacity-50"
            >
              {parentVerifiedAt ? "Already verified" : safetyLoading ? "Sending…" : "Send approval email"}
            </button>
          </div>

          {safetyStatus && (
            <div className="mt-2">
              <StatusMessage type={safetyStatus.type} message={safetyStatus.msg} onClose={() => setSafetyStatus(null)} />
            </div>
          )}

          {/* Capability preview (useful during testing) */}
          {capabilities && (
            <div className="mt-4 text-xs text-vault-textTertiary">
              <div className="font-semibold mb-1">Feature access:</div>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span>Messaging: {capabilities.canMessage ? "✅" : "❌"}</span>
                <span>Trading: {capabilities.canTrade ? "✅" : "❌"}</span>
                <span>Discord linking: {capabilities.canConnectDiscord ? "✅" : "❌"}</span>
                <span>Discord sharing: {capabilities.canShareToDiscord ? "✅" : "❌"}</span>
              </div>
            </div>
          )}
        </form>
      </section>

      {/* CONNECTED ACCOUNTS */}
      <section className="bg-vault-surface border border-vault-border rounded-[10px] px-6 py-8 ">
        <h2 className="text-xl font-bold mb-6 text-vault-accent dark:text-vault-accent">Connected Accounts</h2>

        <ul className="divide-y divide-vault-border dark:divide-vault-border">
          {/* Discord row */}
          <li className="flex items-center justify-between py-5">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center justify-center w-9 h-9 rounded-[6px] border border-vault-border"
                style={{ color: "#5865F2" }}
              >
                <FaDiscord className="text-current text-lg" />
              </span>
              <div>
                <div className="font-semibold">Discord</div>

                {!canConnectDiscord && (
                  <div className="mt-0.5 text-sm text-amber-600 dark:text-amber-400 font-semibold">
                    Restricted — parent approval required
                  </div>
                )}

                {discordLinked ? (
                  <div className="mt-0.5 text-sm text-vault-textTertiary">
                    Connected as{" "}
                    <span className="font-semibold text-vault-accent dark:text-vault-accent">
                      {discordUsername || "your Discord account"}
                    </span>
                  </div>
                ) : (
                  <div className="mt-0.5 text-sm text-vault-textTertiary">Link your Discord account</div>
                )}
              </div>
            </div>

            {discordLinked ? (
              <button
                type="button"
                onClick={handleUnlinkDiscord}
                disabled={connLoading === "discord"}
                className="px-5 py-2 rounded-[6px] font-semibold border border-vault-border bg-vault-raised text-vault-text hover:bg-vault-surface dark:hover:bg-vault-surface transition disabled:opacity-50"
              >
                {connLoading === "discord" ? "Unlinking…" : "Unlink"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLinkDiscord}
                disabled={connLoading === "discord" || !canConnectDiscord}
                className="px-5 py-2 rounded-[6px] font-semibold bg-vault-accent text-white dark:text-black hover:bg-vault-accent dark:hover:bg-vault-accent transition disabled:opacity-50"
              >
                {connLoading === "discord" ? "Opening…" : "Link Discord"}
              </button>
            )}
          </li>

        </ul>

        {connStatus && (
          <div className="mt-4">
            <StatusMessage type={connStatus.type} message={connStatus.msg} onClose={() => setConnStatus(null)} />
          </div>
        )}
      </section>

      {/* PASSWORD CHANGE */}
      <form
        onSubmit={handlePasswordUpdate}
        className="bg-vault-surface border border-vault-border rounded-[10px] px-6 py-8 "
      >
        <h2 className="text-xl font-bold mb-6 text-vault-accent dark:text-vault-accent">Change Password</h2>
        <div className="mb-6">
          <label className="block mb-1 font-semibold text-vault-text">Current Password</label>
          <input
            type="password"
            value={pwFields.current}
            disabled={isOAuth}
            onChange={(e) => setPwFields((f) => ({ ...f, current: e.target.value }))}
            className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text transition"
            autoComplete="current-password"
          />
        </div>
        <div className="mb-6">
          <label className="block mb-1 font-semibold text-vault-text">New Password</label>
          <input
            type="password"
            value={pwFields.new}
            disabled={isOAuth}
            onChange={(e) => setPwFields((f) => ({ ...f, new: e.target.value }))}
            className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text transition"
            autoComplete="new-password"
          />
          <ul className="text-sm mb-2 mt-2">
            <li className={pwRules.length ? "text-green-600" : "text-vault-textTertiary"}>
              {pwRules.length ? "✅" : "❌"} At least 8 characters
            </li>
            <li className={pwRules.upper ? "text-green-600" : "text-vault-textTertiary"}>
              {pwRules.upper ? "✅" : "❌"} At least one uppercase letter
            </li>
            <li className={pwRules.lower ? "text-green-600" : "text-vault-textTertiary"}>
              {pwRules.lower ? "✅" : "❌"} At least one lowercase letter
            </li>
            <li className={pwRules.number ? "text-green-600" : "text-vault-textTertiary"}>
              {pwRules.number ? "✅" : "❌"} At least one number
            </li>
            <li className={pwRules.special ? "text-green-600" : "text-vault-textTertiary"}>
              {pwRules.special ? "✅" : "❌"} At least one special character
            </li>
          </ul>
        </div>
        <div className="mb-6">
          <label className="block mb-1 font-semibold text-vault-text">Confirm New Password</label>
          <input
            type="password"
            value={pwFields.confirm}
            disabled={isOAuth}
            onChange={(e) => setPwFields((f) => ({ ...f, confirm: e.target.value }))}
            className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text transition"
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={isOAuth}
          className="bg-vault-accent text-white px-6 py-2.5 rounded-[10px] font-bold hover:bg-vault-accent dark:hover:bg-vault-accentHover transition disabled:opacity-50"
        >
          Change Password
        </button>
        {pwStatus && (
          <div className="mt-4">
            <StatusMessage type={pwStatus.type} message={pwStatus.msg} onClose={() => setPwStatus(null)} />
          </div>
        )}
      </form>

      {/* EMAIL CHANGE */}
      <form
        onSubmit={handleEmailUpdate}
        className="bg-vault-surface border border-vault-border rounded-[10px] px-6 py-8 "
      >
        <h2 className="text-xl font-bold mb-6 text-vault-accent dark:text-vault-accent">Change Email</h2>
        <div className="mb-6">
          <label className="block mb-1 font-semibold text-vault-text">New Email</label>
          <input
            type="email"
            value={emailFields.email}
            disabled={isOAuth}
            onChange={(e) => setEmailFields((f) => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text transition"
            autoComplete="email"
          />
        </div>
        <div className="mb-6">
          <label className="block mb-1 font-semibold text-vault-text">Current Password</label>
          <input
            type="password"
            value={emailFields.currentPassword}
            disabled={isOAuth}
            onChange={(e) => setEmailFields((f) => ({ ...f, currentPassword: e.target.value }))}
            className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text transition"
            autoComplete="current-password"
          />
        </div>
        <button
          type="submit"
          disabled={isOAuth}
          className="bg-vault-accent px-6 py-2.5 rounded-[10px] font-bold hover:bg-vault-accent dark:hover:bg-vault-accentHover transition disabled:opacity-50"
        >
          Change Email
        </button>
        {emailStatus && (
          <div className="mt-4">
            <StatusMessage type={emailStatus.type} message={emailStatus.msg} onClose={() => setEmailStatus(null)} />
          </div>
        )}
      </form>

      {/* TWO-FACTOR AUTH */}
      <div className="bg-vault-surface border border-vault-border rounded-[10px] px-6 py-8 ">
        <h2 className="text-xl font-bold mb-6 text-vault-accent dark:text-vault-accent">Two-Factor Authentication</h2>
        {twoFA.enabled ? (
          <div>
            <p className="mb-2 text-green-600">
              2FA is currently <strong>ENABLED</strong> on your account.
            </p>
            <button
              type="button"
              disabled={twoFA.loading}
              onClick={handleDisable2FA}
              className="bg-vault-warning dark:bg-vault-warning text-vault-text px-6 py-2.5 rounded-[10px] font-bold hover:bg-vault-accent dark:hover:bg-vault-accentHover transition"
            >
              Disable 2FA
            </button>
          </div>
        ) : twoFA.showSetup ? (
          <form onSubmit={handleVerify2FA}>
            <p className="mb-2">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc), or enter this code
              manually:
              <br />
              <span className="break-all text-sm font-mono">{twoFA.setupUrl}</span>
            </p>
            <img src={twoFA.qrCode} alt="2FA QR Code" className="mb-4 w-40 h-40" />
            <div className="mb-3">
              <label className="block mb-1 font-semibold text-vault-text">
                Enter the 6-digit code from your authenticator app:
              </label>
              <input
                type="text"
                value={twoFA.verifyCode}
                onChange={(e) => setTwoFA((s) => ({ ...s, verifyCode: e.target.value }))}
                className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text transition"
                maxLength={6}
                inputMode="numeric"
                pattern="\\d*"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={twoFA.loading || !twoFA.verifyCode}
              className="bg-vault-accent text-white dark:text-black px-6 py-2.5 rounded-[10px] font-bold hover:bg-vault-accent dark:hover:bg-vault-accent transition"
            >
              Verify & Enable 2FA
            </button>
            {twoFA.verifyStatus && (
              <div className="mt-4">
                <StatusMessage
                  type={twoFA.verifyStatus.type}
                  message={twoFA.verifyStatus.msg}
                  onClose={() => setTwoFA((s) => ({ ...s, verifyStatus: null }))}
                />
              </div>
            )}
          </form>
        ) : (
          <div>
            <p className="mb-2 text-red-600">
              2FA is currently <strong>DISABLED</strong> on your account.
            </p>
            <button
              type="button"
              disabled={twoFA.loading}
              onClick={handleStart2FA}
              className="bg-vault-accent px-6 py-2.5 rounded-[10px] font-bold hover:bg-vault-accent dark:hover:bg-vault-accentHover transition"
            >
              Enable 2FA
            </button>
          </div>
        )}
        {twoFA.generalStatus && (
          <div className="mt-4">
            <StatusMessage
              type={twoFA.generalStatus.type}
              message={twoFA.generalStatus.msg}
              onClose={() => setTwoFA((s) => ({ ...s, generalStatus: null }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

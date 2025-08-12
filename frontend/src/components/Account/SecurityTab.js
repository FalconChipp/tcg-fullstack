import React, { useState } from "react";
import StatusMessage from "@/components/UI/StatusMessage";

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
  if (!/[A-Z]/.test(pw)) return "Password must have at least one uppercase letter";
  if (!/[a-z]/.test(pw)) return "Password must have at least one lowercase letter";
  if (!/[0-9]/.test(pw)) return "Password must have at least one number";
  if (!/[\W_]/.test(pw)) return "Password must have at least one special character";
  return null;
}

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";

export default function SecurityTab({ user, token }) {
  // --- State for each section ---
  const [pwFields, setPwFields] = useState({ current: "", new: "", confirm: "" });
  const [pwStatus, setPwStatus] = useState(null);

  const [emailFields, setEmailFields] = useState({ email: user?.email || "", currentPassword: "" });
  const [emailStatus, setEmailStatus] = useState(null);

  const [twoFA, setTwoFA] = useState({
    loading: false,
    enabled: !!user.twoFactorEnabled,
    showSetup: false,
    setupUrl: "",
    qrCode: "",
    verifyCode: "",
    verifyStatus: null,
    generalStatus: null,
  });

  const isOAuth = user?.authProvider && user.authProvider !== "local";
  const pwRules = getPasswordRules(pwFields.new);

  // ---- PASSWORD CHANGE HANDLER ----
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
      const res = await fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : undefined },
        body: JSON.stringify({
          query: `
            mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
              changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
            }
          `,
          variables: {
            currentPassword: pwFields.current,
            newPassword: pwFields.new,
          },
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

  // ---- EMAIL CHANGE HANDLER ----
  async function handleEmailUpdate(e) {
    e.preventDefault();
    setEmailStatus(null);

    if (!emailFields.email) return setEmailStatus({ type: "error", msg: "Please enter your new email." });
    if (!emailFields.currentPassword) return setEmailStatus({ type: "error", msg: "Enter your current password." });
    if (emailFields.email === user.email)
      return setEmailStatus({ type: "error", msg: "New email cannot be the same as your current email." });

    setEmailStatus({ type: "loading", msg: "Updating email..." });
    try {
      const res = await fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : undefined },
        body: JSON.stringify({
          query: `
            mutation ChangeEmail($newEmail: String!, $currentPassword: String!) {
              changeEmail(newEmail: $newEmail, currentPassword: $currentPassword)
            }
          `,
          variables: {
            newEmail: emailFields.email,
            currentPassword: emailFields.currentPassword,
          },
        }),
      });
      const json = await res.json();
      if (json.data?.changeEmail) {
        setEmailStatus({
          type: "success",
          msg: "Email changed! Please verify your new email address before using it for login.",
        });
        setEmailFields({ ...emailFields, currentPassword: "" });
      } else {
        throw new Error(json.errors?.[0]?.message || "Unknown error");
      }
    } catch (err) {
      setEmailStatus({ type: "error", msg: err.message });
    }
  }

  // ---- 2FA HANDLERS ----

  // Begin 2FA setup (get QR)
  async function handleStart2FA() {
    setTwoFA((s) => ({ ...s, loading: true, generalStatus: null }));
    try {
      const res = await fetch(GRAPHQL_ENDPOINT, {
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

  // Verify entered 2FA code (complete setup)
  async function handleVerify2FA(e) {
    e.preventDefault();
    setTwoFA((s) => ({ ...s, verifyStatus: null, loading: true }));
    try {
      const res = await fetch(GRAPHQL_ENDPOINT, {
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

  // Disable 2FA
  async function handleDisable2FA() {
    setTwoFA((s) => ({ ...s, loading: true, generalStatus: null }));
    try {
      const res = await fetch(GRAPHQL_ENDPOINT, {
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
      setTwoFA((s) => ({
        ...s,
        loading: false,
        generalStatus: { type: "error", msg: err.message },
      }));
    }
  }

  // ---- RENDER ----
  return (
    <div className="space-y-10">
      {/* PASSWORD CHANGE */}
      <form
        onSubmit={handlePasswordUpdate}
        className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl px-6 py-8 shadow"
      >
        <h2 className="text-xl font-bold mb-6 text-light-primary dark:text-dark-primary">Change Password</h2>
        {/* Fields as before */}
        <div className="mb-6">
          <label className="block mb-1 font-semibold text-light-text dark:text-dark-text">Current Password</label>
          <input
            type="password"
            value={pwFields.current}
            disabled={isOAuth}
            onChange={(e) => setPwFields((f) => ({ ...f, current: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text transition"
            autoComplete="current-password"
          />
        </div>
        <div className="mb-6">
          <label className="block mb-1 font-semibold text-light-text dark:text-dark-text">New Password</label>
          <input
            type="password"
            value={pwFields.new}
            disabled={isOAuth}
            onChange={(e) => setPwFields((f) => ({ ...f, new: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text transition"
            autoComplete="new-password"
          />
          <ul className="text-sm mb-2 mt-2">
            <li className={pwRules.length ? "text-green-600" : "text-light-textMuted dark:text-dark-textMuted"}>
              {pwRules.length ? "✅" : "❌"} At least 8 characters
            </li>
            <li className={pwRules.upper ? "text-green-600" : "text-light-textMuted dark:text-dark-textMuted"}>
              {pwRules.upper ? "✅" : "❌"} At least one uppercase letter
            </li>
            <li className={pwRules.lower ? "text-green-600" : "text-light-textMuted dark:text-dark-textMuted"}>
              {pwRules.lower ? "✅" : "❌"} At least one lowercase letter
            </li>
            <li className={pwRules.number ? "text-green-600" : "text-light-textMuted dark:text-dark-textMuted"}>
              {pwRules.number ? "✅" : "❌"} At least one number
            </li>
            <li className={pwRules.special ? "text-green-600" : "text-light-textMuted dark:text-dark-textMuted"}>
              {pwRules.special ? "✅" : "❌"} At least one special character
            </li>
          </ul>
        </div>
        <div className="mb-6">
          <label className="block mb-1 font-semibold text-light-text dark:text-dark-text">Confirm New Password</label>
          <input
            type="password"
            value={pwFields.confirm}
            disabled={isOAuth}
            onChange={(e) => setPwFields((f) => ({ ...f, confirm: e.target.value }))}
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
            <StatusMessage type={pwStatus.type} message={pwStatus.msg} onClose={() => setPwStatus(null)} />
          </div>
        )}
      </form>

      {/* EMAIL CHANGE */}
      <form
        onSubmit={handleEmailUpdate}
        className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl px-6 py-8 shadow"
      >
        <h2 className="text-xl font-bold mb-6 text-light-primary dark:text-dark-primary">Change Email</h2>
        <div className="mb-6">
          <label className="block mb-1 font-semibold text-light-text dark:text-dark-text">New Email</label>
          <input
            type="email"
            value={emailFields.email}
            disabled={isOAuth}
            onChange={(e) => setEmailFields((f) => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text transition"
            autoComplete="email"
          />
        </div>
        <div className="mb-6">
          <label className="block mb-1 font-semibold text-light-text dark:text-dark-text">Current Password</label>
          <input
            type="password"
            value={emailFields.currentPassword}
            disabled={isOAuth}
            onChange={(e) => setEmailFields((f) => ({ ...f, currentPassword: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text transition"
            autoComplete="current-password"
          />
        </div>
        <button
          type="submit"
          disabled={isOAuth}
          className="bg-light-accent dark:bg-dark-accent text-white dark:text-black px-6 py-2.5 rounded-xl font-bold hover:bg-light-primary dark:hover:bg-dark-primary transition disabled:opacity-50"
        >
          Change Email
        </button>
        {emailStatus && (
          <div className="mt-4">
            <StatusMessage type={emailStatus.type} message={emailStatus.msg} onClose={() => setEmailStatus(null)} />
          </div>
        )}
      </form>

      {/* 2FA ENABLE/DISABLE */}
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl px-6 py-8 shadow">
        <h2 className="text-xl font-bold mb-6 text-light-primary dark:text-dark-primary">Two-Factor Authentication</h2>
        {twoFA.enabled ? (
          <div>
            <p className="mb-2 text-green-600">2FA is currently <strong>ENABLED</strong> on your account.</p>
            <button
              type="button"
              disabled={twoFA.loading}
              onClick={handleDisable2FA}
              className="bg-light-warning dark:bg-dark-warning text-light-text dark:text-dark-text px-6 py-2.5 rounded-xl font-bold hover:bg-light-accent dark:hover:bg-dark-accent transition"
            >
              Disable 2FA
            </button>
          </div>
        ) : twoFA.showSetup ? (
          <form onSubmit={handleVerify2FA}>
            <p className="mb-2">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc), or enter this code manually:<br />
              <span className="break-all text-sm font-mono">{twoFA.setupUrl}</span>
            </p>
            <img src={twoFA.qrCode} alt="2FA QR Code" className="mb-4 w-40 h-40" />
            <div className="mb-3">
              <label className="block mb-1 font-semibold text-light-text dark:text-dark-text">
                Enter the 6-digit code from your authenticator app:
              </label>
              <input
                type="text"
                value={twoFA.verifyCode}
                onChange={e => setTwoFA(s => ({ ...s, verifyCode: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text transition"
                maxLength={6}
                inputMode="numeric"
                pattern="\d*"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={twoFA.loading || !twoFA.verifyCode}
              className="bg-light-accent dark:bg-dark-accent text-white dark:text-black px-6 py-2.5 rounded-xl font-bold hover:bg-light-primary dark:hover:bg-dark-primary transition"
            >
              Verify & Enable 2FA
            </button>
            {twoFA.verifyStatus && (
              <div className="mt-4">
                <StatusMessage
                  type={twoFA.verifyStatus.type}
                  message={twoFA.verifyStatus.msg}
                  onClose={() => setTwoFA(s => ({ ...s, verifyStatus: null }))}
                />
              </div>
            )}
          </form>
        ) : (
          <div>
            <p className="mb-2 text-red-600">2FA is currently <strong>DISABLED</strong> on your account.</p>
            <button
              type="button"
              disabled={twoFA.loading}
              onClick={handleStart2FA}
              className="bg-light-accent dark:bg-dark-accent text-white dark:text-black px-6 py-2.5 rounded-xl font-bold hover:bg-light-primary dark:hover:bg-dark-primary transition"
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
              onClose={() => setTwoFA(s => ({ ...s, generalStatus: null }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

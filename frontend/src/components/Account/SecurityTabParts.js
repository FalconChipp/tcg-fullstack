import React from "react";
import StatusMessage from "@/components/UI/StatusMessage";

/* ─── Password section ───────────────────────────────────────────────────── */

export function PasswordSection({ pwFields, setPwFields, pwStatus, setPwStatus, isOAuth, pwRules, handlePasswordUpdate }) {
  const inputCls = "w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text transition";
  return (
    <form onSubmit={handlePasswordUpdate} className="bg-vault-surface border border-vault-border rounded-[10px] px-6 py-8">
      <h2 className="text-xl font-bold mb-6 text-vault-accent dark:text-vault-accent">Change Password</h2>
      <div className="mb-6">
        <label className="block mb-1 font-semibold text-vault-text">Current Password</label>
        <input type="password" value={pwFields.current} disabled={isOAuth} autoComplete="current-password"
          onChange={(e) => setPwFields((f) => ({ ...f, current: e.target.value }))}
          className={inputCls} />
      </div>
      <div className="mb-6">
        <label className="block mb-1 font-semibold text-vault-text">New Password</label>
        <input type="password" value={pwFields.new} disabled={isOAuth} autoComplete="new-password"
          onChange={(e) => setPwFields((f) => ({ ...f, new: e.target.value }))}
          className={inputCls} />
        <ul className="text-sm mb-2 mt-2">
          {[
            [pwRules.length,   "At least 8 characters"],
            [pwRules.upper,    "At least one uppercase letter"],
            [pwRules.lower,    "At least one lowercase letter"],
            [pwRules.number,   "At least one number"],
            [pwRules.special,  "At least one special character"],
          ].map(([ok, label]) => (
            <li key={label} className={ok ? "text-green-600" : "text-vault-textTertiary"}>
              {ok ? "✅" : "❌"} {label}
            </li>
          ))}
        </ul>
      </div>
      <div className="mb-6">
        <label className="block mb-1 font-semibold text-vault-text">Confirm New Password</label>
        <input type="password" value={pwFields.confirm} disabled={isOAuth} autoComplete="new-password"
          onChange={(e) => setPwFields((f) => ({ ...f, confirm: e.target.value }))}
          className={inputCls} />
      </div>
      <button type="submit" disabled={isOAuth}
        className="bg-vault-accent text-white px-6 py-2.5 rounded-[10px] font-bold hover:bg-vault-accent dark:hover:bg-vault-accentHover transition disabled:opacity-50">
        Change Password
      </button>
      {pwStatus && (
        <div className="mt-4">
          <StatusMessage type={pwStatus.type} message={pwStatus.msg} onClose={() => setPwStatus(null)} />
        </div>
      )}
    </form>
  );
}

/* ─── Email section ──────────────────────────────────────────────────────── */

export function EmailSection({ emailFields, setEmailFields, emailStatus, setEmailStatus, isOAuth, handleEmailUpdate }) {
  const inputCls = "w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text transition";
  return (
    <form onSubmit={handleEmailUpdate} className="bg-vault-surface border border-vault-border rounded-[10px] px-6 py-8">
      <h2 className="text-xl font-bold mb-6 text-vault-accent dark:text-vault-accent">Change Email</h2>
      <div className="mb-6">
        <label className="block mb-1 font-semibold text-vault-text">New Email</label>
        <input type="email" value={emailFields.email} disabled={isOAuth} autoComplete="email"
          onChange={(e) => setEmailFields((f) => ({ ...f, email: e.target.value }))}
          className={inputCls} />
      </div>
      <div className="mb-6">
        <label className="block mb-1 font-semibold text-vault-text">Current Password</label>
        <input type="password" value={emailFields.currentPassword} disabled={isOAuth} autoComplete="current-password"
          onChange={(e) => setEmailFields((f) => ({ ...f, currentPassword: e.target.value }))}
          className={inputCls} />
      </div>
      <button type="submit" disabled={isOAuth}
        className="bg-vault-accent px-6 py-2.5 rounded-[10px] font-bold hover:bg-vault-accent dark:hover:bg-vault-accentHover transition disabled:opacity-50">
        Change Email
      </button>
      {emailStatus && (
        <div className="mt-4">
          <StatusMessage type={emailStatus.type} message={emailStatus.msg} onClose={() => setEmailStatus(null)} />
        </div>
      )}
    </form>
  );
}

/* ─── 2FA section ────────────────────────────────────────────────────────── */

export function TwoFASection({ twoFA, setTwoFA, handleStart2FA, handleVerify2FA, handleDisable2FA }) {
  return (
    <div className="bg-vault-surface border border-vault-border rounded-[10px] px-6 py-8">
      <h2 className="text-xl font-bold mb-6 text-vault-accent dark:text-vault-accent">Two-Factor Authentication</h2>

      {twoFA.enabled ? (
        <div>
          <p className="mb-2 text-green-600">2FA is currently <strong>ENABLED</strong> on your account.</p>
          <button type="button" disabled={twoFA.loading} onClick={handleDisable2FA}
            className="bg-vault-warning dark:bg-vault-warning text-vault-text px-6 py-2.5 rounded-[10px] font-bold hover:bg-vault-accent dark:hover:bg-vault-accentHover transition">
            Disable 2FA
          </button>
        </div>
      ) : twoFA.showSetup ? (
        <form onSubmit={handleVerify2FA}>
          <p className="mb-2">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc), or enter this code manually:
            <br />
            <span className="break-all text-sm font-mono">{twoFA.setupUrl}</span>
          </p>
          <img src={twoFA.qrCode} alt="2FA QR Code" className="mb-4 w-40 h-40" />
          <div className="mb-3">
            <label className="block mb-1 font-semibold text-vault-text">
              Enter the 6-digit code from your authenticator app:
            </label>
            <input type="text" value={twoFA.verifyCode} maxLength={6} inputMode="numeric" pattern="\d*" autoComplete="off"
              onChange={(e) => setTwoFA((s) => ({ ...s, verifyCode: e.target.value }))}
              className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text transition" />
          </div>
          <button type="submit" disabled={twoFA.loading || !twoFA.verifyCode}
            className="bg-vault-accent text-white dark:text-black px-6 py-2.5 rounded-[10px] font-bold hover:bg-vault-accent dark:hover:bg-vault-accent transition">
            Verify & Enable 2FA
          </button>
          {twoFA.verifyStatus && (
            <div className="mt-4">
              <StatusMessage type={twoFA.verifyStatus.type} message={twoFA.verifyStatus.msg}
                onClose={() => setTwoFA((s) => ({ ...s, verifyStatus: null }))} />
            </div>
          )}
        </form>
      ) : (
        <div>
          <p className="mb-2 text-red-600">2FA is currently <strong>DISABLED</strong> on your account.</p>
          <button type="button" disabled={twoFA.loading} onClick={handleStart2FA}
            className="bg-vault-accent px-6 py-2.5 rounded-[10px] font-bold hover:bg-vault-accent dark:hover:bg-vault-accentHover transition">
            Enable 2FA
          </button>
        </div>
      )}

      {twoFA.generalStatus && (
        <div className="mt-4">
          <StatusMessage type={twoFA.generalStatus.type} message={twoFA.generalStatus.msg}
            onClose={() => setTwoFA((s) => ({ ...s, generalStatus: null }))} />
        </div>
      )}
    </div>
  );
}

// src/components/Account/PrivacyTab.js
"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import StatusMessage from "@/components/UI/StatusMessage";
import { getGraphqlUrl } from "@/utils/apiClient";

/* Small UI primitives */
function Card({ title, children, className = "" }) {
  return (
    <section
      className={`rounded-[10px] border border-vault-border bg-vault-surface p-6 md:p-7  ${className}`}
    >
      {title && (
        <h2 className="text-xl font-bold mb-5 text-vault-accent dark:text-vault-accent">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent transition ${props.className || ""}`}
    />
  );
}
function PasswordField({ id, value, onChange, placeholder, disabled, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextInput
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-2 my-auto h-8 px-2 rounded-[6px] text-xs text-vault-textTertiary hover:bg-vault-raised dark:hover:bg-vault-raised"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export default function PrivacyTab({ user, token }) {
  const router = useRouter();

  // local state (separate fields so forms don't share input)
  const [exportPwd, setExportPwd] = useState("");
  const [deletePwd, setDeletePwd] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [exportStatus, setExportStatus] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function callGraphQL(query, variables) {
    const res = await fetch(getGraphqlUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors?.length) {
      throw new Error(json.errors[0].message || "Request failed");
    }
    return json.data;
  }

  // EXPORT
  const handleExport = async (e) => {
    e.preventDefault();
    setExportStatus(null);
    if (!exportPwd) return setExportStatus({ type: "error", msg: "Enter your password to export your data." });

    setExporting(true);
    try {
      const data = await callGraphQL(
        `mutation ExportUserData($password: String!) { exportUserData(password: $password) }`,
        { password: exportPwd }
      );

      const result = data?.exportUserData;

      if (typeof result === "string") {
        if (/^https?:\/\//i.test(result)) {
          window.open(result, "_blank");
        } else {
          // Backend returns the export as a JSON string — trigger browser download
          const blob = new Blob([result], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "my-data-export.json";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }

      setExportStatus({ type: "success", msg: "Your data export has been downloaded." });
      setExportPwd("");
    } catch (err) {
      setExportStatus({ type: "error", msg: err.message });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    setDeleteStatus(null);
    if (confirmText !== "DELETE")
      return setDeleteStatus({ type: "error", msg: 'Type DELETE in the confirmation box above to continue.' });
    if (!deletePwd) return setDeleteStatus({ type: "error", msg: "Enter your password to delete your account." });

    setDeleting(true);
    try {
      await callGraphQL(
        `mutation DeleteAccount($password: String!, $confirm: String!) {
           deleteAccount(password: $password, confirm: $confirm)
         }`,
        { password: deletePwd, confirm: "DELETE" }
      );

      setDeleteStatus({ type: "success", msg: "Account deleted. Redirecting…" });
      setTimeout(() => {
        if (typeof window !== "undefined") localStorage.clear();
        router.push("/");
        window.location.reload();
      }, 1200);
    } catch (err) {
      setDeleteStatus({ type: "error", msg: err.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro */}
      <Card title="Privacy & Data">
        <p className="text-sm text-vault-textSecondary">
          Download a copy of your data or permanently delete your account.
        </p>
      </Card>

      {/* Two-up */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export data */}
        <Card title="Request My Data (GDPR)">
          <p className="text-sm text-vault-textSecondary mb-4">
            We’ll generate a downloadable archive (JSON/CSV where applicable) of your profile, collection, and settings.
          </p>
          <form onSubmit={handleExport} className="space-y-3" aria-live="polite">
            <label className="block text-sm font-semibold">Confirm with password</label>
            <PasswordField
              id="export-password"
              value={exportPwd}
              onChange={(e) => setExportPwd(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={exporting}
              className="mt-1 bg-vault-accent text-white px-5 py-2.5 rounded-[10px] font-semibold hover:bg-vault-accentHover transition disabled:opacity-50"
            >
              {exporting ? "Preparing export…" : "Generate export"}
            </button>
            {exportStatus && (
              <StatusMessage
                type={exportStatus.type}
                message={exportStatus.msg}
                onClose={() => setExportStatus(null)}
              />
            )}
          </form>
        </Card>

        {/* Delete account */}
        <Card title="Delete Account" className="border-red-500/40 dark:border-red-500/40">
          <div className="rounded-[6px] border border-red-500/30 bg-red-500/10 text-red-500 text-sm px-4 py-3 mb-4">
            This action is permanent and cannot be undone. All personal data, collections, binders and preferences will be deleted.
          </div>

          <form onSubmit={handleDelete} className="space-y-3" aria-live="polite">
            <label className="block text-sm font-semibold">
              Type <span className="font-mono">DELETE</span> to confirm
            </label>
            <TextInput
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />

            <label className="block text-sm font-semibold mt-2">Confirm with password</label>
            <PasswordField
              id="delete-password"
              value={deletePwd}
              onChange={(e) => setDeletePwd(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />

            <div className="pt-1">
              <button
                type="submit"
                disabled={deleting}
                className="bg-vault-danger text-white px-5 py-2.5 rounded-[10px] font-semibold hover:bg-red-600 transition disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete my account"}
              </button>
            </div>
            {deleteStatus && (
              <StatusMessage
                type={deleteStatus.type}
                message={deleteStatus.msg}
                onClose={() => setDeleteStatus(null)}
              />
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}

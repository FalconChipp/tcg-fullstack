import React, { useState } from "react";
import { gql, useMutation } from "@apollo/client";
import StatusMessage from "@/components/UI/StatusMessage";
import { useRouter } from "next/router";

// --- GQL MUTATIONS (match backend) ---
const EXPORT_USER_DATA = gql`
  mutation ExportUserData($password: String!) {
    exportUserData(password: $password)
  }
`;

const DELETE_ACCOUNT = gql`
  mutation DeleteAccount($password: String!, $confirm: String!) {
    deleteAccount(password: $password, confirm: $confirm)
  }
`;

export default function PrivacyTab({ user }) {
  const [showExport, setShowExport] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(null);
  const router = useRouter();

  // --- EXPORT USER DATA ---
  const [exportUserData, { loading: exporting }] = useMutation(EXPORT_USER_DATA, {
    onCompleted: (data) => {
      setStatus({ type: "success", msg: "Your data export is ready!" });
      // Open the exported file in a new tab if a URL is returned
      if (data.exportUserData) {
        window.open(data.exportUserData, "_blank");
      }
      setShowExport(false);
      setPassword("");
    },
    onError: (err) => {
      setStatus({ type: "error", msg: err.message });
    },
  });

  // --- DELETE ACCOUNT ---
  const [deleteAccount, { loading: deleting }] = useMutation(DELETE_ACCOUNT, {
    onCompleted: () => {
      setStatus({ type: "success", msg: "Account deleted. Redirecting…" });
      setTimeout(() => {
        // Clear all local storage/session data and redirect
        if (typeof window !== "undefined") {
          localStorage.clear();
        }
        router.push("/");
        window.location.reload();
      }, 1500);
    },
    onError: (err) => {
      setStatus({ type: "error", msg: err.message });
    },
  });

  // --- EXPORT HANDLER ---
  const handleExport = (e) => {
    e.preventDefault();
    setStatus(null);
    if (!password) {
      setStatus({ type: "error", msg: "Enter your password to export your data." });
      return;
    }
    exportUserData({ variables: { password } });
  };

  // --- DELETE HANDLER ---
  const handleDelete = (e) => {
    e.preventDefault();
    setStatus(null);
    // Confirm user really wants to delete account
    const confirmText = window.prompt('Type DELETE to confirm account deletion.');
    if (confirmText !== "DELETE") {
      setStatus({ type: "error", msg: "Confirmation text incorrect." });
      return;
    }
    if (!password) {
      setStatus({ type: "error", msg: "Enter your password to delete your account." });
      return;
    }
    deleteAccount({ variables: { password, confirm: "DELETE" } });
  };

  // --- UI ---
  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl px-6 py-8 shadow">
      <h2 className="text-xl font-bold mb-6 text-light-primary dark:text-dark-primary">
        Privacy & Data
      </h2>
      <ul className="mb-4 space-y-2 text-light-text dark:text-dark-text">
        <li>• Request/download your data (GDPR)</li>
        <li>• Delete/close account</li>
      </ul>

      {/* --- EXPORT USER DATA FORM --- */}
      {showExport && (
        <form onSubmit={handleExport} className="space-y-4 max-w-md mb-8">
          <label className="block mb-1 font-semibold">
            Enter password to export your data:
          </label>
          <input
            type="password"
            className="w-full px-3 py-2 rounded-lg border"
            value={password}
            autoFocus
            onChange={e => setPassword(e.target.value)}
            required
            disabled={exporting}
          />
          <div className="flex gap-4">
            <button
              type="submit"
              className="bg-light-accent dark:bg-dark-accent text-white dark:text-black px-6 py-2.5 rounded-xl font-bold"
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export My Data"}
            </button>
            <button
              type="button"
              className="bg-light-alt dark:bg-dark-alt px-6 py-2.5 rounded-xl font-bold border"
              onClick={() => { setShowExport(false); setPassword(""); }}
              disabled={exporting}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* --- DELETE ACCOUNT FORM --- */}
      {showDelete && (
        <form onSubmit={handleDelete} className="space-y-4 max-w-md mb-8">
          <label className="block mb-1 font-semibold">
            Enter password to delete your account:
          </label>
          <input
            type="password"
            className="w-full px-3 py-2 rounded-lg border"
            value={password}
            autoFocus
            onChange={e => setPassword(e.target.value)}
            required
            disabled={deleting}
          />
          <div className="flex gap-4">
            <button
              type="submit"
              className="bg-light-error dark:bg-red-700 text-white px-6 py-2.5 rounded-xl font-bold"
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete My Account"}
            </button>
            <button
              type="button"
              className="bg-light-alt dark:bg-dark-alt px-6 py-2.5 rounded-xl font-bold border"
              onClick={() => { setShowDelete(false); setPassword(""); }}
              disabled={deleting}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* --- ACTION BUTTONS --- */}
      {!showExport && !showDelete && (
        <form className="mt-6 space-y-4 max-w-md">
          <button
            type="button"
            className="bg-light-accent dark:bg-dark-accent text-white dark:text-black px-6 py-2.5 rounded-xl font-bold hover:bg-light-primary dark:hover:bg-dark-primary transition"
            onClick={() => { setShowExport(true); setStatus(null); setPassword(""); }}
          >
            Request My Data
          </button>
          <button
            type="button"
            className="bg-light-error dark:bg-red-700 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-600 transition"
            onClick={() => { setShowDelete(true); setStatus(null); setPassword(""); }}
          >
            Delete My Account
          </button>
        </form>
      )}

      {/* --- STATUS MESSAGE --- */}
      {status && (
        <div className="mt-4">
          <StatusMessage
            type={status.type}
            message={status.msg}
            onClose={() => setStatus(null)}
          />
        </div>
      )}

      {/* --- WARNING --- */}
      <div className="mt-6 text-light-textMuted dark:text-dark-textMuted">
        Deleting your account is permanent and cannot be undone.
      </div>
    </div>
  );
}

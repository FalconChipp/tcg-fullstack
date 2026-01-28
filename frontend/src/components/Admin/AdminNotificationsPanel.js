// frontend/src/components/Admin/AdminNotificationsPanel.js
// -----------------------------------------------------------------------------
// Admin panel: send broadcast notifications to all users.
// Uses adminSendBroadcastNotification mutation.
// -----------------------------------------------------------------------------

"use client";

import React, { useMemo, useState } from "react";
import { gql, useMutation } from "@apollo/client";

const SEND_BROADCAST = gql`
  mutation AdminSendBroadcastNotification($input: NotificationInput!) {
    adminSendBroadcastNotification(input: $input)
  }
`;

const TYPE_OPTIONS = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "message", label: "Message" },
];

const DEFAULT_FORM = {
  title: "",
  body: "",
  type: "info",
  linkUrl: "",
  iconUrl: "",
  isSilent: false,
};

export default function AdminNotificationsPanel() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [status, setStatus] = useState(null);
  const [sendBroadcast, { loading }] = useMutation(SEND_BROADCAST, {
    onCompleted: () => {
      setStatus({ type: "success", message: "Broadcast notification sent." });
      setForm((prev) => ({
        ...DEFAULT_FORM,
        type: prev.type,
        isSilent: prev.isSilent,
      }));
    },
    onError: (error) => {
      setStatus({
        type: "error",
        message: error?.message || "Failed to send notification.",
      });
    },
  });

  const canSend = useMemo(() => {
    return form.title.trim().length > 0 && form.body.trim().length > 0;
  }, [form.title, form.body]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    if (!canSend) {
      setStatus({
        type: "error",
        message: "Add both a title and message before sending.",
      });
      return;
    }

    await sendBroadcast({
      variables: {
        input: {
          title: form.title.trim(),
          body: form.body.trim(),
          type: form.type,
          linkUrl: form.linkUrl.trim() || null,
          iconUrl: form.iconUrl.trim() || null,
          isSilent: form.isSilent,
          isBroadcast: true,
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-50">
            Admin notifications
          </h2>
          <p className="text-xs text-neutral-500">
            Broadcast a message to all users via the in-app notification system.
          </p>
        </div>
      </div>

      <div className="border border-white/5 rounded-xl p-4 md:p-6 bg-black/40">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-neutral-400">
              Type
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full rounded-md bg-black/60 border border-white/10 px-3 py-2 text-sm text-neutral-100"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs text-neutral-400">
              Title
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Short headline"
                className="w-full rounded-md bg-black/60 border border-white/10 px-3 py-2 text-sm text-neutral-100"
              />
            </label>
          </div>

          <label className="space-y-1 text-xs text-neutral-400">
            Message
            <textarea
              name="body"
              value={form.body}
              onChange={handleChange}
              placeholder="Tell users what's happening…"
              rows={4}
              className="w-full rounded-md bg-black/60 border border-white/10 px-3 py-2 text-sm text-neutral-100"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-neutral-400">
              Link URL (optional)
              <input
                name="linkUrl"
                value={form.linkUrl}
                onChange={handleChange}
                placeholder="https://tcg.sixbyfive.com/..."
                className="w-full rounded-md bg-black/60 border border-white/10 px-3 py-2 text-sm text-neutral-100"
              />
            </label>

            <label className="space-y-1 text-xs text-neutral-400">
              Icon URL (optional)
              <input
                name="iconUrl"
                value={form.iconUrl}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full rounded-md bg-black/60 border border-white/10 px-3 py-2 text-sm text-neutral-100"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <input
                type="checkbox"
                name="isSilent"
                checked={form.isSilent}
                onChange={handleChange}
                className="h-4 w-4 rounded border border-white/20 bg-black/60"
              />
              Silent (no popover, still stored)
            </label>
            <span className="text-[11px] text-neutral-500">
              Sends as a broadcast notification to every user.
            </span>
          </div>

          {status && (
            <div
              className={[
                "rounded-md border px-3 py-2 text-xs",
                status.type === "error"
                  ? "border-red-500/40 bg-red-950/40 text-red-200"
                  : "border-emerald-500/40 bg-emerald-950/40 text-emerald-200",
              ].join(" ")}
            >
              {status.message}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-neutral-500">
              Required: title + message. Optional: link or icon URL.
            </p>
            <button
              type="submit"
              disabled={!canSend || loading}
              className="inline-flex items-center rounded-md px-4 py-2 text-xs font-semibold border border-white/20 text-neutral-50 hover:bg-white/10 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send broadcast"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

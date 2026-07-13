"use client";

import React, { useMemo, useState } from "react";
import { useMutation } from "@apollo/client";
import { ADMIN_SEND_BROADCAST as SEND_BROADCAST } from '@/graphql/admin';

const TYPE_OPTS = [
  { value: "info",    label: "Info",    cls: "text-sky-300" },
  { value: "warning", label: "Warning", cls: "text-amber-300" },
  { value: "error",   label: "Error",   cls: "text-red-300" },
  { value: "message", label: "Message", cls: "text-neutral-300" },
];

const DEFAULT = { title: "", body: "", type: "info", linkUrl: "", iconUrl: "" };

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[11px] font-medium text-neutral-400">{label}</label>
        {hint && <span className="text-[10px] text-neutral-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 transition";

export default function AdminNotificationsPanel() {
  const [form, setForm]     = useState(DEFAULT);
  const [status, setStatus] = useState(null); // { kind: 'success'|'error', text }

  const [sendBroadcast, { loading }] = useMutation(SEND_BROADCAST, {
    onCompleted: () => {
      setStatus({ kind: "success", text: "Broadcast sent successfully." });
      setForm((f) => ({ ...DEFAULT, type: f.type }));
    },
    onError: (e) => {
      setStatus({ kind: "error", text: e?.message || "Failed to send." });
    },
  });

  const canSend = useMemo(() => form.title.trim() && form.body.trim(), [form.title, form.body]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    if (!canSend) { setStatus({ kind: "error", text: "Title and message are required." }); return; }
    await sendBroadcast({
      variables: {
        input: {
          title:   form.title.trim(),
          body:    form.body.trim(),
          type:    form.type,
          linkUrl: form.linkUrl.trim() || null,
          iconUrl: form.iconUrl.trim() || null,
        },
      },
    });
  };

  const selectedType = TYPE_OPTS.find((t) => t.value === form.type);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-neutral-50">Broadcast Notification</h2>
        <p className="text-xs text-neutral-500 mt-0.5">Send an in-app notification to all users at once.</p>
      </div>

      <div className="border border-white/[0.08] rounded-2xl p-5 bg-black/30 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Type">
              <div className="flex rounded-lg border border-white/10 overflow-hidden text-[11px]">
                {TYPE_OPTS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                    className={["flex-1 py-2 font-medium transition", form.type === t.value ? `bg-white/10 ${t.cls}` : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"].join(" ")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Title" hint="required">
              <input
                name="title"
                value={form.title}
                onChange={set("title")}
                placeholder="Short headline…"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Message" hint="required">
            <textarea
              name="body"
              value={form.body}
              onChange={set("body")}
              rows={4}
              placeholder="Tell users what's happening…"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Link URL" hint="optional">
              <input name="linkUrl" value={form.linkUrl} onChange={set("linkUrl")} placeholder="https://…" className={inputCls} />
            </Field>
            <Field label="Icon URL" hint="optional">
              <input name="iconUrl" value={form.iconUrl} onChange={set("iconUrl")} placeholder="https://…" className={inputCls} />
            </Field>
          </div>

          {status && (
            <div className={`border rounded-lg px-3 py-2 text-xs ${status.kind === "success" ? "border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-300" : "border-red-500/30 bg-red-950/20 text-red-300"}`}>
              {status.text}
            </div>
          )}

          {/* Preview strip */}
          {(form.title || form.body) && (
            <div className="border border-white/[0.06] rounded-xl p-3 bg-white/[0.02] space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold">Preview</p>
              <div className="flex items-start gap-2">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${selectedType?.cls ?? "text-neutral-400"}`}>{form.type}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-100 truncate">{form.title || "—"}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">{form.body || "—"}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-neutral-600">Sends to every registered user.</p>
            <button
              type="submit"
              disabled={!canSend || loading}
              className="inline-flex items-center rounded-lg px-4 py-2 text-xs font-semibold bg-white/10 border border-white/20 text-neutral-100 hover:bg-white/15 disabled:opacity-50 transition"
            >
              {loading ? "Sending…" : "Send broadcast"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

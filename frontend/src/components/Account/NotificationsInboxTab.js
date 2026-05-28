"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import { useMessenger } from "@/components/Messenger/MessengerContext";
import {
  CheckCircle,
  AlertCircle,
  MessageCircle,
  XCircle,
  Bell,
  X,
  CheckCheck,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

/* ─── Type config ─────────────────────────────────────────────────────────── */

const TYPE_CONFIG = {
  info:         { icon: CheckCircle,   color: "text-blue-500",   bg: "bg-blue-500/10" },
  error:        { icon: XCircle,       color: "text-red-500",    bg: "bg-red-500/10" },
  warning:      { icon: AlertCircle,   color: "text-amber-500",  bg: "bg-amber-500/10" },
  message:      { icon: MessageCircle, color: "text-violet-500", bg: "bg-violet-500/10" },
  subscription: { icon: Bell,          color: "text-teal-500",   bg: "bg-teal-500/10" },
};

function getTypeConfig(type) {
  return TYPE_CONFIG[type?.toLowerCase()] ?? TYPE_CONFIG.info;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function formatRelative(dateStr) {
  const d = new Date(dateStr);
  const now = Date.now();
  const t = d.getTime();
  if (Number.isNaN(t) || t > now) return d.toLocaleDateString("en-GB");
  const diff = Math.floor((now - t) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB");
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function NotificationsInboxTab({ token }) {
  const router = useRouter();
  const { openSidebar: openMessenger } = useMessenger();
  const [filter, setFilter] = useState("all"); // "all" | "unread"

  const {
    items,
    unread,
    total,
    loading,
    loadingMore,
    hasMore,
    markAllRead,
    markOneRead,
    dismissOne,
    loadMore,
  } = useNotifications({ token, pageSize: 20 });

  const displayed = filter === "unread" ? items.filter((n) => !n.read) : items;

  function handleClick(n) {
    if (!n.read) markOneRead(n.id);
    if (!n.linkUrl) return;
    if (n.linkUrl === '#messenger') {
      openMessenger();
    } else if (n.linkUrl.startsWith('http://') || n.linkUrl.startsWith('https://')) {
      window.open(n.linkUrl, '_blank', 'noopener,noreferrer');
    } else {
      router.push(n.linkUrl);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">

      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-light-text dark:text-dark-text">Notifications</h2>
          {unread > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-bold bg-light-accent/15 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent">
              {unread > 99 ? "99+" : unread} unread
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Filter pills */}
          <div className="flex rounded-lg overflow-hidden border border-light-border dark:border-dark-border">
            {["all", "unread"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  filter === f
                    ? "bg-light-accent dark:bg-dark-accent text-white"
                    : "bg-light-surface dark:bg-dark-surface text-light-textSecondary dark:text-dark-textSecondary hover:bg-light-alt dark:hover:bg-dark-alt"
                }`}
              >
                {f === "all" ? "All" : "Unread"}
              </button>
            ))}
          </div>

          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface hover:bg-light-alt dark:hover:bg-dark-alt text-light-textSecondary dark:text-dark-textSecondary transition"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-light-textMuted dark:text-dark-textMuted" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-light-textMuted dark:text-dark-textMuted">
          <Bell className="w-10 h-10 opacity-30" />
          <p className="text-sm">
            {filter === "unread" ? "No unread notifications" : "No notifications"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-light-border dark:border-dark-border overflow-hidden divide-y divide-light-border dark:divide-dark-border">
          {displayed.map((n) => {
            const cfg = getTypeConfig(n.type);
            const Icon = cfg.icon;

            return (
              <div
                key={n.id}
                className={`
                  flex gap-4 px-4 py-4 group transition
                  ${!n.read ? "bg-light-accent/5 dark:bg-dark-accent/5" : "bg-light-surface dark:bg-dark-surface"}
                  ${n.linkUrl ? "cursor-pointer hover:bg-light-accent/10 dark:hover:bg-dark-accent/10" : "hover:bg-light-alt dark:hover:bg-dark-alt"}
                `}
                onClick={() => handleClick(n)}
                role={n.linkUrl ? "button" : undefined}
                tabIndex={n.linkUrl ? 0 : undefined}
                onKeyDown={(e) => e.key === "Enter" && handleClick(n)}
              >
                {/* Icon */}
                <div className={`mt-0.5 shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${cfg.bg}`}>
                  {n.iconUrl ? (
                    <img src={n.iconUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <Icon className={`w-4.5 h-4.5 ${cfg.color}`} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold leading-snug ${
                      n.read
                        ? "text-light-textSecondary dark:text-dark-textSecondary"
                        : "text-light-text dark:text-dark-text"
                    }`}>
                      {n.title}
                      {!n.read && (
                        <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-light-accent dark:bg-dark-accent align-middle" />
                      )}
                    </p>
                    <span className="shrink-0 text-xs text-light-textMuted dark:text-dark-textMuted whitespace-nowrap mt-0.5">
                      {formatRelative(n.date)}
                    </span>
                  </div>

                  {n.body && (
                    <p className="mt-1 text-sm text-light-textSecondary dark:text-dark-textSecondary leading-relaxed">
                      {n.body}
                    </p>
                  )}

                  {n.linkUrl && (
                    <p className="mt-1.5 text-xs text-light-accent dark:text-dark-accent flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-3 h-3" /> View
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="shrink-0 flex flex-col items-end gap-1 ml-1">
                  {/* Dismiss */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); dismissOne(n.id); }}
                    className="p-1 rounded-md text-light-textMuted dark:text-dark-textMuted hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  {/* Mark read */}
                  {!n.read && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); markOneRead(n.id); }}
                      className="p-1 rounded-md text-light-textMuted dark:text-dark-textMuted hover:text-teal-500 dark:hover:text-teal-400 hover:bg-teal-500/10 transition opacity-0 group-hover:opacity-100"
                      title="Mark as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center pt-2">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface hover:bg-light-alt dark:hover:bg-dark-alt text-sm text-light-textSecondary dark:text-dark-textSecondary transition disabled:opacity-50"
          >
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loadingMore ? "Loading…" : `Load more (${total - items.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}

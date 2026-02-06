// src/components/Messenger/MessengerSidebar.js
//
// UPDATED (2026-02-06):
// - ADD: Search box (filters by username + last message content).
// - ADD: Last message time (HH:MM) on each row.
// - KEEP: unread badges + active highlighting + loading/empty states.

"use client";

import React, { useMemo, useState } from "react";
import { X, Search } from "lucide-react";
import { motion } from "framer-motion";

function resolveAvatar(avatar) {
  if (!avatar) return "https://placehold.co/40/webp";
  return avatar;
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MessengerSidebar({
  threads = [],
  loading = false,
  onOpenChat,
  openChats = [],
  onClose,
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
    if (!query) return threads;

    return threads.filter((t) => {
      const name = String(t?.user?.username || "").toLowerCase();
      const last = String(t?.lastMessage?.content || "").toLowerCase();
      return name.includes(query) || last.includes(query);
    });
  }, [threads, q]);

  return (
    <motion.aside
      className="
        h-full w-full
        bg-light-surface dark:bg-dark-surface
        border-l border-light-border dark:border-dark-border
        flex flex-col
      "
    >
      <div className="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border">
        <div className="flex flex-col">
          <span className="font-bold text-lg">Messages</span>
          <span className="text-xs text-light-textMuted dark:text-dark-textMuted">
            {loading
              ? "Loading..."
              : `${threads.length} conversation${threads.length === 1 ? "" : "s"}`}
          </span>
        </div>

        <button onClick={onClose} aria-label="Close messenger" type="button">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-light-border dark:border-dark-border">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-light-border dark:border-dark-border bg-light-alt/40 dark:bg-dark-alt/40">
          <Search className="w-4 h-4 text-light-textMuted dark:text-dark-textMuted" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search messages…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading && threads.length === 0 && (
          <div className="text-light-textMuted dark:text-dark-textMuted py-12 text-center">
            Loading conversations...
          </div>
        )}

        {!loading && threads.length === 0 && (
          <div className="text-light-textMuted dark:text-dark-textMuted py-12 text-center">
            No conversations yet.
          </div>
        )}

        {!loading && threads.length > 0 && filtered.length === 0 && (
          <div className="text-light-textMuted dark:text-dark-textMuted py-12 text-center">
            No conversations match your search.
          </div>
        )}

        {filtered.map((t) => {
          const userId = t?.user?.id;
          const name = t?.user?.username || "User";
          const avatar = resolveAvatar(t?.user?.avatar);
          const last = t?.lastMessage?.content || "";
          const time = formatTime(t?.lastMessage?.createdAt);
          const isActive = userId && openChats.includes(userId);
          const hasUnread = (t?.unreadCount || 0) > 0;

          if (!userId) return null;

          return (
            <button
              key={userId}
              type="button"
              className={`
                w-full text-left
                flex items-center gap-3 p-2 rounded-lg cursor-pointer transition
                ${isActive ? "bg-light-accent/10 dark:bg-dark-accent/10" : "hover:bg-light-alt dark:hover:bg-dark-alt"}
              `}
              onClick={() => onOpenChat(userId)}
            >
              <img
                src={avatar}
                alt={name}
                width={40}
                height={40}
                className="rounded-full border border-light-border dark:border-dark-border"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold truncate">{name}</div>
                  <div className="text-[11px] text-light-textMuted dark:text-dark-textMuted shrink-0">
                    {time}
                  </div>
                </div>

                <div className="text-xs text-light-textMuted dark:text-dark-textMuted truncate">
                  {last || " "}
                </div>
              </div>

              {hasUnread && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-light-accent/15 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent">
                    {t.unreadCount}
                  </span>
                  <span className="w-2 h-2 bg-light-accent dark:bg-dark-accent rounded-full" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </motion.aside>
  );
}

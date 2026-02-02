// src/components/Messenger/MessengerSidebar.js
//
// UPDATED (2026-01-29):
// - WIRED: expects real `myChats` objects: { user, lastMessage, unreadCount }
// - FIX: openChat now uses userId, not thread.id
// - ADDED: loading state

"use client";

import React from "react";
import { X } from "lucide-react";
import { motion } from "framer-motion";

function resolveAvatar(avatar) {
  if (!avatar) return "https://placehold.co/40/webp";
  return avatar;
}

export default function MessengerSidebar({
  threads = [],
  loading = false,
  onOpenChat,
  openChats = [],
  onClose,
}) {
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
            {loading ? "Loading..." : `${threads.length} conversation${threads.length === 1 ? "" : "s"}`}
          </span>
        </div>

        <button onClick={onClose} aria-label="Close messenger" type="button">
          <X className="w-6 h-6" />
        </button>
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

        {threads.map((t) => {
          const userId = t?.user?.id;
          const name = t?.user?.username || "User";
          const avatar = resolveAvatar(t?.user?.avatar);
          const last = t?.lastMessage?.content || "";
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
                <div className="font-semibold truncate">{name}</div>
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

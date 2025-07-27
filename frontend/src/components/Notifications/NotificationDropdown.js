"use client";
import {
  CheckCircle,
  AlertCircle,
  MessageCircle,
  XCircle,
  Cog,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Correct icons: always "muted" color for icon, bg changes on unread, full theme support
const TYPE = {
  info: {
    icon: (
      <CheckCircle className="w-5 h-5 text-light-textMuted dark:text-dark-textMuted" />
    ),
  },
  error: {
    icon: (
      <XCircle className="w-5 h-5 text-light-textMuted dark:text-dark-textMuted" />
    ),
  },
  warning: {
    icon: (
      <AlertCircle className="w-5 h-5 text-light-textMuted dark:text-dark-textMuted" />
    ),
  },
  message: {
    icon: (
      <MessageCircle className="w-5 h-5 text-light-textMuted dark:text-dark-textMuted" />
    ),
  },
};

export default function NotificationDropdown({ notifications, setOpen }) {
  // Sort newest first
  const items = [...notifications].sort((a, b) => b.date.localeCompare(a.date));

  function markAllAsRead(e) {
    e.stopPropagation();
    for (let n of items) n.read = true;
    setOpen(false);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.17 }}
        className="absolute right-0 mt-2 w-80 max-w-[95vw] bg-light-surface dark:bg-dark-surface rounded-xl shadow-xl z-50 border border-light-border dark:border-dark-border overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt">
          <span className="font-semibold text-base text-light-text dark:text-dark-text">
            Notifications
          </span>
          <div className="flex gap-2">
            <button
              className="text-xs text-light-accent dark:text-dark-accent underline hover:opacity-70"
              onClick={markAllAsRead}
            >
              Mark all as read
            </button>
            <a
              href="/settings/notifications"
              className="inline-flex items-center gap-1 text-xs text-light-textSecondary dark:text-dark-textSecondary hover:text-light-accent dark:hover:text-dark-accent"
            >
              <Cog className="w-4 h-4" /> Settings
            </a>
          </div>
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <li className="text-center text-light-textMuted dark:text-dark-textMuted p-8">
              No notifications
            </li>
          )}
          {items.map((n) => (
            <li
              key={n.id}
              className={`
                flex items-start gap-3 px-4 py-3 border-b last:border-0 border-light-border dark:border-dark-border
                ${!n.read ? "bg-light-accent/5 dark:bg-dark-accent/5" : ""}
                cursor-pointer hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition
                group
              `}
            >
              <div className="mt-1 shrink-0 rounded-full p-1 bg-transparent">
                {TYPE[n.type]?.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`
                  text-sm truncate
                  ${!n.read
                    ? "font-semibold text-light-text dark:text-dark-text"
                    : "font-medium text-light-textMuted dark:text-dark-textMuted"}
                `}>
                  {n.title}
                </div>
                <div className="text-xs text-light-textMuted dark:text-dark-textMuted truncate">
                  {n.body}
                </div>
              </div>
              <div className="ml-2 text-xs text-light-textMuted dark:text-dark-textMuted whitespace-nowrap pt-1">
                {formatDate(n.date)}
              </div>
            </li>
          ))}
        </ul>
      </motion.div>
    </AnimatePresence>
  );
}

// Helper: always show date as DD/MM/YYYY
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB");
}

"use client";
import React, { forwardRef, useEffect, useMemo, useRef } from "react";
import {
  CheckCircle,
  AlertCircle,
  MessageCircle,
  XCircle,
  Cog,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/** ========================================================================
 *  Icon map (unchanged look) — muted icon colour, unread uses bg highlight
 * ======================================================================== */
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

/** ========================================================================
 *  Helpers
 * ======================================================================== */

// NEW: relative time formatter (fallbacks to date if future/invalid)
function formatRelative(dateStr) {
  const d = new Date(dateStr);
  const now = Date.now();
  const t = d.getTime();
  if (Number.isNaN(t) || t > now) return formatDate(dateStr);
  const diff = Math.floor((now - t) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

// Existing: always show date as DD/MM/YYYY
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB");
}

/** ========================================================================
 *  Dropdown (forwardRef for anchor + a11y)
 *  CHANGED: accepts more optional props to play nicely with the bell button.
 * ======================================================================== */
/**
 * Props (backwards compatible):
 * - notifications: Array<{ id, type, title, body, read, date }>
 * - setOpen: Function(boolean)     // kept for backwards compat
 * - id?: string                     // NEW a11y id for menu
 * - labelledBy?: string             // NEW aria-labelledby (button id)
 * - anchorRef?: Ref<HTMLDivElement> // NEW if you want to align to anchor
 * - onRequestClose?: () => void     // NEW child can close itself
 * - onMarkAllRead?: () => void      // NEW don’t mutate props locally
 * - onItemClick?: (notif) => void   // NEW click handler for items
 * - onDismiss?: (notif) => void     // NEW dismiss handler
 * - timeMode?: 'relative'|'date'    // NEW (default 'relative')
 * - hasMore?: boolean               // NEW pagination helper
 * - onLoadMore?: () => void         // NEW pagination handler
 * - loadingMore?: boolean           // NEW pagination state
 */
const NotificationDropdown = forwardRef(function NotificationDropdown(
  {
    notifications = [],
    setOpen, // legacy
    id,
    labelledBy,
    anchorRef,
    onRequestClose, // CHANGED: preferred over setOpen(false)
    onMarkAllRead,
    onItemClick,
    onDismiss,
    timeMode = "relative",
    hasMore = false,
    onLoadMore,
    loadingMore = false,
  },
  ref
) {
  // CHANGED: never mutate props; sort in a memo.
  const items = useMemo(
    () => [...notifications].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [notifications]
  );

  // NEW: focusable items for keyboard nav
  const itemRefs = useRef([]);

  // NEW: focus first item on mount
  useEffect(() => {
    if (itemRefs.current[0]) {
      // slight delay so Framer Motion finishes mounting
      const t = setTimeout(() => itemRefs.current[0]?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, []);

  // NEW: keyboard navigation and ESC to close
  const onKeyDown = (e) => {
    const max = items.length - 1;
    if (max < 0) return;

    const idx = itemRefs.current.findIndex((el) => el === document.activeElement);
    const focusAt = (i) => itemRefs.current[i]?.focus();

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onRequestClose ? onRequestClose() : setOpen?.(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusAt(idx < 0 ? 0 : Math.min(idx + 1, max));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusAt(idx <= 0 ? 0 : idx - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusAt(max);
    }
  };

  // NEW: declarative handler (don’t mutate notifications here)
  function markAllAsRead(e) {
    e?.stopPropagation?.();
    if (typeof onMarkAllRead === "function") onMarkAllRead();
    // Close after action for quick feedback
    onRequestClose ? onRequestClose() : setOpen?.(false);
  }

  // NEW: item click wrapper
  function handleItemClick(n) {
    if (typeof onItemClick === "function") {
      onItemClick(n);
    }
    // Optional: close the menu after click
    onRequestClose ? onRequestClose() : setOpen?.(false);
  }

  function handleDismiss(n, e) {
    e?.stopPropagation?.();
    if (typeof onDismiss === "function") {
      onDismiss(n);
    }
  }

  // CHANGED: use time mode consistently
  const timeFn = timeMode === "date" ? formatDate : formatRelative;

  // Simple popover positioning — we keep your absolute-right style.
  // If you ever need smart positioning, we can swap in @floating-ui.
  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        id={id} // NEW
        role="menu" // NEW a11y
        aria-labelledby={labelledBy} // NEW
        tabIndex={-1}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.17 }}
        className="absolute right-0 mt-2 w-80 max-w-[95vw] bg-light-surface dark:bg-dark-surface rounded-xl shadow-xl z-50 border border-light-border dark:border-dark-border overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown} // NEW
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt">
          <span className="font-semibold text-base text-light-text dark:text-dark-text">
            Notifications
          </span>
          <div className="flex items-center gap-2">
            <button
              className="text-xs text-light-accent dark:text-dark-accent underline hover:opacity-80"
              onClick={markAllAsRead}
              type="button"
            >
              Mark all read
            </button>
            <a
              href="/account?tab=notifications"
              className="inline-flex items-center gap-1 text-xs text-light-textSecondary dark:text-dark-textSecondary hover:text-light-accent dark:hover:text-dark-accent"
              title="Notification settings"
            >
              <Cog className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* List */}
        <ul className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <li className="text-center text-light-textMuted dark:text-dark-textMuted p-8">
              No notifications
            </li>
          )}

          {items.map((n, i) => (
            <li key={n.id} role="none">
              {/* CHANGED: make row itself focusable button for keyboard + a11y */}
              <button
                role="menuitem" // NEW
                ref={(el) => (itemRefs.current[i] = el)} // NEW
                onClick={() => handleItemClick(n)} // NEW
                className={`
                  w-full text-left
                  flex items-start gap-3 px-4 py-3 border-b last:border-0 border-light-border dark:border-dark-border
                  ${!n.read ? "bg-light-accent/5 dark:bg-dark-accent/5" : ""}
                  hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition
                  group focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
                `}
                data-unread={!n.read ? "true" : "false"}
              >
                <div className="mt-1 shrink-0 rounded-full p-1 bg-transparent">
                  {n.iconUrl ? (
                    <img
                      src={n.iconUrl}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    TYPE[n.type]?.icon || TYPE.info.icon
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className={`
                      text-sm truncate
                      ${
                        !n.read
                          ? "font-semibold text-light-text dark:text-dark-text"
                          : "font-medium text-light-textMuted dark:text-dark-textMuted"
                      }
                    `}
                  >
                    {n.title}
                  </div>
                  {n.body ? (
                    <div className="text-xs text-light-textMuted dark:text-dark-textMuted line-clamp-2 whitespace-normal">
                      {n.body}
                    </div>
                  ) : null}
                </div>

                <div className="ml-2 text-xs text-light-textMuted dark:text-dark-textMuted whitespace-nowrap pt-1 flex items-start gap-2">
                  {timeFn(n.date)}
                  <button
                    type="button"
                    onClick={(e) => handleDismiss(n, e)}
                    className="text-light-textMuted dark:text-dark-textMuted hover:text-light-error dark:hover:text-dark-error"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </button>
            </li>
          ))}
          {hasMore && (
            <li className="px-4 py-3 border-t border-light-border dark:border-dark-border text-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadMore?.();
                }}
                disabled={loadingMore}
                className="text-sm text-light-accent dark:text-dark-accent hover:opacity-80 disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </li>
          )}
        </ul>

        {/* Footer — view all inbox */}
        <div className="border-t border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt">
          <a
            href="/dashboard?view=notifications"
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-light-accent dark:text-dark-accent hover:opacity-80 transition"
            onClick={() => onRequestClose ? onRequestClose() : setOpen?.(false)}
          >
            View all notifications →
          </a>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

export default NotificationDropdown;

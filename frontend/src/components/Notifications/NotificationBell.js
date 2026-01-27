"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import NotificationDropdown from "./NotificationDropdown";

export default function NotificationBell({
  notifications = [],
  onMarkAllRead,     // kept optional so dropdown's "Mark all" still works
  onItemClick,
  onDismiss,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  unreadCount,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const bellRef = useRef(null);
  const menuRef = useRef(null); // track dropdown for outside-click

  // Unread count (used only for aria-label)
  const unread = useMemo(() => {
    if (typeof unreadCount === "number") return unreadCount;
    return notifications.filter((n) => !n.read).length;
  }, [notifications, unreadCount]);

  // Outside click + ESC to close (kept)
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e) {
      const inButton = bellRef.current?.contains(e.target);
      const inMenu = menuRef.current?.contains?.(e.target);
      if (!inButton && !inMenu) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const ariaLabel =
    unread > 0 ? `Open notifications (${unread} unread)` : "Open notifications";

  return (
    <div className={`relative ${className}`} ref={bellRef}>
      <button
        className="
          relative p-2 rounded-full
          hover:bg-light-border dark:hover:bg-dark-border
          focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
          transition
        "
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}     // basic a11y kept
        aria-haspopup="menu"
        aria-expanded={open}
        type="button"
        title={ariaLabel}
      >
        <Bell className="w-6 h-6" />
        {unread > 0 && (
          // Minimal unread dot (kept from your original)
          <span
            className="
              absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full
              border-2 border-light-surface dark:border-dark-surface
            "
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <NotificationDropdown
          notifications={notifications}
          setOpen={setOpen}
          ref={menuRef}
          onRequestClose={() => setOpen(false)} // child can close itself
          onMarkAllRead={onMarkAllRead}         // pass-through (optional)
          onItemClick={onItemClick}
          onDismiss={onDismiss}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          loadingMore={loadingMore}
        />
      )}
    </div>
  );
}

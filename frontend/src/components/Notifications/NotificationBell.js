"use client";
import { Bell } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import NotificationDropdown from "./NotificationDropdown";

export default function NotificationBell({ notifications }) {
  const [open, setOpen] = useState(false);
  const bellRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (!bellRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Count unread
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={bellRef}>
      <button
        className="relative p-2 rounded-full hover:bg-light-border dark:hover:bg-dark-border focus:outline-none"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open notifications"
      >
        <Bell className="w-6 h-6" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-light-surface dark:border-dark-surface" />
        )}
      </button>
      {open && (
        <NotificationDropdown
          notifications={notifications}
          setOpen={setOpen}
        />
      )}
    </div>
  );
}

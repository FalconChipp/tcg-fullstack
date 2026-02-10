// src/components/Messenger/MessengerToggleButton.js
//
// UPDATED (2026-01-29):
// - FIX: remove internal `fixed` class conflicts; parent controls positioning via `style`
// - KEEP: same look

"use client";

import { MessageCircle } from "lucide-react";

export default function MessengerToggleButton({ onClick, style }) {
  return (
    <button
      onClick={onClick}
      style={style}
      className="
        flex items-center justify-center
        w-14 h-14 rounded-full bg-light-accent dark:bg-dark-accent
        text-white shadow-lg hover:scale-105 transition
        focus:outline-none
      "
      aria-label="Open Messenger"
      type="button"
    >
      <MessageCircle className="w-7 h-7" />
    </button>
  );
}

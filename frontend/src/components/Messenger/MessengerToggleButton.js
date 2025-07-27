// MessengerToggleButton.js
"use client";
import { MessageCircle } from "lucide-react";

export default function MessengerToggleButton({ onClick, style }) {
  return (
    <button
      onClick={onClick}
      style={style}
      className="
        fixed flex items-center justify-center
        w-14 h-14 rounded-full bg-light-accent dark:bg-dark-accent
        text-white shadow-lg hover:scale-105 transition
        focus:outline-none z-[130]
      "
      aria-label="Open Messenger"
      type="button"
    >
      <MessageCircle className="w-7 h-7" />
    </button>
  );
}

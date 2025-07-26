"use client";
import React from "react";
import { useMessenger } from "./MessengerContext";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function MessengerSidebar({
  threads = [],
  onOpenChat,
  openChats = [],
}) {
  const { sidebarOpen, closeSidebar } = useMessenger();

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <motion.aside
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`
            fixed top-0 right-0 z-[102] h-full w-[380px] max-w-full
            bg-light-surface dark:bg-dark-surface border-l border-light-border dark:border-dark-border
            shadow-2xl flex flex-col
            backdrop-blur-md
          `}
          style={{ willChange: "transform" }}
          tabIndex={-1}
        >
          <div className="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border">
            <span className="font-bold text-lg">Messenger</span>
            <button onClick={closeSidebar} aria-label="Close messenger">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {threads.length === 0 && (
              <div className="text-light-textMuted dark:text-dark-textMuted py-12 text-center">
                No chats yet.
              </div>
            )}
            {threads.map((thread) => (
              <div
                key={thread.id}
                className={`
                  flex items-center gap-3 p-2 rounded-lg cursor-pointer transition
                  ${openChats.includes(thread.id)
                    ? "bg-light-accent/10 dark:bg-dark-accent/10"
                    : "hover:bg-light-alt dark:hover:bg-dark-alt"}
                `}
                onClick={() => onOpenChat(thread.id)}
                tabIndex={0}
              >
                <img
                  src={thread.avatar}
                  alt={thread.name}
                  width={40}
                  height={40}
                  className="rounded-full border border-light-border dark:border-dark-border"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{thread.name}</div>
                  <div className="text-xs text-light-textMuted dark:text-dark-textMuted truncate">
                    {thread.lastMessage}
                  </div>
                </div>
                {thread.unread && (
                  <span className="w-2 h-2 bg-light-accent dark:bg-dark-accent rounded-full" />
                )}
              </div>
            ))}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

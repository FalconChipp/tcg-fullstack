// src/components/Messenger/MessengerLayout.js
//
// UPDATED (2026-01-29):
// - FIX: removed mockThreads/mock open chats
// - WIRED: uses MessengerContext threads/openChats/messages
// - FIX: toggle button pinned bottom-right consistently
// - FIX: popups pinned above toggle, minimised row left of toggle

"use client";

import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import MessengerSidebar from "./MessengerSidebar";
import MessengerToggleButton from "./MessengerToggleButton";
import MessengerPopup from "./MessengerPopup";
import { useMessenger } from "./MessengerContext";

const TOGGLE_SIZE = 56;
const GAP = 12;
const MARGIN = 20;

export default function MessengerLayout() {
  const {
    sidebarOpen,
    openSidebar,
    closeSidebar,
    threads,
    threadsLoading,
    openChats,
    openChat,
    closeChat,
    minimiseChat,
    restoreChat,
  } = useMessenger();

  const openChatIds = useMemo(() => openChats.map((c) => c.userId), [openChats]);
  const fullChats = openChats.filter((c) => !c.minimised);
  const minimisedChats = openChats.filter((c) => c.minimised);

  const minimisedRowRight = TOGGLE_SIZE + MARGIN + GAP;
  const bottomOffset = TOGGLE_SIZE + MARGIN + GAP + 8;

  return (
    <>
      {/* Sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[111] bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSidebar}
            />

            <motion.div
              className="fixed top-0 right-0 h-full w-[370px] max-w-full z-[112] shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.28 }}
            >
              <MessengerSidebar
                threads={threads}
                loading={threadsLoading}
                onOpenChat={(userId) => openChat(userId)}
                openChats={openChatIds}
                onClose={closeSidebar}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toggle button (FAB) */}
      <MessengerToggleButton
        onClick={openSidebar}
        style={{
          position: "fixed",
          right: MARGIN,
          bottom: MARGIN,
          zIndex: 130,
        }}
      />

      {/* Minimised row (left of FAB) */}
      <div
        className="fixed flex gap-2 z-[121] pointer-events-none"
        style={{ bottom: MARGIN, right: minimisedRowRight }}
      >
        <AnimatePresence>
          {minimisedChats.map((c) => {
            const thread = threads.find((t) => t?.user?.id === c.userId);
            if (!thread) return null;
            return (
              <motion.div
                key={c.userId}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.17 }}
                style={{ pointerEvents: "auto" }}
              >
                <MessengerPopup
                  otherUser={thread.user}
                  onClose={() => closeChat(c.userId)}
                  onRestore={() => restoreChat(c.userId)}
                  isMinimised
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Full popups above FAB */}
      <div
        className="fixed flex gap-3 z-[120] pointer-events-none"
        style={{ right: MARGIN, bottom: bottomOffset }}
      >
        <AnimatePresence>
          {fullChats.map((c) => {
            const thread = threads.find((t) => t?.user?.id === c.userId);
            // If thread isn't loaded yet (rare), still allow popup with fallback user
            const otherUser = thread?.user || { id: c.userId, username: "User", avatar: null };

            return (
              <motion.div
                key={c.userId}
                initial={{ opacity: 0, y: 40, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.96 }}
                transition={{ duration: 0.23 }}
                style={{ pointerEvents: "auto" }}
              >
                <MessengerPopup
                  otherUser={otherUser}
                  onClose={() => closeChat(c.userId)}
                  onMinimise={() => minimiseChat(c.userId)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}

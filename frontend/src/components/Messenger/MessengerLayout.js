"use client";
import React, { useState, useEffect } from "react";
import MessengerSidebar from "./MessengerSidebar";
import MessengerToggleButton from "./MessengerToggleButton";
import MessengerPopup from "./MessengerPopup";
import { AnimatePresence, motion } from "framer-motion";
import { useMessenger } from "./MessengerContext"; // <---

// Layout constants
const MINIMISED_WIDTH = 340;
const TOGGLE_SIZE = 64;
const GAP = 12;
const MARGIN = 24;

const mockThreads = [
  { id: "thread1", name: "Ryan", avatar: "/avatars/ryan.png", lastMessage: "Let's trade!", unread: true },
  { id: "thread2", name: "John", avatar: "/avatars/john.png", lastMessage: "Sent payment!", unread: false },
];

function useAutoCloseSidebar(closeSidebar) {
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 900) closeSidebar();
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [closeSidebar]);
}

export default function MessengerLayout() {
  const { sidebarOpen, openSidebar, closeSidebar } = useMessenger();
  const [openChats, setOpenChats] = useState([
    { id: "thread1", minimised: false },
    { id: "thread2", minimised: true },
  ]);

  useAutoCloseSidebar(closeSidebar);

  // --- Actions ---
  function openChat(threadId) {
    setOpenChats((prev) =>
      prev.find((c) => c.id === threadId)
        ? prev.map((c) =>
            c.id === threadId ? { ...c, minimised: false } : c
          )
        : [...prev, { id: threadId, minimised: false }]
    );
    closeSidebar(); // Always close sidebar when chat is opened
  }
  function closeChat(threadId) {
    setOpenChats((prev) => prev.filter((c) => c.id !== threadId));
  }
  function minimiseChat(threadId) {
    setOpenChats((prev) =>
      prev.map((c) =>
        c.id === threadId ? { ...c, minimised: true } : c
      )
    );
  }
  function restoreChat(threadId) {
    setOpenChats((prev) =>
      prev.map((c) =>
        c.id === threadId ? { ...c, minimised: false } : c
      )
    );
  }

  const fullChats = openChats.filter((c) => !c.minimised);
  const minimisedChats = openChats.filter((c) => c.minimised);
  const minimisedRowRight = TOGGLE_SIZE + MARGIN + GAP;
  const bottomOffset = TOGGLE_SIZE + MARGIN + GAP + 8;

  return (
    <>
      {/* Sidebar: overlays from right */}
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
              className="fixed top-0 right-0 h-full w-[370px] max-w-full bg-light-surface dark:bg-dark-surface border-l border-light-border dark:border-dark-border z-[112] shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.28 }}
            >
              <MessengerSidebar
                threads={mockThreads}
                onOpenChat={openChat}
                openChats={openChats.map((c) => c.id)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Messenger FAB toggle */}
      <MessengerToggleButton
        onClick={openSidebar}
        style={{
          zIndex: 130,
          position: "fixed",
          right: MARGIN,
          bottom: MARGIN,
        }}
      />

      {/* Minimised row: always to the left of the FAB */}
      <div
        className="fixed flex gap-2 z-[121] pointer-events-none"
        style={{
          bottom: MARGIN,
          right: minimisedRowRight,
        }}
      >
        <AnimatePresence>
          {minimisedChats.map((c, idx) => {
            const thread = mockThreads.find((t) => t.id === c.id);
            if (!thread) return null;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                transition={{ duration: 0.17 }}
                style={{
                  pointerEvents: "auto",
                }}
              >
                <MessengerPopup
                  thread={thread}
                  onClose={() => closeChat(c.id)}
                  onRestore={() => restoreChat(c.id)}
                  isMinimised={true}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Full popups: always above the minimised row & FAB */}
      <div
        className="fixed flex gap-3 z-[120] pointer-events-none"
        style={{
          right: MARGIN,
          bottom: bottomOffset,
        }}
      >
        <AnimatePresence>
          {fullChats.map((c, idx) => {
            const thread = mockThreads.find((t) => t.id === c.id);
            if (!thread) return null;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 40, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.96 }}
                transition={{ duration: 0.23 }}
                style={{
                  pointerEvents: "auto",
                }}
              >
                <MessengerPopup
                  thread={thread}
                  onClose={() => closeChat(c.id)}
                  onMinimise={() => minimiseChat(c.id)}
                  isMinimised={false}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}

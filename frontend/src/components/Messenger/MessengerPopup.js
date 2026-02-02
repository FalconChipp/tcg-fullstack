// src/components/Messenger/MessengerPopup.js
//
// UPDATED (2026-01-29):
// - FIX: removed mockMessages, now uses messagesByUserId from context
// - FIX: username/header uses otherUser.username reliably
// - FIX: sendMessage uses real GraphQL mutation + optimistic UI
// - FIX: scroll to bottom when new messages arrive

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { X, Minus, Send } from "lucide-react";
import { motion } from "framer-motion";
import { useMessenger } from "./MessengerContext";

function resolveAvatar(avatar) {
  if (!avatar) return "https://placehold.co/32/webp";
  return avatar;
}

export default function MessengerPopup({
  otherUser,
  onClose,
  onMinimise,
  onRestore,
  isMinimised = false,
  style,
}) {
  const { messagesByUserId, sendMessage, loadChatWithUser } = useMessenger();

  const otherUserId = otherUser?.id;
  const name = otherUser?.username || "User";
  const avatar = resolveAvatar(otherUser?.avatar);

  const [input, setInput] = useState("");
  const endRef = useRef(null);

  const bucket = messagesByUserId?.[otherUserId];
  const loading = !!bucket?.loading;

  const messages = useMemo(() => {
    const items = Array.isArray(bucket?.items) ? bucket.items : [];
    // sort oldest->newest in case backend returns newest-first
    return [...items].sort((a, b) => {
      const ta = new Date(a?.createdAt || 0).getTime();
      const tb = new Date(b?.createdAt || 0).getTime();
      return ta - tb;
    });
  }, [bucket]);

  // If popup is opened and we don't have messages yet, load once
  useEffect(() => {
    if (!otherUserId) return;
    const hasAny = Array.isArray(bucket?.items) && bucket.items.length > 0;
    if (!hasAny && !loading) {
      loadChatWithUser(otherUserId).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId]);

  useEffect(() => {
    if (isMinimised) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isMinimised]);

  async function onSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !otherUserId) return;

    setInput("");
    try {
      await sendMessage(otherUserId, text);
    } catch (err) {
      console.error("sendMessage failed:", err);
      // restore input so user can retry
      setInput(text);
    }
  }

  // Minimised bar
  if (isMinimised) {
    return (
      <motion.div
        className="w-[340px] h-[52px] bg-dark-surface/90 border border-dark-border rounded-2xl shadow-2xl flex items-center px-3 cursor-pointer select-none backdrop-blur"
        style={style}
        onClick={onRestore}
        tabIndex={0}
        initial={{ y: 70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 70, opacity: 0 }}
        transition={{ type: "spring", stiffness: 250, damping: 25 }}
      >
        <Image src={avatar} alt={name} width={32} height={32} className="rounded-full border border-dark-border mr-2" />
        <div className="font-semibold text-base flex-1 truncate text-white">{name}</div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          className="ml-2 p-1 rounded hover:bg-light-error/10 dark:hover:bg-dark-error/10"
          title="Close"
          type="button"
        >
          <X className="w-5 h-5 text-dark-textMuted" />
        </button>
      </motion.div>
    );
  }

  // Full popup
  return (
    <motion.div
      className="w-[340px] h-[420px] bg-gradient-to-br from-[#22253c] to-[#191a23] border border-dark-border rounded-2xl shadow-2xl flex flex-col mb-5 backdrop-blur-lg"
      style={style}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: "spring", stiffness: 250, damping: 30 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-dark-border rounded-t-2xl bg-dark-alt/90 backdrop-blur">
        <Image src={avatar} alt={name} width={32} height={32} className="rounded-full border border-dark-border" />
        <div className="font-semibold text-base flex-1 text-white truncate">{name}</div>

        <button
          onClick={onMinimise}
          className="p-1 rounded hover:bg-dark-border"
          title="Minimise"
          type="button"
        >
          <Minus className="w-5 h-5 text-dark-textMuted" />
        </button>

        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-light-error/10 dark:hover:bg-dark-error/10"
          title="Close"
          type="button"
        >
          <X className="w-5 h-5 text-dark-textMuted" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 px-3 py-2 overflow-y-auto space-y-2 bg-transparent">
        {loading && messages.length === 0 && (
          <div className="text-center text-sm text-dark-textMuted py-6">Loading messages...</div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center text-sm text-dark-textMuted py-6">No messages yet.</div>
        )}

        {messages.map((msg) => {
          const mine = msg?.senderId && otherUserId && msg.senderId !== otherUserId;
          return (
            <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`
                  px-4 py-2 rounded-2xl text-sm max-w-[78%] shadow
                  ${mine ? "bg-gradient-to-r from-[#3056ff] to-[#00b1ff] text-white" : "bg-dark-alt text-white"}
                `}
                title={msg?.createdAt ? new Date(msg.createdAt).toLocaleString() : undefined}
                style={{
                  borderBottomRightRadius: mine ? "8px" : "16px",
                  borderBottomLeftRadius: mine ? "16px" : "8px",
                }}
              >
                {msg.content}
              </div>
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={onSubmit}
        className="flex items-center px-3 py-3 gap-2 border-t border-dark-border bg-dark-surface/90 rounded-b-2xl backdrop-blur"
      >
        <input
          type="text"
          className="
            flex-1 px-3 py-2 rounded-xl bg-dark-background border border-dark-border text-white
            focus:border-blue-500 outline-none transition
          "
          placeholder={`Message ${name}...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="flex items-center gap-1 px-3 py-2 bg-gradient-to-tr from-[#3056ff] to-[#00b1ff] text-white rounded-full font-bold shadow hover:scale-105 transition"
          aria-label="Send"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </motion.div>
  );
}

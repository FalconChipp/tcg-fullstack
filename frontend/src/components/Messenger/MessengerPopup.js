"use client";
import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { X, Minus, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Demo messages for John
const mockMessages = {
  "2": [
    { sender: "John", text: "I've shipped your order!", ts: "2025-07-27T16:15:00Z" },
    { sender: "me", text: "Thank you!", ts: "2025-07-27T16:16:00Z" },
  ],
};

export default function MessengerPopup({
  thread,
  onClose,
  onMinimise,
  isMinimised = false,
  onRestore,
  style,
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(mockMessages[thread.id] || []);
  const endRef = useRef();

  useEffect(() => {
    if (!isMinimised) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isMinimised]);

  function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages((msgs) => [
      ...msgs,
      { sender: "me", text: input.trim(), ts: new Date().toISOString() },
    ]);
    setInput("");
  }

  // MINIMISED BAR
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
        <Image
          src={thread.avatar}
          alt={thread.name}
          width={32}
          height={32}
          className="rounded-full border border-dark-border mr-2"
        />
        <div className="font-semibold text-base flex-1 truncate text-white">{thread.name}</div>
        <button
          onClick={e => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-2 p-1 rounded hover:bg-light-error/10 dark:hover:bg-dark-error/10"
          title="Close"
        >
          <X className="w-5 h-5 text-dark-textMuted" />
        </button>
      </motion.div>
    );
  }

  // FULL POPUP
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
        <Image
          src={thread.avatar}
          alt={thread.name}
          width={32}
          height={32}
          className="rounded-full border border-dark-border"
        />
        <div className="font-semibold text-base flex-1 text-white">{thread.name}</div>
        {/* Minimise */}
        <button
          onClick={onMinimise}
          className="p-1 rounded hover:bg-dark-border"
          title="Minimise"
        >
          <Minus className="w-5 h-5 text-dark-textMuted" />
        </button>
        {/* Close */}
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-light-error/10 dark:hover:bg-dark-error/10"
          title="Close"
        >
          <X className="w-5 h-5 text-dark-textMuted" />
        </button>
      </div>
      {/* Messages */}
      <div className="flex-1 px-3 py-2 overflow-y-auto space-y-2 bg-transparent">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
            <div
              className={`
                px-4 py-2 rounded-2xl text-sm max-w-[78%] shadow
                ${msg.sender === "me"
                  ? "bg-gradient-to-r from-[#3056ff] to-[#00b1ff] text-white self-end"
                  : "bg-dark-alt text-white self-start"}
              `}
              style={{
                borderBottomRightRadius: msg.sender === "me" ? "8px" : "16px",
                borderBottomLeftRadius: msg.sender === "me" ? "16px" : "8px",
                borderTopRightRadius: "16px",
                borderTopLeftRadius: "16px",
                marginRight: msg.sender === "me" ? "2px" : 0,
                marginLeft: msg.sender !== "me" ? "2px" : 0,
                transition: "background 0.15s",
              }}
              title={msg.ts ? new Date(msg.ts).toLocaleString() : undefined}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="flex items-center px-3 py-3 gap-2 border-t border-dark-border bg-dark-surface/90 rounded-b-2xl backdrop-blur"
      >
        <input
          type="text"
          className="
            flex-1 px-3 py-2 rounded-xl bg-dark-background border border-dark-border text-white
            focus:border-blue-500 outline-none transition
          "
          placeholder={`Message ${thread.name}...`}
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="flex items-center gap-1 px-3 py-2 bg-gradient-to-tr from-[#3056ff] to-[#00b1ff] text-white rounded-full font-bold shadow hover:scale-105 hover:from-[#457bff] hover:to-[#00e6ff] transition"
          aria-label="Send"
        >
          <Send className="w-5 h-5 mr-0.5" />
          
        </button>
      </form>
    </motion.div>
  );
}

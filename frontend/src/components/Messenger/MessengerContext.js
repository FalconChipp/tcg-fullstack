// src/components/Messenger/MessengerContext.js
//
// UPDATED (2026-01-30):
// - FIX: Use dedicated Socket.IO path "/realtime/socket.io" to avoid collision with express-status-monitor (socket.io v2)
// - FIX: Force polling + disable websocket upgrade while WS is unstable ("Invalid frame header")
// - ADD: Strong debug logs for connect/connect_error/disconnect + payload visibility
// - FIX: Backend origin resolution supports NEXT_PUBLIC_API_URL + NEXT_PUBLIC_API_BASE_URL
// - KEEP: existing GraphQL fetch logic + optimistic sendMessage
//
// NOTE:
// - Backend Socket.IO must be created with: path: "/realtime/socket.io"
// - This client must connect with the same path.
//

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AuthContext } from "@/components/Auth/AuthProvider";
import { io as socketIo } from "socket.io-client";

const MessengerContext = createContext(null);

const SOCKET_PATH = "/realtime/socket.io"; // ✅ must match backend

function normalizeOriginUrl(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s.replace(/\/+$/, "");
  return `https://${s}`.replace(/\/+$/, "");
}

function getGraphqlEndpoint() {
  const explicit = process.env.NEXT_PUBLIC_BACKEND_GRAPHQL_ENDPOINT;
  if (explicit) return normalizeOriginUrl(explicit);

  const legacy = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;
  if (legacy) return normalizeOriginUrl(legacy);

  const backend = normalizeOriginUrl(process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000");
  return `${backend}/graphql`;
}

function getBackendOrigin() {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (backend) return normalizeOriginUrl(backend);

  const api = process.env.NEXT_PUBLIC_API_URL;
  if (api) return normalizeOriginUrl(api);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (apiBase) return normalizeOriginUrl(apiBase);

  const gql =
    process.env.NEXT_PUBLIC_BACKEND_GRAPHQL_ENDPOINT ||
    process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;

  if (gql) return normalizeOriginUrl(gql).replace(/\/graphql\/?$/, "");

  return normalizeOriginUrl("http://localhost:4000");
}

async function gqlFetch({ token, query, variables }) {
  const endpoint = getGraphqlEndpoint();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json().catch(() => null);
  if (!json) throw new Error("GraphQL: invalid JSON response");

  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join(" | ");
    throw new Error(msg || "GraphQL error");
  }

  return json.data;
}

/* ---------------- GraphQL docs ---------------- */

const Q_MY_CHATS = `
  query MyChats($page: Int, $pageSize: Int) {
    myChats(page: $page, pageSize: $pageSize) {
      user { id username avatar }
      lastMessage { id senderId receiverId content createdAt }
      unreadCount
    }
  }
`;

const Q_CHAT_WITH_USER = `
  query ChatWithUser($userId: ID!, $page: Int, $pageSize: Int) {
    chatWithUser(userId: $userId, page: $page, pageSize: $pageSize) {
      id senderId receiverId content createdAt isRead isSystemMessage meta
    }
  }
`;

const M_SEND_MESSAGE = `
  mutation SendMessage($receiverId: ID!, $content: String!, $meta: JSON) {
    sendMessage(receiverId: $receiverId, content: $content, meta: $meta) {
      id senderId receiverId content createdAt isRead isSystemMessage meta
    }
  }
`;

const M_MARK_CHAT_READ = `
  mutation MarkChatRead($userId: ID!) {
    markChatRead(userId: $userId)
  }
`;

export function MessengerProvider({ children }) {
  const { token, user } = useContext(AuthContext);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const [openChats, setOpenChats] = useState([]);
  const [messagesByUserId, setMessagesByUserId] = useState({});

  const myUserId = user?.id || null;

  // realtime refs
  const socketRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const openChatsRef = useRef(new Set());
  const messagesRef = useRef({});

  useEffect(() => {
    openChatsRef.current = new Set(openChats.map((c) => String(c.userId)));
  }, [openChats]);

  useEffect(() => {
    messagesRef.current = messagesByUserId || {};
  }, [messagesByUserId]);

  const refreshThreads = useCallback(async () => {
    if (!token) {
      setThreads([]);
      return;
    }

    setThreadsLoading(true);
    try {
      const data = await gqlFetch({
        token,
        query: Q_MY_CHATS,
        variables: { page: 1, pageSize: 50 },
      });

      const list = Array.isArray(data?.myChats) ? data.myChats : [];
      setThreads(list);
    } catch (e) {
      console.error("[Messenger] myChats failed:", e);
    } finally {
      setThreadsLoading(false);
    }
  }, [token]);

  // debounce refresh for bursts
  const refreshThreadsSoon = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshThreads().catch(() => {});
    }, 150);
  }, [refreshThreads]);

  const loadChatWithUser = useCallback(
    async (otherUserId) => {
      if (!token || !otherUserId) return [];

      setMessagesByUserId((prev) => {
        const current = prev[otherUserId];
        return {
          ...prev,
          [otherUserId]: {
            loading: true,
            items: Array.isArray(current?.items) ? current.items : [],
          },
        };
      });

      try {
        const data = await gqlFetch({
          token,
          query: Q_CHAT_WITH_USER,
          variables: { userId: otherUserId, page: 1, pageSize: 50 },
        });

        const msgs = Array.isArray(data?.chatWithUser) ? data.chatWithUser : [];

        setMessagesByUserId((prev) => ({
          ...prev,
          [otherUserId]: { loading: false, items: msgs },
        }));

        return msgs;
      } catch (e) {
        console.error("[Messenger] chatWithUser failed:", e);
        setMessagesByUserId((prev) => ({
          ...prev,
          [otherUserId]: { loading: false, items: prev?.[otherUserId]?.items || [] },
        }));
        return [];
      }
    },
    [token]
  );

  const markChatRead = useCallback(
    async (otherUserId) => {
      if (!token || !otherUserId) return;
      try {
        await gqlFetch({
          token,
          query: M_MARK_CHAT_READ,
          variables: { userId: otherUserId },
        });

        setThreads((prev) =>
          prev.map((t) => (t?.user?.id === otherUserId ? { ...t, unreadCount: 0 } : t))
        );
      } catch (e) {
        console.warn("[Messenger] markChatRead failed:", e);
      }
    },
    [token]
  );

  const openChat = useCallback(
    async (otherUserId) => {
      if (!token || !otherUserId || otherUserId === myUserId) return;

      setOpenChats((prev) => {
        const exists = prev.some((c) => c.userId === otherUserId);
        if (exists) {
          return prev.map((c) =>
            c.userId === otherUserId ? { ...c, minimised: false } : c
          );
        }
        return [...prev, { userId: otherUserId, minimised: false }];
      });

      setSidebarOpen(false);

      await loadChatWithUser(otherUserId);
      await markChatRead(otherUserId);
    },
    [token, myUserId, loadChatWithUser, markChatRead]
  );

  const closeChat = useCallback((otherUserId) => {
    setOpenChats((prev) => prev.filter((c) => c.userId !== otherUserId));
  }, []);

  const minimiseChat = useCallback((otherUserId) => {
    setOpenChats((prev) =>
      prev.map((c) => (c.userId === otherUserId ? { ...c, minimised: true } : c))
    );
  }, []);

  const restoreChat = useCallback((otherUserId) => {
    setOpenChats((prev) =>
      prev.map((c) => (c.userId === otherUserId ? { ...c, minimised: false } : c))
    );
  }, []);

  const sendMessage = useCallback(
    async (receiverId, content, meta = null) => {
      if (!token) throw new Error("Not authenticated");
      if (!receiverId) throw new Error("Missing receiverId");

      const clean = String(content || "").trim();
      if (!clean) return null;

      const optimistic = {
        id: `optimistic-${Date.now()}`,
        senderId: myUserId || "me",
        receiverId,
        content: clean,
        createdAt: new Date().toISOString(),
        isRead: false,
        isSystemMessage: false,
        meta,
      };

      // optimistic UI append
      setMessagesByUserId((prev) => {
        const current = prev[receiverId];
        const items = Array.isArray(current?.items) ? current.items : [];
        return { ...prev, [receiverId]: { loading: false, items: [...items, optimistic] } };
      });

      // optimistic thread bump
      setThreads((prev) => {
        const existing = prev.find((t) => t?.user?.id === receiverId);
        const updatedThread = {
          user: existing?.user || { id: receiverId, username: "User", avatar: null },
          lastMessage: { ...optimistic },
          unreadCount: existing?.unreadCount ?? 0,
        };
        const rest = prev.filter((t) => t?.user?.id !== receiverId);
        return [updatedThread, ...rest];
      });

      try {
        const data = await gqlFetch({
          token,
          query: M_SEND_MESSAGE,
          variables: { receiverId, content: clean, meta },
        });

        const saved = data?.sendMessage || null;
        if (!saved) return null;

        setMessagesByUserId((prev) => {
          const current = prev[receiverId];
          const items = Array.isArray(current?.items) ? current.items : [];
          const next = items.map((m) => (m.id === optimistic.id ? saved : m));
          return { ...prev, [receiverId]: { loading: false, items: next } };
        });

        setThreads((prev) => {
          const existing = prev.find((t) => t?.user?.id === receiverId);
          const updatedThread = {
            user: existing?.user || { id: receiverId, username: "User", avatar: null },
            lastMessage: saved,
            unreadCount: existing?.unreadCount ?? 0,
          };
          const rest = prev.filter((t) => t?.user?.id !== receiverId);
          return [updatedThread, ...rest];
        });

        return saved;
      } catch (e) {
        console.error("[Messenger] sendMessage failed:", e);

        // rollback optimistic message
        setMessagesByUserId((prev) => {
          const current = prev[receiverId];
          const items = Array.isArray(current?.items) ? current.items : [];
          return {
            ...prev,
            [receiverId]: { loading: false, items: items.filter((m) => m.id !== optimistic.id) },
          };
        });

        throw e;
      }
    },
    [token, myUserId]
  );

  // load threads on login
  useEffect(() => {
    if (!token) {
      setThreads([]);
      setMessagesByUserId({});
      setOpenChats([]);
      return;
    }
    refreshThreads();
  }, [token, refreshThreads]);

  // ✅ Socket connect + newMessage listener (polling-only for now)
  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const origin = getBackendOrigin();

    // recreate per token (avoid stale auth)
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    console.log("[Messenger] socket env snapshot", {
      origin,
      path: SOCKET_PATH,
      NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
      NEXT_PUBLIC_BACKEND_GRAPHQL_ENDPOINT: process.env.NEXT_PUBLIC_BACKEND_GRAPHQL_ENDPOINT,
    });

    const s = socketIo(origin, {
      path: SOCKET_PATH, // ✅ NEW: avoid status-monitor collision
      auth: { token },

      // ✅ Keep stable while debugging
      transports: ["polling"],
      upgrade: false,

      reconnection: true,
      reconnectionAttempts: 10,
      withCredentials: true,
    });

    socketRef.current = s;

    console.log("[Messenger] creating socket", {
      origin,
      path: SOCKET_PATH,
      transports: ["polling"],
      upgrade: false,
      tokenPresent: !!token,
    });

    s.on("connect", () => console.log("[Messenger] socket connected", { id: s.id }));
    s.on("disconnect", (reason) => console.warn("[Messenger] socket disconnected", reason));
    s.on("connect_error", (err) =>
      console.error("[Messenger] socket connect_error", err?.message || err)
    );

    s.on("newMessage", (payload) => {
      console.log("[Messenger] newMessage", payload);

      const fromIdRaw = payload?.from;
      const fromId = fromIdRaw != null ? String(fromIdRaw) : "";
      if (!fromId) {
        console.warn("[Messenger] newMessage missing from", payload);
        return;
      }

      refreshThreadsSoon();

      // only refresh messages if the chat is open (keeps calls down)
      if (openChatsRef.current.has(fromId)) {
        loadChatWithUser(fromId).catch(() => {});
      }
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [token, refreshThreadsSoon, loadChatWithUser]);

  const value = useMemo(
    () => ({
      sidebarOpen,
      openSidebar: () => setSidebarOpen(true),
      closeSidebar: () => setSidebarOpen(false),

      threads,
      threadsLoading,
      refreshThreads,

      openChats,
      openChat,
      closeChat,
      minimiseChat,
      restoreChat,

      messagesByUserId,
      loadChatWithUser,
      sendMessage,
      markChatRead,
    }),
    [
      sidebarOpen,
      threads,
      threadsLoading,
      refreshThreads,
      openChats,
      openChat,
      closeChat,
      minimiseChat,
      restoreChat,
      messagesByUserId,
      loadChatWithUser,
      sendMessage,
      markChatRead,
    ]
  );

  return <MessengerContext.Provider value={value}>{children}</MessengerContext.Provider>;
}

export function useMessenger() {
  const ctx = useContext(MessengerContext);
  if (!ctx) throw new Error("useMessenger must be used within <MessengerProvider>");
  return ctx;
}

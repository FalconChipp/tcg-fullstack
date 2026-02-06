// src/components/Messenger/MessengerContext.js
//
// UPDATED (2026-02-06):
// - FIX: Report functions were incorrectly declared inside loadChatWithUser (invalid hook usage).
// - FIX: reportUser/reportMessage are now top-level provider actions and exposed via context.
// - REMOVE: reportUser/reportMessage stored inside messagesByUserId buckets (wrong place).
// - FIX: Missing semicolon for M_REPORT_MESSAGE.
// - KEEP: All existing chat logic (pagination, merge, optimistic send, deny handling, socket refresh).

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

  const backend = normalizeOriginUrl(
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"
  );
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

/**
 * GraphQL fetch helper
 * - Throws a rich error object so we can detect chat-denied without crashing the site.
 */
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
  if (!json) {
    const e = new Error("GraphQL: invalid JSON response");
    e.code = "BAD_RESPONSE";
    throw e;
  }

  if (json.errors?.length) {
    const first = json.errors[0] || {};
    const msg = json.errors.map((e) => e.message).join(" | ");
    const e = new Error(msg || "GraphQL error");

    e.graphQLErrors = json.errors;
    e.extensions = first.extensions || null;
    e.code = first.extensions?.code || null;

    throw e;
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

// ✅ Reports
const M_REPORT_USER = `
  mutation ReportUser($userId: ID!, $reason: String!, $details: String) {
    reportUser(userId: $userId, reason: $reason, details: $details)
  }
`;

const M_REPORT_MESSAGE = `
  mutation ReportMessage($messageId: ID!, $reason: String!, $details: String) {
    reportMessage(messageId: $messageId, reason: $reason, details: $details)
  }
`;

function getExtensionsFromError(err) {
  return err?.extensions || err?.graphQLErrors?.[0]?.extensions || null;
}

function isChatDeniedError(err) {
  const ext = getExtensionsFromError(err);
  const code = ext?.code || err?.code || null;
  const msg = String(err?.message || "");

  if (code === "CAPABILITY_DENIED") return true;
  if (code === "CHAT_AGREEMENT_REQUIRED") return true;
  if (code === "CHAT_BANNED") return true;

  if (msg === "Chat access denied") return true;
  if (msg.includes("Chat access denied")) return true;

  return false;
}

function extractChatDeniedMeta(err) {
  const ext = getExtensionsFromError(err) || {};
  return {
    message: err?.message || "Chat is restricted for this account.",
    code: ext?.code || err?.code || null,
    capability: ext?.capability || null,
    restrictionLevel: ext?.restrictionLevel || null,
  };
}

export function MessengerProvider({ children }) {
  const { token, user } = useContext(AuthContext);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const [openChats, setOpenChats] = useState([]);
  const [messagesByUserId, setMessagesByUserId] = useState({});

  const myUserId = user?.id || null;

  const [chatDenied, setChatDenied] = useState(false);
  const [chatDeniedMeta, setChatDeniedMeta] = useState(null);

  // realtime refs
  const socketRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const openChatsRef = useRef(new Set());
  const messagesRef = useRef({});

  const pauseAutoRefreshRef = useRef(false);

  const clearChatDenied = useCallback(() => {
    pauseAutoRefreshRef.current = false;
    setChatDenied(false);
    setChatDeniedMeta(null);
  }, []);

  const handleChatDenied = useCallback((err) => {
    if (!isChatDeniedError(err)) return false;

    const meta = extractChatDeniedMeta(err);

    pauseAutoRefreshRef.current = true;
    setChatDenied(true);
    setChatDeniedMeta(meta);

    return true;
  }, []);

  useEffect(() => {
    openChatsRef.current = new Set(openChats.map((c) => String(c.userId)));
  }, [openChats]);

  useEffect(() => {
    messagesRef.current = messagesByUserId || {};
  }, [messagesByUserId]);

  useEffect(() => {
    if (!token) {
      pauseAutoRefreshRef.current = false;
      setChatDenied(false);
      setChatDeniedMeta(null);
      return;
    }
    pauseAutoRefreshRef.current = false;
    setChatDenied(false);
    setChatDeniedMeta(null);
  }, [token]);

  const refreshThreads = useCallback(
    async ({ force = false } = {}) => {
      if (!token) {
        setThreads([]);
        return;
      }

      if (pauseAutoRefreshRef.current && !force) return;

      setThreadsLoading(true);
      try {
        const data = await gqlFetch({
          token,
          query: Q_MY_CHATS,
          variables: { page: 1, pageSize: 50 },
        });

        const list = Array.isArray(data?.myChats) ? data.myChats : [];
        setThreads(list);

        pauseAutoRefreshRef.current = false;
        setChatDenied(false);
        setChatDeniedMeta(null);
      } catch (e) {
        const denied = handleChatDenied(e);
        if (!denied) console.error("[Messenger] myChats failed:", e);
      } finally {
        setThreadsLoading(false);
      }
    },
    [token, handleChatDenied]
  );

  const refreshThreadsSoon = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshThreads().catch(() => {});
    }, 150);
  }, [refreshThreads]);

  const loadChatWithUser = useCallback(
    async (otherUserId, { force = false, page = 1, pageSize = 50, mode = "replace" } = {}) => {
      if (!token || !otherUserId) return [];
      if (pauseAutoRefreshRef.current && !force) return [];

      const userId = String(otherUserId);

      setMessagesByUserId((prev) => {
        const current = prev[userId];
        const currentItems = Array.isArray(current?.items) ? current.items : [];
        return {
          ...prev,
          [userId]: {
            loading: true,
            items: currentItems,
            page: Number.isFinite(current?.page) ? current.page : 1,
            pageSize: Number.isFinite(current?.pageSize) ? current.pageSize : pageSize,
            hasMore: typeof current?.hasMore === "boolean" ? current.hasMore : true,
          },
        };
      });

      try {
        const data = await gqlFetch({
          token,
          query: Q_CHAT_WITH_USER,
          variables: { userId, page, pageSize },
        });

        const msgs = Array.isArray(data?.chatWithUser) ? data.chatWithUser : [];

        setMessagesByUserId((prev) => {
          const current = prev[userId];
          const existing = Array.isArray(current?.items) ? current.items : [];

          let merged = [];
          if (mode === "replace") merged = msgs;
          else if (mode === "prepend") merged = [...msgs, ...existing];
          else merged = [...existing, ...msgs];

          const byId = new Map();
          for (const m of merged) {
            if (!m || !m.id) continue;
            byId.set(String(m.id), m);
          }

          const clientOnly = merged.filter((m) => m && !m.id);
          const deduped = [...byId.values(), ...clientOnly];

          deduped.sort((a, b) => {
            const ta = new Date(a?.createdAt || 0).getTime();
            const tb = new Date(b?.createdAt || 0).getTime();
            return ta - tb;
          });

          const hasMore = msgs.length >= pageSize;

          return {
            ...prev,
            [userId]: {
              loading: false,
              items: deduped,
              page,
              pageSize,
              hasMore,
            },
          };
        });

        pauseAutoRefreshRef.current = false;
        setChatDenied(false);
        setChatDeniedMeta(null);

        return msgs;
      } catch (e) {
        const denied = handleChatDenied(e);
        if (!denied) console.error("[Messenger] chatWithUser failed:", e);

        setMessagesByUserId((prev) => {
          const current = prev[userId];
          return {
            ...prev,
            [userId]: {
              ...(current || {}),
              loading: false,
              items: Array.isArray(current?.items) ? current.items : [],
              page: Number.isFinite(current?.page) ? current.page : 1,
              pageSize: Number.isFinite(current?.pageSize) ? current.pageSize : pageSize,
              hasMore: typeof current?.hasMore === "boolean" ? current.hasMore : true,
            },
          };
        });

        return [];
      }
    },
    [token, handleChatDenied]
  );

  const loadMoreChatWithUser = useCallback(
    async (otherUserId, { force = false } = {}) => {
      if (!token || !otherUserId) return [];
      const userId = String(otherUserId);

      const current = messagesRef.current?.[userId];
      const page = Number.isFinite(current?.page) ? current.page : 1;
      const pageSize = Number.isFinite(current?.pageSize) ? current.pageSize : 50;
      const hasMore = typeof current?.hasMore === "boolean" ? current.hasMore : true;

      if (!hasMore) return [];
      if (current?.loading) return [];

      return loadChatWithUser(userId, { force, page: page + 1, pageSize, mode: "prepend" });
    },
    [token, loadChatWithUser]
  );

  const markChatRead = useCallback(
    async (otherUserId) => {
      if (!token || !otherUserId) return;
      if (pauseAutoRefreshRef.current) return;

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
        const denied = handleChatDenied(e);
        if (!denied) console.warn("[Messenger] markChatRead failed:", e);
      }
    },
    [token, handleChatDenied]
  );

  const openChat = useCallback(
    async (otherUserId) => {
      if (!token || !otherUserId) return;

      setOpenChats((prev) => {
        const already = prev.find((c) => String(c.userId) === String(otherUserId));
        if (already) {
          return prev.map((c) =>
            String(c.userId) === String(otherUserId) ? { ...c, minimised: false } : c
          );
        }
        return [...prev, { userId: otherUserId, minimised: false }];
      });

      loadChatWithUser(otherUserId, { page: 1, pageSize: 50, mode: "replace" }).catch(() => {});
      markChatRead(otherUserId).catch(() => {});
    },
    [token, loadChatWithUser, markChatRead]
  );

  const closeChat = useCallback((otherUserId) => {
    setOpenChats((prev) => prev.filter((c) => String(c.userId) !== String(otherUserId)));
  }, []);

  const minimiseChat = useCallback((otherUserId) => {
    setOpenChats((prev) =>
      prev.map((c) => (String(c.userId) === String(otherUserId) ? { ...c, minimised: true } : c))
    );
  }, []);

  const restoreChat = useCallback((otherUserId) => {
    setOpenChats((prev) =>
      prev.map((c) => (String(c.userId) === String(otherUserId) ? { ...c, minimised: false } : c))
    );
  }, []);

  const sendMessage = useCallback(
    async (receiverId, content, meta = null, { _retryClientId = null } = {}) => {
      if (!token) return null;
      if (!receiverId) return null;
      if (pauseAutoRefreshRef.current) return null;

      const clean = String(content || "").trim();
      if (!clean) return null;

      const clientId =
        _retryClientId || `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const optimistic = {
        id: `optimistic-${Date.now()}`,
        __clientId: clientId,
        __status: "sending",
        __error: null,
        senderId: myUserId || "me",
        receiverId,
        content: clean,
        createdAt: new Date().toISOString(),
        isRead: false,
        isSystemMessage: false,
        meta,
      };

      setMessagesByUserId((prev) => {
        const current = prev[receiverId];
        const items = Array.isArray(current?.items) ? current.items : [];
        const withoutSameClient = items.filter((m) => m?.__clientId !== clientId);
        return {
          ...prev,
          [receiverId]: {
            ...(current || {}),
            loading: false,
            items: [...withoutSameClient, optimistic],
          },
        };
      });

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
          const next = items.map((m) => {
            if (m?.__clientId === clientId) return saved;
            if (m?.id === optimistic.id) return saved;
            return m;
          });
          return { ...prev, [receiverId]: { ...(current || {}), loading: false, items: next } };
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

        pauseAutoRefreshRef.current = false;
        setChatDenied(false);
        setChatDeniedMeta(null);

        return saved;
      } catch (e) {
        console.error("[Messenger] sendMessage failed:", e);

        setMessagesByUserId((prev) => {
          const current = prev[receiverId];
          const items = Array.isArray(current?.items) ? current.items : [];
          const next = items.map((m) => {
            if (m?.__clientId === clientId || m?.id === optimistic.id) {
              return { ...m, __status: "failed", __error: e?.message || "Failed to send" };
            }
            return m;
          });
          return { ...prev, [receiverId]: { ...(current || {}), loading: false, items: next } };
        });

        const denied = handleChatDenied(e);
        if (denied) return null;

        return null;
      }
    },
    [token, myUserId, handleChatDenied]
  );

  const retryFailedMessage = useCallback(
    async (receiverId, clientId) => {
      if (!token || !receiverId || !clientId) return null;

      const bucket = messagesRef.current?.[receiverId];
      const items = Array.isArray(bucket?.items) ? bucket.items : [];
      const msg = items.find((m) => m?.__clientId === clientId);

      if (!msg) return null;
      if (msg?.__status !== "failed") return null;

      return sendMessage(receiverId, msg.content, msg.meta || null, { _retryClientId: clientId });
    },
    [token, sendMessage]
  );

  // ✅ NEW: Report actions (top-level, proper hooks)
  const reportUser = useCallback(
    async (userId, reason, details = null) => {
      if (!token) throw new Error("Not logged in.");
      if (!userId) throw new Error("Missing user id.");
      if (!reason) throw new Error("Missing reason.");

      try {
        const data = await gqlFetch({
          token,
          query: M_REPORT_USER,
          variables: { userId, reason, details },
        });

        if (!data?.reportUser) throw new Error("Report could not be submitted.");
        return true;
      } catch (e) {
        const denied = handleChatDenied(e);
        if (denied) throw new Error("Chat is restricted for this account.");
        throw e;
      }
    },
    [token, handleChatDenied]
  );

  const reportMessage = useCallback(
    async (messageId, reason, details = null) => {
      if (!token) throw new Error("Not logged in.");
      if (!messageId) throw new Error("Missing message id.");
      if (!reason) throw new Error("Missing reason.");

      try {
        const data = await gqlFetch({
          token,
          query: M_REPORT_MESSAGE,
          variables: { messageId, reason, details },
        });

        if (!data?.reportMessage) throw new Error("Report could not be submitted.");
        return true;
      } catch (e) {
        const denied = handleChatDenied(e);
        if (denied) throw new Error("Chat is restricted for this account.");
        throw e;
      }
    },
    [token, handleChatDenied]
  );

  useEffect(() => {
    if (!token) {
      setThreads([]);
      setMessagesByUserId({});
      setOpenChats([]);
      clearChatDenied();
      return;
    }
    refreshThreads();
  }, [token, refreshThreads, clearChatDenied]);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const origin = getBackendOrigin();

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const s = socketIo(origin, {
      path: SOCKET_PATH,
      auth: { token },
      transports: ["polling"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 10,
      withCredentials: true,
    });

    socketRef.current = s;

    s.on("connect", () => console.log("[Messenger] socket connected", { id: s.id }));
    s.on("disconnect", (reason) => console.warn("[Messenger] socket disconnected", reason));
    s.on("connect_error", (err) =>
      console.error("[Messenger] socket connect_error", err?.message || err)
    );

    s.on("newMessage", (payload) => {
      const fromIdRaw = payload?.from;
      const fromId = fromIdRaw != null ? String(fromIdRaw) : "";
      if (!fromId) return;

      if (!pauseAutoRefreshRef.current) {
        refreshThreadsSoon();

        if (openChatsRef.current.has(fromId)) {
          loadChatWithUser(fromId, {
            force: true,
            page: 1,
            pageSize: 50,
            mode: "merge",
          }).catch(() => {});
        }
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

      chatDenied,
      chatDeniedMeta,
      clearChatDenied,

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
      loadMoreChatWithUser,
      sendMessage,
      retryFailedMessage,
      markChatRead,

      // ✅ Expose reporting to the popup
      reportUser,
      reportMessage,
    }),
    [
      sidebarOpen,
      chatDenied,
      chatDeniedMeta,
      clearChatDenied,
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
      loadMoreChatWithUser,
      sendMessage,
      retryFailedMessage,
      markChatRead,
      reportUser,
      reportMessage,
    ]
  );

  return <MessengerContext.Provider value={value}>{children}</MessengerContext.Provider>;
}

export function useMessenger() {
  const ctx = useContext(MessengerContext);
  if (!ctx) throw new Error("useMessenger must be used within <MessengerProvider>");
  return ctx;
}

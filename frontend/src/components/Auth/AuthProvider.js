"use client";

import React, { createContext, useState, useEffect, useCallback } from "react";
import { getCookie, setCookie } from "@/utils/cookieUtils";

function deleteCookie(name) {
  document.cookie = `${name}=; Max-Age=-99999999; path=/;`;
}

const API_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;
// NEW: backend REST base (your Express server)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- Fetch current user using 'me' query with all needed fields ---
  const fetchUser = useCallback(
    async (currentToken) => {
      if (!currentToken) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(API_GRAPHQL_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({
            query: `
              query {
                me {
                  id
                  username
                  email
                  emailVerified
                  lastLogin
                  createdAt
                  updatedAt
                  mfaEnabled
                  oauthProvider
                  oauthId
                  discordId
                  discordUsername
                }
              }
            `,
          }),
        });
        const json = await res.json();
        if (json?.data?.me) {
          setUser(json.data.me);
        } else {
          const msg = json.errors?.[0]?.message?.toLowerCase() || "";
          if (msg.includes("unauthorized") || msg.includes("invalid token") || msg.includes("forbidden") || msg.includes("expired")) {
            deleteCookie("authToken");
            setToken(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error("AuthProvider: Error fetching user:", error);
      }
      setLoading(false);
    },
    []
  );

  // On mount: check token in cookie, load user.
  useEffect(() => {
    const currentToken = getCookie("authToken");
    setToken(currentToken || null);
    fetchUser(currentToken);
  }, [fetchUser]);

  // Poll for cookie token changes (multi-tab)
  useEffect(() => {
    const interval = setInterval(() => {
      const currentToken = getCookie("authToken");
      if (currentToken !== token) {
        setToken(currentToken || null);
        fetchUser(currentToken);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [token, fetchUser]);

  // NEW: call backend to set an HttpOnly cookie for REST routes (sbf_token)
  async function ensureBackendSession(jwt) {
    if (!jwt) return;
    try {
      await fetch(`${API_BASE_URL}/auth/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",              // IMPORTANT: let browser store HttpOnly cookie
        body: JSON.stringify({ token: jwt }),
      });
      // No response data needed. Cookie is set by the server.
    } catch (e) {
      console.warn("Failed to set backend session cookie:", e);
    }
  }

  // Unified login/register handler
  const authMutation = async (mutation, variables) => {
    try {
      const res = await fetch(API_GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: mutation, variables }),
      });
      const json = await res.json();
      const key = Object.keys(json.data || {})[0];
      const payload = json.data?.[key];
      if (!payload) throw new Error(json.errors?.[0]?.message || "Unknown error");
      if (payload.token && payload.user) {
        updateToken(payload.token);       // CHANGED: will also set HttpOnly cookie
        setUser(payload.user);
        return { success: true, user: payload.user };
      }
      throw new Error("Invalid response from server");
    } catch (error) {
      return { error: error.message || "Failed to login/register" };
    }
  };

  // CHANGED: after setting cookie token for GraphQL, also set HttpOnly session cookie for REST
  const updateToken = (newToken) => {
    setToken(newToken);
    setCookie("authToken", newToken, { path: "/", maxAge: 86400 });
    // NEW: make sure backend sees req.user on normal browser requests
    ensureBackendSession(newToken);
    fetchUser(newToken);
  };

  const logout = () => {
    deleteCookie("authToken");
    // (optional) clear HttpOnly cookie on the backend too:
    fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" })
      .catch(() => {});
    setToken(null);
    setUser(null);
  };

  // NEW: one-call helper to kick off Discord linking
  // Option A (recommended): fetch URL from backend (requires req.user) then redirect
  const connectDiscord = async (returnPath = "/account?tab=security") => {
    try {
      const r = await fetch(`${API_BASE_URL}/auth/discord/start-url?return=${encodeURIComponent(returnPath)}`, {
        method: "GET",
        credentials: "include", // send sbf_token cookie so backend knows req.user
      });
      const { url } = await r.json();
      if (url) window.location.href = url;
    } catch (e) {
      console.error("Failed to get Discord start URL:", e);
      // Fallback: direct navigate to start (works only if cookie already set)
      window.location.href = `${API_BASE_URL}/auth/discord/start?return=${encodeURIComponent(returnPath)}`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="text-xl text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        updateToken,
        logout,
        loading,
        connectDiscord, // NEW: expose this to your UI
        login: async (identifier, password, mfaToken) =>
          authMutation(
            `
              mutation Login($email: String, $username: String, $password: String!, $mfaToken: String) {
                login(email: $email, username: $username, password: $password, mfaToken: $mfaToken) {
                  token
                  user {
                    id
                    username
                    email
                    emailVerified
                    lastLogin
                    createdAt
                    updatedAt
                    avatar
                    mfaEnabled
                    oauthProvider
                    oauthId
                  }
                }
              }
            `,
            identifier.includes("@")
              ? { email: identifier, password, mfaToken }
              : { username: identifier, password, mfaToken }
          ),
        register: async (email, username, password) =>
          authMutation(
            `
              mutation Register($email: String!, $username: String!, $password: String!) {
                register(email: $email, username: $username, password: $password) {
                  token
                  user {
                    id
                    username
                    email
                    emailVerified
                    lastLogin
                    createdAt
                    updatedAt
                    avatar
                    mfaEnabled
                    oauthProvider
                    oauthId
                  }
                }
              }
            `,
            { email, username, password }
          ),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

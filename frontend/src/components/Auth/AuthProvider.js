"use client";

import React, { createContext, useState, useEffect, useCallback, useRef } from "react";
import { getCookie, setCookie } from "@/utils/cookieUtils";
import { getApiBase, getGraphqlUrl } from "@/utils/apiClient";
import { devError } from "@/utils/devLog";

// How long (ms) to wait before proactively refreshing — 13 min, giving 2 min
// buffer before the 15-minute JWT expiry.
const REFRESH_INTERVAL_MS = 13 * 60 * 1000;

// Cookie lifetime for the JS-readable authToken — match the refresh token window
// so the cookie never expires while the session is still valid.
const AUTH_COOKIE_DAYS = 30;

function deleteCookie(name) {
  document.cookie = `${name}=; Max-Age=-99999999; path=/;`;
}


export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  const storeToken = useCallback((t) => {
    setToken(t);
    if (t) {
      setCookie("authToken", t, AUTH_COOKIE_DAYS);
    } else {
      deleteCookie("authToken");
    }
  }, []);

  // --- Silent refresh: hit /auth/refresh (uses sbf_refresh HttpOnly cookie) ---
  // Returns the new access token string, or null on failure.
  const silentRefresh = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.accessToken ?? null;
    } catch {
      return null;
    }
  }, []);

  // Schedule the next proactive refresh 13 minutes from now.
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      const newToken = await silentRefresh();
      if (newToken) {
        storeToken(newToken);
        scheduleRefresh();
      } else {
        // Refresh token expired — clear session
        storeToken(null);
        setUser(null);
      }
    }, REFRESH_INTERVAL_MS);
  }, [silentRefresh, storeToken]);

  // --- Fetch current user using 'me' query with all needed fields ---
  const fetchUser = useCallback(
    async (currentToken) => {
      if (!currentToken) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(getGraphqlUrl(), {
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
          setLoading(false);
          return;
        }
        const msg = json.errors?.[0]?.message?.toLowerCase() || "";
        if (msg.includes("unauthorized") || msg.includes("invalid token") || msg.includes("forbidden") || msg.includes("expired")) {
          // Token is expired — try a silent refresh before giving up
          const newToken = await silentRefresh();
          if (newToken) {
            storeToken(newToken);
            scheduleRefresh();
            // Re-fetch with fresh token
            await fetchUser(newToken);
            return;
          }
          storeToken(null);
          setUser(null);
        }
      } catch (error) {
        devError("AuthProvider: Error fetching user:", error);
      }
      setLoading(false);
    },
    [silentRefresh, storeToken, scheduleRefresh]
  );

  // On mount: try a silent refresh first to get a guaranteed-fresh token,
  // then fall back to the stored authToken cookie.
  useEffect(() => {
    async function init() {
      const refreshed = await silentRefresh();
      if (refreshed) {
        storeToken(refreshed);
        await fetchUser(refreshed);
        scheduleRefresh();
      } else {
        // No valid refresh token — use whatever's in the cookie (may still be valid)
        const stored = getCookie("authToken");
        storeToken(stored || null);
        await fetchUser(stored || null);
      }
    }
    init();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for cookie token changes across tabs (e.g. login in another tab).
  // If the cookie disappears while we have an active session, try a silent
  // refresh before giving up — avoids spurious logouts from cookie expiry.
  useEffect(() => {
    const interval = setInterval(async () => {
      const currentToken = getCookie("authToken");
      if (currentToken !== token) {
        if (!currentToken && token) {
          // Cookie gone but we think we're logged in — try refresh first
          const refreshed = await silentRefresh();
          if (refreshed) {
            storeToken(refreshed);
            scheduleRefresh();
            return;
          }
        }
        storeToken(currentToken || null);
        fetchUser(currentToken || null);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [token, fetchUser, storeToken, silentRefresh, scheduleRefresh]);

  // Unified login/register handler
  const authMutation = async (mutation, variables) => {
    try {
      const res = await fetch(getGraphqlUrl(), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: mutation, variables }),
      });
      const json = await res.json();
      const key = Object.keys(json.data || {})[0];
      const payload = json.data?.[key];
      if (!payload) throw new Error(json.errors?.[0]?.message || "Unknown error");
      if (payload.token && payload.user) {
        updateToken(payload.token);
        setUser(payload.user);
        return { success: true, user: payload.user };
      }
      throw new Error("Invalid response from server");
    } catch (error) {
      return { error: error.message || "Failed to login/register" };
    }
  };

  const updateToken = (newToken) => {
    storeToken(newToken);
    scheduleRefresh();
    fetchUser(newToken);
  };

  const logout = (currentToken) => {
    const t = currentToken || token;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    storeToken(null);
    setUser(null);
    fetch(`${getApiBase()}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    }).catch(() => {});
  };

  const connectDiscord = async (returnPath = "/account?tab=security") => {
    try {
      const r = await fetch(`${getApiBase()}/auth/discord/start-url?return=${encodeURIComponent(returnPath)}`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const { url } = await r.json();
      if (url) window.location.href = url;
    } catch (e) {
      devError("Failed to get Discord start URL:", e);
      window.location.href = `${getApiBase()}/auth/discord/start?return=${encodeURIComponent(returnPath)}`;
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

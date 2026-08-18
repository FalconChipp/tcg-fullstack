"use client";

import React, { useState, useEffect, useCallback, useContext } from "react";
import { getGraphqlUrl } from "@/utils/apiClient";
import { AuthContext } from "@/components/Auth/AuthProvider";

/* ─── GQL ────────────────────────────────────────────────────────────────── */

const AUDIT_LOGS_QUERY = `
  query AuditLogs($userId: ID, $action: String, $targetType: String, $page: Int, $pageSize: Int) {
    auditLogs(userId: $userId, action: $action, targetType: $targetType, page: $page, pageSize: $pageSize) {
      id userId action targetId targetType details ip createdAt
    }
  }
`;

async function gql(query, variables, token) {
  const res = await fetch(getGraphqlUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(iso));
};

const ACTION_COLOURS = {
  login:           "text-sky-400",
  logout:          "text-neutral-400",
  ban:             "text-rose-400",
  unban:           "text-emerald-400",
  delete:          "text-rose-400",
  create:          "text-emerald-400",
  update:          "text-amber-400",
  admin:           "text-purple-400",
};

function actionColour(action = "") {
  const key = Object.keys(ACTION_COLOURS).find((k) => action.toLowerCase().includes(k));
  return key ? ACTION_COLOURS[key] : "text-neutral-300";
}

const PAGE_SIZE = 25;

const TARGET_TYPES = ["", "user", "listing", "order", "trade", "subscription", "binder", "notification"];

/* ─── Main panel ─────────────────────────────────────────────────────────── */

export default function AdminAuditLogsPanel() {
  const { token } = useContext(AuthContext);

  const [logs,       setLogs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(false);

  /* filters */
  const [userId,     setUserId]     = useState("");
  const [action,     setAction]     = useState("");
  const [targetType, setTargetType] = useState("");

  /* expanded row */
  const [expanded,   setExpanded]   = useState(null);

  const load = useCallback(async (pg = 1) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const vars = {
        page: pg,
        pageSize: PAGE_SIZE,
        ...(userId.trim()     ? { userId: userId.trim() }         : {}),
        ...(action.trim()     ? { action: action.trim() }         : {}),
        ...(targetType.trim() ? { targetType: targetType.trim() } : {}),
      };
      const data = await gql(AUDIT_LOGS_QUERY, vars, token);
      const rows = data?.auditLogs ?? [];
      setLogs(rows);
      setPage(pg);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, userId, action, targetType]);

  useEffect(() => { load(1); }, [load]);

  function handleSearch(e) {
    e.preventDefault();
    load(1);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-neutral-50">Audit Logs</h2>
        <p className="text-xs text-neutral-500 mt-0.5">All admin and system actions, newest first.</p>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="uuid…"
            className="h-8 px-3 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-sky-500 w-52"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600">Action</label>
          <input
            type="text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="e.g. ban_user"
            className="h-8 px-3 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-sky-500 w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600">Target type</label>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="h-8 px-3 rounded-lg border border-white/[0.08] bg-[#0f1117] text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>{t || "All types"}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-8 px-4 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => { setUserId(""); setAction(""); setTargetType(""); }}
          className="h-8 px-3 rounded-lg text-xs font-semibold border border-white/[0.08] text-neutral-500 hover:text-neutral-200 transition"
        >
          Clear
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs px-4 py-2">{error}</div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : !logs.length ? (
          <div className="p-10 text-center text-sm text-neutral-500">No audit log entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-600 border-b border-white/[0.06]">
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">User ID</th>
                  <th className="px-4 py-3 font-semibold">Target</th>
                  <th className="px-4 py-3 font-semibold">IP</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr
                      className="hover:bg-white/[0.02] transition cursor-pointer"
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                    >
                      <td className="px-4 py-2.5 text-neutral-500 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                      <td className={`px-4 py-2.5 font-mono font-semibold whitespace-nowrap ${actionColour(log.action)}`}>
                        {log.action || "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-neutral-500 max-w-[120px] truncate">
                        {log.userId || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-400 whitespace-nowrap">
                        {log.targetType
                          ? <span>{log.targetType}{log.targetId ? <span className="text-neutral-600"> · {log.targetId.slice(0, 8)}…</span> : ""}</span>
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-neutral-600">{log.ip || "—"}</td>
                      <td className="px-4 py-2.5 text-neutral-500">
                        {log.details
                          ? <span className="underline decoration-dotted text-neutral-400">
                              {expanded === log.id ? "hide" : "show"}
                            </span>
                          : "—"}
                      </td>
                    </tr>
                    {expanded === log.id && log.details && (
                      <tr className="bg-white/[0.02]">
                        <td colSpan={6} className="px-4 py-3">
                          <pre className="text-[10px] text-neutral-400 whitespace-pre-wrap break-all font-mono bg-black/30 rounded-lg p-3 max-h-48 overflow-y-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {(page > 1 || hasMore) && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => load(page - 1)}
              disabled={page === 1 || loading}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/[0.06] text-neutral-500 hover:text-neutral-200 transition disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-xs text-neutral-600">Page {page}</span>
            <button
              type="button"
              onClick={() => load(page + 1)}
              disabled={!hasMore || loading}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/[0.06] text-neutral-500 hover:text-neutral-200 transition disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

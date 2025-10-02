// src/modules/cardsearch/admin/adminScript.js
// Admin UI script for Card Search module.
// - No external dependencies
// - Expects the markup/IDs from adminPage.html
// - Talks to /admin/cardsearch endpoints (change BASE if you mounted elsewhere)

(() => {
  "use strict";

  // ====== CONFIG ============================================================
  const BASE = "/admin/cardsearch";
  const TOKEN_KEY = "CARDSEARCH_ADMIN_TOKEN";

  const $ = (sel, root = document) => root.querySelector(sel);
  const toastBox = $("#toast");
  let fxState = null;

  // ====== TOKEN STORAGE =====================================================
  const getToken = () => (localStorage.getItem(TOKEN_KEY) || "").trim();
  const setToken = (value) => localStorage.setItem(TOKEN_KEY, (value || "").trim());
  const clearToken = () => localStorage.removeItem(TOKEN_KEY);

  // ====== UI HELPERS ========================================================
  function toast(message, kind = "ok") {
    if (!toastBox) return;
    const div = document.createElement("div");
    div.className = "t " + (kind || "ok");
    div.textContent = message;
    toastBox.appendChild(div);
    setTimeout(() => div.remove(), 4500);
  }

  function setTokenStatus() {
    const el = $("#tokenStatus");
    if (!el) return;
    const token = getToken();
    if (token) {
      el.textContent = "token saved";
      el.className = "token-ind ok";
    } else {
      el.textContent = "no token";
      el.className = "token-ind";
    }
  }

  async function jfetch(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": getToken(),
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) {
      let text = "";
      try { text = await res.text(); } catch {}
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.text();
  }

  const isoToday = () => new Date().toISOString().slice(0, 10);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
  const fmtDt = (s) => {
    if (!s) return "-";
    try {
      return new Date(s).toLocaleString();
    } catch {
      return String(s);
    }
  };

  // ====== TASK LIST =========================================================
  async function loadTasks() {
    const data = await jfetch(`${BASE}/scheduler/tasks`).catch((err) => {
      toast(`Load tasks failed: ${err.message}`, "err");
      return { tasks: [] };
    });
    const tasks = Array.isArray(data) ? data : (data?.tasks || []);
    const kpiTasks = $("#kpiTasks");
    if (kpiTasks) kpiTasks.textContent = String(tasks.length);
    renderTasks(tasks);
  }

  function renderTasks(tasks) {
    const tbody = $("#tasksTbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!tasks.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">No tasks.</td></tr>`;
      return;
    }

    for (const task of tasks) {
      const row = document.createElement("tr");
      const statusChip = `<span class="chip ${chipClass(task.status)}">${esc(task.status)}</span>`;
      const lastNext = `<div>${fmtDt(task.lastRunAt)}</div><div class="muted small">next: ${fmtDt(task.nextRunAt)}</div>`;

      row.innerHTML = `
        <td><div class="mono">${esc(task.name)}</div><div class="muted small">${esc(task.id)}</div></td>
        <td>${describePlan(task.plan)}</td>
        <td>${statusChip}</td>
        <td>${lastNext}</td>
        <td class="small">${task.tries ?? 0}</td>
        <td class="right">
          <button class="btn" data-action="run" data-id="${esc(task.id)}">Run now</button>
          <button class="btn" data-action="pause" data-id="${esc(task.id)}">Pause</button>
          <button class="btn" data-action="resume" data-id="${esc(task.id)}">Resume</button>
          <button class="btn-warn" data-action="cancel" data-id="${esc(task.id)}">Remove</button>
        </td>
      `;
      tbody.appendChild(row);
    }
  }

  function renderFxRates(data) {
    const meta = $("#fxMeta");
    const tbody = $("#fxRatesTbody");
    if (meta) {
      const base = data?.base || "EUR";
      const date = data?.date || "–";
      meta.textContent = `Base ${base} • Date ${date}`;
    }
    if (!tbody) return;
    const rates = data?.rates && typeof data.rates === "object" ? data.rates : {};
    const wanted = ["GBP", "USD", "EUR"];
    const entries = wanted
      .map((ccy) => [ccy, rates[ccy]])
      .filter(([, rate]) => rate != null);
    tbody.innerHTML = "";
    if (!entries.length) {
      tbody.innerHTML = `<tr><td colspan="2" class="muted">No rates.</td></tr>`;
      return;
    }
    for (const [ccy, rate] of entries) {
      const num = Number(rate);
      const display = Number.isFinite(num) ? num.toFixed(6) : esc(rate);
      const row = document.createElement("tr");
      row.innerHTML = `<td class="mono">${esc(ccy)}</td><td>${display}</td>`;
      tbody.appendChild(row);
    }
  }

  function currentFxDateValue() {
    const input = $("#fxDate");
    if (!input) return undefined;
    const value = input.value ? input.value.trim() : "";
    return value || undefined;
  }

  async function loadFxRates(date) {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    const url = params.toString() ? `${BASE}/fx/rates?${params.toString()}` : `${BASE}/fx/rates`;
    const data = await jfetch(url).catch((err) => {
      toast(`FX fetch failed: ${err.message}`, "err");
      return null;
    });
    if (!data) return;
    fxState = data;
    const input = $("#fxDate");
    if (input && !date && data?.date) input.value = data.date;
    renderFxRates(data);
  }

  function describePlan(plan) {
    if (!plan) return "-";
    if (plan.kind === "cron") {
      const tz = plan.timezone ? ` <span class="mono small">${esc(plan.timezone)}</span>` : "";
      const desc = plan.description ? `<div class="muted small">${esc(plan.description)}</div>` : "";
      return `cron <span class="mono">${esc(plan.expr)}</span>${tz}${desc}`;
    }
    if (plan.kind === "every") return `every ${esc(plan.everyMs ?? "?")}ms`;
    if (plan.kind === "once") return "once";
    return esc(plan.kind ?? "-");
  }

  function chipClass(status = "") {
    switch (status.toLowerCase()) {
      case "running": return "busy";
      case "error": return "err";
      case "paused": return "warn";
      default: return "ok";
    }
  }

  async function onTasksClick(event) {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");
    if (!id || !action) return;

    try {
      if (action === "run") {
        await jfetch(`${BASE}/scheduler/run-now/${id}`, { method: "POST" });
        toast(`Triggered ${id}`);
      } else if (action === "pause") {
        await jfetch(`${BASE}/scheduler/pause/${id}`, { method: "POST" });
        toast(`Paused ${id}`);
      } else if (action === "resume") {
        await jfetch(`${BASE}/scheduler/resume/${id}`, { method: "POST" });
        toast(`Resumed ${id}`);
      } else if (action === "cancel") {
        await jfetch(`${BASE}/scheduler/${id}`, { method: "DELETE" });
        toast(`Removed ${id}`);
      }
    } catch (err) {
      toast(err.message || String(err), "err");
    } finally {
      loadTasks().catch(() => {});
    }
  }

  // ====== JOB ACTIONS =======================================================
  async function runFxDaily() {
    const backfillRaw = Number.parseInt($("#fxBackfill")?.value || "0", 10);
    const body = { kind: "FX_DAILY" };
    if (Number.isFinite(backfillRaw) && backfillRaw > 0) body.backfillFxDays = backfillRaw;
    await jfetch(`${BASE}/run-job`, { method: "POST", body: JSON.stringify(body) });
    toast("FX daily started");
  }

  async function runIngestSet() {
    const set = $("#ingestSetInput")?.value.trim();
    if (!set) return toast("Provide a set input", "warn");
    const refreshSet = $("#ingestRefresh")?.value === "true";
    const dryRun = $("#ingestDry")?.value === "true";
    const body = { kind: "INGEST_SET", set, refreshSet, dryRun };
    await jfetch(`${BASE}/run-job`, { method: "POST", body: JSON.stringify(body) });
    toast(`Ingest queued for ${set}`);
  }

  async function runCollect() {
    const set = $("#collectSetInput")?.value.trim();
    if (!set) return toast("Provide a set input", "warn");
    const since = $("#collectSince")?.value.trim() || null;
    const prewarmFx = $("#collectPrewarmFx")?.value !== "false";
    const backfillFxDays = toInt($("#collectBackfillFxDays")?.value, null);
    const pauseMs = toInt($("#collectPauseMs")?.value, null);
    const dryRun = $("#collectDry")?.value === "true";
    const body = {
      kind: "COLLECT_PRICES",
      set,
      since,
      prewarmFx,
      dryRun,
      backfillFxDays,
      pauseMs,
    };
    await jfetch(`${BASE}/run-job`, {
      method: "POST",
      body: JSON.stringify(body, (_k, v) => (v === null ? undefined : v)),
    });
    toast(`Collect queued for ${set}`);
  }

  async function runRollups() {
    const scope = $("#rollupScope")?.value || "";
    const target = $("#rollupTarget")?.value.trim();

    if (!scope) {
      await jfetch(`${BASE}/run-job`, { method: "POST", body: JSON.stringify({ kind: "ROLLUP_ALL" }) });
      toast("Global rollups queued");
      return;
    }

    if (scope === "set") {
      if (!target) return toast("Provide a set", "warn");
      await jfetch(`${BASE}/run-job`, {
        method: "POST",
        body: JSON.stringify({ kind: "ROLLUP_SET", set: target }),
      });
      toast(`Rollups queued for ${target}`);
      return;
    }

    toast("Card scope not supported via admin UI. Use CLI.", "warn");
  }

  function toInt(value, fallback) {
    if (value == null || value === "") return fallback;
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  // ====== SET LIST ==========================================================
  async function searchSets() {
    const q = $("#setsQuery")?.value.trim();
    const url = new URL(`${BASE}/sets`, window.location.origin);
    if (q) url.searchParams.set("query", q);
    const sets = await jfetch(url.toString()).catch((err) => {
      toast(`Load sets failed: ${err.message}`, "err");
      return [];
    });
    const list = Array.isArray(sets) ? sets : sets?.items || [];
    renderSets(list);
  }

  function renderSets(sets) {
    const tbody = $("#setsTbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!sets.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted">No sets found.</td></tr>`;
      return;
    }
    let enabledCount = 0;

    for (const s of sets) {
      const code = esc(s.code);
      const enabled = !!s.enabled;
      if (enabled) enabledCount += 1;
      const buttonLabel = enabled ? "Disable" : "Enable";
      const buttonClass = enabled ? "btn-warn" : "btn-ok";
      const buttonState = enabled ? "1" : "0";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="mono">${code}</td>
        <td>${esc(s.abbr ?? "")}</td>
        <td>${esc(s.name ?? "")}</td>
        <td>${esc(s.series ?? "")}</td>
        <td class="small">${esc(s.releasedAt ?? "")}</td>
        <td>${esc(s.total ?? "")}</td>
        <td class="right">
          <button class="${buttonClass}" data-set="${code}" data-enabled="${buttonState}">${buttonLabel}</button>
        </td>
      `;
      tbody.appendChild(row);
    }

    const kpiSets = $("#kpiSets");
    if (kpiSets) kpiSets.textContent = String(enabledCount || 0);
  }

  async function onSetsClick(event) {
    const btn = event.target.closest("button[data-set]");
    if (!btn) return;
    const code = btn.getAttribute("data-set");
    const currentlyEnabled = btn.getAttribute("data-enabled") === "1";
    const enable = !currentlyEnabled;
    try {
      await jfetch(`${BASE}/sets/toggle`, {
        method: "POST",
        body: JSON.stringify({ code, enabled: enable }),
      });
      toast(`${enable ? "Enabled" : "Disabled"} ${code}`);
      await searchSets();
    } catch (err) {
      toast(err.message || String(err), "err");
    }
  }

  // ====== TOKEN UI ==========================================================
  function bindTokenUi() {
    const input = $("#adminToken");
    const saveBtn = $("#saveToken");
    const clearBtn = $("#clearToken");

    if (input) input.value = getToken();

    saveBtn?.addEventListener("click", () => {
      if (input) setToken(input.value);
      setTokenStatus();
      toast("Token saved");
      Promise.allSettled([loadTasks(), searchSets(), loadFxRates(currentFxDateValue())]);
    });

    clearBtn?.addEventListener("click", () => {
      clearToken();
      if (input) input.value = "";
      setTokenStatus();
      toast("Token cleared", "warn");
    });

    setTokenStatus();
  }

  // ====== INITIALISATION ====================================================
  function bindHandlers() {
    $("#refreshAll")?.addEventListener("click", () => {
      Promise.allSettled([loadTasks(), searchSets(), loadFxRates(currentFxDateValue())]);
      toast("Refreshed");
    });

    $("#runFxDaily")?.addEventListener("click", () => runFxDaily().catch((e) => toast(e.message, "err")));
    $("#runIngestSet")?.addEventListener("click", () => runIngestSet().catch((e) => toast(e.message, "err")));
    $("#runCollect")?.addEventListener("click", () => runCollect().catch((e) => toast(e.message, "err")));
    $("#runRollups")?.addEventListener("click", () => runRollups().catch((e) => toast(e.message, "err")));

    $("#refreshTasks")?.addEventListener("click", () => loadTasks().catch((e) => toast(e.message, "err")));
    $("#tasksTbody")?.addEventListener("click", onTasksClick);

    $("#fxFetch")?.addEventListener("click", () => loadFxRates(currentFxDateValue()).catch((e) => toast(e.message, "err")));

    $("#searchSets")?.addEventListener("click", () => searchSets().catch((e) => toast(e.message, "err")));
    $("#setsTbody")?.addEventListener("click", onSetsClick);

    const rollupAsOf = $("#rollupAsOf");
    if (rollupAsOf && !rollupAsOf.placeholder) rollupAsOf.placeholder = isoToday();

    bindTokenUi();
  }

  async function init() {
    bindHandlers();
    await Promise.allSettled([loadTasks(), searchSets(), loadFxRates(currentFxDateValue())]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

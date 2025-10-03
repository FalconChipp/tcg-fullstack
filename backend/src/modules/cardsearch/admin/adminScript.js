// src/modules/cardsearch/admin/adminScript.js
// Admin UI script for Card Search module.
// - No external dependencies
// - Expects the markup/IDs from adminPage.html
// - Talks to /admin/cardsearch endpoints (change BASE if you mounted elsewhere)

(() => {
  "use strict";

  const BASE = "/admin/cardsearch";
  const TOKEN_KEY = "CARDSEARCH_ADMIN_TOKEN";

  const $ = (sel, root = document) => root.querySelector(sel);
  const toastBox = $("#toast");
  let fxState = null;

  function toast(message, kind = "ok") {
    const tone = kind === "warn" ? "warn" : kind === "err" ? "err" : "ok";
    const text = typeof message === "string" ? message : String(message ?? "");

    if (toastBox) {
      const div = document.createElement("div");
      div.className = "t " + tone;
      div.textContent = text;
      toastBox.appendChild(div);
      setTimeout(() => div.remove(), 4500);
    }

    const headline = $("#kpiLast");
    if (headline) {
      const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const clean = text.trim().replace(/\s+/g, " ");
      const clipped = clean.length > 90 ? `${clean.slice(0, 87)}...` : clean;
      headline.textContent = `${stamp} - ${clipped || "Action recorded"}`;
      headline.dataset.kind = tone;
    }
  }

  const getToken = () => (localStorage.getItem(TOKEN_KEY) || "").trim();
  const setToken = (value) => localStorage.setItem(TOKEN_KEY, (value || "").trim());
  const clearToken = () => localStorage.removeItem(TOKEN_KEY);

  async function jfetch(url, opts = {}) {
    const headers = {
      "Content-Type": "application/json",
      "x-admin-token": getToken(),
      ...(opts.headers || {}),
    };
    const init = {
      ...opts,
      headers,
    };
    if (!Object.prototype.hasOwnProperty.call(init, "cache")) {
      init.cache = "no-store";
    }
    const res = await fetch(url, init);
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

  const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const DOW_ALIASES = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

  const clamp = (value, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(Math.max(n, min), max);
  };
  const pad = (n) => String(n).padStart(2, "0");

  function parseDow(raw) {
    if (raw == null) return null;
    const value = String(raw).trim().toUpperCase();
    if (value in DOW_ALIASES) return DOW_ALIASES[value];
    const asNum = Number.parseInt(value, 10);
    if (Number.isFinite(asNum)) {
      if (asNum === 7) return 0;
      if (asNum >= 0 && asNum <= 6) return asNum;
    }
    return null;
  }

  function parseCronExpr(expr) {
    const clean = String(expr || "").trim();
    if (!clean) return { type: "custom", expr: "" };
    const parts = clean.split(/\s+/);
    if (parts.length !== 5) return { type: "custom", expr: clean };
    const [minutePart, hourPart, dom, month, dow] = parts;
    const minute = Number.parseInt(minutePart, 10);
    const hour = Number.parseInt(hourPart, 10);
    if (dom === "*" && month === "*" && dow === "*" && hourPart === "*" && Number.isFinite(minute)) {
      return { type: "hourly", minute: clamp(minute, 0, 59) };
    }
    if (dom === "*" && month === "*" && dow === "*" && Number.isFinite(minute) && Number.isFinite(hour)) {
      return {
        type: "daily",
        minute: clamp(minute, 0, 59),
        hour: clamp(hour, 0, 23),
        time: `${pad(clamp(hour, 0, 23))}:${pad(clamp(minute, 0, 59))}`,
      };
    }
    const dowValue = parseDow(dow);
    if (dom === "*" && month === "*" && dowValue !== null && Number.isFinite(minute) && Number.isFinite(hour)) {
      return {
        type: "weekly",
        minute: clamp(minute, 0, 59),
        hour: clamp(hour, 0, 23),
        time: `${pad(clamp(hour, 0, 23))}:${pad(clamp(minute, 0, 59))}`,
        dow: dowValue,
      };
    }
    return { type: "custom", expr: clean };
  }

  function humanizeCron(plan) {
    if (!plan?.expr) return "";
    const parsed = parseCronExpr(plan.expr);
    switch (parsed.type) {
      case "hourly":
        return `Every hour at minute ${parsed.minute ?? 0}`;
      case "daily":
        return `Every day at ${parsed.time || "00:00"}`;
      case "weekly": {
        const label = DOW_NAMES[parsed.dow ?? 1] || "Monday";
        return `Every ${label} at ${parsed.time || "00:00"}`;
      }
      default:
        return "";
    }
  }

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
    const container = $("#tasksList");
    if (!container) return;
    container.innerHTML = "";
    if (!tasks.length) {
      container.innerHTML = `<div class="empty muted small">No tasks loaded.</div>`;
      return;
    }

    for (const task of tasks) {
      const card = document.createElement("div");
      card.className = "task-card";
      const statusChip = `<span class="chip ${chipClass(task.status)}">${esc(task.status ?? "unknown")}</span>`;
      const planSummary = describePlan(task.plan) || `<span class="muted small">-</span>`;
      const payloadObj = task.payload && typeof task.payload === "object" ? task.payload : null;
      const payloadHtml = payloadObj && Object.keys(payloadObj).length
        ? `<pre class="payload">${esc(JSON.stringify(payloadObj, null, 2))}</pre>`
        : `<span class="muted small">None</span>`;

      const factsHtml = `
        <ul class="task-card__facts">
          <li><span class="label">Next run</span><span>${fmtDt(task.nextRunAt)}</span></li>
          <li><span class="label">Last run</span><span>${fmtDt(task.lastRunAt)}</span></li>
          <li><span class="label">Tries</span><span>${task.tries ?? 0}</span></li>
        </ul>
      `;

      const actionButtons = [
        `<button class="btn-accent" data-action="run" data-id="${esc(task.id)}">Run now</button>`,
        `<button class="btn-outline" data-action="pause" data-id="${esc(task.id)}">Pause</button>`,
        `<button class="btn-outline" data-action="resume" data-id="${esc(task.id)}">Resume</button>`,
        `<button class="btn-warn" data-action="cancel" data-id="${esc(task.id)}">Remove</button>`,
      ];
      if (task.plan?.kind === "cron") {
        actionButtons.push(`<button class="btn-outline" data-action="edit-schedule" data-id="${esc(task.id)}">Edit schedule</button>`);
      }

      const scheduleForm = task.plan?.kind === "cron"
        ? `<form class="schedule-form hidden" data-task="${esc(task.id)}">
              <div class="form-grid">
                <div class="field">
                  <label>Frequency</label>
                  <select data-field="frequency">
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="custom">Custom cron</option>
                  </select>
                  <div class="hint">Common cadences auto-generate cron expressions.</div>
                </div>
                <div class="field" data-variant="hourly">
                  <label>Minute past the hour</label>
                  <input type="number" min="0" max="59" data-field="minute" />
                </div>
                <div class="field" data-variant="daily weekly">
                  <label>Time (HH:MM)</label>
                  <input type="time" data-field="time" />
                </div>
                <div class="field" data-variant="weekly">
                  <label>Day of week</label>
                  <select data-field="dow">
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                    <option value="0">Sunday</option>
                  </select>
                </div>
                <div class="field" data-variant="custom">
                  <label>Cron expression</label>
                  <input data-field="cron" placeholder="0 4 * * *" />
                  <div class="hint">minute hour day-of-month month day-of-week</div>
                </div>
                <div class="field">
                  <label>Description</label>
                  <input data-field="description" placeholder="e.g., Daily ingest for sv08" />
                </div>
                <div class="field">
                  <label>Timezone</label>
                  <input data-field="timezone" placeholder="UTC or Europe/London" />
                </div>
                <div class="field">
                  <label>Status</label>
                  <select data-field="status">
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>
              <div class="schedule-actions">
                <button type="button" class="btn-ok" data-action="save-schedule" data-id="${esc(task.id)}">Save changes</button>
                <button type="button" class="btn-muted" data-action="cancel-schedule" data-id="${esc(task.id)}">Cancel</button>
              </div>
            </form>`
        : "";

      const detailSections = [];
      if (payloadObj && Object.keys(payloadObj).length) {
        detailSections.push(`<div class="task-card__section"><span class="label">Payload</span>${payloadHtml}</div>`);
      }
      if (task.lastError) {
        const errMsg = typeof task.lastError === "object"
          ? task.lastError.message || JSON.stringify(task.lastError, null, 2)
          : String(task.lastError);
        detailSections.push(`<div class="task-card__section"><span class="label">Last error</span><div class="muted small">${esc(errMsg)}</div></div>`);
      }
      const detailsHtml = detailSections.length
        ? `<details class="task-card__details"><summary>Details</summary><div class="task-card__details-body">${detailSections.join("")}</div></details>`
        : "";

      card.innerHTML = `
        <div class="task-card__header">
          <div class="task-card__title">
            <div class="mono">${esc(task.name)}</div>
            <div class="muted small">${esc(task.id)}</div>
          </div>
          ${statusChip}
        </div>
        <div class="task-card__planline">
          <span class="label">Schedule</span>
          <div class="task-card__plantext">${planSummary}</div>
        </div>
        ${factsHtml}
        <div class="task-card__actions">${actionButtons.join("")}</div>
        ${scheduleForm}
        ${detailsHtml}
      `;
      container.appendChild(card);
      setupScheduleForm(card, task);
    }
  }  function describePlan(plan) {
    if (!plan) return "-";
    if (plan.kind === "cron") {
      const friendly = humanizeCron(plan);
      const friendlyWithZone = plan.timezone && friendly
        ? `${friendly} (${plan.timezone})`
        : friendly || (plan.timezone ? `Timezone ${plan.timezone}` : "");
      const friendlyLine = friendlyWithZone ? `<div>${esc(friendlyWithZone)}</div>` : "";
      const cronLine = `<div class="muted small">Cron: <span class="monospace">${esc(plan.expr)}</span></div>`;
      const descLine = plan.description ? `<div class="muted small">${esc(plan.description)}</div>` : "";
      return [friendlyLine, cronLine, descLine].filter(Boolean).join("");
    }
    if (plan.kind === "every") return `every ${esc(plan.everyMs ?? "?")}ms`;
    if (plan.kind === "once") return "once";
    return esc(plan.kind ?? "-");
  }

  function chipClass(status = "") {
    switch (String(status).toLowerCase()) {
      case "running":
      case "queued":
        return "busy";
      case "error":
      case "failed":
        return "err";
      case "paused":
        return "warn";
      default:
        return "ok";
    }
  }

  function setupScheduleForm(card, task) {
    const form = card.querySelector(".schedule-form");
    if (!form || task.plan?.kind !== "cron") return;
    form.dataset.cronExpr = task.plan?.expr || "";
    form.dataset.timezone = task.plan?.timezone || "";
    form.dataset.description = task.plan?.description || "";
    form.dataset.status = task.status || "idle";
    if (!form.dataset.bound) {
      const frequencySelect = form.querySelector('[data-field="frequency"]');
      frequencySelect?.addEventListener("change", () => {
        applyScheduleVariant(form, frequencySelect.value);
      });
      form.dataset.bound = "1";
    }
    populateScheduleForm(form);
  }

  function populateScheduleForm(form) {
    const cronExpr = form.dataset.cronExpr || "";
    const timezone = form.dataset.timezone || "";
    const description = form.dataset.description || "";
    const status = form.dataset.status === "paused" ? "paused" : "active";

    const parsed = parseCronExpr(cronExpr);
    const frequencySelect = form.querySelector('[data-field="frequency"]');
    const minuteInput = form.querySelector('[data-field="minute"]');
    const timeInput = form.querySelector('[data-field="time"]');
    const dowSelect = form.querySelector('[data-field="dow"]');
    const cronInput = form.querySelector('[data-field="cron"]');
    const tzInput = form.querySelector('[data-field="timezone"]');
    const descInput = form.querySelector('[data-field="description"]');
    const statusSelect = form.querySelector('[data-field="status"]');

    if (frequencySelect) frequencySelect.value = parsed.type;
    applyScheduleVariant(form, parsed.type);
    if (minuteInput) minuteInput.value = parsed.minute != null ? String(parsed.minute) : "0";
    if (timeInput) timeInput.value = parsed.time || "04:00";
    if (dowSelect) dowSelect.value = String(parsed.dow != null ? parsed.dow : 1);
    if (cronInput) cronInput.value = cronExpr;
    if (tzInput) tzInput.value = timezone;
    if (descInput) descInput.value = description;
    if (statusSelect) statusSelect.value = status;
  }

  function applyScheduleVariant(form, frequency) {
    const nodes = form.querySelectorAll("[data-variant]");
    nodes.forEach((node) => {
      const variants = node.getAttribute("data-variant").split(/\s+/);
      node.classList.toggle("is-visible", variants.includes(frequency));
    });
  }

  function toggleScheduleForm(card, show) {
    if (!card) return;
    const form = card.querySelector(".schedule-form");
    const trigger = card.querySelector('button[data-action="edit-schedule"]');
    if (!form || !trigger) return;
    const shouldShow = show ?? form.classList.contains("hidden");
    if (shouldShow) {
      populateScheduleForm(form);
      form.classList.remove("hidden");
      trigger.textContent = "Hide editor";
    } else {
      form.classList.add("hidden");
      trigger.textContent = "Edit schedule";
    }
  }

  function collectScheduleFormData(form) {
    const frequency = form.querySelector('[data-field="frequency"]').value;
    const status = form.querySelector('[data-field="status"]').value;
    const timezoneInput = form.querySelector('[data-field="timezone"]');
    const descriptionInput = form.querySelector('[data-field="description"]');

    let cronExp = "";
    if (frequency === "hourly") {
      const minuteInput = form.querySelector('[data-field="minute"]');
      const minute = clamp(Number.parseInt(minuteInput?.value ?? "0", 10), 0, 59);
      if (minuteInput) minuteInput.value = String(minute);
      cronExp = `${minute} * * * *`;
    } else if (frequency === "daily" || frequency === "weekly") {
      const timeInput = form.querySelector('[data-field="time"]');
      let timeValue = timeInput?.value || "04:00";
      if (!/^\d{2}:\d{2}$/.test(timeValue)) timeValue = "04:00";
      let [hourStr, minuteStr] = timeValue.split(":");
      const hour = clamp(Number.parseInt(hourStr, 10), 0, 23);
      const minute = clamp(Number.parseInt(minuteStr, 10), 0, 59);
      const sanitized = `${pad(hour)}:${pad(minute)}`;
      if (timeInput) timeInput.value = sanitized;
      if (frequency === "daily") {
        cronExp = `${minute} ${hour} * * *`;
      } else {
        const dowSelect = form.querySelector('[data-field="dow"]');
        let dow = parseDow(dowSelect?.value ?? 1);
        if (dow === null) dow = 1;
        if (dowSelect) dowSelect.value = String(dow);
        cronExp = `${minute} ${hour} * * ${dow}`;
      }
    } else {
      const cronInput = form.querySelector('[data-field="cron"]');
      const value = cronInput?.value.trim() || "";
      if (!value) throw new Error("Provide a cron expression");
      cronExp = value;
    }

    const tzRaw = timezoneInput?.value.trim() || "";
    const descriptionRaw = descriptionInput?.value.trim() || "";

    return {
      cronExp,
      timezone: tzRaw.length ? tzRaw : null,
      description: descriptionRaw.length ? descriptionRaw : null,
      enabled: status !== "paused",
    };
  }

  async function saveSchedule(taskId, form) {
    if (!taskId || !form) return;
    let payload;
    try {
      payload = collectScheduleFormData(form);
    } catch (err) {
      toast(err.message || String(err), "err");
      return;
    }
    try {
      await jfetch(`${BASE}/scheduler/${encodeURIComponent(taskId)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      form.dataset.cronExpr = payload.cronExp;
      form.dataset.timezone = payload.timezone || "";
      form.dataset.description = payload.description || "";
      form.dataset.status = payload.enabled ? "idle" : "paused";
      toast("Schedule updated");
      toggleScheduleForm(form.closest(".task-card"), false);
      await loadTasks();
    } catch (err) {
      toast(err.message || String(err), "err");
    }
  }

  async function onTasksClick(event) {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    const card = btn.closest(".task-card");
    if (!action) return;

    if (action === "edit-schedule") {
      toggleScheduleForm(card, undefined);
      return;
    }
    if (action === "cancel-schedule") {
      toggleScheduleForm(card, false);
      return;
    }
    if (action === "save-schedule") {
      saveSchedule(id, card?.querySelector(".schedule-form"));
      return;
    }

    if (!id) return;

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

  function renderFxRates(data) {
    const meta = $("#fxMeta");
    const tbody = $("#fxRatesTbody");
    if (meta) {
      const base = data?.base || "EUR";
      const fixDate = data?.date || "-";
      meta.textContent = `Base ${base} - Fix ${fixDate}`;
    }
    if (!tbody) return;

    const rates = data?.rates && typeof data.rates === "object" ? data.rates : {};
    const entries = Object.entries(rates)
      .filter(([ccy, rate]) => ccy && rate != null)
      .map(([ccy, rate]) => [ccy, Number(rate)])
      .filter(([, rate]) => Number.isFinite(rate))
      .sort((a, b) => a[0].localeCompare(b[0]));

    tbody.innerHTML = "";
    if (!entries.length) {
      tbody.innerHTML = `<tr><td colspan="2" class="muted">No rates.</td></tr>`;
      return;
    }

    for (const [ccy, rate] of entries) {
      const row = document.createElement("tr");
      row.innerHTML = `<td class="mono">${esc(ccy)}</td><td>${rate.toFixed(6)}</td>`;
      tbody.appendChild(row);
    }
  }

  function currentFxDateValue() {
    const input = $("#fxDate");
    if (!input) return "";
    return input.value ? input.value.trim() : "";
  }

  function updateHealthTargetState() {
    const scopeSelect = $("#healthScope");
    const targetInput = $("#healthTarget");
    if (!scopeSelect || !targetInput) return;
    const scope = scopeSelect.value || "all";
    if (scope === "all") {
      targetInput.setAttribute("disabled", "disabled");
      targetInput.placeholder = "Not required for all scope";
    } else {
      targetInput.removeAttribute("disabled");
      targetInput.placeholder = scope === "set" ? "sv08" : "sv08-123";
    }
  }

  async function runVerifyHealth() {
    const scope = ($("#healthScope")?.value || "all").toLowerCase();
    const targetInput = $("#healthTarget");
    const target = targetInput && !targetInput.disabled ? targetInput.value.trim() : "";
    let warnStaleDays = Number.parseInt($("#healthWarnStale")?.value || "", 10);
    if (!Number.isFinite(warnStaleDays) || warnStaleDays <= 0) warnStaleDays = 2;
    const fixMissingVariants = !!$("#healthFixVariants")?.checked;
    const rebuildRollups = !!$("#healthRebuildRollups")?.checked;
    const dryRun = !!$("#healthDryRun")?.checked;

    if ((scope === "set" || scope === "card") && !target) {
      toast("Provide a target when scope is set or card", "warn");
      return;
    }

    const body = {
      kind: "VERIFY_HEALTH",
      scope,
      target: target || undefined,
      warnStaleDays,
      fixMissingVariants,
      rebuildRollups,
      dryRun,
    };

    await jfetch(`${BASE}/run-job`, {
      method: "POST",
      body: JSON.stringify(body, (_k, v) => (v === undefined ? undefined : v)),
    });

    const label = scope === "all" ? "all data" : `${scope} ${target}`.trim();
    toast(`Health check queued for ${label}`);
  }

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
    const container = $("#setsList");
    if (!container) return;
    container.innerHTML = "";
    if (!sets.length) {
      container.innerHTML = `<div class="empty muted small">No sets found.</div>`;
      return;
    }
    let enabledCount = 0;

    for (const s of sets) {
      const code = esc(s.code);
      const abbr = esc(s.abbr ?? "");
      const name = esc(s.name ?? "");
      const series = esc(s.series ?? "");
      const released = esc(s.releasedAt ?? "");
      const total = esc(s.total ?? "");
      const enabled = !!s.enabled;
      if (enabled) enabledCount += 1;
      const statusChip = `<span class="chip ${enabled ? "ok" : "warn"}">${enabled ? "Enabled" : "Disabled"}</span>`;
      const buttonClass = enabled ? "btn-warn" : "btn-ok";
      const buttonLabel = enabled ? "Disable" : "Enable";
      const buttonState = enabled ? "1" : "0";

      const card = document.createElement("div");
      card.className = "set-card";
      card.innerHTML = `
        <div class="set-card__header">
          <div class="set-card__title">
            <div class="mono">${code}</div>
            <div class="muted small">${abbr || "n/a"}</div>
          </div>
          ${statusChip}
        </div>
        <div class="set-card__body">
          <div><span class="label">Name</span>${name || "n/a"}</div>
          <div><span class="label">Series</span>${series || "n/a"}</div>
          <div><span class="label">Released</span>${released || "n/a"}</div>
          <div><span class="label">Total cards</span>${total || "n/a"}</div>
        </div>
        <div class="set-card__actions">
          <button class="${buttonClass}" data-set="${code}" data-enabled="${buttonState}">${buttonLabel}</button>
        </div>
      `;
      container.appendChild(card);
    }

    const kpiSets = $("#kpiSets");
    if (kpiSets) kpiSets.textContent = String(enabledCount || 0);
  }

  async function onSetsClick(event) {
    const btn = event.target.closest("button[data-set]");
    if (!btn || btn.disabled) return;
    const code = btn.getAttribute("data-set");
    const currentlyEnabled = btn.getAttribute("data-enabled") === "1";
    const enable = !currentlyEnabled;
    btn.disabled = true;
    try {
      await jfetch(`${BASE}/sets/toggle`, {
        method: "POST",
        body: JSON.stringify({ code, enabled: enable }),
      });

      const card = btn.closest(".set-card");
      if (card) {
        const chip = card.querySelector(".chip");
        if (chip) {
          chip.className = `chip ${enable ? "ok" : "warn"}`;
          chip.textContent = enable ? "Enabled" : "Disabled";
        }
      }
      btn.className = enable ? "btn-warn" : "btn-ok";
      btn.textContent = enable ? "Disable" : "Enable";
      btn.setAttribute("data-enabled", enable ? "1" : "0");

      toast(`${enable ? "Enabled" : "Disabled"} ${code}`);
      await searchSets();
    } catch (err) {
      toast(err.message || String(err), "err");
    } finally {
      btn.disabled = false;
    }
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

  function bindHandlers() {
    $("#refreshAll")?.addEventListener("click", () => {
      Promise.allSettled([loadTasks(), searchSets(), loadFxRates(currentFxDateValue())]);
      toast("Refreshed");
    });

    $("#runFxDaily")?.addEventListener("click", () => runFxDaily().catch((e) => toast(e.message, "err")));
    $("#runIngestSet")?.addEventListener("click", () => runIngestSet().catch((e) => toast(e.message, "err")));
    $("#runCollect")?.addEventListener("click", () => runCollect().catch((e) => toast(e.message, "err")));
    $("#runVerifyHealth")?.addEventListener("click", () => runVerifyHealth().catch((e) => toast(e.message, "err")));
    $("#runRollups")?.addEventListener("click", () => runRollups().catch((e) => toast(e.message, "err")));

    $("#healthScope")?.addEventListener("change", updateHealthTargetState);

    $("#refreshTasks")?.addEventListener("click", () => loadTasks().catch((e) => toast(e.message, "err")));
    $("#tasksList")?.addEventListener("click", onTasksClick);

    $("#fxFetch")?.addEventListener("click", () => loadFxRates(currentFxDateValue()).catch((e) => toast(e.message, "err")));

    $("#searchSets")?.addEventListener("click", () => searchSets().catch((e) => toast(e.message, "err")));
    $("#setsList")?.addEventListener("click", onSetsClick);

    const rollupAsOf = $("#rollupAsOf");
    if (rollupAsOf && !rollupAsOf.placeholder) rollupAsOf.placeholder = isoToday();

    updateHealthTargetState();
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
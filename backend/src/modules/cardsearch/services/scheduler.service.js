// src/modules/cardsearch/services/scheduler.service.js
// Tiny in-process scheduler with cron + ad-hoc job registry tailored for the Card Search module.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cron from "node-cron";
import { v4 as uuid } from "uuid";

import { fxDaily } from "../jobs/fxDaily.job.js";
import { ingestSet } from "../jobs/ingestSet.job.js";
import { collectBoth } from "../jobs/collectBoth.job.js";
import { verifyDataHealth } from "../jobs/verifyDataHealth.job.js";
import { rebuildPriceRollups } from "../jobs/priceRollup.job.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.resolve(__dirname, "../../../..", ".cache", "cardsearch", "scheduler.tasks.json");

const JOBS = {
  fxDaily: async (payload) => {
    const days = Number(payload?.backfillFxDays || 0);
    if (days > 0) return fxDaily({ backfillDays: days });
    return fxDaily({ prewarm90d: true });
  },
  ingestSet: async (payload) => {
    const input = payload?.input || payload?.set || payload?.code;
    return ingestSet({ input, refresh: !!payload?.refresh, dryRun: !!payload?.dryRun });
  },
  collectBoth: async (payload) => {
    const sets = payload?.sets || (payload?.set ? [payload.set] : []);
    return collectBoth({
      sets,
      refreshSet: !!payload?.refreshSet,
      since: payload?.since,
      prewarmFx: payload?.prewarmFx !== false,
      backfillFxDays: Number(payload?.backfillFxDays || 0),
      dryRun: !!payload?.dryRun,
      pauseMs: Number(payload?.pauseMs || 400),
    });
  },
  verifyDataHealth: async (payload = {}) => {
    // payload may include: scope ('all'|'set'|'card'), target, warnStaleDays, fixMissingVariants, rebuildRollups, dryRun
    return await verifyDataHealth(payload);
  },

  priceRollups: async (payload) => {
    const scope = payload?.scope || "all";
    return rebuildPriceRollups({
      scope,
      set: payload?.set,
      cardId: payload?.cardId,
      variant: payload?.variant,
      asOf: payload?.asOf,
      batchSize: Number(payload?.batchSize || 1000),
    });
  },
};

const _tasks = new Map();

const KEYS = {
  STATUS: "status",
  LAST_RUN_AT: "lastRunAt",
  NEXT_RUN_AT: "nextRunAt",
  TRIES: "tries",
  LAST_ERROR: "lastError",
};

let isRestoring = false;
let persistTimer = null;

async function ensureStateDir() {
  try {
    await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  } catch {}
}

async function writeStateToDisk() {
  if (isRestoring) return;
  const payload = {
    version: 1,
    tasks: Array.from(_tasks.values())
      .filter((t) => t.plan?.kind === "cron")
      .map((t) => ({
        id: t.id,
        name: t.name,
        cronExp: t.cronExp,
        payload: t.payload || null,
        timezone: t.plan?.timezone || null,
        description: t.plan?.description || null,
        enabled: t[KEYS.STATUS] !== "paused",
      })),
  };
  await ensureStateDir();
  await fs.writeFile(STATE_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function schedulePersist() {
  if (isRestoring) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    writeStateToDisk().catch((err) => {
      console.error("[scheduler] persist failed", err);
    });
  }, 250);
}

async function loadPersistedTasks() {
  let raw;
  try {
    raw = await fs.readFile(STATE_FILE, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return;
    console.error("[scheduler] failed to read tasks file", err);
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("[scheduler] invalid tasks file", err);
    return;
  }
  const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
  if (!tasks.length) return;

  isRestoring = true;
  try {
    for (const record of tasks) {
      if (!record?.cronExp || !record?.name) continue;
      try {
        Scheduler.addCron(record.cronExp, record.name, record.payload || {}, {
          id: record.id,
          timezone: record.timezone || undefined,
          description: record.description || undefined,
          enabled: record.enabled !== false,
          autoStart: record.enabled !== false,
        });
      } catch (err) {
        console.error("[scheduler] restore failed", record, err);
      }
    }
  } finally {
    isRestoring = false;
    schedulePersist();
  }
}

function nowISO() {
  return new Date().toISOString();
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toISOString === "function") {
    try {
      return value.toISOString();
    } catch {}
  }
  if (typeof value.toISO === "function") {
    try {
      return value.toISO();
    } catch {}
  }
  if (typeof value.toDate === "function") {
    try {
      const d = value.toDate();
      if (d && typeof d.toISOString === "function") return d.toISOString();
    } catch {}
  }
  return null;
}

function scheduleNextRun(task) {
  try {
    if (task.plan?.kind === "cron" && task.handle && task[KEYS.STATUS] !== "paused") {
      const matcher = task.handle?.timeMatcher;
      if (matcher?.getNextMatch) {
        const next = matcher.getNextMatch(new Date());
        task[KEYS.NEXT_RUN_AT] = toIso(next);
      } else if (typeof task.handle?.nextDates === "function") {
        const next = task.handle.nextDates(1);
        task[KEYS.NEXT_RUN_AT] = Array.isArray(next) ? toIso(next[0]) : toIso(next);
      } else {
        task[KEYS.NEXT_RUN_AT] = null;
      }
    } else {
      task[KEYS.NEXT_RUN_AT] = null;
    }
  } catch {
    task[KEYS.NEXT_RUN_AT] = null;
  }
}

function serializeError(err) {
  if (!err) return null;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  if (typeof err === "object") {
    try {
      return JSON.parse(JSON.stringify(err));
    } catch {}
  }
  return { message: String(err) };
}

function createCronRunner(task, fn) {
  return async () => {
    task[KEYS.STATUS] = "running";
    task[KEYS.LAST_RUN_AT] = nowISO();
    task[KEYS.TRIES] += 1;
    try {
      await fn(task.payload || {});
      task[KEYS.STATUS] = "idle";
      task[KEYS.LAST_ERROR] = null;
    } catch (error) {
      task[KEYS.STATUS] = "error";
      task[KEYS.LAST_ERROR] = serializeError(error);
      console.error(`[scheduler] job failed name=${task.name}`, error);
    } finally {
      scheduleNextRun(task);
      schedulePersist();
    }
  };
}

export const Scheduler = {
  list() {
    return Array.from(_tasks.values()).map((t) => {
      let nextRunAt = t[KEYS.NEXT_RUN_AT];
      if (nextRunAt == null && t.plan?.kind === "cron") {
        try {
          const matcher = t.handle?.timeMatcher;
          if (matcher?.getNextMatch) {
            const computed = matcher.getNextMatch(new Date());
            nextRunAt = toIso(computed);
            if (nextRunAt) t[KEYS.NEXT_RUN_AT] = nextRunAt;
          }
        } catch {}
      }
      return {
        id: t.id,
        name: t.name,
        plan: t.plan,
        payload: t.payload,
        status: t[KEYS.STATUS],
        lastRunAt: t[KEYS.LAST_RUN_AT],
        nextRunAt,
        tries: t[KEYS.TRIES],
        lastError: t[KEYS.LAST_ERROR],
      };
    });
  },

  async runAdhoc(name, payload = {}) {
    const fn = JOBS[name];
    if (!fn) throw new Error(`Unknown job name: ${name}`);
    try {
      console.info(`[scheduler] adhoc start name=${name}`);
      const res = await fn(payload);
      console.info(`[scheduler] adhoc done name=${name}`);
      return res;
    } catch (err) {
      console.error(
        JSON.stringify(
          {
            time: Date.now(),
            level: "error",
            name: "scheduler",
            msg: "adhoc.failed",
            ctx: { svc: "scheduler" },
            extra: { name, error: serializeError(err) },
          },
          null,
          0,
        ),
      );
      throw err;
    }
  },

  addCron(cronExp, name, payload = {}, opts = {}) {
    const fn = JOBS[name];
    if (!fn) throw new Error(`Unknown job name for cron: ${name}`);

    const expr = String(cronExp || "").trim();
    if (!expr) throw new Error("cron expression is required");
    if (!cron.validate(expr)) throw new Error(`Invalid cron expression: ${expr}`);

    const id = opts.id || uuid();
    const enabled = opts.enabled !== undefined ? !!opts.enabled : true;
    const timezone = opts.timezone || process.env.CRON_TZ || null;

    if (_tasks.has(id)) return id;

    const task = {
      id,
      name,
      cronExp: expr,
      payload,
      plan: {
        kind: "cron",
        expr,
        timezone,
        description: opts.description || null,
      },
      [KEYS.STATUS]: enabled ? "idle" : "paused",
      [KEYS.TRIES]: 0,
      [KEYS.LAST_RUN_AT]: null,
      [KEYS.NEXT_RUN_AT]: null,
      [KEYS.LAST_ERROR]: null,
      handle: null,
      jobFn: fn,
      runner: null,
    };

    task.runner = createCronRunner(task, fn);

    task.handle = cron.schedule(expr, task.runner, {
      scheduled: enabled,
      timezone: timezone || undefined,
    });
    if (enabled && typeof task.handle?.start === "function" && opts.autoStart !== false) {
      task.handle.start();
    }

    scheduleNextRun(task);
    _tasks.set(id, task);
    schedulePersist();
    return id;
  },

  updateCron(id, options = {}) {
    const task = _tasks.get(id);
    if (!task) throw new Error("Task not found");
    if (task.plan?.kind !== "cron") throw new Error("Task is not cron-scheduled");

    const fn = task.jobFn || JOBS[task.name];
    if (!fn) throw new Error(`Unknown job for cron task: ${task.name}`);

    const baseExpr = task.cronExp || task.plan?.expr || "";
    const incoming = typeof options.cronExp === "string" ? options.cronExp.trim() : "";
    const expr = incoming || baseExpr;
    if (!expr) throw new Error("cron expression is required");
    if (!cron.validate(expr)) throw new Error(`Invalid cron expression: ${expr}`);

    const timezoneRaw = options.timezone !== undefined && options.timezone !== null
      ? String(options.timezone).trim()
      : task.plan?.timezone || null;
    const timezone = timezoneRaw ? timezoneRaw : null;

    if (options.payload !== undefined) {
      task.payload = options.payload;
    }

    const description = options.description !== undefined
      ? (options.description ? String(options.description).trim() : null)
      : task.plan?.description || null;

    const enabled = options.enabled !== undefined ? !!options.enabled : task[KEYS.STATUS] !== "paused";

    if (typeof task.handle?.stop === "function") task.handle.stop();

    task.cronExp = expr;
    task.plan = {
      kind: "cron",
      expr,
      timezone,
      description,
    };
    task.jobFn = fn;
    task.runner = createCronRunner(task, fn);

    task.handle = cron.schedule(expr, task.runner, {
      scheduled: enabled,
      timezone: timezone || undefined,
    });
    if (enabled && typeof task.handle?.start === "function") task.handle.start();
    task[KEYS.STATUS] = enabled ? "idle" : "paused";

    scheduleNextRun(task);
    schedulePersist();
    return this.list().find((t) => t.id === id) || null;
  },

  addTask(name, payload = {}, opts = {}) {
    const id = opts.id || uuid();
    if (_tasks.has(id)) return id;

    const task = {
      id,
      name,
      payload,
      plan: {
        kind: opts.kind || "once",
        description: opts.description || null,
      },
      [KEYS.STATUS]: "idle",
      [KEYS.TRIES]: 0,
      [KEYS.LAST_RUN_AT]: null,
      [KEYS.NEXT_RUN_AT]: null,
      [KEYS.LAST_ERROR]: null,
      handle: null,
    };

    _tasks.set(id, task);
    schedulePersist();
    return id;
  },

  async runNow(id) {
    const task = _tasks.get(id);
    if (!task) throw new Error("Task not found");
    const fn = task.jobFn || JOBS[task.name];
    if (!fn) throw new Error(`Unknown job: ${task.name}`);

    task[KEYS.STATUS] = "running";
    task[KEYS.LAST_RUN_AT] = nowISO();
    task[KEYS.TRIES] += 1;
    try {
      console.info(`[scheduler] runNow start id=${id} name=${task.name}`);
      await fn(task.payload || {});
      task[KEYS.STATUS] = "idle";
      task[KEYS.LAST_ERROR] = null;
      console.info(`[scheduler] runNow done id=${id} name=${task.name}`);
    } catch (error) {
      task[KEYS.STATUS] = "error";
      task[KEYS.LAST_ERROR] = serializeError(error);
      console.error(`[scheduler] runNow failed id=${id} name=${task.name}`, error);
    } finally {
      scheduleNextRun(task);
      schedulePersist();
    }
  },

  pause(id) {
    const task = _tasks.get(id);
    if (!task) throw new Error("Task not found");
    if (typeof task.handle?.stop === "function") task.handle.stop();
    task[KEYS.STATUS] = "paused";
    scheduleNextRun(task);
    schedulePersist();
  },

  resume(id) {
    const task = _tasks.get(id);
    if (!task) throw new Error("Task not found");
    if (typeof task.handle?.start === "function") task.handle.start();
    task[KEYS.STATUS] = "idle";
    scheduleNextRun(task);
    schedulePersist();
  },

  cancel(id) {
    const task = _tasks.get(id);
    if (!task) throw new Error("Task not found");
    if (typeof task.handle?.stop === "function") task.handle.stop();
    _tasks.delete(id);
    schedulePersist();
  },

  async ensureSetTasks(setCode) {
    const planKey = (suffix) => `${suffix}:${setCode}`;

    const templates = [
      {
        id: planKey("ingest"),
        expr: "0 4 * * *",
        name: "ingestSet",
        payload: { input: setCode, refresh: false },
        description: `Daily ingest for ${setCode}`,
      },
      {
        id: planKey("collect"),
        expr: "15 * * * *",
        name: "collectBoth",
        payload: { sets: [setCode], prewarmFx: false, pauseMs: 250 },
        description: `Hourly collect for ${setCode}`,
      },
      {
        id: planKey("rollup"),
        expr: "0 */6 * * *",
        name: "priceRollups",
        payload: { scope: "set", set: setCode },
        description: `6-hour rollups for ${setCode}`,
      },
    ];

    for (const tpl of templates) {
      if (_tasks.has(tpl.id)) continue;
      this.addCron(tpl.expr, tpl.name, tpl.payload, { id: tpl.id, description: tpl.description });
    }
  },
};

await loadPersistedTasks().catch((err) => {
  console.error("[scheduler] failed to restore tasks", err);
});

export default Scheduler;

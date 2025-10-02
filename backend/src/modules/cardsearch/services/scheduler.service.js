// src/modules/cardsearch/services/scheduler.service.js
// Tiny in-process scheduler with cron + ad-hoc job registry tailored for the Card Search module.

import cron from "node-cron";
import { v4 as uuid } from "uuid";

import { fxDaily } from "../jobs/fxDaily.job.js";
import { ingestSet } from "../jobs/ingestSet.job.js";
import { collectBoth } from "../jobs/collectBoth.job.js";
import { rebuildPriceRollups } from "../jobs/priceRollup.job.js";

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

function nowISO() {
  return new Date().toISOString();
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toISOString === "function") {
    try { return value.toISOString(); } catch { /* ignore */ }
  }
  if (typeof value.toISO === "function") {
    try { return value.toISO(); } catch { /* ignore */ }
  }
  if (typeof value.toDate === "function") {
    try {
      const d = value.toDate();
      if (d && typeof d.toISOString === "function") return d.toISOString();
    } catch { /* ignore */ }
  }
  try {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  } catch { /* ignore */ }
  return null;
}

function scheduleNextRun(task) {
  try {
    if (task.plan?.kind === "cron") {
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

    const id = opts.id || uuid();
    const enabled = opts.enabled !== undefined ? !!opts.enabled : true;

    if (_tasks.has(id)) return id;

    const task = {
      id,
      name,
      cronExp,
      payload,
      plan: {
        kind: "cron",
        expr: cronExp,
        timezone: opts.timezone || process.env.CRON_TZ || null,
        description: opts.description || null,
      },
      [KEYS.STATUS]: enabled ? "idle" : "paused",
      [KEYS.TRIES]: 0,
      [KEYS.LAST_RUN_AT]: null,
      [KEYS.NEXT_RUN_AT]: null,
      [KEYS.LAST_ERROR]: null,
      handle: null,
    };

    const runner = async () => {
      task[KEYS.STATUS] = "running";
      task[KEYS.LAST_RUN_AT] = nowISO();
      task[KEYS.TRIES] += 1;
      try {
        await fn(task.payload);
        task[KEYS.STATUS] = "idle";
        task[KEYS.LAST_ERROR] = null;
      } catch (error) {
        task[KEYS.STATUS] = "error";
        task[KEYS.LAST_ERROR] = serializeError(error);
        console.error(`[scheduler] job failed name=${name}`, error);
      } finally {
        scheduleNextRun(task);
      }
    };

    task.handle = cron.schedule(cronExp, runner, { scheduled: enabled });
    if (enabled && typeof task.handle?.start === "function" && opts.autoStart !== false) {
      task.handle.start();
    }

    scheduleNextRun(task);
    _tasks.set(id, task);
    return id;
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
    return id;
  },

  async runNow(id) {
    const task = _tasks.get(id);
    if (!task) throw new Error("Task not found");
    const fn = JOBS[task.name];
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
    }
  },

  pause(id) {
    const task = _tasks.get(id);
    if (!task) throw new Error("Task not found");
    if (typeof task.handle?.stop === "function") task.handle.stop();
    task[KEYS.STATUS] = "paused";
    scheduleNextRun(task);
  },

  resume(id) {
    const task = _tasks.get(id);
    if (!task) throw new Error("Task not found");
    if (typeof task.handle?.start === "function") task.handle.start();
    task[KEYS.STATUS] = "idle";
    scheduleNextRun(task);
  },

  cancel(id) {
    const task = _tasks.get(id);
    if (!task) throw new Error("Task not found");
    if (typeof task.handle?.stop === "function") task.handle.stop();
    _tasks.delete(id);
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

export default Scheduler;

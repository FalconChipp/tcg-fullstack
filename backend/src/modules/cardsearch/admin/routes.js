// src/modules/cardsearch/admin/routes.js
// Admin UI + JSON API for Card Search
//
// Exports two routers:
//   - publicRouter()  -> UI pages/assets (no auth, index.js allowlists these)
//   - apiRouter()     -> JSON API (index.js wraps with requireAdmin)

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Op } from "sequelize";
import { m_Set } from "../../../models/index.js";
import { Scheduler } from "../services/scheduler.service.js";
import { getFx } from "../services/fx.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_DIR = __dirname;
const HTML_FILE = path.join(ADMIN_DIR, "adminPage.html");
const SCRIPT_FILE = path.join(ADMIN_DIR, "adminScript.js");

const SET_TASK_PREFIXES = ["ingest", "collect", "rollup"];

let setEnabledColumnState = null;
let setEnabledColumnPromise = null;
let setEnabledDescribeWarned = false;

async function ensureSetEnabledColumn() {
  if (setEnabledColumnState !== null) {
    return setEnabledColumnState;
  }
  if (!setEnabledColumnPromise) {
    setEnabledColumnPromise = (async () => {
      let hasColumn = true;
      try {
        const desc = typeof m_Set.describe === "function" ? await m_Set.describe() : null;
        hasColumn = !!desc?.enabled;
      } catch (err) {
        if (!setEnabledDescribeWarned) {
          console.warn("[cardsearch admin] m_sets.describe failed, assuming no 'enabled' column", err?.message || err);
          setEnabledDescribeWarned = true;
        }
        hasColumn = false;
      }
      if (!hasColumn && typeof m_Set.removeAttribute === "function" && m_Set.rawAttributes?.enabled) {
        m_Set.removeAttribute("enabled");
        if (typeof m_Set.refreshAttributes === "function") {
          m_Set.refreshAttributes();
        }
      }
      setEnabledColumnState = hasColumn;
      setEnabledColumnPromise = null;
      return hasColumn;
    })();
  }
  return setEnabledColumnPromise;
}

function isTaskNotFoundError(err) {
  return !!(err && typeof err.message === "string" && err.message.toLowerCase().includes("task not found"));
}

function safeSchedulerList() {
  if (Scheduler && typeof Scheduler.list === "function") {
    try {
      return Scheduler.list() || [];
    } catch (err) {
      console.warn("[cardsearch admin] scheduler.list failed", err?.message || err);
    }
  }
  return [];
}

function isSetEnabledFromScheduler(code, tasks) {
  if (!code) return false;
  const list = Array.isArray(tasks) ? tasks : [];
  const suffix = `:${code}`;
  let seen = false;
  for (const task of list) {
    if (!task) continue;
    const id = typeof task.id === "string" ? task.id : "";
    const payload = task.payload || {};
    const matchesId = id.endsWith(suffix);
    const matchesPayloadSet = typeof payload.set === "string" && payload.set === code;
    const matchesPayloadSets = Array.isArray(payload.sets) && payload.sets.includes(code);
    if (!(matchesId || matchesPayloadSet || matchesPayloadSets)) continue;
    seen = true;
    const status = typeof task.status === "string" ? task.status.toLowerCase() : "";
    if (status !== "paused") return true;
  }
  return seen ? false : false;
}

async function syncSchedulerForSet(code, enabled) {
  if (!code || !Scheduler) return;
  const ids = SET_TASK_PREFIXES.map((prefix) => `${prefix}:${code}`);
  if (enabled) {
    if (typeof Scheduler.ensureSetTasks === "function") {
      await Scheduler.ensureSetTasks(code);
    }
    if (typeof Scheduler.resume === "function") {
      for (const id of ids) {
        try {
          Scheduler.resume(id);
        } catch (err) {
          if (!isTaskNotFoundError(err)) throw err;
        }
      }
    }
  } else if (typeof Scheduler.pause === "function") {
    for (const id of ids) {
      try {
        Scheduler.pause(id);
      } catch (err) {
        if (!isTaskNotFoundError(err)) throw err;
      }
    }
  }
}


// ---------------- Public UI ----------------
export function publicRouter() {
  const r = express.Router();

  r.get("/ui", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.sendFile(HTML_FILE);
  });

  r.get("/adminScript.js", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.type("application/javascript; charset=utf-8").sendFile(SCRIPT_FILE);
  });

  r.get("/partials/:name", (req, res) => {
    const safe = String(req.params.name || "").replace(/[^a-z0-9_.-]/gi, "");
    const p = path.join(ADMIN_DIR, "partials", safe);
    res.set("Cache-Control", "no-store");
    res.sendFile(p, (err) => {
      if (err) res.status(404).send("Not found");
    });
  });

  return r;
}

// ---------------- Protected JSON API ----------------
export function apiRouter() {
  const r = express.Router();

  r.post("/run-job", express.json(), async (req, res) => {
    try {
      const { kind } = req.body || {};
      let jobName = null;
      let payload = {};

      switch (kind) {
        case "FX_DAILY":
          jobName = "fxDaily";
          payload = { backfillFxDays: toInt(req.body?.backfillFxDays, 0) };
          break;
        case "INGEST_SET":
          jobName = "ingestSet";
          payload = {
            input: String(req.body?.set || "").trim(),
            refresh: !!req.body?.refreshSet,
            dryRun: !!req.body?.dryRun,
          };
          break;
        case "COLLECT_PRICES":
          jobName = "collectBoth";
          payload = {
            sets: [String(req.body?.set || "").trim()].filter(Boolean),
            since: req.body?.since || null,
            pauseMs: toInt(req.body?.pauseMs, 0),
            dryRun: !!req.body?.dryRun,
            prewarmFx: req.body?.prewarmFx !== false,
            backfillFxDays: toInt(req.body?.backfillFxDays, 0),
          };
          break;
        case "ROLLUP_ALL":
          jobName = "priceRollups";
          payload = { scope: "all" };
          break;
        case "ROLLUP_SET":
          jobName = "priceRollups";
          payload = { scope: "set", set: String(req.body?.set || "").trim() };
          break;
        case "VERIFY_HEALTH": {
          jobName = "verifyDataHealth";
          payload = {
            scope: (req.body?.scope || "all").toLowerCase(),
            target: req.body?.target || undefined,
            warnStaleDays: Number(req.body?.warnStaleDays) || 2,
            fixMissingVariants: !!req.body?.fixMissingVariants,
            rebuildRollups: !!req.body?.rebuildRollups,
            dryRun: !!req.body?.dryRun,
          };
          break;
        }

        default:
          return res.status(400).json({ ok: false, error: `Unknown kind: ${kind}` });
      }

      const out = await Scheduler.runAdhoc(jobName, payload);
      return res.json({ ok: true, job: jobName, payload, result: out });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  r.get("/scheduler/tasks", async (_req, res) => {
    try {
      res.json(Scheduler.list());
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  r.post("/scheduler/run-now/:id", async (req, res) => {
    try {
      await Scheduler.runNow(String(req.params.id || ""));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  r.post("/scheduler/pause/:id", async (req, res) => {
    try {
      await Scheduler.pause(String(req.params.id || ""));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  r.post("/scheduler/resume/:id", async (req, res) => {
    try {
      await Scheduler.resume(String(req.params.id || ""));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  r.put("/scheduler/:id", express.json(), async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ ok: false, error: "id is required" });

      const body = req.body || {};
      const cronExp = typeof body.cronExp === "string" ? body.cronExp.trim() : undefined;
      let timezone;
      if (Object.prototype.hasOwnProperty.call(body, "timezone")) {
        if (body.timezone === null) {
          timezone = null;
        } else if (typeof body.timezone === "string") {
          const trimmed = body.timezone.trim();
          timezone = trimmed.length ? trimmed : null;
        } else {
          timezone = undefined;
        }
      }
      let description;
      if (Object.prototype.hasOwnProperty.call(body, "description")) {
        if (body.description === null) {
          description = null;
        } else if (typeof body.description === "string") {
          const trimmedDesc = body.description.trim();
          description = trimmedDesc.length ? trimmedDesc : null;
        } else {
          description = undefined;
        }
      }
      const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;

      const task = await Scheduler.updateCron(id, {
        cronExp,
        timezone,
        description,
        enabled,
      });
      res.json({ ok: true, task });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  r.delete("/scheduler/:id", async (req, res) => {
    try {
      await Scheduler.cancel(String(req.params.id || ""));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  r.get("/fx/rates", async (req, res) => {
    try {
      const raw = typeof req.query.date === "string" ? req.query.date.trim() : "";
      const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
      const fx = await getFx(date ? { date } : {});

      let payload = fx;
      const gbpRate = Number(fx?.rates?.GBP);
      if (fx && Number.isFinite(gbpRate) && gbpRate !== 0) {
        const rates = { GBP: 1 };
        const wanted = ["USD", "EUR"];
        for (const ccy of wanted) {
          if (ccy === "GBP") continue;
          const rawRate = fx.rates?.[ccy];
          const num = Number(rawRate);
          if (!Number.isFinite(num)) continue;
          rates[ccy] = num / gbpRate;
        }
        if (!Object.prototype.hasOwnProperty.call(rates, "EUR")) {
          rates.EUR = 1 / gbpRate;
        }
        payload = { base: "GBP", date: fx.date, rates };
      }

      res.json(payload);
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });
  r.get("/sets", async (req, res) => {
    try {
      const q = String(req.query.query || "").trim();
      const limit = Math.max(1, Math.min(500, toInt(req.query.limit, 200)));
      const where = {};
      if (q) {
        const like = `%${q}%`;
        where[Op.or] = [
          { code: { [Op.like]: like } },
          { abbreviation: { [Op.like]: like } },
          { name: { [Op.like]: like } },
        ];
      }

      const hasEnabledColumn = await ensureSetEnabledColumn();
      const rows = await m_Set.findAll({
        where,
        order: [["release_date", "DESC"]],
        limit,
      });

      const schedulerTasks = hasEnabledColumn ? null : safeSchedulerList();

      const items = rows.map((r) => {
        const x = r.get();
        const code = x.code;
        return {
          code,
          abbr: x.abbreviation ?? null,
          name: x.name ?? null,
          series: null,
          releasedAt: x.release_date ?? null,
          total: x.total_cards ?? x.official_count ?? null,
          lang: null,
          enabled: hasEnabledColumn ? !!x.enabled : isSetEnabledFromScheduler(code, schedulerTasks),
        };
      });
      res.json(items);
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  r.post("/sets/toggle", express.json(), async (req, res) => {
    try {
      const code = String(req.body?.code || "").trim();
      const requestedEnabled = !!req.body?.enabled;
      if (!code) return res.status(400).json({ ok: false, error: "code is required" });

      const hasEnabledColumn = await ensureSetEnabledColumn();
      const row = await m_Set.findOne({ where: { code } });
      if (!row) return res.status(404).json({ ok: false, error: `Set not found: ${code}` });

      if (hasEnabledColumn && typeof row.set === "function") {
        row.set("enabled", requestedEnabled);
        await row.save();
      }

      await syncSchedulerForSet(code, requestedEnabled);

      const data = row.get();
      const schedulerTasks = hasEnabledColumn ? null : safeSchedulerList();
      const effectiveEnabled = hasEnabledColumn ? !!data.enabled : isSetEnabledFromScheduler(code, schedulerTasks);

      res.json({
        ok: true,
        set: {
          code: data.code,
          abbr: data.abbreviation ?? null,
          name: data.name ?? null,
          releasedAt: data.release_date ?? null,
          total: data.total_cards ?? data.official_count ?? null,
          enabled: effectiveEnabled,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  return r;
}

function toInt(v, d = 0) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
}

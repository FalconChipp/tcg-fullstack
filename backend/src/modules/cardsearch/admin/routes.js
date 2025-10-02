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
      const rows = await m_Set.findAll({
        where,
        order: [["release_date", "DESC"]],
        limit,
      });

      const items = rows.map((r) => {
        const x = r.get();
        return {
          code: x.code,
          abbr: x.abbreviation ?? null,
          name: x.name ?? null,
          series: null,
          releasedAt: x.release_date ?? null,
          total: x.total_cards ?? x.official_count ?? null,
          lang: null,
          enabled: !!x.enabled,
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
      const enabled = !!req.body?.enabled;
      if (!code) return res.status(400).json({ ok: false, error: "code is required" });

      const row = await m_Set.findOne({ where: { code } });
      if (!row) return res.status(404).json({ ok: false, error: `Set not found: ${code}` });

      if ("enabled" in row.get()) {
        row.set("enabled", enabled);
        await row.save();
      }

      if (enabled && Scheduler?.ensureSetTasks) {
        await Scheduler.ensureSetTasks(code);
      }

      res.json({
        ok: true,
        set: {
          code: row.get("code"),
          abbr: row.get("abbreviation") ?? null,
          name: row.get("name") ?? null,
          releasedAt: row.get("release_date") ?? null,
          total: row.get("total_cards") ?? row.get("official_count") ?? null,
          enabled,
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

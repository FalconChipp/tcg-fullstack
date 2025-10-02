// src/modules/cardsearch/services/logging.service.js
// Lightweight, dependency-free structured logging with rotation and context.
//
// Features
// - Levels: trace, debug, info, warn, error, fatal
// - Console: pretty (optional) or compact JSON
// - File: newline-delimited JSON (one object per line)
// - Rotation: daily file segmentation + size-based rollover
// - Context: child() to add persistent fields (jobId, setCode, etc.)
// - Helpers: time() for duration measurement, wrapJob() to log start/end
//
// Environment
//   LOG_LEVEL=info            // min level (trace|debug|info|warn|error|fatal)
//   LOG_DIR=./logs            // directory for log files
//   LOG_PRETTY=true           // pretty-print console
//   LOG_TO_FILE=true          // enable file logging
//   LOG_FILE_MAX_MB=16        // rotate when file exceeds this size
//
// Usage
//   import { getLogger } from "./logging.service.js";
//   const log = getLogger("collectPrices").child({ set: "sv08" });
//   const end = log.time().start("fetch-adapters");
//   log.info("starting fetch");
//   ...
//   end(); // logs duration
//
//   // Wrap a whole job
//   await log.wrapJob("collect-both", async (jobLog) => {
//      jobLog.info("phase", { step: "ingest" });
//      ...
//      return { ok: true };
//   });

import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/* -----------------------------------------------------------------------------
 * Config
 * -------------------------------------------------------------------------- */

const ENV = {
  level: (process.env.LOG_LEVEL || "info").toLowerCase(),
  dir: process.env.LOG_DIR || path.resolve(process.cwd(), "logs"),
  pretty: String(process.env.LOG_PRETTY || "false").toLowerCase() === "true",
  toFile: String(process.env.LOG_TO_FILE || "true").toLowerCase() === "true",
  maxMb: Number(process.env.LOG_FILE_MAX_MB || 16),
};

const LEVELS = /** @type {const} */ (["trace", "debug", "info", "warn", "error", "fatal"]);
const LEVEL_IDX = Object.fromEntries(LEVELS.map((l, i) => [l, i]));

/* -----------------------------------------------------------------------------
 * File writer with rotation (daily + size)
 * -------------------------------------------------------------------------- */

class RotatingWriter {
  /**
   * @param {string} dir
   * @param {number} maxBytes
   */
  constructor(dir, maxBytes) {
    this.dir = dir;
    this.maxBytes = maxBytes;
    this.currentDate = null; // YYYY-MM-DD
    this.seq = 0;
    this.bytes = 0;
    /** @type {fss.WriteStream | null} */
    this.stream = null;
    /** @type {Array<string>} */
    this.queue = [];
    this.flushing = false;
    this.initPromise = this.init();
  }

  async init() {
    await fs.mkdir(this.dir, { recursive: true });
    await this.rotateIfNeeded(true);
  }

  /**
   * @param {string} line
   */
  async write(line) {
    await this.initPromise;
    this.queue.push(line);
    if (!this.flushing) {
      this.flushing = true;
      try {
        while (this.queue.length) {
          await this.rotateIfNeeded(false);
          const chunk = this.queue.shift();
          if (!chunk) continue;
          await new Promise((resolve, reject) => {
            const data = chunk + "\n";
            this.stream.write(data, (err) => {
              if (err) reject(err);
              else resolve(null);
            });
          });
          this.bytes += Buffer.byteLength(chunk) + 1;
        }
      } finally {
        this.flushing = false;
      }
    }
  }

  async rotateIfNeeded(forceNewDay) {
    const today = new Date().toISOString().slice(0, 10);
    const sizeExceeded = this.bytes >= this.maxBytes;
    const dayChanged = this.currentDate !== today;

    if (forceNewDay || dayChanged || sizeExceeded || !this.stream) {
      if (this.stream) {
        await new Promise((r) => this.stream.end(r));
        this.stream = null;
      }
      if (dayChanged) this.seq = 0;

      const base = `cardsearch-${today}`;
      let file = path.join(this.dir, `${base}.${String(this.seq).padStart(2, "0")}.log`);
      // If file exists and exceeds size, bump seq.
      if (fss.existsSync(file)) {
        const stat = fss.statSync(file);
        if (stat.size >= this.maxBytes) {
          this.seq += 1;
          file = path.join(this.dir, `${base}.${String(this.seq).padStart(2, "0")}.log`);
        }
      }
      this.stream = fss.createWriteStream(file, { flags: "a", encoding: "utf8" });
      try {
        const st = fss.statSync(file);
        this.bytes = st.size;
      } catch {
        this.bytes = 0;
      }
      this.currentDate = today;
    }
  }
}

/* -----------------------------------------------------------------------------
 * Console formatters
 * -------------------------------------------------------------------------- */

function fmtConsolePretty(rec) {
  const t = new Date(rec.time).toISOString();
  const lvl = rec.level.padEnd(5, " ");
  const name = rec.name ? `[${rec.name}] ` : "";
  const ctx = rec.ctx ? ` ${JSON.stringify(rec.ctx)}` : "";
  const msg = rec.msg || "";
  const extra = rec.extra ? ` ${JSON.stringify(rec.extra)}` : "";
  return `${t} ${lvl} ${name}${msg}${ctx}${extra}`;
}

function fmtConsoleCompact(rec) {
  return JSON.stringify(rec);
}

/* -----------------------------------------------------------------------------
 * Logger
 * -------------------------------------------------------------------------- */

/**
 * @typedef {{
 *   name?: string;
 *   level?: string;
 *   ctx?: Record<string, any>;
 * }} LoggerOptions
 */

class Logger {
  /**
   * @param {LoggerOptions} [opts]
   * @param {RotatingWriter|null} writer
   */
  constructor(opts = {}, writer) {
    this.name = opts.name || null;
    this.ctx = opts.ctx || null;
    this.minLevel = (opts.level || ENV.level).toLowerCase();
    this.writer = writer;
  }

  child(ctxAdd = {}) {
    const nextCtx = { ...(this.ctx || {}), ...ctxAdd };
    return new Logger({ name: this.name, level: this.minLevel, ctx: nextCtx }, this.writer);
  }

  level(newLevel) {
    if (!newLevel) return this.minLevel;
    this.minLevel = String(newLevel).toLowerCase();
    return this;
  }

  // ---- level methods

  trace(msg, extra) { return this._log("trace", msg, extra); }
  debug(msg, extra) { return this._log("debug", msg, extra); }
  info(msg, extra)  { return this._log("info",  msg, extra); }
  warn(msg, extra)  { return this._log("warn",  msg, extra); }
  error(msg, extra) { return this._log("error", msg, extra); }
  fatal(msg, extra) { return this._log("fatal", msg, extra); }

  /**
   * Time a block of work.
   * @returns {{ start: (label?:string, extra?:any)=>()=>void }}
   */
  time() {
    const startAt = process.hrtime.bigint();
    const self = this;
    return {
      start(label = "duration", extra) {
        const started = startAt;
        return function end() {
          const endNs = process.hrtime.bigint() - started;
          const ms = Number(endNs / 1000000n);
          self.info(label, { ms, ...(extra || {}) });
        };
      },
    };
  }

  /**
   * Wrap a job with start/end logging and auto error capture.
   * @template T
   * @param {string} name
   * @param {(log: Logger)=>Promise<T>} fn
   * @returns {Promise<T>}
   */
  async wrapJob(name, fn) {
    const jobId = randomUUID();
    const jobLog = this.child({ job: name, jobId });
    const stop = jobLog.time().start("job");
    jobLog.info("job.start");
    try {
      const res = await fn(jobLog);
      stop();
      jobLog.info("job.done", { ok: true });
      return res;
    } catch (err) {
      stop();
      jobLog.error("job.fail", { ok: false, error: serializeError(err) });
      throw err;
    }
  }

  // ---- core

  _log(level, msg, extra) {
    if (LEVEL_IDX[level] < LEVEL_IDX[this.minLevel]) return;

    const rec = {
      time: Date.now(),
      level,
      name: this.name || undefined,
      msg: msg || "",
      ctx: this.ctx || undefined,
      extra: normalizeExtra(extra),
      pid: process.pid,
    };

    // Console
    try {
      if (ENV.pretty) {
        const line = fmtConsolePretty(rec);
        if (level === "error" || level === "fatal") console.error(line);
        else if (level === "warn") console.warn(line);
        else console.log(line);
      } else {
        const line = fmtConsoleCompact(rec);
        if (level === "error" || level === "fatal") console.error(line);
        else if (level === "warn") console.warn(line);
        else console.log(line);
      }
    } catch {
      // swallow console errors
    }

    // File (JSON lines)
    if (ENV.toFile && this.writer) {
      const line = JSON.stringify(rec);
      // fire-and-forget (queued internally)
      this.writer.write(line).catch(() => {});
    }
  }
}

/* -----------------------------------------------------------------------------
 * Public API
 * -------------------------------------------------------------------------- */

let _writer = null;

/**
 * Get a named logger (singleton writer).
 * @param {string} [name]
 */
export function getLogger(name) {
  if (!_writer && ENV.toFile) {
    const maxBytes = Math.max(1, ENV.maxMb | 0) * 1024 * 1024;
    _writer = new RotatingWriter(ENV.dir, maxBytes);
  }
  return new Logger({ name, level: ENV.level }, _writer);
}

/**
 * Convert any thrown value to a safe, serializable object.
 * @param {unknown} err
 */
export function serializeError(err) {
  if (!err) return { message: "Unknown error" };
  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      stack: err.stack,
      code: /** @type {any} */(err).code || undefined,
      cause: err.cause ? serializeError(err.cause) : undefined,
    };
  }
  if (typeof err === "object") {
    try {
      return JSON.parse(JSON.stringify(err));
    } catch {
      return { message: String(err) };
    }
  }
  return { message: String(err) };
}

/* -----------------------------------------------------------------------------
 * Internals
 * -------------------------------------------------------------------------- */

function normalizeExtra(extra) {
  if (extra == null) return undefined;
  if (extra instanceof Error) return serializeError(extra);
  if (typeof extra === "object") {
    try { return JSON.parse(JSON.stringify(extra)); }
    catch { return { note: "unserializable-extra" }; }
  }
  return extra;
}

/* -----------------------------------------------------------------------------
 * Default export
 * -------------------------------------------------------------------------- */

export default {
  getLogger,
  serializeError,
};

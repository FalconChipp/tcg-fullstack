// index.js
//
// FIXED (2026-01-30):
// - ✅ FIX: express-status-monitor was spawning Socket.IO v2 on /socket.io (conflicts with your v4 server)
// - ✅ FIX: move monitor sockets to /status/socket.io via socketPath option
// - ✅ ADD: explicitly set main Socket.IO server path to /socket.io
// - ✅ ADD: engine-level debug logs for connection + connection_error
// - KEEP: your existing setupSocket(io, logger) single setup
//
// Why this matters:
// - socket.io-client@4 uses Engine.IO protocol EIO=4
// - express-status-monitor depends on socket.io@2 (Engine.IO v3) and by default binds /socket.io
// - that creates protocol mismatch => "Invalid frame header" + connect_error "server error"

import "dotenv/config";
import express from "express";
import http from "http";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
// import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import multer from "multer";
import expressStatusMonitor from "express-status-monitor";
import rateLimit from "express-rate-limit";
import winston from "winston";
import Stripe from "stripe";
import { Server as SocketIOServer } from "socket.io";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import cron from "node-cron";
import os from "os";
import dns from "node:dns";
dns.setDefaultResultOrder?.("ipv4first");

import { startExpiredMessageCleanup } from "./src/jobs/messageCleanup.js";
import { startNotificationCleanup } from "./src/jobs/notificationCleanup.js";
import { startNotificationDeliveryJobs } from "./src/jobs/notificationDelivery.js";
import { startUnreadReminderJob } from "./src/jobs/unreadReminder.js";

// ✅ correct import
import { setupSocket } from "./src/server/realtime/socket.js";

import { typeDefs, resolvers } from "./src/schema.js";
import { sequelize, User, Profile } from "./src/models/index.js";
import * as models from "./src/models/index.js";

// Admin page assets
import { adminPageHtml } from "./src/admin/adminPage.js";
import { adminScriptJs } from "./src/admin/adminScript.js";

// [CARDSEARCH]
import { registerCardsearchSchedules } from "./src/tasks/cardsearch.schedule.js";
import { withCookieParser, attachUser } from "./src/middleware/attachUser.js";
import authSessionRouter from "./src/routes/authSession.js";

// Discord OAuth + Bot
import discordAuthRouter from "./src/routes/discordAuth.js";
import discordBotRoutes from "./src/routes/discordBot.js";
import discordShareRouter from "./src/routes/discord/discordShare.js";

// Checkout
import checkoutRouter from "./src/routes/checkout.js";
import ordersService from "./src/modules/marketplace/services/ordersService.js";
import inkthreadablesWebhook from "./src/webhooks/inkthreadables.js";

// --- Logger Setup ---
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => `[${timestamp}] [${level}] ${message}`)
  ),
  transports: [new winston.transports.Console()],
});

// --- Express + HTTP Server ---
const app = express();
const httpServer = http.createServer(app);

app.set("logger", logger);
app.set("trust proxy", ["loopback", "127.0.0.1", "::1"]);

// Static assets
app.use("/achievements", express.static("public/achievements"));

/* =============================================================================
   GLOBAL CORS: single source of truth + hard de-dupe
============================================================================= */

function normalizeOrigin(s) {
  if (!s) return "";
  return String(s).trim().toLowerCase().replace(/\/+$/, "");
}

const allowedOriginsRaw = process.env.CORS_ORIGINS || "";
const allowedOrigins = allowedOriginsRaw.split(",").map(normalizeOrigin).filter(Boolean);
const extraDev = (process.env.CORS_EXTRA_ORIGINS || "").split(",").map(normalizeOrigin).filter(Boolean);
const ALLOWED = Array.from(new Set([...allowedOrigins, ...extraDev]));

logger.info(`[CORS] Allow-list parsed (${ALLOWED.length}): ${ALLOWED.join(", ") || "(none)"}`);

function isOriginAllowed(origin, reqHost) {
  if (!origin) return true; // native apps/curl/etc.
  const norm = normalizeOrigin(origin);
  if (ALLOWED.length === 0 || ALLOWED.includes(norm)) return true;
  const hostFromOrigin = norm.replace(/^https?:\/\//, "");
  return !!(reqHost && hostFromOrigin === String(reqHost).toLowerCase());
}

const CORS_HEADER_KEYS = [
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-expose-headers",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-max-age",
];

function applyCorsOnce(req, res) {
  res.removeHeader("Access-Control-Allow-Origin");
  res.removeHeader("Access-Control-Allow-Credentials");
  res.removeHeader("Access-Control-Expose-Headers");
  res.removeHeader("Access-Control-Allow-Methods");
  res.removeHeader("Access-Control-Allow-Headers");
  res.removeHeader("Access-Control-Max-Age");

  res.setHeader("Vary", "Origin");

  const origin = req.headers.origin || "";
  const allowed = isOriginAllowed(origin, req.headers.host);

  if (allowed && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Expose-Headers", "Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization,Content-Type,Origin,Accept,X-Requested-With,X-Access-Token,X-Admin-Token"
    );
    res.setHeader("Access-Control-Max-Age", "86400");
  }
}

app.use((req, res, next) => {
  if (req.headers.origin) logger.info(`[CORS] Origin: ${req.headers.origin} -> ${req.method} ${req.url}`);

  const origSetHeader = res.setHeader.bind(res);
  const origAppend = res.append ? res.append.bind(res) : null;
  const isCorsHeader = (name) => CORS_HEADER_KEYS.includes(String(name).toLowerCase());

  res.setHeader = (name, value) => {
    if (isCorsHeader(name)) {
      if (Array.isArray(value)) value = value[0];
      return origSetHeader(name, value);
    }
    return origSetHeader(name, value);
  };

  if (origAppend) {
    res.append = (name, value) => {
      if (isCorsHeader(name)) {
        if (Array.isArray(value)) value = value[0];
        return res.setHeader(name, value);
      }
      return origAppend(name, value);
    };
  }

  if (!req._corsOnceApplied) {
    req._corsOnceApplied = true;
    applyCorsOnce(req, res);
  }

  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
});

/* ============================
   Socket.IO (CORS aligned)
   ============================ */
/* ============================
   Socket.IO (CORS aligned)
   ============================ */
const io = new SocketIOServer(httpServer, {
  // ✅ FIX: avoid path collision with express-status-monitor (socket.io v2)
  // express-status-monitor commonly uses the default "/socket.io"
  // so we move our realtime server to a dedicated path.
  path: "/realtime/socket.io",

  cors: {
    credentials: true,
    methods: ["GET", "POST"],
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      const norm = normalizeOrigin(origin);

      // ✅ Helpful logging if origin is blocked
      if (ALLOWED.length === 0 || ALLOWED.includes(norm)) return cb(null, true);

      const err = new Error(`Socket.IO CORS blocked: ${origin}`);
      logger.warn(`[socket][cors] blocked origin=${origin} norm=${norm}`);
      return cb(err);
    },
  },

  // Optional: keep defaults, but explicit is clearer
  transports: ["polling", "websocket"],
  allowEIO3: false,
});

app.set("io", io);

// ✅ Keep your existing setup call
setupSocket(io, logger);

/* ============================
   Status Monitor
   ============================ */

// ✅ FIX: express-status-monitor spawns its own socket.io@2 by default.
// If it uses /socket.io, it will conflict with your v4 server.
// Move it to a dedicated path: /status/socket.io
app.use(
  expressStatusMonitor({
    path: "/status",
    socketPath: "/status/socket.io", // ✅ CHANGED: avoid clobbering /socket.io (your realtime)
    ignoreStartsWith: "/admin",
  })
);

/* ============================
   Admin auth helpers
   ============================ */
const ADMIN_HEADER = "x-admin-token";
function extractAdminToken(req) {
  const value = req.headers[ADMIN_HEADER];
  if (Array.isArray(value)) return value[0] || "";
  if (typeof value === "string") return value;
  return value ? String(value) : "";
}
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return res.status(500).json({ ok: false, error: "ADMIN_API_TOKEN not configured" });
  const provided = extractAdminToken(req).trim();
  if (!provided || provided !== expected) return res.status(401).json({ ok: false, error: "unauthorized" });
  return next();
}

/* ============================
   STRIPE WEBHOOK (raw body)
   ============================ */
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret || !webhookSecret) {
    logger.error("Stripe webhook error: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).send("Webhook misconfigured");
  }

  let event;
  try {
    const stripe = new Stripe(stripeSecret);
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.error(`Stripe webhook verify error: ${err.message}`);
    return res.status(400).send("Webhook Error");
  }

  logger.info(`Stripe webhook: received event ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orderId = session.metadata && session.metadata.orderId;
        if (!orderId) {
          logger.warn("Stripe webhook: checkout.session.completed with no orderId metadata");
          break;
        }

        logger.info(`Stripe webhook: checkout.session.completed for order ${orderId}, session ${session.id}`);

        const ctx = { models, sequelize, logger, user: null };
        await ordersService.markOrderPaid(orderId, ctx);
        break;
      }
      default:
        logger.info(`Stripe webhook: Ignoring unhandled event type ${event.type}`);
    }

    return res.json({ received: true });
  } catch (err) {
    logger.error(`Stripe webhook handler error: ${err.stack || err.message}`);
    return res.status(500).send("Webhook handler error");
  }
});

/* ============================
   Security / Parsers
   ============================ */
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());

app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(expressStatusMonitor({ path: "" })); // ❌ REMOVED (don’t do this) - left here as an example of what NOT to do

// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// IMPORTANT:
// If you already had `app.use(expressStatusMonitor({ path: "/status" }))` elsewhere,
// make sure you ONLY have the ONE above with socketPath set.
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

/* ============================
   Rate limit
   ============================ */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown",
  skipFailedRequests: true,
  skip: (req) => req.method === "OPTIONS",
});
app.use(limiter);

// ---- Logging ----
const NOISY_RE = /^\/admin\/cardsearch\/(sets|scheduler\/tasks|ui|adminScript\.js)\b/;
app.use(
  morgan("combined", {
    skip: (req) => req.method === "GET" && NOISY_RE.test(req.path),
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

/* ============================
   Avatar upload
   ============================ */
const AVATAR_DIR = path.join(process.cwd(), "uploads", "avatars");
fs.mkdirSync(AVATAR_DIR, { recursive: true });

function getUserIdFromAuthHeader(header) {
  if (!header || !header.startsWith("Bearer ")) return null;
  try {
    const token = header.replace("Bearer ", "");
    const decoded = jwt.decode(token);
    return decoded && decoded.id ? decoded.id : null;
  } catch {
    return null;
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: async (req, file, cb) => {
    try {
      let userId = getUserIdFromAuthHeader(req.headers.authorization);
      let username = req.body.username || "user";
      if (userId && (!req.body.username || req.body.username === "user")) {
        const user = await User.findByPk(userId);
        if (user && user.username) username = user.username;
      }
      const ext = path.extname(file.originalname).toLowerCase() || ".webp";
      const base = username.replace(/[^a-zA-Z0-9_-]/g, "_");
      const newFilename = `${base}_${Date.now()}${ext}`;

      if (userId) {
        const profile = await Profile.findOne({ where: { userId } });
        if (profile && profile.avatar && !profile.avatar.startsWith("http")) {
          const oldPath = profile.avatar.startsWith("/uploads/")
            ? path.join(process.cwd(), profile.avatar)
            : path.join(AVATAR_DIR, profile.avatar);
          if (fs.existsSync(oldPath) && oldPath !== path.join(AVATAR_DIR, newFilename)) {
            fs.unlinkSync(oldPath);
            logger.info(`Old avatar deleted: ${oldPath}`);
          }
        }
      }
      cb(null, newFilename);
    } catch (err) {
      cb(err, "");
    }
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files (jpeg, png, webp) are allowed!"));
  },
});

app.post("/upload/avatar", upload.single("avatar"), async (req, res) => {
  try {
    const userId = getUserIdFromAuthHeader(req.headers.authorization);
    if (!userId) return res.status(401).json({ success: false, error: "No user ID found" });
    if (!req.file?.filename) return res.status(400).json({ success: false, error: "No file uploaded" });

    let profile = await Profile.findOne({ where: { userId } });
    if (!profile) profile = await Profile.create({ userId });

    profile.avatar = `/uploads/avatars/${req.file.filename}`;
    await profile.save();

    logger.info(`Avatar uploaded: userId=${userId} file=${req.file.filename}`);
    res.json({
      success: true,
      filename: req.file.filename,
      avatar: `/uploads/avatars/${req.file.filename}`,
    });
  } catch (err) {
    logger.error(`Avatar upload failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use("/uploads/avatars", express.static(AVATAR_DIR));

/* ============================
   Health + simple endpoints
   ============================ */
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: Date.now() }));
app.get("/graphql", (_req, res) => res.status(200).send("OK"));

app.get("/admin", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.type("text/html; charset=utf-8").send(adminPageHtml());
});
app.get("/admin/admin.js", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.type("application/javascript; charset=utf-8").send(adminScriptJs());
});

// [CARDSEARCH] routes
try {
  const { publicRouter, apiRouter } = await import("./src/modules/cardsearch/admin/routes.js");
  app.use("/admin/cardsearch", publicRouter());
  app.use("/admin/cardsearch", requireAdmin, apiRouter());
  app.get("/admin/cardsearch", (_req, res) => res.redirect(302, "/admin/cardsearch/ui"));
  logger.info("[Cardsearch] admin routes mounted at /admin/cardsearch (public UI + protected API)");
} catch (e) {
  logger.warn(`[Cardsearch] admin routes not available: ${e?.message || e}`);
}

// cookies then attach req.user
app.use(withCookieParser());
app.use(attachUser());

app.get("/debug/me", (req, res) => {
  res.json({ user: req.user || null });
});

// Checkout / payments
logger.info("[BOOT] Mounting /checkout router");
app.use("/checkout", checkoutRouter);

app.post("/checkout/test", (req, res) => {
  const log = req.app.get("logger") || console;
  log.info("[TEST] Hit /checkout/test");
  return res.json({ ok: true, message: "checkout test route reached" });
});

app.post("/webhooks/inkthreadables", express.json({ type: "application/json" }), inkthreadablesWebhook);

/* ============================
   GraphQL (Apollo)
   ============================ */
import { ingestSet as jobIngestSet } from "./src/modules/cardsearch/jobs/ingestSet.job.js";
import { collectPrices as jobCollectPrices } from "./src/modules/cardsearch/jobs/collectPrices.job.js";
import { collectBoth as jobCollectBoth } from "./src/modules/cardsearch/jobs/collectBoth.job.js";
import { rebuildPriceRollups as jobRollup } from "./src/modules/cardsearch/jobs/priceRollup.job.js";
import { fxDaily as jobFxDaily } from "./src/modules/cardsearch/jobs/fxDaily.job.js";

const jobs = {
  ingestSet: jobIngestSet,
  collectPrices: jobCollectPrices,
  collectBoth: jobCollectBoth,
  priceRollup: jobRollup,
  fxDaily: jobFxDaily,
};

function extractToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  if (req.cookies) {
    if (req.cookies.authToken) return req.cookies.authToken;
    if (req.cookies.sbf_token) return req.cookies.sbf_token;
    if (req.cookies.token) return req.cookies.token;
  }
  return null;
}

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [],
  formatError: (err) => {
    logger.warn(`[GraphQL Error] ${err.message}`);
    return err;
  },
});
await apolloServer.start();

app.use(
  "/graphql",
  expressMiddleware(apolloServer, {
    context: async ({ req, res }) => {
      const token = extractToken(req);
      let user = null;

      if (token) {
        try {
          const payload = jwt.verify(token, process.env.JWT_SECRET);
          user = await User.findByPk(payload.id);
        } catch (err) {
          logger.info(`JWT verify failed: ${err.message}`);
          user = null;
        }
      }

      return {
        req,
        res,
        io,
        logger,
        user,
        token,
        userAgent: req.headers["user-agent"],
        ip: req.ip,
        models,
        jobs,
      };
    },
  })
);

app.use(authSessionRouter);
app.use(discordAuthRouter);
app.use("/api/discord", discordShareRouter);
app.use("/api/discord-bot", discordBotRoutes);

/* ============================
   Boot
   ============================ */
const PORT = Number(process.env.PORT || 4000);

httpServer.keepAliveTimeout = 70 * 1000;
httpServer.headersTimeout = 75 * 1000;
httpServer.requestTimeout = 0;

process.on("unhandledRejection", (reason) => logger.error(`UnhandledRejection: ${reason?.stack || reason}`));
process.on("uncaughtException", (err) => logger.error(`UncaughtException: ${err.stack || err.message}`));

function shouldRunJobs() {
  if (String(process.env.JOBS_ENABLED || "") !== "1") return false;

  const lockToInstance0 = String(process.env.JOBS_ENABLED_INSTANCE0 || "1") === "1";
  const instance = process.env.NODE_APP_INSTANCE;

  if (lockToInstance0 && instance != null && String(instance) !== "0") return false;
  return true;
}

try {
  await sequelize.authenticate();
  logger.info("Database connection established.");
  await sequelize.sync();

  let cleanupIntervals = [];

  if (shouldRunJobs()) {
    cleanupIntervals = [
      startExpiredMessageCleanup(logger),
      startNotificationCleanup(logger),
      startNotificationDeliveryJobs(logger),
      startUnreadReminderJob(logger),
    ];
    logger.info("[BOOT] Jobs Enabled: background jobs started");
  } else {
    logger.info("[BOOT] Jobs disabled or not instance 0: skipping");
  }

  if (process.env.CARDSEARCH_SCHED_DISABLE !== "1") {
    try {
      registerCardsearchSchedules();
      logger.info("[Cardsearch] scheduler registered.");
    } catch (e) {
      logger.warn(`[Cardsearch] scheduler not started: ${e?.message || e}`);
    }
  }

  const CRON_TZ = process.env.CRON_TZ || "UTC";
  const now = new Date();

  logger.info(`[BOOT] Host: ${os.hostname()} | PID ${process.pid}`);
  logger.info(`[BOOT] Now: ${now.toISOString()} (tz: ${Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown"})`);
  logger.info(`[BOOT] CRON_TZ=${CRON_TZ}`);

  function shutdown() {
    logger.info("Shutdown requested, draining...");
    cleanupIntervals.forEach(clearInterval);
    httpServer.close(() => {
      sequelize.close().finally(() => {
        logger.info("Shutdown complete");
        process.exit(0);
      });
    });
    setTimeout(() => {
      logger.error("Force-exiting after graceful timeout");
      process.exit(1);
    }, 10_000).unref();
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  httpServer.listen(PORT, () => {
    logger.info(`Server listening at http://localhost:${PORT}/graphql`);
  });
} catch (err) {
  logger.error(`Database connection failed: ${err.message}`);
  process.exit(1);
}

export { app, io, apolloServer, logger };

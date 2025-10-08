// index.js

import 'dotenv/config';
import express from 'express';
import http from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import expressStatusMonitor from 'express-status-monitor';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import Stripe from 'stripe';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';
import os from 'os';
import dns from 'node:dns';
dns.setDefaultResultOrder?.('ipv4first');

import { startExpiredMessageCleanup } from './src/jobs/messageCleanup.js';
// import { startUnreadReminderJob } from './src/jobs/unreadReminder.js';
import { startNotificationCleanup } from './src/jobs/notificationCleanup.js';

import { typeDefs, resolvers } from './src/schema.js';
import {
  sequelize,
  User,
  Profile,
} from './src/models/index.js';
import * as models from './src/models/index.js';

// Admin page assets
import { adminPageHtml } from './src/admin/adminPage.js';
import { adminScriptJs } from './src/admin/adminScript.js';

// [CARDSEARCH]
import { registerCardsearchSchedules } from './src/tasks/cardsearch.schedule.js';
import { withCookieParser, attachUser } from "./src/middleware/attachUser.js";
import authSessionRouter from "./src/routes/authSession.js";
import discordAuthRouter from './src/routes/discordAuth.js';

// --- Logger Setup ---
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => `[${timestamp}] [${level}] ${message}`)
  ),
  transports: [new winston.transports.Console()],
});

// --- Express + HTTP Server ---
const app = express();
const httpServer = http.createServer(app);

// Honor X-Forwarded-* when behind a proxy (rate limit, TLS, etc.)
app.set('trust proxy', ['loopback', '127.0.0.1', '::1']);

// Static assets
app.use('/achievements', express.static('public/achievements'));

// --- Socket.IO ---
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
app.set('io', io);

/* ============================
   Admin auth helpers
   ============================ */
const ADMIN_HEADER = 'x-admin-token';
function extractAdminToken(req) {
  const value = req.headers[ADMIN_HEADER];
  if (Array.isArray(value)) return value[0] || '';
  if (typeof value === 'string') return value;
  return value ? String(value) : '';
}
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return res.status(500).json({ ok: false, error: 'ADMIN_API_TOKEN not configured' });
  const provided = extractAdminToken(req).trim();
  if (!provided || provided !== expected) return res.status(401).json({ ok: false, error: 'unauthorized' });
  return next();
}

/* ============================
   STRIPE WEBHOOK (raw body)
   ============================ */
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      // await handleStripeWebhook(event);
      res.json({ received: true });
    } catch (err) {
      logger.error(`Stripe webhook error: ${err.message}`);
      return res.status(400).send('Webhook Error');
    }
  }
);

/* ============================
   CORS / Security / Parsers
   ============================ */
// Log incoming Origin (debug who is calling)
app.use((req, _res, next) => {
  if (req.headers.origin) logger.info(`[CORS] Origin: ${req.headers.origin}`);
  next();
});

function normalizeOrigin(s) {
  if (!s) return '';
  return String(s).trim().toLowerCase().replace(/\/+$/, '');
}

const allowedOriginsRaw = process.env.CORS_ORIGINS || '';
const allowedOrigins = allowedOriginsRaw.split(',').map(normalizeOrigin).filter(Boolean);
const extraDev = (process.env.CORS_EXTRA_ORIGINS || '').split(',').map(normalizeOrigin).filter(Boolean);
const ALLOWED = Array.from(new Set([...allowedOrigins, ...extraDev]));
logger.info(`[CORS] Allow-list parsed (${ALLOWED.length}): ${ALLOWED.join(', ') || '(none)'}`);

const baseCorsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  exposedHeaders: ['Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};
function corsWithReq(req, res, next) {
  const opts = {
    ...baseCorsOptions,
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const norm = normalizeOrigin(origin);
      if (ALLOWED.length === 0 || ALLOWED.includes(norm)) return cb(null, true);

      const host = (req.headers.host || '').toLowerCase();
      const hostFromOrigin = norm.replace(/^https?:\/\//, '');
      if (host && hostFromOrigin === host) return cb(null, true);

      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
  };
  return cors(opts)(req, res, next);
}
app.use(corsWithReq);
app.options('*', corsWithReq);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());

// Parsers AFTER Stripe raw route
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser()); // <-- ensures req.cookies is populated
app.use(expressStatusMonitor({ path: '/status' }));

// Rate limit (skip preflights)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
  skipFailedRequests: true,
  skip: (req) => req.method === 'OPTIONS',
});
app.use(limiter);

// ---- Logging: hide noisy admin data GETs ----
const NOISY_RE = /^\/admin\/cardsearch\/(sets|scheduler\/tasks|ui|adminScript\.js)\b/;
app.use(morgan('combined', {
  skip: (req) => req.method === 'GET' && NOISY_RE.test(req.path),
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

let lastRefreshedLogAt = 0;
function logRefreshedOncePer(minMs, label = 'admin-ui') {
  const now = Date.now();
  if (now - lastRefreshedLogAt >= minMs) {
    logger.info(`[${label}] refreshed`);
    lastRefreshedLogAt = now;
  }
}

/* ============================
   Avatar upload
   ============================ */
const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

function getUserIdFromAuthHeader(header) {
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const token = header.replace('Bearer ', '');
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
      let username = req.body.username || 'user';
      if (userId && (!req.body.username || req.body.username === 'user')) {
        const user = await User.findByPk(userId);
        if (user && user.username) username = user.username;
      }
      const ext = path.extname(file.originalname).toLowerCase() || '.webp';
      const base = username.replace(/[^a-zA-Z0-9_-]/g, '_');
      const newFilename = `${base}_${Date.now()}${ext}`;

      if (userId) {
        const profile = await Profile.findOne({ where: { userId } });
        if (profile && profile.avatar && !profile.avatar.startsWith('http')) {
          const oldPath = profile.avatar.startsWith('/uploads/')
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
      cb(err, '');
    }
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files (jpeg, png, webp) are allowed!'));
  },
});

// Upload API
app.post('/upload/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const userId = getUserIdFromAuthHeader(req.headers.authorization);
    if (!userId) return res.status(401).json({ success: false, error: 'No user ID found' });
    if (!req.file?.filename) return res.status(400).json({ success: false, error: 'No file uploaded' });

    let profile = await Profile.findOne({ where: { userId } });
    if (!profile) profile = await Profile.create({ userId });

    profile.avatar = `/uploads/avatars/${req.file.filename}`;
    await profile.save();

    logger.info(`Avatar uploaded: userId=${userId} file=${req.file.filename}`);
    res.json({ success: true, filename: req.file.filename, avatar: `/uploads/avatars/${req.file.filename}` });
  } catch (err) {
    logger.error(`Avatar upload failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve avatars
app.use('/uploads/avatars', express.static(AVATAR_DIR));

/* ============================
   Health + simple endpoints
   ============================ */
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));
app.get('/graphql', (_req, res) => res.status(200).send('OK'));

// Admin UI
app.get('/admin', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('text/html; charset=utf-8').send(adminPageHtml());
});
app.get('/admin/admin.js', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('application/javascript; charset=utf-8').send(adminScriptJs());
});

// [CARDSEARCH] routes
try {
  const { publicRouter, apiRouter } = await import('./src/modules/cardsearch/admin/routes.js');

  // Public assets/pages (no auth)
  app.use('/admin/cardsearch', publicRouter());

  // Protected JSON API (requires x-admin-token)
  app.use('/admin/cardsearch', requireAdmin, apiRouter());

  // Optional convenience redirect
  app.get('/admin/cardsearch', (_req, res) => res.redirect(302, '/admin/cardsearch/ui'));

  logger.info('[Cardsearch] admin routes mounted at /admin/cardsearch (public UI + protected API)');
} catch (e) {
  logger.warn(`[Cardsearch] admin routes not available: ${e?.message || e}`);
}

// NEW: cookies then attach req.user
app.use(withCookieParser());
app.use(attachUser());

app.get("/debug/me", (req, res) => {
  res.json({ user: req.user || null });
});

app.use(authSessionRouter);

// Discord Auth Router 
app.use(discordAuthRouter);

/* ============================
   GraphQL (Apollo)
   ============================ */

// ADDED: robust extractor for raw JWT for GraphQL context
function extractToken(req) {
  // 1) Authorization: Bearer <jwt>
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  // 2) Cookie fallbacks — align with frontend cookie names
  if (req.cookies) {
    // CHANGED: check 'authToken' first (what the FE writes)
    if (req.cookies.authToken) return req.cookies.authToken;     // ADDED
    if (req.cookies.sbf_token) return req.cookies.sbf_token;     // legacy
    if (req.cookies.token) return req.cookies.token;             // legacy
  }
  return null;
}

const apolloServer = new ApolloServer({
  typeDefs,          // cardsearch SDL is merged inside src/schema.js
  resolvers,         // cardsearch resolvers too
  plugins: [],
  formatError: (err) => {
    logger.warn(`[GraphQL Error] ${err.message}`);
    return err;
  },
});
await apolloServer.start();

app.use(
  '/graphql',
  expressMiddleware(apolloServer, {
    context: async ({ req, res }) => {
      // CHANGED: use robust extractor
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
        user,      // may be null
        token,     // RAW JWT (no "Bearer ")
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        models,
      };
    },
  })
);

/* ============================
   Boot + Scheduler + Cron
   ============================ */
const PORT = Number(process.env.PORT || 4000);

// Align with proxy timeouts
httpServer.keepAliveTimeout = 70 * 1000;
httpServer.headersTimeout = 75 * 1000;
httpServer.requestTimeout = 0;

process.on('unhandledRejection', (reason) => logger.error(`UnhandledRejection: ${reason?.stack || reason}`));
process.on('uncaughtException', (err) => logger.error(`UncaughtException: ${err.stack || err.message}`));

try {
  await sequelize.authenticate();
  logger.info('Database connection established.');
  await sequelize.sync();

  const cleanupIntervals = [
    startExpiredMessageCleanup(logger),
    // startUnreadReminderJob(logger),
    startNotificationCleanup(logger),
  ];

  // [CARDSEARCH] schedules
  if (process.env.CARDSEARCH_SCHED_DISABLE !== '1') {
    try {
      registerCardsearchSchedules();
      logger.info('[Cardsearch] scheduler registered.');
    } catch (e) {
      logger.warn(`[Cardsearch] scheduler not started: ${e?.message || e}`);
    }
  }

  const CRON_TZ = process.env.CRON_TZ || 'UTC';

  // Boot diagnostics
  const now = new Date();
  logger.info(`[BOOT] Host: ${os.hostname()} | PID ${process.pid}`);
  logger.info(`[BOOT] Now: ${now.toISOString()} (tz: ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'})`);
  logger.info(`[BOOT] CRON_TZ=${CRON_TZ}`);

  // Graceful shutdown
  function shutdown() {
    logger.info('Shutdown requested, draining...');
    cleanupIntervals.forEach(clearInterval);
    httpServer.close(() => {
      sequelize.close().finally(() => {
        logger.info('Shutdown complete');
        process.exit(0);
      });
    });
    setTimeout(() => {
      logger.error('Force-exiting after graceful timeout');
      process.exit(1);
    }, 10_000).unref();
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  httpServer.listen(PORT, () => {
    logger.info(`Server listening at http://localhost:${PORT}/graphql`);
  });
} catch (err) {
  logger.error(`Database connection failed: ${err.message}`);
  process.exit(1);
}

export { app, io, apolloServer, logger };

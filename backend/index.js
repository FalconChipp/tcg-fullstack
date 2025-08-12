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
import { startExpiredMessageCleanup } from './src/jobs/messageCleanup.js';
import { startUnreadReminderJob } from './src/jobs/unreadReminder.js';
import { startNotificationCleanup } from './src/jobs/notificationCleanup.js';

import { typeDefs, resolvers } from './src/schema.js';
import { sequelize, User, Profile } from './src/models/index.js';
import * as models from './src/models/index.js'; // instead of destructuring

// --- Logger Setup ---
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // CHANGED: configurable level
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) =>
      `[${timestamp}] [${level}] ${message}`
    )
  ),
  transports: [new winston.transports.Console()],
});

// --- Express + HTTP Server ---
const app = express();
const httpServer = http.createServer(app);

// CHANGED: trust proxy to honor X-Forwarded-* from NGINX and fix express-rate-limit
app.set('trust proxy', ['loopback', '127.0.0.1', '::1']);

// Serve static assets
app.use('/achievements', express.static('public/achievements'));

// --- Socket.IO ---
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
app.set('io', io);

// ======================================================================
// STRIPE WEBHOOKS MUST COME **BEFORE** JSON BODY PARSING
// ======================================================================

// MOVED: Stripe webhook route BEFORE any bodyParser.json() so raw body is preserved
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      // TODO: implement handleStripeWebhook(event)
      // await handleStripeWebhook(event);
      res.json({ received: true });
    } catch (err) {
      logger.error(`Stripe webhook error: ${err.message}`);
      return res.status(400).send('Webhook Error');
    }
  }
);

// --- CORS / Security / Parsers ---
// CHANGED: allow configured origins; allow no-origin (mobile apps/curl)
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Origin',
      'X-Requested-With',
      'Accept',
      'X-Access-Token'
    ],
    exposedHeaders: ['Authorization']
  })
);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // ADDED: typical for asset sharing
}));
app.use(compression());

// CHANGED: JSON/body parsers come AFTER Stripe raw route
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(expressStatusMonitor({ path: '/status' })); // CHANGED: explicit path

// CHANGED: rate limit with safe keyGenerator and higher default ceiling
const limiter = rateLimit({
  windowMs: 60 * 1000,          // 1 minute window
  max: 600,                     // allow more burst for GraphQL
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
  skipFailedRequests: true,     // do not count 4xx/5xx
});
app.use(limiter);

// CHANGED: morgan uses info level; avoid spamming errors for normal flow
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// --- AVATAR UPLOAD SETUP ---
const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

// Helper: Decode JWT to get user ID (safe, only returns id)
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

      // If username not provided, look up by userId
      let username = req.body.username || 'user';
      if (userId && (!req.body.username || req.body.username === 'user')) {
        const user = await User.findByPk(userId);
        if (user && user.username) username = user.username;
      }
      const ext = path.extname(file.originalname).toLowerCase() || '.webp';
      const base = username.replace(/[^a-zA-Z0-9_-]/g, '_');
      const newFilename = `${base}_${Date.now()}${ext}`;

      // Remove old avatar if the user's profile has one stored
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/webp'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, png, webp) are allowed!'));
    }
  },
});

// --- Avatar Upload API ---
app.post('/upload/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const userId = getUserIdFromAuthHeader(req.headers.authorization);

    if (!userId) {
      return res.status(401).json({ success: false, error: 'No user ID found' });
    }
    if (!req.file?.filename) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

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

// Serve avatar images statically
app.use('/uploads/avatars', express.static(AVATAR_DIR));

// --- Health Check Route ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Optional: GET /graphql landing (handy for NGINX uptime tests)
app.get('/graphql', (_req, res) => res.status(200).send('OK'));

// --- GraphQL Apollo Setup ---
const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [],
  formatError: (err) => {
    logger.warn(`[GraphQL Error] ${err.message}`); // CHANGED: warn instead of error for noise control
    return err;
  },
});
await apolloServer.start();

app.use(
  '/graphql',
  expressMiddleware(apolloServer, {
    context: async ({ req, res }) => {
      // Extract token (try all casings and sources)
      let token =
        req.headers.authorization?.replace('Bearer ', '') ||
        req.headers.Authorization?.replace('Bearer ', '') ||
        req.cookies.token ||
        null;

      // CHANGED: lower log level; avoid spamming error logs on normal ops
      logger.debug?.(`Authorization header: ${req.headers.authorization || ''}`);
      logger.debug?.(`Token present: ${Boolean(token)}`);

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
        user,          // for resolvers that check context.user
        token,         // for legacy requireAdmin(token) etc
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        models,
      };
    }
  })
);

// --- Start DB, then Server ---
const PORT = Number(process.env.PORT || 4000);

// CHANGED: HTTP timeouts aligned with NGINX (avoid premature closes → 504)
httpServer.keepAliveTimeout = 70 * 1000;
httpServer.headersTimeout   = 75 * 1000;
httpServer.requestTimeout   = 0; // disable per-request cap at Node layer

// CHANGED: Global crash shields so a bad resolver/external API doesn't kill PM2
process.on('unhandledRejection', (reason) => {
  logger.error(`UnhandledRejection: ${reason?.stack || reason}`);
});
process.on('uncaughtException', (err) => {
  logger.error(`UncaughtException: ${err.stack || err.message}`);
});

try {
  await sequelize.authenticate();
  logger.info('Database connection established.');
  await sequelize.sync(); // NOTE: use migrations in production

  const cleanupIntervals = [
    startExpiredMessageCleanup(logger),
    startUnreadReminderJob(logger),
    startNotificationCleanup(logger),
  ];

  // CHANGED: Graceful shutdown with timeout
  function shutdown() {
    logger.info('Shutdown requested, draining...');
    cleanupIntervals.forEach(clearInterval);
    // Stop taking new connections
    httpServer.close(() => {
      sequelize.close().finally(() => {
        logger.info('Shutdown complete');
        process.exit(0);
      });
    });
    // Force exit if something hangs
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

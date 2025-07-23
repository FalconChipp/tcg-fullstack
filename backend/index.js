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
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp }) =>
      `[${timestamp}] [${level}] ${message}`
    )
  ),
  transports: [new winston.transports.Console()],
});

// --- Express Setup ---
const app = express();
const httpServer = http.createServer(app);
app.use('/achievements', express.static('public/achievements'));

// --- Socket.IO ---
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
app.set('io', io);

// --- Middleware ---
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
app.use(helmet());
app.use(compression());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(expressStatusMonitor());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

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
          const oldAvatarPath = profile.avatar.startsWith('/uploads/')
            ? path.join(process.cwd(), profile.avatar)
            : path.join(AVATAR_DIR, profile.avatar);
          if (
            fs.existsSync(oldAvatarPath) &&
            oldAvatarPath !== path.join(AVATAR_DIR, newFilename)
          ) {
            fs.unlinkSync(oldAvatarPath);
            logger.info(`Old avatar deleted: ${oldAvatarPath}`);
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

    // Update profile avatar field to new file
    let profile = await Profile.findOne({ where: { userId } });
    if (!profile) {
      profile = await Profile.create({ userId });
    }
    profile.avatar = `/uploads/avatars/${req.file.filename}`;
    await profile.save();

    logger.info(
      `Avatar uploaded: userId=${userId} file=${req.file.filename}`
    );
    res.json({
      success: true,
      filename: req.file.filename,
      avatar: `/uploads/avatars/${req.file.filename}`,
    });
  } catch (err) {
    logger.error('Avatar upload failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Serve avatar images statically ---
app.use('/uploads/avatars', express.static(AVATAR_DIR));

// --- Stripe Webhooks ---
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    try {
      const event = new Stripe(process.env.STRIPE_SECRET_KEY).webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      await handleStripeWebhook(event);
      res.json({ received: true });
    } catch (err) {
      logger.error('Stripe webhook error', err);
      res.status(400).send('Webhook Error');
    }
  }
);
// --- Health Check Route ---
app.get('/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ status: 'ok', timestamp: Date.now() });
});

// --- GraphQL Apollo Setup ---
const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [],
  formatError: (err) => {
    logger.error(`[GraphQL Error] ${err.message}`, err.extensions || {});
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

      logger.error("Authorization header:", req.headers.authorization);
      logger.error("Token:", token);

      let user = null;
      if (token) {
        try {
          const payload = jwt.verify(token, process.env.JWT_SECRET);
          logger.error("Decoded JWT payload:", payload);
          user = await User.findByPk(payload.id);
          logger.error("User from DB:", user ? { id: user.id, username: user.username, isAdmin: user.isAdmin } : null);
        } catch (err) {
          logger.error("JWT verify error:", err.message);
          user = null;
        }
      } else {
        logger.error("No token provided");
      }

      // Always log what we return for context user
      logger.error("Final context user:", user);

      return {
        req,
        res,
        io,
        logger,
        user,          // for resolvers that check context.user
        token,         // for requireAdmin(token) and other legacy resolvers
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        models,
      };
    }
  })
);

// --- Start DB, then Server ---
const PORT = process.env.PORT || 4000;
try {
  await sequelize.authenticate();
  logger.info('Database connection established.');
  await sequelize.sync(); // For production, use migrations!
  const cleanupIntervals = [
    startExpiredMessageCleanup(logger),
    startUnreadReminderJob(logger),
    startNotificationCleanup(logger),
  ];

  function shutdown() {
    cleanupIntervals.forEach(clearInterval);
    httpServer.close(() => {
      sequelize.close().then(() => process.exit(0));
    });
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (err) {
  logger.error('Database connection failed:', err);
  process.exit(1);
}
httpServer.listen(PORT, () => {
  logger.info(`Server listening at http://localhost:${PORT}/graphql`);
});

export { app, io, apolloServer, logger };

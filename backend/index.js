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
import expressStatusMonitor from 'express-status-monitor';
import winston from 'winston';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { avatarUpload } from './src/utils/avatarUpload.js';
import { verifyJwt } from './src/modules/auth/helpers.js';
import { startExpiredMessageCleanup } from './src/jobs/messageCleanup.js';
import { startUnreadReminderJob } from './src/jobs/unreadReminder.js';
import { startNotificationCleanup } from './src/jobs/notificationCleanup.js';

import { typeDefs, resolvers } from './src/schema.js';
import { sequelize, Profile } from './src/models/index.js';

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

// --- Socket.IO ---
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
app.set('io', io);

// --- Middleware ---
app.use(cors({ origin: true, credentials: true }));
app.use(helmet());
app.use(compression());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(expressStatusMonitor());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// --- AVATAR UPLOAD SETUP ---
const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

// Simple authentication middleware using JWT
function authenticateUser(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }
  try {
    const token = header.replace('Bearer ', '');
    req.user = verifyJwt(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Avatar Upload API ---
app.post(
  '/upload/avatar',
  authenticateUser,
  avatarUpload.single('avatar'),
  async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: 'No file uploaded' });
    }
    try {
      const profile = await Profile.findOne({ where: { userId: req.user.id } });
      if (!profile) {
        return res
          .status(404)
          .json({ success: false, error: 'Profile not found' });
      }

      if (profile.avatar && profile.avatar.startsWith('/uploads/avatars/')) {
        const oldPath = path.join(
          process.cwd(),
          profile.avatar.replace(/^\//, '')
        );
        try {
          await fs.promises.unlink(oldPath);
        } catch {}
      }

      const newPath = `/uploads/avatars/${req.file.filename}`;
      profile.avatar = newPath;
      await profile.save();

      logger.info(`Avatar uploaded: userId=${req.user.id} file=${req.file.filename}`);
      res.json({ success: true, avatar: newPath });
    } catch (err) {
      logger.error('Avatar upload failed:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
);

// --- Serve avatar images statically ---
app.use('/uploads/avatars', express.static(AVATAR_DIR));

// --- Stripe Webhooks ---
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    await handleStripeWebhook(JSON.parse(req.body.toString()));
    res.json({ received: true });
  } catch (err) {
    logger.error("Stripe webhook error", err);
    res.status(400).send("Webhook Error");
  }
});
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
    context: async ({ req, res }) => ({
      req,
      res,
      io,
      logger,
      token: req.headers.authorization?.replace('Bearer ', '') || req.cookies.token || null,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    }),
  })
);

// --- Start DB, then Server ---
const PORT = process.env.PORT || 4000;
try {
  await sequelize.authenticate();
  logger.info('Database connection established.');
  await sequelize.sync(); // For production, use migrations!
  startExpiredMessageCleanup(logger);
  startUnreadReminderJob(logger);
  startNotificationCleanup(logger);
} catch (err) {
  logger.error('Database connection failed:', err);
  process.exit(1);
}
httpServer.listen(PORT, () => {
  logger.info(`Server listening at http://localhost:${PORT}/graphql`);
});

export { app, io, apolloServer, logger };

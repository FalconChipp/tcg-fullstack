// src/server/realtime/socket.js
//
// UPDATED (2026-01-30):
// - ADD: explicit Engine.IO + Socket.IO handshake logging (origin, transport, hasToken)
// - ADD: proper "connect_error" reasons via next(new Error(...)) using io.use middleware
// - CHANGE: move auth to io.use so client receives a real error message (instead of silent disconnect)
// - KEEP: room join == userId
// - KEEP: typing relay + mute/block suppression
//
// Why:
// Your client is seeing `connect_error: server error` with no server logs.
// That typically means auth fails early and the server disconnects without a reason.
// Moving auth into `io.use` allows Socket.IO to send a *real* connect_error message.
//

import { Op } from "sequelize";
import { verifyJwt } from "../../modules/auth/helpers.js";
import { ChatMute, ChatBlock } from "../../models/index.js";

async function isBlockedBetween(a, b) {
  const aId = String(a);
  const bId = String(b);

  const row = await ChatBlock.findOne({
    where: {
      [Op.or]: [
        { blockerId: aId, blockedId: bId },
        { blockerId: bId, blockedId: aId },
      ],
    },
  });

  return !!row;
}

async function isMutedForReceiver(receiverId, senderId) {
  const rId = String(receiverId);
  const sId = String(senderId);

  const mute = await ChatMute.findOne({
    where: { userId: rId, otherUserId: sId },
  });

  if (!mute) return false;
  if (!mute.mutedUntil) return true; // null => forever

  const until = new Date(mute.mutedUntil);
  if (Number.isNaN(until.getTime())) return true;

  return until.getTime() > Date.now();
}

function safeMsg(e) {
  return e?.message ? String(e.message) : String(e || "");
}

function extractTokenFromSocket(socket) {
  // Accept token via socket.handshake.auth.token (recommended)
  // Fallback: ?token= query param
  const raw =
    socket?.handshake?.auth?.token ||
    socket?.handshake?.query?.token ||
    null;

  if (!raw) return null;

  // IMPORTANT:
  // Some helpers expect "Bearer <token>", others expect raw token.
  // We normalize here to raw token only.
  const s = String(raw).trim();
  if (!s) return null;
  return s.startsWith("Bearer ") ? s.slice(7).trim() : s;
}

export function setupSocket(io, logger = console) {
  // ---------------------------------------------------------------------------
  // Engine.IO low-level visibility (handshake/polling)
  // ---------------------------------------------------------------------------
  try {
    io.engine.on("initial_headers", (_headers, req) => {
      logger?.info?.(
        `[socket:engine] initial_headers url=${req?.url || ""} origin=${req?.headers?.origin || ""}`
      );
    });

    io.engine.on("connection_error", (err) => {
      logger?.warn?.(
        `[socket:engine] connection_error code=${err?.code || "?"} message=${safeMsg(err)}`
      );
    });
  } catch (e) {
    logger?.warn?.("[socket] unable to attach engine logs", e);
  }

  // ---------------------------------------------------------------------------
  // Auth middleware (THIS is what makes connect_error readable in the client)
  // ---------------------------------------------------------------------------
  io.use((socket, next) => {
    try {
      const token = extractTokenFromSocket(socket);

      const origin = socket?.handshake?.headers?.origin || "";
      const ua = socket?.handshake?.headers?.["user-agent"] || "";
      const transport = socket?.conn?.transport?.name || "unknown";

      logger?.info?.(
        `[socket] handshake origin=${origin || "(none)"} transport=${transport} tokenPresent=${!!token}`
      );

      if (!token) {
        return next(new Error("SOCKET_AUTH_MISSING_TOKEN"));
      }

      // verifyJwt should throw on invalid token. We catch and return message to client.
      const payload = verifyJwt(String(token));
      if (!payload || !payload.id) {
        return next(new Error("SOCKET_AUTH_INVALID_PAYLOAD"));
      }

      socket.data.userId = String(payload.id);
      return next();
    } catch (e) {
      logger?.warn?.(`[socket] auth failed: ${safeMsg(e)}`);
      return next(new Error(`SOCKET_AUTH_FAILED:${safeMsg(e) || "unknown"}`));
    }
  });

  // ---------------------------------------------------------------------------
  // Connection handler
  // ---------------------------------------------------------------------------
  io.on("connection", async (socket) => {
    const userId = String(socket.data.userId || "");

    try {
      if (!userId) {
        // Should not happen due to io.use, but keep defensive
        socket.disconnect(true);
        return;
      }

      // Join personal room for direct emits
      socket.join(userId);

      logger?.info?.(`[socket] connected user=${userId} id=${socket.id}`);

      // Typing relay: client emits { toUserId, isTyping }
      socket.on("typing", async (data) => {
        try {
          const fromId = String(socket.data.userId || "");
          const toId = String(data?.toUserId || "");
          const isTyping = !!data?.isTyping;

          if (!fromId || !toId) return;
          if (fromId === toId) return;

          // Blocked either way? ignore
          if (await isBlockedBetween(fromId, toId)) return;

          // Recipient muted sender? suppress typing
          if (await isMutedForReceiver(toId, fromId)) return;

          io.to(String(toId)).emit("typing", { from: fromId, isTyping });
        } catch (e) {
          logger?.warn?.(`[socket] typing error: ${safeMsg(e)}`);
        }
      });

      socket.on("disconnect", (reason) => {
        logger?.info?.(`[socket] disconnected user=${userId} reason=${reason}`);
      });
    } catch (e) {
      logger?.warn?.(`[socket] connection handler error: ${safeMsg(e)}`);
      socket.disconnect(true);
    }
  });
}

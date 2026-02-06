import path from 'path';
import fs from 'fs';
import { Op } from 'sequelize';
import {
  Trade,
  TradeCard,
  TradeProof,
  TradeDispute,
  m_Card,
  User,
} from '../../models/index.js';
import { requireAuth } from './helpers.js';
import { requireAdmin } from '../users/helpers.js';
import { notifyUser } from '../../utils/notifications.js';
import { generateProofCode, moderateProofImage, saveBase64Image } from '../marketplace/helpers.js';

const proofCodes = new Map();
const DEFAULT_PAGE_SIZE = 20;
const PROOF_DIR = path.join(process.cwd(), 'uploads', 'trade_proofs');

const resolvers = {
  Query: {
    myTrades: async (_, { status, page = 1, pageSize = DEFAULT_PAGE_SIZE }, { token }) => {
      const payload = requireAuth(token);
      const where = {
        [Op.or]: [{ partyAId: payload.id }, { partyBId: payload.id }],
      };
      if (status) where.status = status;
      const { count, rows } = await Trade.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      return { trades: rows, total: count, page, pageSize };
    },
    trade: async (_, { id }, { token }) => {
      const payload = token ? requireAuth(token) : null;
      const trade = await Trade.findByPk(id, { include: [{ model: TradeCard, as: 'cards' }] });
      if (!trade) return null;
      if (payload && (payload.id === trade.partyAId || payload.id === trade.partyBId || payload.isAdmin)) {
        return trade;
      }
      if (!payload) return null;
      throw new Error('Not authorized');
    },
    browseTrades: async (_, { filter = {}, page = 1, pageSize = DEFAULT_PAGE_SIZE }) => {
      const where = {};
      if (filter.status) where.status = filter.status;
      const { count, rows } = await Trade.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      return { trades: rows, total: count, page, pageSize };
    },
    tradeDisputes: async (_, { status, page = 1, pageSize = DEFAULT_PAGE_SIZE }, { token }) => {
      await requireAdmin(token);
      const where = {};
      if (status) where.status = status;
      return TradeDispute.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
    },
    tradeProof: async (_, { tradeId, userId }, { token }) => {
      const payload = requireAuth(token);
      const trade = await Trade.findByPk(tradeId);
      if (!trade) throw new Error('Trade not found');
      if (
        !payload.isAdmin &&
        payload.id !== trade.partyAId &&
        payload.id !== trade.partyBId
      ) {
        throw new Error('Not authorized');
      }
      return TradeProof.findOne({ where: { tradeId, userId } });
    },
  },
  Mutation: {
    initiateTrade: async (_, { userId, offeredCards = [], wantedCards = [], message }, { token }) => {
      const payload = requireAuth(token);
      const t = await Trade.sequelize.transaction();
      try {
        const trade = await Trade.create(
          { partyAId: payload.id, partyBId: userId, initiatorId: payload.id },
          { transaction: t }
        );
        const cardRecords = [];
        for (const c of offeredCards) {
          cardRecords.push({
            tradeId: trade.id,
            userId: payload.id,
            cardId: c.cardId,
            quantity: c.quantity,
            condition: c.condition,
            notes: c.notes,
            offeredOrWanted: 'offered',
          });
        }
        for (const c of wantedCards) {
          cardRecords.push({
            tradeId: trade.id,
            userId: userId,
            cardId: c.cardId,
            quantity: c.quantity,
            condition: c.condition,
            notes: c.notes,
            offeredOrWanted: 'wanted',
          });
        }
        if (cardRecords.length) await TradeCard.bulkCreate(cardRecords, { transaction: t });
        await t.commit();
        await notifyUser({
          userId,
          type: 'trade',
          title: 'New Trade Offer',
          body: message || 'You have received a new trade offer.',
          linkUrl: `/trades/${trade.id}`,
        });
        return trade;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },
    respondToTrade: async (_, { tradeId, accept, counterOffer = [] }, { token }) => {
      const payload = requireAuth(token);
      const trade = await Trade.findByPk(tradeId);
      if (!trade) throw new Error('Trade not found');
      if (payload.id !== trade.partyBId && payload.id !== trade.partyAId) {
        throw new Error('Not authorized');
      }
      if (accept) {
        trade.status = 'confirmed';
        await trade.save();
        await notifyUser({
          userId: trade.partyAId === payload.id ? trade.partyBId : trade.partyAId,
          type: 'trade',
          title: 'Trade Accepted',
          body: 'Your trade offer was accepted.',
          linkUrl: `/trades/${trade.id}`,
        });
        return trade;
      }
      if (counterOffer.length) {
        await TradeCard.destroy({ where: { tradeId } });
        const records = counterOffer.map((c) => ({
          tradeId,
          userId: payload.id,
          cardId: c.cardId,
          quantity: c.quantity,
          condition: c.condition,
          notes: c.notes,
          offeredOrWanted: 'offered',
        }));
        await TradeCard.bulkCreate(records);
      }
      trade.status = 'pending';
      await trade.save();
      return trade;
    },
    lockTrade: async (_, { tradeId }, { token }) => {
      const payload = requireAuth(token);
      const trade = await Trade.findByPk(tradeId);
      if (!trade) throw new Error('Trade not found');
      if (payload.id !== trade.partyAId && payload.id !== trade.partyBId) throw new Error('Not authorized');
      trade.lockedAt = new Date();
      trade.status = 'confirmed';
      await trade.save();
      return trade;
    },
    uploadTradeProof: async (_, { tradeId, proofImage, proofCode }, { token }) => {
      const payload = requireAuth(token);
      const trade = await Trade.findByPk(tradeId);
      if (!trade) throw new Error('Trade not found');
      if (payload.id !== trade.partyAId && payload.id !== trade.partyBId) throw new Error('Not authorized');
      fs.mkdirSync(PROOF_DIR, { recursive: true });
      const filePath = saveBase64Image(proofImage, PROOF_DIR);
      const passed = await moderateProofImage(filePath, proofCode).catch(() => false);
      if (!passed) {
        fs.unlinkSync(filePath);
        throw new Error('Proof image failed moderation');
      }
      const tp = await TradeProof.create({
        tradeId,
        userId: payload.id,
        proofImage: `/uploads/trade_proofs/${path.basename(filePath)}`,
        proofCode,
        uploadedAt: new Date(),
        moderationResult: 'approved',
        moderatedAt: new Date(),
      });
      return tp;
    },
    submitTracking: async (_, { tradeId, trackingNumber }, { token }) => {
      const payload = requireAuth(token);
      const trade = await Trade.findByPk(tradeId);
      if (!trade) throw new Error('Trade not found');
      if (payload.id === trade.partyAId) trade.trackingNumberA = trackingNumber;
      else if (payload.id === trade.partyBId) trade.trackingNumberB = trackingNumber;
      else throw new Error('Not authorized');
      trade.status = 'in_transit';
      await trade.save();
      return trade;
    },
    confirmReceived: async (_, { tradeId }, { token }) => {
      const payload = requireAuth(token);
      const trade = await Trade.findByPk(tradeId);
      if (!trade) throw new Error('Trade not found');
      if (payload.id !== trade.partyAId && payload.id !== trade.partyBId) throw new Error('Not authorized');
      trade.status = 'completed';
      trade.completedAt = new Date();
      await trade.save();
      await notifyUser({
        userId: trade.partyAId === payload.id ? trade.partyBId : trade.partyAId,
        type: 'trade',
        title: 'Trade Completed',
        body: 'Your trade has been marked completed.',
        linkUrl: `/trades/${trade.id}`,
      });
      return trade;
    },
    raiseTradeDispute: async (_, { tradeId, reason }, { token }) => {
      const payload = requireAuth(token);
      const trade = await Trade.findByPk(tradeId);
      if (!trade) throw new Error('Trade not found');
      if (payload.id !== trade.partyAId && payload.id !== trade.partyBId) throw new Error('Not authorized');
      const dispute = await TradeDispute.create({ tradeId, raisedById: payload.id, reason });
      trade.status = 'disputed';
      trade.disputeId = dispute.id;
      await trade.save();
      return dispute;
    },
    adminResolveTradeDispute: async (_, { tradeId, resolution }, { token }) => {
      await requireAdmin(token);
      const trade = await Trade.findByPk(tradeId);
      if (!trade || !trade.disputeId) throw new Error('Trade/dispute not found');
      const dispute = await TradeDispute.findByPk(trade.disputeId);
      if (!dispute) throw new Error('Dispute not found');
      dispute.status = 'resolved';
      dispute.resolution = resolution;
      await dispute.save();
      trade.status = 'completed';
      trade.adminNotes = resolution;
      await trade.save();
      return dispute;
    },
    blockUserFromTrade: async (_, { userId }, { token }) => {
      await requireAdmin(token);
      // Placeholder logic
      return true;
    },
    leaveTradeFeedback: async (_, { tradeId, rating, review }, { token }) => {
      requireAuth(token);
      // TODO: integrate with reputation system
      return true;
    },
  },
  Trade: {
    cards: (trade) => TradeCard.findAll({ where: { tradeId: trade.id } }),
    proofs: (trade) => TradeProof.findAll({ where: { tradeId: trade.id } }),
    disputes: (trade) => TradeDispute.findAll({ where: { tradeId: trade.id } }),
    partyA: (trade) => User.findByPk(trade.partyAId),
    partyB: (trade) => User.findByPk(trade.partyBId),
    initiator: (trade) => User.findByPk(trade.initiatorId),
  },
  TradeCard: {
    card: (tc) => Card.findByPk(tc.cardId),
    user: (tc) => User.findByPk(tc.userId),
  },
  TradeProof: {
    user: (tp) => User.findByPk(tp.userId),
  },
  TradeDispute: {
    raisedBy: (td) => User.findByPk(td.raisedById),
  },
};

export default resolvers;

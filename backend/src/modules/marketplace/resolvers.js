import path from 'path';
import fs from 'fs';
import { Listing, Offer, User } from '../../models/index.js';
import { requireAuth } from '../collection/helpers.js';
import { generateProofCode, moderateProofImage, saveBase64Image } from './helpers.js';

const proofCodes = new Map();
const PROOF_DIR = path.join(process.cwd(), 'uploads', 'proofs');

const DEFAULT_PAGE_SIZE = 20;

const resolvers = {
  Query: {
    myMarketplaceListings: async (_, { page = 1, pageSize = DEFAULT_PAGE_SIZE }, { token }) => {
      const payload = requireAuth(token);
      const { rows, count } = await Listing.findAndCountAll({
        where: { userId: payload.id },
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: [['createdAt', 'DESC']],
      });
      return { listings: rows, total: count, page, pageSize };
    },
    marketplaceListing: async (_, { id }) => Listing.findByPk(id),
    browseMarketplaceListings: async (_, { page = 1, pageSize = DEFAULT_PAGE_SIZE, cardId, sellerId }) => {
      const where = { status: 'active' };
      if (cardId) where.cardId = cardId;
      if (sellerId) where.userId = sellerId;
      const { rows, count } = await Listing.findAndCountAll({
        where,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: [['createdAt', 'DESC']],
      });
      return { listings: rows, total: count, page, pageSize };
    },
  },
  Mutation: {
    generateProofCode: (_, __, { token }) => {
      const payload = requireAuth(token);
      const code = generateProofCode();
      proofCodes.set(payload.id, { code, expires: Date.now() + 10 * 60 * 1000 });
      return code;
    },
    createMarketplaceListing: async (_, { input, proofCode, proofImage }, { token }) => {
      const payload = requireAuth(token);
      const record = proofCodes.get(payload.id);
      if (!record || record.code !== proofCode || Date.now() > record.expires) {
        throw new Error('Invalid or expired proof code');
      }
      const filePath = saveBase64Image(proofImage, PROOF_DIR);
      const passed = await moderateProofImage(filePath, proofCode).catch(() => false);
      if (!passed) {
        fs.unlinkSync(filePath);
        throw new Error('Proof image failed moderation');
      }
      const listing = await Listing.create({
        userId: payload.id,
        ...input,
        proofCode,
        proofImage: `/uploads/proofs/${path.basename(filePath)}`,
        proofUploadedAt: new Date(),
      });
      proofCodes.delete(payload.id);
      return listing;
    },
    updateMarketplaceListing: async (_, { id, input }, { token }) => {
      const payload = requireAuth(token);
      const listing = await Listing.findByPk(id);
      if (!listing || listing.userId !== payload.id) throw new Error('Not found');
      Object.assign(listing, input);
      await listing.save();
      return listing;
    },
    delistMarketplaceListing: async (_, { id }, { token }) => {
      const payload = requireAuth(token);
      const listing = await Listing.findByPk(id);
      if (!listing || listing.userId !== payload.id) throw new Error('Not found');
      listing.status = 'removed';
      await listing.save();
      return true;
    },
    makeOffer: async (_, { input }, { token }) => {
      const payload = requireAuth(token);
      const listing = await Listing.findByPk(input.listingId);
      if (!listing || listing.status !== 'active') throw new Error('Listing not available');
      const offer = await Offer.create({ buyerId: payload.id, ...input });
      return offer;
    },
    respondOffer: async (_, { id, accept }, { token }) => {
      const payload = requireAuth(token);
      const offer = await Offer.findByPk(id);
      if (!offer) throw new Error('Offer not found');
      const listing = await Listing.findByPk(offer.listingId);
      if (!listing || listing.userId !== payload.id) throw new Error('Not authorized');
      offer.status = accept ? 'accepted' : 'declined';
      await offer.save();
      if (accept) listing.status = 'sold';
      await listing.save();
      return offer;
    },
  },
  MarketplaceListing: {
    offers: (listing) => Offer.findAll({ where: { listingId: listing.id } }),
    seller: (listing) => User.findByPk(listing.userId),
  },
  Offer: {
    buyer: (offer) => User.findByPk(offer.buyerId),
  },
};

export default resolvers;

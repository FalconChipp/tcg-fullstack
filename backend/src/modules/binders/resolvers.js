import fs from 'fs';
import path from 'path';
import { Op } from 'sequelize';
import {
  Binder,
  BinderPage,
  BinderSlot,
  Card,
  Collection,
  User,
} from '../../models/index.js';
import { requireAuth, requireAdmin, slugify, checkBinderLimits } from './helpers.js';
import { maybeGrantAchievement } from '../achievements/helpers.js';
import { notifyUser } from '../../utils/notifications.js';
import { getUserTier } from '../../utils/getUserTier.js';

// No image logic: only coverColor is used now

const DEFAULT_PAGE_SIZE = 20;

const resolvers = {
  Query: {
    myBinders: async (_, __, { token }) => {
      const payload = requireAuth(token);
      return Binder.findAll({
        where: { userId: payload.id, isDeleted: false },
        order: [['createdAt', 'DESC']]
      });
    },
    binder: async (_, { id, slug }, { token }) => {
      const where = {};
      if (id) where.id = id;
      if (slug) where.slug = slug;
      const binder = await Binder.findOne({
        where,
        include: [{
          model: BinderPage,
          as: 'pages',
          include: [{
            model: BinderSlot,
            as: 'slots',
            include: [{ model: Card, as: 'card' }]
          }]
        }]
      });
      if (!binder) return null;
      if (binder.visibility === 'private' && (!token || requireAuth(token).id !== binder.userId)) {
        throw new Error('Not authorized');
      }
      return binder;
    },
    browseBinders: async (_, { page = 1, pageSize = DEFAULT_PAGE_SIZE, userId, search }) => {
      const where = { visibility: 'public', isDeleted: false };
      if (userId) where.userId = userId;
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
        ];
      }
      const { rows, count } = await Binder.findAndCountAll({
        where,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: [['createdAt', 'DESC']],
        include: [{
          model: BinderPage,
          as: 'pages',
          include: [{
            model: BinderSlot,
            as: 'slots',
            include: [{ model: Card, as: 'card' }]
          }]
        }]
      });
      return { binders: rows, total: count, page, pageSize };
    },
  },
  Mutation: {
    createBinder: async (_, { input }, { token }) => {
      const payload = requireAuth(token);
      const { limit } = await checkBinderLimits(payload.id);
      const count = await Binder.count({ where: { userId: payload.id, isDeleted: false } });
      if (count >= limit) throw new Error('Binder limit reached');
      const slugBase = slugify(input.name || 'binder');
      let slug = slugBase;
      let i = 1;
      while (await Binder.findOne({ where: { slug } })) {
        slug = `${slugBase}-${i++}`;
      }
      const binder = await Binder.create({
        userId: payload.id,
        name: input.name,
        description: input.description,
        accentColor: input.accentColor,
        coverColor: input.coverColor, // main color
        visibility: input.visibility || 'public',
        slug,
      });
      await maybeGrantAchievement(payload.id, 'first_binder_created', { binderId: binder.id });
      return binder;
    },
    updateBinder: async (_, { id, input }, { token }) => {
      const payload = requireAuth(token);
      const binder = await Binder.findByPk(id);
      if (!binder || binder.userId !== payload.id) throw new Error('Not authorized');
      if (input.name !== undefined) binder.name = input.name;
      if (input.description !== undefined) binder.description = input.description;
      if (input.accentColor !== undefined) binder.accentColor = input.accentColor;
      if (input.coverColor !== undefined) binder.coverColor = input.coverColor;
      if (input.visibility !== undefined) binder.visibility = input.visibility;
      await binder.save();
      return binder;
    },
    deleteBinder: async (_, { id, permanent = false }, { token }) => {
      const payload = requireAuth(token);
      const binder = await Binder.findByPk(id);
      if (!binder || binder.userId !== payload.id) throw new Error('Not authorized');
      if (permanent) await binder.destroy();
      else {
        binder.isDeleted = true;
        await binder.save();
      }
      return true;
    },
    addBinderPage: async (_, { binderId, input }, { token }) => {
      const payload = requireAuth(token);
      const binder = await Binder.findByPk(binderId);
      if (!binder || binder.userId !== payload.id) throw new Error('Not authorized');
      const pageCount = await BinderPage.count({ where: { binderId } });
      const tier = await getUserTier(payload.id);
      if (tier.limits.pagesPerBinder && pageCount >= tier.limits.pagesPerBinder) throw new Error('Page limit reached');
      const page = await BinderPage.create({ binderId, ...input, pageOrder: input.pageOrder ?? pageCount });
      return page;
    },
    updateBinderPage: async (_, { id, input }, { token }) => {
      const payload = requireAuth(token);
      const page = await BinderPage.findByPk(id);
      if (!page) throw new Error('Not found');
      const binder = await Binder.findByPk(page.binderId);
      if (!binder || binder.userId !== payload.id) throw new Error('Not authorized');
      Object.assign(page, input);
      await page.save();
      return page;
    },
    deleteBinderPage: async (_, { id }, { token }) => {
      const payload = requireAuth(token);
      const page = await BinderPage.findByPk(id);
      if (!page) return false;
      const binder = await Binder.findByPk(page.binderId);
      if (!binder || binder.userId !== payload.id) throw new Error('Not authorized');
      await page.destroy();
      return true;
    },
    addCardToBinder: async (_, { pageId, input }, { token }) => {
      const payload = requireAuth(token);
      const page = await BinderPage.findByPk(pageId);
      if (!page) throw new Error('Page not found');
      const binder = await Binder.findByPk(page.binderId);
      if (!binder || binder.userId !== payload.id) throw new Error('Not authorized');
      const col = await Collection.findOne({ where: { userId: payload.id, cardId: input.cardId, wishlist: false } });
      if (!col) throw new Error('Card not in collection');
      const slot = await BinderSlot.create({
        pageId,
        cardId: input.cardId,
        quantity: input.quantity || 1,
        position: input.position,
        notes: input.notes,
      });
      return slot;
    },
    updateBinderSlot: async (_, { id, input }, { token }) => {
      const payload = requireAuth(token);
      const slot = await BinderSlot.findByPk(id);
      if (!slot) throw new Error('Not found');
      const page = await BinderPage.findByPk(slot.pageId);
      const binder = await Binder.findByPk(page.binderId);
      if (!binder || binder.userId !== payload.id) throw new Error('Not authorized');
      Object.assign(slot, input);
      await slot.save();
      return slot;
    },
    moveBinderSlot: async (_, { id, pageId, position }, { token }) => {
      const payload = requireAuth(token);
      const slot = await BinderSlot.findByPk(id);
      if (!slot) throw new Error('Not found');
      const page = await BinderPage.findByPk(slot.pageId);
      const binder = await Binder.findByPk(page.binderId);
      if (!binder || binder.userId !== payload.id) throw new Error('Not authorized');
      const newPage = await BinderPage.findByPk(pageId);
      if (!newPage || newPage.binderId !== binder.id) throw new Error('Invalid target page');
      slot.pageId = pageId;
      slot.position = position;
      await slot.save();
      return slot;
    },
    removeBinderSlot: async (_, { id }, { token }) => {
      const payload = requireAuth(token);
      const slot = await BinderSlot.findByPk(id);
      if (!slot) return false;
      const page = await BinderPage.findByPk(slot.pageId);
      const binder = await Binder.findByPk(page.binderId);
      if (!binder || binder.userId !== payload.id) throw new Error('Not authorized');
      await slot.destroy();
      return true;
    },

    // --- BULK PAGES + SLOTS SAVE ---
    /**
     * Bulk save (upsert) all pages and slots for a binder.
     * Any page/slot not in the request is deleted.
     */
    saveBinderPagesAndSlots: async (_, { binderId, pages }, { token }) => {
      const payload = requireAuth(token);
      const binder = await Binder.findByPk(binderId, {
        include: [{ model: BinderPage, as: 'pages', include: [{ model: BinderSlot, as: 'slots' }] }]
      });
      if (!binder || binder.userId !== payload.id) throw new Error('Not authorized');

      console.log('saveBinderPagesAndSlots input:', JSON.stringify({ binderId, pages }, null, 2));

      // Existing state
      const existingPages = await BinderPage.findAll({ where: { binderId } });
      const existingPageMap = Object.fromEntries(existingPages.map(p => [p.id, p]));
      const keptPageIds = [];
      let keptSlotIds = [];
      console.log('Existing pages:', existingPages.map(p => p.id));

      for (const [pageIdx, clientPage] of pages.entries()) {
        console.log(`Processing page ${pageIdx}`, clientPage);
        let page;
        try {
          if (clientPage.id && existingPageMap[clientPage.id]) {
            // Update
            page = existingPageMap[clientPage.id];
            if (clientPage.layout !== undefined) page.layout = clientPage.layout;
            if (clientPage.title !== undefined) page.title = clientPage.title;
            page.pageOrder = pageIdx;
            await page.save();
          } else {
            // Create
            page = await BinderPage.create({
              binderId,
              pageOrder: pageIdx,
              layout: clientPage.layout,
              title: clientPage.title
            });
          }
        } catch (err) {
          console.error('Page upsert failed', err);
          throw new Error('Failed to save binder page');
        }
        keptPageIds.push(page.id);

        // --- SLOTS (upsert or create, and collect kept ids) ---
        const existingSlots = await BinderSlot.findAll({ where: { pageId: page.id } });
        const existingSlotMap = Object.fromEntries(existingSlots.map(s => [s.id, s]));
        const thisPageSlotIds = [];

        for (const clientSlot of (clientPage.slots || [])) {
          console.log('  Processing slot', clientSlot);
          let slot;
          try {
            if (clientSlot.id && existingSlotMap[clientSlot.id]) {
              // Update
              slot = existingSlotMap[clientSlot.id];
              slot.position = clientSlot.position;
              slot.cardId = clientSlot.cardId;
              slot.quantity = clientSlot.quantity;
              slot.notes = clientSlot.notes;
              await slot.save();
            } else {
              // Create
              slot = await BinderSlot.create({
                id: clientSlot.id,
                pageId: page.id,
                cardId: clientSlot.cardId,
                position: clientSlot.position,
                quantity: clientSlot.quantity,
                notes: clientSlot.notes,
              });
            }
          } catch (err) {
            console.error('Slot upsert failed', err);
            throw new Error('Failed to save binder slot');
          }
          thisPageSlotIds.push(slot.id);
        }

        // Remove slots not kept on this page
        for (const slot of existingSlots) {
          if (!thisPageSlotIds.includes(slot.id)) {
            console.log('  Removing slot', slot.id);
            await slot.destroy();
          }
        }
        keptSlotIds = keptSlotIds.concat(thisPageSlotIds);
      }

      // Remove pages not kept
      for (const p of existingPages) {
        if (!keptPageIds.includes(p.id)) {
          // Delete slots under the page first (in case)
          console.log('Removing page', p.id);
          await BinderSlot.destroy({ where: { pageId: p.id } });
          await p.destroy();
        }
      }

      console.log('Kept pages after save:', keptPageIds);
      console.log('Kept slots after save:', keptSlotIds);

      // Return updated binder, nested
      return Binder.findByPk(binderId, {
        include: [{
          model: BinderPage,
          as: 'pages',
          include: [{
            model: BinderSlot,
            as: 'slots',
            include: [{ model: Card, as: 'card' }]
          }],
          order: [['pageOrder', 'ASC']]
        }]
      });
    },

    // Admin only
    adminEditBinder: async (_, { id, input }, { token }) => {
      requireAdmin(token);
      const binder = await Binder.findByPk(id);
      if (!binder) throw new Error('Not found');
      if (input.name !== undefined) binder.name = input.name;
      if (input.description !== undefined) binder.description = input.description;
      if (input.accentColor !== undefined) binder.accentColor = input.accentColor;
      if (input.coverColor !== undefined) binder.coverColor = input.coverColor;
      if (input.visibility !== undefined) binder.visibility = input.visibility;
      await binder.save();
      await notifyUser({
        userId: binder.userId,
        type: 'system',
        title: 'Binder Updated by Admin',
        body: `Your binder "${binder.name}" was modified by an admin`,
        linkUrl: `/binders/${binder.slug}`,
      });
      return binder;
    },
    adminDeleteBinder: async (_, { id, permanent = false }, { token }) => {
      requireAdmin(token);
      const binder = await Binder.findByPk(id);
      if (!binder) return false;
      if (permanent) await binder.destroy();
      else {
        binder.isDeleted = true;
        await binder.save();
      }
      await notifyUser({
        userId: binder.userId,
        type: 'system',
        title: 'Binder Removed',
        body: `Your binder "${binder.name}" was removed by an admin`,
      });
      return true;
    },
  },
  Binder: {
    pages: (binder) =>
      BinderPage.findAll({
        where: { binderId: binder.id },
        order: [['pageOrder', 'ASC']]
      }),
  },
  BinderPage: {
    slots: (page) =>
      BinderSlot.findAll({
        where: { pageId: page.id },
        order: [['position', 'ASC']]
      }),
  },
  BinderSlot: {
    card: (slot) => Card.findByPk(slot.cardId),
  },
};

export default resolvers;

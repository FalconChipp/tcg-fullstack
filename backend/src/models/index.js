import "dotenv/config";
// models/index.js
//
// UPDATED (2026-01-28):
// - ADDED: ChatMute + ChatBlock model imports + initialization
// - ADDED: ChatMute + ChatBlock associations to User (and optional cross-user aliases)
// - ADDED: Exports for ChatMute + ChatBlock
// - NOTE: User IDs are UUIDs in your app (Message.senderId/receiverId are UUID),
//         so ChatMute/ChatBlock should use UUID foreign keys too.
// - NOTE: Kept your existing association style (explicit in index.js).
// - NOTE: Left all existing models/associations untouched unless required.

import { Sequelize, DataTypes } from "sequelize";
import path from "path";
import process from "process";

/* ---------------- DB Connection: MySQL from .env or fallback SQLite ---------------- */
let sequelize;

if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASS && process.env.DB_NAME) {
  sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    dialect: "mysql",
    logging: (msg) => console.log(`[DB] ${msg}`),
    dialectOptions: process.env.DB_SSL ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  });
  console.log("[DB] Connecting to MySQL:", process.env.DB_HOST, process.env.DB_NAME);
} else {
  const DB_URL = `sqlite:${path.join(process.cwd(), "sixbyfive-tcg.sqlite")}`;
  sequelize = new Sequelize(DB_URL, { logging: (msg) => console.log(`[DB] ${msg}`) });
  console.log("[DB] Connecting to SQLite:", DB_URL);
}

/* ---------------- Legacy models (kept) ---------------- */
import UserFactory from "./User.js";
import ProfileFactory from "./Profile.js";
// import CardFactory from './Card.js';
import CollectionFactory from "./Collection.js";
import WishlistFactory from "./Wishlist.js";
import ListingFactory from "./Listing.js";
import OfferFactory from "./Offer.js";
import TradeFactory from "./Trade.js";
import UserReputationFactory from "./UserReputation.js";
import MessageFactory from "./Message.js";
import ChatAgreementFactory from "./ChatAgreement.js";
import ReportedUserFactory from "./ReportedUser.js";
import NotificationFactory from "./Notification.js";
import AuditLogFactory from "./AuditLog.js";
import AchievementFactory from "./Achievement.js";
import UserAchievementFactory from "./UserAchievement.js";
import SubscriptionFactory from "./Subscription.js";
import SubscriptionTierFactory from "./SubscriptionTier.js";
import TransactionFactory from "./Transaction.js";
import ShippingLabelFactory from "./ShippingLabel.js";
// CHANGED: legacy cache/history reintroduced for compat pricing
import CardPriceCacheFactory from "./_CardPriceCache.js";
import CardPriceHistoryFactory from "./_CardPriceHistory.js";
import SubscriptionAddOnFactory from "./SubscriptionAddOn.js";
import AdminActionFactory from "./AdminAction.js";
import RewardFactory from "./Reward.js";
import BinderFactory from "./Binder.js";
import BinderPageFactory from "./BinderPage.js";
import BinderSlotFactory from "./BinderSlot.js";
import PriceAlertFactory from "./PriceAlert.js";
import UserNotificationPrefFactory from "./UserNotificationPref.js";

// Messaging preferences/safety models
import ChatMuteFactory from "./ChatMute.js";
import ChatBlockFactory from "./ChatBlock.js";

// Legacy snapshot (INTENTIONALLY not imported)
// import CardPriceFactory from './CardPrices.js';

/* ---------------- New marketdata2 models (m_*) ---------------- */
import init_m_Card from "./m_Card.js";
import init_m_PriceDaily from "./m_PriceDaily.js";
import init_m_PriceLatest from "./m_PriceLatest.js";
import init_m_CardVariant from "./m_CardVariant.js";
import init_m_Set from "./m_Set.js";
import init_m_PriceObservation from "./m_PriceObservation.js";
// rollups table for fast 7/30/90 reads
import init_m_PriceRollup from "./m_PriceRollup.js";
import initUserDiscordLink from "./UserDiscordLink.js";
import OrderFactory from "./Order.js";

/* ---------------- Initialize (legacy) ---------------- */
const User = UserFactory(sequelize, DataTypes);
const Profile = ProfileFactory(sequelize, DataTypes);

const Collection = CollectionFactory(sequelize, DataTypes);
const Wishlist = WishlistFactory(sequelize, DataTypes);
const Listing = ListingFactory(sequelize, DataTypes);
const Offer = OfferFactory(sequelize, DataTypes);
const { Trade, TradeCard, TradeProof, TradeDispute } = TradeFactory(sequelize, DataTypes);
const UserReputation = UserReputationFactory(sequelize, DataTypes);
const Message = MessageFactory(sequelize, DataTypes);
const ChatAgreement = ChatAgreementFactory(sequelize, DataTypes);
const ReportedUser = ReportedUserFactory(sequelize, DataTypes);
const Notification = NotificationFactory(sequelize, DataTypes);
const AuditLog = AuditLogFactory(sequelize, DataTypes);
const Achievement = AchievementFactory(sequelize, DataTypes);
const UserAchievement = UserAchievementFactory(sequelize, DataTypes);
const Subscription = SubscriptionFactory(sequelize, DataTypes);
const SubscriptionTier = SubscriptionTierFactory(sequelize, DataTypes);
const Transaction = TransactionFactory(sequelize, DataTypes);
const ShippingLabel = ShippingLabelFactory(sequelize, DataTypes);
const AdminAction = AdminActionFactory(sequelize, DataTypes);
const SubscriptionAddOn = SubscriptionAddOnFactory(sequelize, DataTypes);
const Reward = RewardFactory(sequelize, DataTypes);
const Binder = BinderFactory(sequelize, DataTypes);
const BinderPage = BinderPageFactory(sequelize, DataTypes);
const BinderSlot = BinderSlotFactory(sequelize, DataTypes);
const PriceAlert = PriceAlertFactory(sequelize, DataTypes);
const UserNotificationPref = UserNotificationPrefFactory(sequelize, DataTypes);
const UserDiscordLink = initUserDiscordLink(sequelize, DataTypes);
const Order = OrderFactory(sequelize, DataTypes);

// Initialize chat mute/block models
const ChatMute = ChatMuteFactory(sequelize, DataTypes);
const ChatBlock = ChatBlockFactory(sequelize, DataTypes);

/* ---------------- Initialize (cardsearch) ---------------- */
const m_Set = init_m_Set(sequelize, DataTypes);
const m_Card = init_m_Card(sequelize, DataTypes);
const m_CardVariant = init_m_CardVariant(sequelize, DataTypes);
const m_PriceObservation = init_m_PriceObservation(sequelize, DataTypes);
const m_PriceDaily = init_m_PriceDaily(sequelize, DataTypes);
const m_PriceLatest = init_m_PriceLatest(sequelize, DataTypes);
const m_PriceRollup = init_m_PriceRollup(sequelize, DataTypes); // ADDED
const CardPriceCache = CardPriceCacheFactory(sequelize); // CHANGED
const CardPriceHistory = CardPriceHistoryFactory(sequelize); // CHANGED

/* ---------------- Associations (legacy) ---------------- */
// User/Profile: 1:1
User.hasOne(Profile, { foreignKey: "userId", onDelete: "CASCADE" });
Profile.belongsTo(User, { foreignKey: "userId" });

// Referrals
User.belongsTo(User, { as: "referrer", foreignKey: "referrerId" });
User.hasMany(User, { as: "referrals", foreignKey: "referrerId" });

// User/Collection/Listing/Wishlist
User.hasMany(Collection, { foreignKey: "userId", onDelete: "CASCADE" });
Collection.belongsTo(User, { foreignKey: "userId" });

m_Card.hasMany(Collection, { foreignKey: "cardId", as: "collections", onDelete: "CASCADE" });
Collection.belongsTo(m_Card, { foreignKey: "cardId", as: "card" });

User.hasMany(Listing, { foreignKey: "userId", as: "listings", onDelete: "CASCADE" });
Listing.belongsTo(User, { foreignKey: "userId", as: "seller" });
User.hasMany(Listing, { foreignKey: "buyerId", as: "purchases" });
Listing.belongsTo(User, { foreignKey: "buyerId", as: "buyer" });

m_Card.hasMany(Listing, { foreignKey: "cardId", onDelete: "CASCADE" });
Listing.belongsTo(m_Card, { foreignKey: "cardId" });

Listing.hasMany(Offer, { foreignKey: "listingId", as: "offers", onDelete: "CASCADE" });
Offer.belongsTo(Listing, { foreignKey: "listingId" });
Offer.belongsTo(User, { foreignKey: "buyerId", as: "buyer" });
User.hasMany(Offer, { foreignKey: "buyerId", as: "offers" });

User.hasMany(Wishlist, { foreignKey: "userId", onDelete: "CASCADE" });
Wishlist.belongsTo(User, { foreignKey: "userId" });

m_Card.hasMany(Wishlist, { foreignKey: "cardId", as: "wishlists", onDelete: "CASCADE" });
Wishlist.belongsTo(m_Card, { foreignKey: "cardId", as: "card" });

// Binders
User.hasMany(Binder, { foreignKey: "userId", onDelete: "CASCADE" });
Binder.belongsTo(User, { foreignKey: "userId" });
Binder.hasMany(BinderPage, { foreignKey: "binderId", as: "pages", onDelete: "CASCADE" });
BinderPage.belongsTo(Binder, { foreignKey: "binderId" });
BinderPage.hasMany(BinderSlot, { foreignKey: "pageId", as: "slots", onDelete: "CASCADE" });
BinderSlot.belongsTo(BinderPage, { foreignKey: "pageId" });
m_Card.hasMany(BinderSlot, { foreignKey: "cardId" });
BinderSlot.belongsTo(m_Card, { foreignKey: "cardId", as: "card" });

// Trades
User.hasMany(Trade, { as: "partyATrades", foreignKey: "partyAId" });
User.hasMany(Trade, { as: "partyBTrades", foreignKey: "partyBId" });
User.hasMany(Trade, { as: "initiatedTrades", foreignKey: "initiatorId" });
Trade.belongsTo(User, { as: "partyA", foreignKey: "partyAId" });
Trade.belongsTo(User, { as: "partyB", foreignKey: "partyBId" });
Trade.belongsTo(User, { as: "initiator", foreignKey: "initiatorId" });

Trade.hasMany(TradeCard, { foreignKey: "tradeId", as: "cards" });
TradeCard.belongsTo(Trade, { foreignKey: "tradeId" });
TradeCard.belongsTo(User, { foreignKey: "userId" });
TradeCard.belongsTo(m_Card, { foreignKey: "cardId" });
User.hasMany(TradeCard, { foreignKey: "userId" });
m_Card.hasMany(TradeCard, { foreignKey: "cardId" });

Trade.hasMany(TradeProof, { foreignKey: "tradeId", as: "proofs" });
TradeProof.belongsTo(Trade, { foreignKey: "tradeId" });
TradeProof.belongsTo(User, { foreignKey: "userId" });
User.hasMany(TradeProof, { foreignKey: "userId" });

Trade.hasMany(TradeDispute, { foreignKey: "tradeId", as: "disputes" });
TradeDispute.belongsTo(Trade, { foreignKey: "tradeId" });
TradeDispute.belongsTo(User, { foreignKey: "raisedById", as: "raisedBy" });
User.hasMany(TradeDispute, { foreignKey: "raisedById", as: "tradeDisputes" });

// Reputation
User.hasOne(UserReputation, { foreignKey: "userId", onDelete: "CASCADE" });
UserReputation.belongsTo(User, { foreignKey: "userId" });

// Messaging
User.hasMany(Message, { foreignKey: "senderId", as: "sentMessages" });
User.hasMany(Message, { foreignKey: "receiverId", as: "receivedMessages" });
Message.belongsTo(User, { foreignKey: "senderId", as: "sender" });
Message.belongsTo(User, { foreignKey: "receiverId", as: "receiver" });
Message.belongsTo(User, { foreignKey: "flaggedById", as: "flaggedBy" });

User.hasOne(ChatAgreement, { foreignKey: "userId", onDelete: "CASCADE" });
ChatAgreement.belongsTo(User, { foreignKey: "userId" });

User.hasMany(ReportedUser, { foreignKey: "userId", as: "reportsAgainst" });
User.hasMany(ReportedUser, { foreignKey: "reporterId", as: "reportsMade" });
ReportedUser.belongsTo(User, { foreignKey: "userId", as: "user" });
ReportedUser.belongsTo(User, { foreignKey: "reporterId", as: "reporter" });

// Chat Mutes (per-user conversation prefs)
User.hasMany(ChatMute, { foreignKey: "userId", as: "chatMutes", onDelete: "CASCADE" });
ChatMute.belongsTo(User, { foreignKey: "userId", as: "user" });

// "otherUser" is the conversation partner referenced by otherUserId
User.hasMany(ChatMute, { foreignKey: "otherUserId", as: "mutedByOthers" });
ChatMute.belongsTo(User, { foreignKey: "otherUserId", as: "otherUser" });

// Chat Blocks (safety controls)
User.hasMany(ChatBlock, { foreignKey: "blockerId", as: "chatBlocks", onDelete: "CASCADE" });
ChatBlock.belongsTo(User, { foreignKey: "blockerId", as: "blocker" });

User.hasMany(ChatBlock, { foreignKey: "blockedId", as: "blockedByUsers" });
ChatBlock.belongsTo(User, { foreignKey: "blockedId", as: "blocked" });

// Notifications
User.hasMany(Notification, { foreignKey: "userId", onDelete: "CASCADE" });
Notification.belongsTo(User, { foreignKey: "userId" });

// Audit Log
User.hasMany(AuditLog, { foreignKey: "userId" });
AuditLog.belongsTo(User, { foreignKey: "userId" });

// Achievements (M:N)
User.belongsToMany(Achievement, {
  through: UserAchievement,
  foreignKey: "userId",
  otherKey: "achievementId",
  as: "achievements",
});
Achievement.belongsToMany(User, {
  through: UserAchievement,
  foreignKey: "achievementId",
  otherKey: "userId",
  as: "users",
});
User.hasMany(UserAchievement, { foreignKey: "userId" });
UserAchievement.belongsTo(User, { foreignKey: "userId" });
Achievement.hasMany(UserAchievement, { foreignKey: "achievementId" });
UserAchievement.belongsTo(Achievement, { foreignKey: "achievementId" });

// Rewards
User.hasMany(Reward, { foreignKey: "userId", onDelete: "CASCADE" });
Reward.belongsTo(User, { foreignKey: "userId" });
Reward.belongsTo(Achievement, { foreignKey: "achievementId" });
Achievement.hasMany(Reward, { foreignKey: "achievementId" });

// Subscriptions
User.hasMany(Subscription, { foreignKey: "userId" });
Subscription.belongsTo(User, { foreignKey: "userId" });
Subscription.belongsTo(SubscriptionTier, { foreignKey: "tierId" });
SubscriptionTier.hasMany(Subscription, { foreignKey: "tierId" });
User.hasMany(SubscriptionAddOn, { foreignKey: "userId" });
SubscriptionAddOn.belongsTo(User, { foreignKey: "userId" });

// Transactions/Payments
User.hasMany(Transaction, { foreignKey: "userId", onDelete: "CASCADE" });
Transaction.belongsTo(User, { foreignKey: "userId" });
User.hasMany(Transaction, { foreignKey: "sellerId", as: "sales", onDelete: "CASCADE" });
Transaction.belongsTo(User, { foreignKey: "sellerId", as: "seller" });
Listing.hasMany(Transaction, {
  foreignKey: "relatedId",
  constraints: false,
  scope: { relatedType: "listing" },
});
Transaction.belongsTo(Listing, {
  foreignKey: "relatedId",
  constraints: false,
  as: "listing",
});

// Shipping
User.hasMany(ShippingLabel, { foreignKey: "userId", onDelete: "CASCADE" });
ShippingLabel.belongsTo(User, { foreignKey: "userId" });

Order.belongsTo(Listing, { foreignKey: "listingId", as: "listing", onDelete: "CASCADE" });
Listing.hasMany(Order, { foreignKey: "listingId", as: "orders", onDelete: "CASCADE" });
Order.belongsTo(User, { foreignKey: "buyerId", as: "buyer", onDelete: "CASCADE" });
User.hasMany(Order, { foreignKey: "buyerId", as: "ordersPlaced" });
Order.belongsTo(User, { foreignKey: "sellerId", as: "seller" });
User.hasMany(Order, { foreignKey: "sellerId", as: "ordersSold" });

/* ---------------- Order associations (via model.associate) ---------------- */
// Your Order model already defines associations in Order.associate.
// Call it here so they are actually registered.
if (typeof Order.associate === "function") {
  Order.associate({ User, Listing });
}

/* ---------------- Legacy price/search cleanup ---------------- */
// CHANGED: CardPriceCache & CardPriceHistory kept for compat & deterministic pricing.

/* ---------------- NEW marketdata2 associations ---------------- */
// m_Set 1:M m_Card
m_Set.hasMany(m_Card, { as: "cards", foreignKey: "set_code", sourceKey: "code" });
m_Card.belongsTo(m_Set, { as: "set", foreignKey: "set_code", targetKey: "code" });

// m_Card 1:M m_CardVariant
m_Card.hasMany(m_CardVariant, { foreignKey: "card_id", sourceKey: "id" });
m_CardVariant.belongsTo(m_Card, { foreignKey: "card_id", targetKey: "id" });

// m_Card 1:1 m_PriceLatest (latest snapshot)
m_Card.hasOne(m_PriceLatest, {
  foreignKey: "card_id",
  sourceKey: "id",
  as: "price", // ← use include: [{ model: m_PriceLatest, as: 'price' }]
});
m_PriceLatest.belongsTo(m_Card, {
  foreignKey: "card_id",
  targetKey: "id",
  as: "card",
});

// (Optional) m_Card 1:M m_PriceDaily (raw daily timeline)
m_Card.hasMany(m_PriceDaily, { foreignKey: "card_id", sourceKey: "id", as: "daily" });
m_PriceDaily.belongsTo(m_Card, { foreignKey: "card_id", targetKey: "id", as: "card" });

// (Optional) m_Card 1:M m_PriceRollup (precomputed windows 1/7/30/90)
m_Card.hasMany(m_PriceRollup, { foreignKey: "card_id", sourceKey: "id", as: "rollups" });
m_PriceRollup.belongsTo(m_Card, { foreignKey: "card_id", targetKey: "id", as: "card" });

// Intergrations
User.hasOne(UserDiscordLink, { as: "DiscordLink", foreignKey: "userId" });
UserDiscordLink.belongsTo(User, { foreignKey: "userId" });

/* ---------------- Exports ---------------- */
export {
  sequelize,
  // legacy app models
  User,
  Profile,
  Collection,
  Wishlist,
  Listing,
  Trade,
  TradeCard,
  TradeProof,
  TradeDispute,
  UserReputation,
  Message,
  Notification,
  AuditLog,
  Achievement,
  Subscription,
  SubscriptionTier,
  Transaction,
  ShippingLabel,
  PriceAlert,
  UserNotificationPref,
  AdminAction,
  UserAchievement,
  Offer,
  SubscriptionAddOn,
  Reward,
  ChatAgreement,
  ReportedUser,
  Binder,
  BinderPage,
  BinderSlot,
  UserDiscordLink,
  Order,

  // ✅ NEW exports
  ChatMute,
  ChatBlock,

  m_Set,
  m_Card,
  m_CardVariant,
  m_PriceObservation,
  m_PriceDaily,
  m_PriceLatest,
  m_PriceRollup,
  CardPriceCache,
  CardPriceHistory,
};

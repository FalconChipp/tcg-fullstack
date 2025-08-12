import { Sequelize } from 'sequelize';
import path from 'path';
import process from 'process';

// --- DB Connection: MySQL from .env or fallback SQLite ---
// Use process.env vars for MySQL (preferred)
let sequelize;

if (
  process.env.DB_HOST &&
  process.env.DB_USER &&
  process.env.DB_PASS &&
  process.env.DB_NAME
) {
  // MySQL
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      dialect: 'mysql',
      logging: (msg) => console.log(`[DB] ${msg}`),
      dialectOptions: process.env.DB_SSL
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
    }
  );
  console.log('[DB] Connecting to MySQL:', process.env.DB_HOST, process.env.DB_NAME);
} else {
  // Fallback SQLite for dev
  const DB_URL = `sqlite:${path.join(process.cwd(), 'sixbyfive-tcg.sqlite')}`;
  sequelize = new Sequelize(DB_URL, {
    logging: (msg) => console.log(`[DB] ${msg}`),
  });
  console.log('[DB] Connecting to SQLite:', DB_URL);
}

// --- Import all model factories ---
import UserFactory from './User.js';
import ProfileFactory from './Profile.js';
import CardFactory from './Card.js';
import CollectionFactory from './Collection.js';
import WishlistFactory from './Wishlist.js';
import ListingFactory from './Listing.js';
import OfferFactory from './Offer.js';
import TradeFactory from './Trade.js';
import UserReputationFactory from './UserReputation.js';
import MessageFactory from './Message.js';
import ChatAgreementFactory from './ChatAgreement.js';
import ReportedUserFactory from './ReportedUser.js';
import NotificationFactory from './Notification.js';
import AuditLogFactory from './AuditLog.js';
import AchievementFactory from './Achievement.js';
import UserAchievementFactory from './UserAchievement.js';
import SubscriptionFactory from './Subscription.js';
import SubscriptionTierFactory from './SubscriptionTier.js';
import TransactionFactory from './Transaction.js';
import ShippingLabelFactory from './ShippingLabel.js';
import CardPriceCacheFactory from './CardPriceCache.js';
import SubscriptionAddOnFactory from "./SubscriptionAddOn.js";
import AdminActionFactory from './AdminAction.js';
import RewardFactory from './Reward.js';
import BinderFactory from './Binder.js';
import BinderPageFactory from './BinderPage.js';
import BinderSlotFactory from './BinderSlot.js';

// --- Initialize models ---
const User = UserFactory(sequelize);
const Profile = ProfileFactory(sequelize);
const Card = CardFactory(sequelize);
const Collection = CollectionFactory(sequelize);
const Wishlist = WishlistFactory(sequelize);
const Listing = ListingFactory(sequelize);
const Offer = OfferFactory(sequelize);
const { Trade, TradeCard, TradeProof, TradeDispute } = TradeFactory(sequelize);
const UserReputation = UserReputationFactory(sequelize);
const Message = MessageFactory(sequelize);
const ChatAgreement = ChatAgreementFactory(sequelize);
const ReportedUser = ReportedUserFactory(sequelize);
const Notification = NotificationFactory(sequelize);
const AuditLog = AuditLogFactory(sequelize);
const Achievement = AchievementFactory(sequelize);
const UserAchievement = UserAchievementFactory(sequelize);
const Subscription = SubscriptionFactory(sequelize);
const SubscriptionTier = SubscriptionTierFactory(sequelize);
const Transaction = TransactionFactory(sequelize);
const ShippingLabel = ShippingLabelFactory(sequelize);
const CardPriceCache = CardPriceCacheFactory(sequelize);
const AdminAction = AdminActionFactory(sequelize);
const SubscriptionAddOn = SubscriptionAddOnFactory(sequelize);
const Reward = RewardFactory(sequelize);
const Binder = BinderFactory(sequelize);
const BinderPage = BinderPageFactory(sequelize);
const BinderSlot = BinderSlotFactory(sequelize);

// ---- Associations ----

// User/Profile: 1:1
User.hasOne(Profile, { foreignKey: 'userId', onDelete: 'CASCADE' });
Profile.belongsTo(User, { foreignKey: 'userId' });

// Referrals: User -> Referrer (self-reference)
User.belongsTo(User, { as: 'referrer', foreignKey: 'referrerId' });
User.hasMany(User, { as: 'referrals', foreignKey: 'referrerId' });

// User/Collection/Listing/Wishlist
User.hasMany(Collection, { foreignKey: 'userId', onDelete: 'CASCADE' });
Collection.belongsTo(User, { foreignKey: 'userId' });
Card.hasMany(Collection, {
  foreignKey: 'cardId',
  as: 'collections',
  onDelete: 'CASCADE'
});
Collection.belongsTo(Card, { foreignKey: 'cardId', as: 'card' });

User.hasMany(Listing, { foreignKey: 'userId', as: 'listings', onDelete: 'CASCADE' });
Listing.belongsTo(User, { foreignKey: 'userId', as: 'seller' });
User.hasMany(Listing, { foreignKey: 'buyerId', as: 'purchases' });
Listing.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });
Card.hasMany(Listing, { foreignKey: 'cardId', onDelete: 'CASCADE' });
Listing.belongsTo(Card, { foreignKey: 'cardId' });
Listing.hasMany(Offer, { foreignKey: 'listingId', as: 'offers', onDelete: 'CASCADE' });
Offer.belongsTo(Listing, { foreignKey: 'listingId' });
Offer.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });
User.hasMany(Offer, { foreignKey: 'buyerId', as: 'offers' });

User.hasMany(Wishlist, { foreignKey: 'userId', onDelete: 'CASCADE' });
Wishlist.belongsTo(User, { foreignKey: 'userId' });
Card.hasMany(Wishlist, {
  foreignKey: 'cardId',
  as: 'wishlists',
  onDelete: 'CASCADE'
});
Wishlist.belongsTo(Card, { foreignKey: 'cardId', as: 'card' });

User.hasMany(Binder, { foreignKey: 'userId', onDelete: 'CASCADE' });
Binder.belongsTo(User, { foreignKey: 'userId' });
Binder.hasMany(BinderPage, { foreignKey: 'binderId', as: 'pages', onDelete: 'CASCADE' });
BinderPage.belongsTo(Binder, { foreignKey: 'binderId' });
BinderPage.hasMany(BinderSlot, { foreignKey: 'pageId', as: 'slots', onDelete: 'CASCADE' });
BinderSlot.belongsTo(BinderPage, { foreignKey: 'pageId' });
Card.hasMany(BinderSlot, { foreignKey: 'cardId' });
BinderSlot.belongsTo(Card, { foreignKey: 'cardId', as: 'card' });

// Trades
User.hasMany(Trade, { as: 'partyATrades', foreignKey: 'partyAId' });
User.hasMany(Trade, { as: 'partyBTrades', foreignKey: 'partyBId' });
User.hasMany(Trade, { as: 'initiatedTrades', foreignKey: 'initiatorId' });
Trade.belongsTo(User, { as: 'partyA', foreignKey: 'partyAId' });
Trade.belongsTo(User, { as: 'partyB', foreignKey: 'partyBId' });
Trade.belongsTo(User, { as: 'initiator', foreignKey: 'initiatorId' });

Trade.hasMany(TradeCard, { foreignKey: 'tradeId', as: 'cards' });
TradeCard.belongsTo(Trade, { foreignKey: 'tradeId' });
TradeCard.belongsTo(User, { foreignKey: 'userId' });
TradeCard.belongsTo(Card, { foreignKey: 'cardId' });
User.hasMany(TradeCard, { foreignKey: 'userId' });
Card.hasMany(TradeCard, { foreignKey: 'cardId' });

Trade.hasMany(TradeProof, { foreignKey: 'tradeId', as: 'proofs' });
TradeProof.belongsTo(Trade, { foreignKey: 'tradeId' });
TradeProof.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(TradeProof, { foreignKey: 'userId' });

Trade.hasMany(TradeDispute, { foreignKey: 'tradeId', as: 'disputes' });
TradeDispute.belongsTo(Trade, { foreignKey: 'tradeId' });
TradeDispute.belongsTo(User, { foreignKey: 'raisedById', as: 'raisedBy' });
User.hasMany(TradeDispute, { foreignKey: 'raisedById', as: 'tradeDisputes' });

// Reputation (UserReputation: 1:1)
User.hasOne(UserReputation, { foreignKey: 'userId', onDelete: 'CASCADE' });
UserReputation.belongsTo(User, { foreignKey: 'userId' });

// Message/Chat (fields: senderId, receiverId)
User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
User.hasMany(Message, { foreignKey: 'receiverId', as: 'receivedMessages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Message.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });
Message.belongsTo(User, { foreignKey: 'flaggedById', as: 'flaggedBy' });

User.hasOne(ChatAgreement, { foreignKey: 'userId', onDelete: 'CASCADE' });
ChatAgreement.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(ReportedUser, { foreignKey: 'userId', as: 'reportsAgainst' });
User.hasMany(ReportedUser, { foreignKey: 'reporterId', as: 'reportsMade' });
ReportedUser.belongsTo(User, { foreignKey: 'userId', as: 'user' });
ReportedUser.belongsTo(User, { foreignKey: 'reporterId', as: 'reporter' });

// Notifications
User.hasMany(Notification, { foreignKey: 'userId', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'userId' });

// Audit Log
User.hasMany(AuditLog, { foreignKey: 'userId' });
AuditLog.belongsTo(User, { foreignKey: 'userId' });

// User <-> Achievement (many-to-many through UserAchievement)
User.belongsToMany(Achievement, {
  through: UserAchievement,
  foreignKey: 'userId',
  otherKey: 'achievementId',
  as: 'achievements'
});
Achievement.belongsToMany(User, {
  through: UserAchievement,
  foreignKey: 'achievementId',
  otherKey: 'userId',
  as: 'users'
});

// Also add 1:M for UserAchievement <-> Achievement/User for eager loading
User.hasMany(UserAchievement, { foreignKey: 'userId' });
UserAchievement.belongsTo(User, { foreignKey: 'userId' });
Achievement.hasMany(UserAchievement, { foreignKey: 'achievementId' });
UserAchievement.belongsTo(Achievement, { foreignKey: 'achievementId' });

// Rewards
User.hasMany(Reward, { foreignKey: 'userId', onDelete: 'CASCADE' });
Reward.belongsTo(User, { foreignKey: 'userId' });
Reward.belongsTo(Achievement, { foreignKey: 'achievementId' });
Achievement.hasMany(Reward, { foreignKey: 'achievementId' });

// Subscriptions
User.hasMany(Subscription, { foreignKey: 'userId' });
Subscription.belongsTo(User, { foreignKey: 'userId' });
Subscription.belongsTo(SubscriptionTier, { foreignKey: 'tierId' });
SubscriptionTier.hasMany(Subscription, { foreignKey: 'tierId' });
User.hasMany(SubscriptionAddOn, { foreignKey: "userId" });
SubscriptionAddOn.belongsTo(User, { foreignKey: "userId" });

// Transactions/Payments
User.hasMany(Transaction, { foreignKey: 'userId', onDelete: 'CASCADE' });
Transaction.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Transaction, { foreignKey: 'sellerId', as: 'sales', onDelete: 'CASCADE' });
Transaction.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });
Listing.hasMany(Transaction, { foreignKey: 'relatedId', constraints: false, scope: { relatedType: 'listing' } });
Transaction.belongsTo(Listing, { foreignKey: 'relatedId', constraints: false, as: 'listing' });

// Shipping
User.hasMany(ShippingLabel, { foreignKey: 'userId', onDelete: 'CASCADE' });
ShippingLabel.belongsTo(User, { foreignKey: 'userId' });

// Card Price Cache
Card.hasOne(CardPriceCache, { foreignKey: 'cardId', onDelete: 'CASCADE' });
CardPriceCache.belongsTo(Card, { foreignKey: 'cardId' });

// Admin Actions (AdminAction fields: adminId, targetUserId)
User.hasMany(AdminAction, { foreignKey: 'adminId', as: 'adminActions' });
AdminAction.belongsTo(User, { foreignKey: 'adminId', as: 'admin' });
User.hasMany(AdminAction, { foreignKey: 'targetUserId', as: 'receivedAdminActions' });
AdminAction.belongsTo(User, { foreignKey: 'targetUserId', as: 'targetUser' });

// ---- Export ----
export {
  sequelize, User, Profile, Card,
  Collection, Wishlist, Listing,
  Trade, TradeCard, TradeProof, TradeDispute,
  UserReputation, Message,
  Notification, AuditLog, Achievement, Subscription,
  SubscriptionTier, Transaction, ShippingLabel, CardPriceCache,
  AdminAction, UserAchievement, Offer, SubscriptionAddOn,
  Reward,
  ChatAgreement, ReportedUser,
  Binder, BinderPage, BinderSlot
};

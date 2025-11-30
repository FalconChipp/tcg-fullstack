import { DataTypes, Model } from 'sequelize';

/**
 * Order model
 * ------------------------------------------------------------------
 * Represents a purchase transaction for any marketplace listing:
 *  - CARD listings (user-to-user trades/sales)
 *  - PRODUCT listings (official store merchandise)
 *
 * Handles lifecycle, payment info, and fulfillment metadata.
 * Fully UUID-based and compatible with Stripe payments or internal balance.
 *
 * CHANGES:
 * - Added human-friendly `orderNumber` with a generator hook.
 * - Added guest checkout support (buyerEmail, buyerName, guestCheckout).
 * - Relaxed buyerId (nullable) so guests can place orders.
 * - Added granular fulfilmentStatus + paymentStatus (aligned with GraphQL enums).
 * ------------------------------------------------------------------
 */
export default (sequelize, models) => {
  class Order extends Model {
    /**
     * Generate a human-friendly, unique order number.
     *
     * Format: SBF-YYYYMMDD-XXXXXX
     * Example: SBF-20251125-004372
     *
     * This avoids DB auto-increment sequences (we already use UUIDs)
     * but still gives buyers/sellers something readable to reference.
     */
    static async generateOrderNumber() {
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      const datePart = `${year}${month}${day}`;

      // We try a few times in the extremely unlikely case of collision.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const random = Math.floor(Math.random() * 1_000_000)
          .toString()
          .padStart(6, '0');

        const candidate = `SBF-${datePart}-${random}`;

        // Check for existing order with same number.
        const existing = await Order.findOne({
          where: { orderNumber: candidate },
          attributes: ['id'],
        });

        if (!existing) {
          return candidate;
        }
      }

      // If we get here something is very wrong; let the caller handle it.
      throw new Error('Unable to generate unique order number');
    }
  }

  Order.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      // --------------------------------
      // ORDER IDENTIFIERS
      // --------------------------------

      // Human friendly order number, e.g. SBF-20251125-000123
      orderNumber: {
        type: DataTypes.STRING(32),
        allowNull: false,
        unique: true,
        comment:
          'Human-friendly order reference, safe to show in emails/receipts',
      },

      // --------------------------------
      // RELATIONS
      // --------------------------------
      listingId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Reference to the listing being purchased (card or product)',
      },

      // allowNull true for guest checkout
      buyerId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'User placing the order (null for guest checkout)',
      },
      sellerId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Copied from Listing.userId for quick reference',
      },

      // --------------------------------
      // BUYER INFO (FOR GUEST CHECKOUT / RECEIPTS)
      // --------------------------------

      // Email to send receipts to (for guests or override)
      buyerEmail: {
        type: DataTypes.STRING,
        allowNull: true,
        comment:
          'Email used for order notifications. Required when guestCheckout = true',
      },

      // Optional name for invoices
      buyerName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Buyer name as entered at checkout (guest or user override)',
      },

      // Simple flag to distinguish account vs guest orders
      guestCheckout: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'True if order was placed without a logged-in account',
      },

      // --------------------------------
      // ORDER DETAILS
      // --------------------------------
      quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false,
      },
      subtotal: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        comment: 'Total before shipping/tax',
      },
      tax: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      shippingCost: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        comment: 'Final charged total (subtotal + tax + shipping)',
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'GBP',
      },

      // --------------------------------
      // PAYMENT INFO
      // --------------------------------
      paymentMethod: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'E.g. STRIPE, INTERNAL_BALANCE, MANUAL',
      },
      stripeSessionId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      stripePaymentIntentId: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // --------------------------------
      // STATUS & TIMELINE
      // --------------------------------

      // Legacy high-level status (matches OrderStatus enum)
      status: {
        type: DataTypes.STRING,
        defaultValue: 'pending',
        allowNull: false,
        comment: 'pending, paid, fulfilled, completed, cancelled, refunded',
      },

      // NEW: granular fulfilment status (OrderFulfilmentStatus enum)
      // pending -> processing -> in_printing -> shipped -> completed / cancelled
      fulfilmentStatus: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
        comment:
          'pending, processing, in_printing, shipped, completed, cancelled',
      },

      // NEW: granular payment status (OrderPaymentStatus enum)
      // pending -> paid / refunded / failed / cancelled
      paymentStatus: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
        comment: 'pending, paid, refunded, failed, cancelled',
      },

      paidAt: { type: DataTypes.DATE, allowNull: true },
      fulfilledAt: { type: DataTypes.DATE, allowNull: true },
      shippedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true },
      cancelledReason: { type: DataTypes.STRING, allowNull: true },
      refundedAt: { type: DataTypes.DATE, allowNull: true },
      refundAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

      // --------------------------------
      // SHIPPING INFO
      // --------------------------------
      shippingAddressJson: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Full structured address used at checkout',
      },
      trackingNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      carrier: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      shippingLabelUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // --------------------------------
      // FEEDBACK
      // --------------------------------
      buyerRating: { type: DataTypes.INTEGER, allowNull: true },
      buyerReview: { type: DataTypes.STRING, allowNull: true },

      // --------------------------------
      // METADATA
      // --------------------------------
      metadataJson: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Flexible JSON for logs, fees, or Stripe Connect data',
      },

      // --------------------------------
      // TIMESTAMPS
      // --------------------------------
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Order',
      tableName: 'orders',
      timestamps: true,
      indexes: [
        { fields: ['buyerId'] },
        { fields: ['sellerId'] },
        { fields: ['listingId'] },
        { fields: ['status'] },
        // NEW: allow quick admin filtering by fulfilment/payment status
        { fields: ['fulfilmentStatus'] },
        { fields: ['paymentStatus'] },
        // NEW: fast lookup/search by orderNumber
        { unique: true, fields: ['orderNumber'] },
      ],
      hooks: {
        /**
         * Attach a human-friendly order number before first persist.
         * This runs server-side and covers all entrypoints (checkout, admin,
         * Stripe webhook, etc).
         */
        beforeCreate: async (order) => {
          if (!order.orderNumber) {
            order.orderNumber = await Order.generateOrderNumber();
          }

          // Safety: if guestCheckout is true, ensure we at least have an email.
          if (order.guestCheckout && !order.buyerEmail) {
            throw new Error(
              'guestCheckout orders require buyerEmail to be set'
            );
          }
        },
      },
    }
  );

  /**
   * Associations
   * ----------------------------------------------------------------
   * - Each Order belongs to a Listing (card or product)
   * - Belongs to Buyer and (optionally) Seller
   * ----------------------------------------------------------------
   */
  // Order.associate = (models) => {
  //   if (models.Listing) {
  //     Order.belongsTo(models.Listing, {
  //       foreignKey: 'listingId',
  //       as: 'listing',
  //       onDelete: 'CASCADE',
  //     });
  //     models.Listing.hasMany(Order, {
  //       foreignKey: 'listingId',
  //       as: 'orders',
  //       onDelete: 'CASCADE',
  //     });
  //   }

  //   if (models.User) {
  //     Order.belongsTo(models.User, {
  //       foreignKey: 'buyerId',
  //       as: 'buyer',
  //       onDelete: 'CASCADE',
  //     });
  //     models.User.hasMany(Order, {
  //       foreignKey: 'buyerId',
  //       as: 'ordersPlaced',
  //     });

  //     Order.belongsTo(models.User, {
  //       foreignKey: 'sellerId',
  //       as: 'seller',
  //     });
  //     models.User.hasMany(Order, {
  //       foreignKey: 'sellerId',
  //       as: 'ordersSold',
  //     });
  //   }
  // };

  return Order;
};

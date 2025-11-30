import { DataTypes, Model } from 'sequelize';

/**
 * Offer model
 * ------------------------------------------------------------------
 * Used by the marketplace for both card and product listings.
 * - Buyers can make offers on listings that allow it (Listing.allowOffers = true)
 * - Compatible with CARD and PRODUCT listing types
 * - Supports counter-offers and negotiation workflow
 * ------------------------------------------------------------------
 */
export default (sequelize, models) => {
  class Offer extends Model {}

  Offer.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      // The listing being offered on (card or product)
      listingId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      // The buyer making the offer
      buyerId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      // Initial offer price (in GBP)
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },

      // Seller’s counter-offer (optional)
      counterPrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },

      // Negotiation lifecycle
      // pending, accepted, declined, countered, withdrawn, expired
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },

      // Optional metadata for future automation
      metadataJson: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Stores negotiation notes, audit logs, or automated flags',
      },

      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Offer',
      tableName: 'offers',
      timestamps: true,
      indexes: [
        { fields: ['listingId'] },
        { fields: ['buyerId'] },
        { fields: ['status'] },
      ],
    }
  );

  /**
   * Associations
   * ----------------------------------------------------------------
   * - Each Offer belongs to a Listing (card or product)
   * - Each Offer belongs to a User (buyer)
   * - A Listing can have many Offers
   * ----------------------------------------------------------------
   */
  Offer.associate = (models) => {
    if (models.Listing) {
      Offer.belongsTo(models.Listing, {
        foreignKey: 'listingId',
        as: 'listing',
        onDelete: 'CASCADE',
      });
      models.Listing.hasMany(Offer, {
        foreignKey: 'listingId',
        as: 'offers',
        onDelete: 'CASCADE',
      });
    }

    if (models.User) {
      Offer.belongsTo(models.User, {
        foreignKey: 'buyerId',
        as: 'buyer',
        onDelete: 'CASCADE',
      });
      models.User.hasMany(Offer, {
        foreignKey: 'buyerId',
        as: 'offersMade',
      });
    }
  };

  return Offer;
};

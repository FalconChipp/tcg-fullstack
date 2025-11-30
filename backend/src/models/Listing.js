import { DataTypes, Model } from 'sequelize';

/**
 * Unified Listing model
 * --------------------------------------------------------------------------
 * Supports both:
 *  - Card listings (user-to-user)
 *  - Product listings (official shop or digital goods)
 *
 * Migration-safe: existing data remains valid (card listings default to type 'CARD').
 * --------------------------------------------------------------------------
 */
export default (sequelize, models) => {
  class Listing extends Model {}

  Listing.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      // --------------------------------
      // CLASSIFICATION
      // --------------------------------
      type: {
        type: DataTypes.ENUM('CARD', 'PRODUCT'),
        allowNull: false,
        defaultValue: 'CARD',
        comment: 'Determines listing type and field context',
      },

      // --------------------------------
      // OWNERSHIP / RELATIONSHIP
      // --------------------------------
      userId: { // Seller (user or admin)
        type: DataTypes.UUID,
        allowNull: false,
      },

      buyerId: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      // --------------------------------
      // CARD LISTING FIELDS
      // --------------------------------
      cardId: {
        type: DataTypes.STRING,
        allowNull: true, // optional if product
      },
      condition: { type: DataTypes.STRING, allowNull: true },
      variation: { type: DataTypes.STRING, allowNull: true },

      // --------------------------------
      // PRODUCT LISTING FIELDS
      // --------------------------------
      productId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Reference to a Product table entry (if applicable)',
      },
      inventoryId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Reference to an InventoryItem record (for product stock)',
      },
      title: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Display title for product listings (e.g., “SixByFive Hoodie”)',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      imageUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      imagesJson: {
        type: DataTypes.JSON, 
        allowNull: true, 
        comment: 'Array of image URLs'
      },
      colourVariantsJson: {
        type: DataTypes.JSON,
        allowNull: true, 
        comment: 'Array of colour variant labels'
      },
      slug: {
        type: DataTypes.STRING, 
        allowNull: true, 
        unique: true, 
      },

      // --------------------------------
      // SHARED ECONOMIC DATA
      // --------------------------------
      quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        defaultValue: 'GBP',
      },
      allowOffers: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      fulfilmentType: {
        type: DataTypes.ENUM("INTERNAL", "POD"),
        allowNull: false, 
        defaultValue: "INTERNAL", 
      },
      fulfilmentProvider: {
        type: DataTypes.STRING(64),
        allowNull: true, 
      },
      fulfilmentExternalId: {
        type: DataTypes.STRING(128),
        allowNull: true, 
      },
      fulfilmentMetaJson: {
        type: DataTypes.JSON,
        allowNull: true, 
      },

      // --------------------------------
      // STATUS / TRANSACTION LIFECYCLE
      // --------------------------------
      status: {
        type: DataTypes.STRING,
        defaultValue: 'active', // active, sold, removed, cancelled, etc.
        allowNull: false,
      },
      soldAt: { type: DataTypes.DATE, allowNull: true },
      shippedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true },
      cancelledReason: { type: DataTypes.STRING, allowNull: true },

      // --------------------------------
      // LOGISTICS / PROOF SYSTEM
      // --------------------------------
      shippingLabelUrl: { type: DataTypes.STRING, allowNull: true },
      proofCode: { type: DataTypes.STRING, allowNull: true },
      proofImage: { type: DataTypes.STRING, allowNull: true },
      proofUploadedAt: { type: DataTypes.DATE, allowNull: true },

      // --------------------------------
      // FEEDBACK / REVIEWS
      // --------------------------------
      rating: { type: DataTypes.INTEGER, allowNull: true },
      review: { type: DataTypes.STRING, allowNull: true },

      // --------------------------------
      // TIMESTAMPS
      // --------------------------------
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Listing',
      tableName: 'listings',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['buyerId'] },
        { fields: ['cardId'] },
        { fields: ['productId'] },
        { fields: ['status'] },
        { fields: ['type'] },
      ],
    }
  );

  // --------------------------------------------------------------------------
  // ASSOCIATIONS - Move to models/index
  // --------------------------------------------------------------------------
  Listing.associate = (models) => {
    // Seller and Buyer
    Listing.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'seller',
      onDelete: 'CASCADE',
    });

    Listing.belongsTo(models.User, {
      foreignKey: 'buyerId',
      as: 'buyer',
    });

    models.User.hasMany(Listing, {
      foreignKey: 'userId',
      as: 'listings',
      onDelete: 'CASCADE',
    });

    models.User.hasMany(Listing, {
      foreignKey: 'buyerId',
      as: 'purchases',
    });

    // Conditional relationship for cards
    if (models.m_Card) {
      Listing.belongsTo(models.m_Card, {
        foreignKey: 'cardId',
        as: 'card',
        onDelete: 'CASCADE',
      });

      models.m_Card.hasMany(Listing, {
        foreignKey: 'cardId',
        as: 'listings',
        onDelete: 'CASCADE',
      });
    }

    // Optional product associations
    if (models.Product) {
      Listing.belongsTo(models.Product, {
        foreignKey: 'productId',
        as: 'product',
      });
    }

    if (models.InventoryItem) {
      Listing.belongsTo(models.InventoryItem, {
        foreignKey: 'inventoryId',
        as: 'inventory',
      });
    }
  };

  return Listing;
};

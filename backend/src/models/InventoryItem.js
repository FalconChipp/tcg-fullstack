import { DataTypes, Model } from 'sequelize';

/**
 * InventoryItem model
 * ------------------------------------------------------------------
 * Tracks stock for official products or merchandise listed in
 * the marketplace. Used only for PRODUCT-type listings.
 *
 * Cards do NOT use this model (their quantity is managed via
 * user collections instead).
 * ------------------------------------------------------------------
 */
export default (sequelize, models) => {
  class InventoryItem extends Model {}

  InventoryItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      // --------------------------------
      // RELATIONSHIPS
      // --------------------------------
      productId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Optional link to a Product entity if your shop uses one',
      },

      listingId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Reference to the active product listing using this inventory',
      },

      // --------------------------------
      // STOCK TRACKING
      // --------------------------------
      onHand: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total units currently in stock (available to sell)',
      },
      reserved: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Units reserved for open carts or pending Stripe payments',
      },
      sold: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Units already sold (fulfilled or completed)',
      },

      // --------------------------------
      // WARNINGS / FLAGS
      // --------------------------------
      lowStockThreshold: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'When reached, triggers a low-stock warning in the admin dashboard',
      },
      restockExpectedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      // --------------------------------
      // METADATA
      // --------------------------------
      metadataJson: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Optional tracking info, such as warehouse ID or supplier notes',
      },

      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'InventoryItem',
      tableName: 'inventory_items',
      timestamps: true,
      indexes: [
        { fields: ['productId'] },
        { fields: ['listingId'] },
      ],
    }
  );

  /**
   * Associations
   * ----------------------------------------------------------------
   * - Belongs to a Product (optional)
   * - Belongs to a Listing (PRODUCT type only)
   * - Has no direct relation to Orders (handled through Listing)
   * ----------------------------------------------------------------
   */
  InventoryItem.associate = (models) => {
    if (models.Product) {
      InventoryItem.belongsTo(models.Product, {
        foreignKey: 'productId',
        as: 'product',
        onDelete: 'SET NULL',
      });
    }

    if (models.Listing) {
      InventoryItem.belongsTo(models.Listing, {
        foreignKey: 'listingId',
        as: 'listing',
        onDelete: 'CASCADE',
      });
      models.Listing.hasOne(InventoryItem, {
        foreignKey: 'listingId',
        as: 'inventory',
      });
    }
  };

  return InventoryItem;
};

// m_PriceRollup.js
// Minimal rollup snapshot per card/variant/window as stored historically.

export default (sequelize, DataTypes) => {
  const m_PriceRollup = sequelize.define("m_PriceRollup", {
    card_id:  { type: DataTypes.STRING(64), allowNull: false, primaryKey: true },
    variant:  { type: DataTypes.ENUM("normal","reverse","holo","firstEdition","foil"), allowNull: false, primaryKey: true },
    days:     { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },

    avg_gbp:  { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    min_gbp:  { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    max_gbp:  { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    last_gbp: { type: DataTypes.DECIMAL(10, 2), allowNull: true },

    computed_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: "m_price_rollups",
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ["card_id", "variant", "days"], unique: true },
      { fields: ["computed_at"] },
      { fields: ["card_id"] },
    ],
  });

  return m_PriceRollup;
};

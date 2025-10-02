// NEW
export default (sequelize, DataTypes) => {
  const m_PriceObservation = sequelize.define("m_PriceObservation", {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    card_id: { type: DataTypes.STRING(64), allowNull: false },
    variant: { type: DataTypes.ENUM("normal","reverse","holo","firstEdition","foil"), allowNull: false },
    source: { type: DataTypes.STRING(32), allowNull: false }, // ptcg, ebay, cardmarket
    currency: { type: DataTypes.STRING(3), allowNull: false },
    amount: { type: DataTypes.DECIMAL(10,2), allowNull: false },
    amount_gbp: { type: DataTypes.DECIMAL(10,2), allowNull: false },
    observed_at: { type: DataTypes.DATE, allowNull: false },
  }, {
    tableName: "m_price_observations",
    timestamps: false,
    underscored: true,
    indexes: [{ fields: ["card_id","variant","observed_at"] }],
  });
  return m_PriceObservation;
};

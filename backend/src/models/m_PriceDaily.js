// NEW
export default (sequelize, DataTypes) => {
  const m_PriceDaily = sequelize.define("m_PriceDaily", {
    card_id: { type: DataTypes.STRING(64), primaryKey: true },
    variant: { type: DataTypes.ENUM("normal","reverse","holo","firstEdition","foil"), primaryKey: true },
    as_of: { type: DataTypes.DATEONLY, primaryKey: true },
    median_gbp: DataTypes.DECIMAL(10,2),
    p10_gbp: DataTypes.DECIMAL(10,2),
    p90_gbp: DataTypes.DECIMAL(10,2),
    sample_size: DataTypes.INTEGER,
    sources_json: DataTypes.JSON,
  }, {
    tableName: "m_price_daily",
    timestamps: false,
    underscored: true,
  });
  return m_PriceDaily;
};

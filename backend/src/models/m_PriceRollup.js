// NEW
export default (sequelize, DataTypes) => {
  const m_PriceRollup = sequelize.define("m_PriceRollup", {
    card_id:  { type: DataTypes.STRING(64), primaryKey: true },
    variant:  { type: DataTypes.ENUM("normal","reverse","holo","firstEdition","foil"), primaryKey: true },
    days:     { type: DataTypes.INTEGER, primaryKey: true },  // 1,7,30,90

    avg_gbp:  DataTypes.DECIMAL(10,2),
    min_gbp:  DataTypes.DECIMAL(10,2),
    max_gbp:  DataTypes.DECIMAL(10,2),
    last_gbp: DataTypes.DECIMAL(10,2),

    computed_at: DataTypes.DATE,
  }, {
    tableName:  "m_price_rollups",
    timestamps: false,
    underscored:true,
    indexes: [
      { fields: ["card_id","variant","days"], unique: true },
      { fields: ["computed_at"] },
    ],
  });
  return m_PriceRollup;
};

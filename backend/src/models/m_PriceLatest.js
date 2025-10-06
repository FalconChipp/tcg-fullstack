// CHANGED: expose canonical price fields via virtual getters while keeping real columns intact
export default (sequelize, DataTypes) => {
  const m_PriceLatest = sequelize.define("m_PriceLatest", {
    card_id: { type: DataTypes.STRING(64), allowNull: false, primaryKey: true },
    variant: { type: DataTypes.ENUM("normal", "reverse", "holo", "firstEdition", "foil"), allowNull: false, primaryKey: true },
    price_gbp: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    median_gbp: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    p10_gbp: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    p90_gbp: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    sample_size: { type: DataTypes.INTEGER, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },
    w_1d_json: { type: DataTypes.JSON, allowNull: true },
    w_7d_json: { type: DataTypes.JSON, allowNull: true },
    w_30d_json: { type: DataTypes.JSON, allowNull: true },
    w_90d_json: { type: DataTypes.JSON, allowNull: true },
    deltas_json: { type: DataTypes.JSON, allowNull: true },
    stale: { type: DataTypes.BOOLEAN, allowNull: true },
    confidence: { type: DataTypes.FLOAT, allowNull: true },
    derived: { type: DataTypes.BOOLEAN, allowNull: true },
    sources_json: { type: DataTypes.JSON, allowNull: true },
    window_days: { type: DataTypes.INTEGER, allowNull: true },
    market: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue("price_gbp");
      },
    },
    mid: {
      type: DataTypes.VIRTUAL,
      get() {
        const mid = this.getDataValue("median_gbp");
        if (mid != null) return mid;
        return this.getDataValue("price_gbp");
      },
    },
    low: {
      type: DataTypes.VIRTUAL,
      get() {
        const low = this.getDataValue("p10_gbp");
        if (low != null) return low;
        const mid = this.getDataValue("median_gbp");
        if (mid != null) return mid;
        return this.getDataValue("price_gbp");
      },
    },
    high: {
      type: DataTypes.VIRTUAL,
      get() {
        const high = this.getDataValue("p90_gbp");
        if (high != null) return high;
        const mid = this.getDataValue("median_gbp");
        if (mid != null) return mid;
        return this.getDataValue("price_gbp");
      },
    },
  }, {
    tableName: "m_price_latest",
    timestamps: false,
    underscored: true,
  });

  return m_PriceLatest;
};

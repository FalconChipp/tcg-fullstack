// UPDATED
export default (sequelize, DataTypes) => {
  const m_PriceLatest = sequelize.define("m_PriceLatest", {
    card_id: { type: DataTypes.STRING(64), primaryKey: true },
    variant: { type: DataTypes.ENUM("normal","reverse","holo","firstEdition","foil"), primaryKey: true },

    // NEW (module reads "price_gbp" as the current point value)
    price_gbp:  DataTypes.DECIMAL(10,2),  // ADDED

    // EXISTING windowed stats (kept; useful for UI + validation)
    median_gbp: DataTypes.DECIMAL(10,2),
    p10_gbp:    DataTypes.DECIMAL(10,2),
    p90_gbp:    DataTypes.DECIMAL(10,2),
    sample_size:DataTypes.INTEGER,
    updated_at: DataTypes.DATE,

    w_1d_json:  DataTypes.JSON,
    w_7d_json:  DataTypes.JSON,
    w_30d_json: DataTypes.JSON,
    w_90d_json: DataTypes.JSON,

    deltas_json: DataTypes.JSON,
    stale:       DataTypes.BOOLEAN,
    confidence:  DataTypes.FLOAT,
    derived:     DataTypes.BOOLEAN,
    sources_json:DataTypes.JSON,
    window_days: DataTypes.INTEGER,
  }, {
    tableName:  "m_price_latest",
    timestamps: false,
    underscored:true,
    hooks: {
      // Ensure price_gbp is always set (mirror median_gbp if not explicitly written)
      beforeSave(instance) {
        if ((instance.price_gbp == null || instance.price_gbp === '') && instance.median_gbp != null) {
          instance.price_gbp = instance.median_gbp;
        }
      },
    },
  });
  return m_PriceLatest;
};

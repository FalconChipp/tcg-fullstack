// NEW
export default (sequelize, DataTypes) => {
  const m_CardVariant = sequelize.define("m_CardVariant", {
    card_id: { type: DataTypes.STRING(64), allowNull: false, primaryKey: true },
    variant: { type: DataTypes.ENUM("normal","reverse","holo","firstEdition","foil"), allowNull: false, primaryKey: true },
  }, {
    tableName: "m_card_variants",
    timestamps: false,
    underscored: true,
  });
  m_CardVariant.associate = (models) => {
    m_CardVariant.belongsTo(models.m_Card, { foreignKey: "card_id", targetKey: "id" });
  };
  return m_CardVariant;
};

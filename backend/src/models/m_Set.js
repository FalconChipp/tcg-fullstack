// NEW
export default (sequelize, DataTypes) => {
  const m_Set = sequelize.define("m_Set", {
    code: { type: DataTypes.STRING(32), primaryKey: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    era: DataTypes.STRING(64),
    release_date: DataTypes.DATEONLY,
    abbreviation: DataTypes.STRING(32),
    official_count: DataTypes.INTEGER,
    total_cards: DataTypes.INTEGER,
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    set_logo: DataTypes.TEXT,
    set_symbol: DataTypes.TEXT,
    source_at: DataTypes.DATE,
    generator_version: DataTypes.STRING(16),
    updated_at: DataTypes.DATE,
  }, {
    tableName: "m_sets",
    timestamps: false,
    underscored: true,
  });
  m_Set.associate = (models) => {
    m_Set.hasMany(models.m_Card, { foreignKey: "set_code", sourceKey: "code" });
  };
  return m_Set;
};

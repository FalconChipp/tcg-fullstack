// UPDATED
export default (sequelize, DataTypes) => {
  const m_Card = sequelize.define("m_Card", {
    id:         { type: DataTypes.STRING(64), primaryKey: true },
    set_code:   { type: DataTypes.STRING(32), allowNull: false },
    number:     { type: DataTypes.STRING(16), allowNull: false },
    name:       { type: DataTypes.STRING(255), allowNull: false },
    rarity:     DataTypes.STRING(64),

    // NEW (module expects these; we keep your existing image_url_remote)
    image_small: DataTypes.TEXT,           // ADDED
    image_large: DataTypes.TEXT,           // ADDED
    supertype:   DataTypes.STRING(64),     // ADDED
    subtype:     DataTypes.STRING(64),     // ADDED

    // EXISTING (kept)
    image_url_remote: DataTypes.TEXT,
    regulation_mark:  DataTypes.STRING(8),
    legality_std:     DataTypes.BOOLEAN,
    legality_exp:     DataTypes.BOOLEAN,
    legality_unl:     DataTypes.BOOLEAN,
    updated_at:       DataTypes.DATE,
  }, {
    tableName:  "m_cards",
    timestamps: false,
    underscored:true,
  });

  m_Card.associate = (models) => {
    m_Card.belongsTo(models.m_Set,        { foreignKey: "set_code", targetKey: "code" });
    m_Card.hasMany(models.m_CardVariant,  { foreignKey: "card_id",  sourceKey: "id"   });
  };
  return m_Card;
};

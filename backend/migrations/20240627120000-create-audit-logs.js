export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('audit_logs', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.literal('uuid_generate_v4()'),
      primaryKey: true,
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    action: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    targetId: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    targetType: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    details: {
      type: Sequelize.JSON,
      allowNull: true,
    },
    ip: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    userAgent: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('audit_logs');
}

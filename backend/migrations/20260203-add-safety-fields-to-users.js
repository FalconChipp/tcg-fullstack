// backend/migrations/20260203-add-safety-fields-to-users.js
export async function up({ context: queryInterface, Sequelize }) {
  await queryInterface.addColumn("users", "dob", {
    type: Sequelize.DATEONLY,
    allowNull: true,
  });

  await queryInterface.addColumn("users", "restriction_level", {
    type: Sequelize.STRING,
    allowNull: true,
  });

  await queryInterface.addColumn("users", "parent_email", {
    type: Sequelize.STRING,
    allowNull: true,
  });

  await queryInterface.addColumn("users", "parent_verified_at", {
    type: Sequelize.DATE,
    allowNull: true,
  });

  // Optional indexes
  await queryInterface.addIndex("users", ["restriction_level"]);
  await queryInterface.addIndex("users", ["parent_verified_at"]);
}

export async function down({ context: queryInterface }) {
  // Remove indexes first
  await queryInterface.removeIndex("users", ["restriction_level"]);
  await queryInterface.removeIndex("users", ["parent_verified_at"]);

  await queryInterface.removeColumn("users", "parent_verified_at");
  await queryInterface.removeColumn("users", "parent_email");
  await queryInterface.removeColumn("users", "restriction_level");
  await queryInterface.removeColumn("users", "dob");
}

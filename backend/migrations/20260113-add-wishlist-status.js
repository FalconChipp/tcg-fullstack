"use strict";

// UPDATED (2026-01-13):
// - Adds `status` column to wishlists table
// - Uses ENUM for strictness (MySQL)
// - Defaults to 'ACTIVE' (adjust if you prefer NULL/empty)
// - Adds an index to speed up filtering by status

module.exports = {
  async up(queryInterface, Sequelize) {
    // ✅ CHANGE THIS if your table name differs
    const TABLE = "wishlists";

    await queryInterface.addColumn(TABLE, "status", {
      type: Sequelize.ENUM("ACTIVE", "GRAIL", "EVENTUAL", "UPGRADE"),
      allowNull: false,
      defaultValue: "ACTIVE",
    });

    // Helpful for profile filtering
    await queryInterface.addIndex(TABLE, ["userId", "status"], {
      name: "wishlists_userId_status_idx",
    });
  },

  async down(queryInterface) {
    const TABLE = "wishlists";

    await queryInterface.removeIndex(TABLE, "wishlists_userId_status_idx");
    await queryInterface.removeColumn(TABLE, "status");

    // ⚠️ MySQL leaves ENUM type behind sometimes; drop it defensively.
    // Sequelize doesn't auto drop ENUM type in some dialects.
    // This is safe if it exists; if your dialect isn't MySQL you can remove this.
    try {
      await queryInterface.sequelize.query("DROP TYPE IF EXISTS enum_wishlists_status;");
    } catch (e) {
      // ignore
    }
  },
};

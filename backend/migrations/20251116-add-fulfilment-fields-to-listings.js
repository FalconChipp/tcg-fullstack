// ESM migration – works with "type": "module" when run via
// node --experimental-vm-modules (see command below).

/**
 * Add fulfilment fields to listings
 * ---------------------------------
 * Keeps existing data intact; all new columns are nullable.
 *
 * Columns:
 *  - fulfilmentType        STRING (e.g. "INTERNAL", "POD")
 *  - fulfilmentProvider    STRING (e.g. "INKTHREADABLE")
 *  - fulfilmentExternalId  STRING (Inkthreadable product code / pn)
 *  - fulfilmentMetaJson    JSON   (any extra config you want to send)
 */

export async function up(queryInterface, Sequelize) {
  await Promise.all([
    queryInterface.addColumn("listings", "fulfilmentType", {
      type: Sequelize.STRING,
      allowNull: true,
    }),
    queryInterface.addColumn("listings", "fulfilmentProvider", {
      type: Sequelize.STRING,
      allowNull: true,
    }),
    queryInterface.addColumn("listings", "fulfilmentExternalId", {
      type: Sequelize.STRING,
      allowNull: true,
    }),
    queryInterface.addColumn("listings", "fulfilmentMetaJson", {
      type: Sequelize.JSON,
      allowNull: true,
    }),
  ]);
}

export async function down(queryInterface /* , Sequelize */) {
  await Promise.all([
    queryInterface.removeColumn("listings", "fulfilmentType"),
    queryInterface.removeColumn("listings", "fulfilmentProvider"),
    queryInterface.removeColumn("listings", "fulfilmentExternalId"),
    queryInterface.removeColumn("listings", "fulfilmentMetaJson"),
  ]);
}

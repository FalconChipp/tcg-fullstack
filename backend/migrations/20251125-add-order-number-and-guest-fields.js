// example: backend/src/migrations/20251125-add-order-number-and-guest-fields.js

export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('orders', 'orderNumber', {
    type: Sequelize.STRING(32),
    allowNull: true, // temporary, will backfill then enforce NOT NULL
    unique: true,
    comment: 'Human-friendly order reference',
  });

  await queryInterface.addColumn('orders', 'buyerEmail', {
    type: Sequelize.STRING,
    allowNull: true,
  });

  await queryInterface.addColumn('orders', 'buyerName', {
    type: Sequelize.STRING,
    allowNull: true,
  });

  await queryInterface.addColumn('orders', 'guestCheckout', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });

  // Make buyerId nullable for guest checkout
  await queryInterface.changeColumn('orders', 'buyerId', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  // Backfill orderNumber for existing orders using a simple pattern
  // (you can also run a script that uses Order.generateOrderNumber()).
  // Example: SBF-LEGACY-<last 8 chars of UUID>
  const [orders] = await queryInterface.sequelize.query(
    'SELECT id FROM orders WHERE orderNumber IS NULL'
  );

  for (const row of orders) {
    const idStr = String(row.id);
    const suffix = idStr.slice(-8);
    const candidate = `SBF-LEGACY-${suffix}`;
    await queryInterface.sequelize.query(
      'UPDATE orders SET orderNumber = :candidate WHERE id = :id',
      { replacements: { candidate, id: row.id } }
    );
  }

  // Now enforce NOT NULL once every row has a value
  await queryInterface.changeColumn('orders', 'orderNumber', {
    type: Sequelize.STRING(32),
    allowNull: false,
    unique: true,
  });
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.changeColumn('orders', 'buyerId', {
    type: Sequelize.UUID,
    allowNull: false,
  });

  await queryInterface.removeColumn('orders', 'guestCheckout');
  await queryInterface.removeColumn('orders', 'buyerName');
  await queryInterface.removeColumn('orders', 'buyerEmail');
  await queryInterface.removeColumn('orders', 'orderNumber');
}

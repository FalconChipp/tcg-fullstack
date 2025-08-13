'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('card_price_history', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      cardId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      variation: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      tcgplayer: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      cardmarket: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      gbp: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      currency: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      fetchedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('card_price_history', ['cardId']);
    await queryInterface.addIndex('card_price_history', ['variation']);
    await queryInterface.addIndex('card_price_history', ['fetchedAt']);
    await queryInterface.addIndex('card_price_history', ['cardId', 'variation', 'fetchedAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('card_price_history');
  }
};

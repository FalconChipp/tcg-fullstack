// src/models/PriceAlert.js - ESM factory (default export)

import { DataTypes } from 'sequelize';

const PriceAlertFactory = (sequelize) => {
    const PriceAlert = sequelize.define( 
        'PriceAlert', 
        { 
            id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true}, 

            userId: { type: DataTypes.UUID, allowNull: false, index: true }, 
            cardId: { type: DataTypes.STRING, allowNull: false, index: true },

            variation: { type: DataTypes.STRING, allowNull: true },
            // One of: pct_up, pct_down, above, below
            condition: { type: DataTypes.STRING, allowNull: false },
            // For pct_*, store percent (e.g. 10 means 10%); for above/below, store GBP price
            value: { type: DataTypes.FLOAT, allowNull: false }, 

             // For pct_*, store percent (e.g. 10 means 10%); for above/below, store GBP price
            windowHours: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 24 }, 

            // Control delivery noise 
            isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            cooldownHours: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 12 }, 
            lastFiredAt: { type: DataTypes.DATE, allowNull: true }, 

            // Kept for frontend compact even though we normalise to GBP 
            currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'GBP'}, 
        }, 
        {
            tableName: 'price_alerts',
            underscored: false, 
            timestamps: true, 
            indexes: [
                { fields: [ 'userId', 'cardId' ] }, 
                { fields: [ 'cardId', 'variation' ] }, 
                { fields: [ 'isActive'] },
            ],
        }
    ); 

    return PriceAlert; 
}

export default PriceAlertFactory;
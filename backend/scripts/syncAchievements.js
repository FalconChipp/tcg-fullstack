// scripts/syncAchievements.js

import 'dotenv/config'; // So DB config loads
import { sequelize, Achievement } from '../src/models/index.js';
import ACHIEVEMENTS from '../src/data/achievements.js';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    for (const data of ACHIEVEMENTS) {
      // Sequelize's upsert will create or update by unique fields (here: code)
      const [record, created] = await Achievement.upsert(
        {
          ...data,
        },
        {
          returning: true,
        }
      );
      console.log(
        `${created ? 'Created' : 'Updated'} achievement: ${record.code} (${record.name})`
      );
    }
    console.log('All achievements synced!');
  } catch (err) {
    console.error('Error syncing achievements:', err);
  } finally {
    await sequelize.close();
  }
}

main();

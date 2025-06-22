// src/seed/achievements.js
const { Achievement } = require('../models');

const defaultAchievements = [
  {
    code: 'PRE_SIGNUP',
    name: 'Pre-launch Signup',
    description: 'Signed up before launch.',
    tier: 'Gold',
    imageUrl: '/assets/achievements/pre_signup.png'
  },
  {
    code: 'COMPLETE_BASE_SET',
    name: 'Base Set Master',
    description: 'Completed the Base Set.',
    tier: 'Gold',
    imageUrl: '/assets/achievements/base_set_master.png'
  },
  // ... more achievements
];

const seedAchievements = async () => {
  for (const a of defaultAchievements) {
    await Achievement.findOrCreate({
      where: { code: a.code },
      defaults: a
    });
  }
  console.log('Achievements seeded');
};

seedAchievements().then(() => process.exit());

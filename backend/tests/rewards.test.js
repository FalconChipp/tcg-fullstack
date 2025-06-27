import RewardFactory from '../src/models/Reward.js';
import AchievementFactory from '../src/models/Achievement.js';
import { Sequelize } from 'sequelize';

test('Reward model initializes and associates achievement', async () => {
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  const Reward = RewardFactory(sequelize);
  const Achievement = AchievementFactory(sequelize);
  Reward.belongsTo(Achievement, { foreignKey: 'achievementId' });
  Achievement.hasMany(Reward, { foreignKey: 'achievementId' });
  await sequelize.sync();
  const a = await Achievement.create({ code: 'test', name: 'Test' });
  const r = await Reward.create({ userId: '11111111-1111-1111-1111-111111111111', type: 'achievement', achievementId: a.id });
  expect(r.id).toBeDefined();
  const loaded = await Reward.findByPk(r.id, { include: [Achievement] });
  expect(loaded.Achievement.id).toBe(a.id);
});

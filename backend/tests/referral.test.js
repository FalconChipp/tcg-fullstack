import UserFactory from '../src/models/User.js';
import { Sequelize } from 'sequelize';

test('User model includes referrerId field', async () => {
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  const User = UserFactory(sequelize);
  await sequelize.sync();
  expect(User.rawAttributes.referrerId).toBeDefined();
});

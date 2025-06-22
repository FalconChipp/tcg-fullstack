// src/utils/jwt.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'notsecure';

module.exports = {
  signUser: (user) => jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: '30d' }
  ),
  verifyToken: (token) => jwt.verify(token, JWT_SECRET),
};

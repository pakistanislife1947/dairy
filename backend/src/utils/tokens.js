const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function generateRefreshToken(user, rememberMe = false) {
  const expiresIn = rememberMe
    ? (process.env.REFRESH_TOKEN_LONG_EXPIRES_IN || '30d')
    : (process.env.REFRESH_TOKEN_EXPIRES_IN      || '7d');

  return jwt.sign(
    { id: user.id, type: 'refresh' },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn }
  );
}

async function hashToken(token) {
  return bcrypt.hash(token, 10);
}

async function verifyTokenHash(token, hash) {
  return bcrypt.compare(token, hash);
}

function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyTokenHash,
  generateSecureToken,
};

// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const db  = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || null;

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  if (!JWT_SECRET) {
    return res.status(500).json({ success: false, message: 'JWT_SECRET not configured.' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.queryOne(
      'SELECT id, name, email, role, is_active FROM users WHERE id = $1 LIMIT 1',
      [payload.id]
    );
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Account not found or deactivated.' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    if (err.name === 'JsonWebTokenError')  return res.status(401).json({ success: false, message: 'Invalid token.' });
    console.error('[auth middleware]', err.message);
    return res.status(500).json({ success: false, message: 'Authentication check failed.' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
}

// alias so settings.js requireAdmin works
const requireAdmin = adminOnly;

function attachMeta(req, _res, next) {
  req.ip_address = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress;
  req.user_agent = req.headers['user-agent'];
  next();
}

module.exports = { authenticate, adminOnly, requireAdmin, attachMeta };

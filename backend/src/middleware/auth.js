const jwt = require('jsonwebtoken');
const db  = require('../config/db');

/**
 * Verifies the Bearer token from the Authorization header.
 * Attaches req.user on success.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Fetch fresh user to catch deactivations
    const [rows] = await db.query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = ?',
      [payload.id]
    );
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'Account not found or deactivated.' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Session expired. Please log in again.'
      : 'Invalid token.';
    return res.status(401).json({ success: false, message: msg });
  }
}

/** Admin-only gate. Use after authenticate. */
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
}

/** Attach IP + user-agent to req for audit logging */
function attachMeta(req, _res, next) {
  req.ip_address = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress;
  req.user_agent = req.headers['user-agent'];
  next();
}

module.exports = { authenticate, adminOnly, attachMeta };

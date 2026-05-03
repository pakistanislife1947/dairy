const jwt = require('jsonwebtoken');
const db  = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || null;

// Department → allowed pages map
const DEPT_PERMS = {
  milk_collection: ['milk','customers_view','dashboard'],
  sales:           ['sales','customers','products','dashboard'],
  accounts:        ['billing','reports','customers','dashboard'],
  hr:              ['hr','expenses','dashboard'],
  manager:         ['milk','sales','billing','customers','products','hr','expenses','reports','dashboard'],
};

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ success:false, message:'Authentication required.' });
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.queryOne(
      'SELECT u.id,u.name,u.email,u.role,u.is_active,u.department,u.permissions,e.id AS emp_id FROM users u LEFT JOIN employees e ON e.user_id=u.id WHERE u.id=$1',
      [payload.id]
    );
    if (!user || !user.is_active)
      return res.status(401).json({ success:false, message:'Account deactivated.' });

    // Build effective permissions
    if (user.role === 'admin') {
      user.perms = ['*']; // all access
    } else {
      const deptPerms = DEPT_PERMS[user.department] || [];
      const extraPerms = user.permissions || [];
      user.perms = [...new Set([...deptPerms, ...extraPerms])];
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name==='TokenExpiredError') return res.status(401).json({ success:false, message:'Session expired.' });
    return res.status(401).json({ success:false, message:'Invalid token.' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ success:false, message:'Admin access required.' });
  next();
}

// Check if user has a specific permission
function requirePerm(perm) {
  return (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    if (req.user?.perms?.includes(perm) || req.user?.perms?.includes('*'))
      return next();
    return res.status(403).json({ success:false, message:`Access denied. Required: ${perm}` });
  };
}

const requireAdmin = adminOnly;

module.exports = { authenticate, adminOnly, requireAdmin, requirePerm };

const auditRouter = require('express').Router();
const db          = require('../config/db');
const { authenticate, adminOnly } = require('../middleware/auth');

auditRouter.use(authenticate, adminOnly);

// Human-readable sentence builder
function buildSentence(action, tableName, oldVals, newVals) {
  const MODULE = {
    milk_records:    'milk collection record',
    farmers:         'collection centre / farmer',
    milk_sales:      'milk sale',
    walkin_sales:    'walk-in sale',
    expenses:        'expense entry',
    bills:           'bill',
    billing_periods: 'billing period',
    payroll:         'payroll entry',
    users:           'user account',
    shops:           'shop',
    vehicles:        'vehicle',
    customers:       'customer',
    products:        'product',
  };
  const mod = MODULE[tableName] || tableName?.replace(/_/g,' ') || 'record';

  if (action === 'LOGIN')    return `Logged into the system`;
  if (action === 'LOGOUT')   return `Logged out`;
  if (action === 'CREATE')   return `Added a new ${mod}`;
  if (action === 'DELETE')   return `Deleted a ${mod}`;

  if (action === 'UPDATE' && oldVals && newVals) {
    try {
      const o = typeof oldVals === 'string' ? JSON.parse(oldVals) : oldVals;
      const n = typeof newVals === 'string' ? JSON.parse(newVals) : newVals;
      const changed = Object.keys(n).filter(k => String(o[k]) !== String(n[k]));
      if (changed.length === 0) return `Updated a ${mod}`;
      const parts = changed.map(k => {
        const label = k.replace(/_/g,' ');
        return `${label}: "${o[k] ?? '—'}" → "${n[k] ?? '—'}"`;
      });
      return `Updated ${mod} — ${parts.join(', ')}`;
    } catch { return `Updated a ${mod}`; }
  }
  return `${action} on ${mod}`;
}

auditRouter.get('/', async (req, res, next) => {
  try {
    const { table_name, user_id, user_search, action, date_from, date_to, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions = ['1=1'];
    const params   = [];
    let   pi       = 1;

    if (table_name)   { conditions.push(`al.table_name = $${pi++}`);                        params.push(table_name); }
    if (user_id)      { conditions.push(`al.user_id = $${pi++}`);                            params.push(user_id); }
    if (action)       { conditions.push(`al.action = $${pi++}`);                             params.push(action); }
    if (date_from)    { conditions.push(`al.created_at >= $${pi++}`);                        params.push(date_from); }
    if (date_to)      { conditions.push(`al.created_at <= $${pi++}`);                        params.push(date_to + ' 23:59:59'); }
    if (user_search)  { conditions.push(`(u.name ILIKE $${pi} OR u.email ILIKE $${pi++})`);  params.push(`%${user_search}%`); }

    const where = conditions.join(' AND ');

    const sql = `
      SELECT
        al.id, al.action, al.table_name, al.record_id,
        al.old_values, al.new_values, al.ip_address, al.created_at,
        u.name  AS user_name,
        u.email AS user_email,
        u.role  AS user_role
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE ${where}
      ORDER BY al.created_at DESC
      LIMIT $${pi++} OFFSET $${pi++}`;

    params.push(parseInt(limit), offset);

    const [rows] = await db.query(sql, params);

    // Count with same filters (excluding pagination params)
    const countParams = params.slice(0, -2);
    const countSql = `
      SELECT COUNT(*) AS total
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE ${where}`;
    const countRow = await db.queryOne(countSql, countParams);
    const total = Number(countRow?.total ?? 0);

    // Build enriched rows
    const enriched = rows.map(r => ({
      ...r,
      sentence: buildSentence(r.action, r.table_name, r.old_values, r.new_values),
      diff: buildDiff(r.old_values, r.new_values),
    }));

    res.json({ success: true, data: enriched, pagination: { page: +page, limit: +limit, total } });
  } catch (err) { next(err); }
});

function buildDiff(oldVals, newVals) {
  if (!oldVals && !newVals) return null;
  try {
    const o = oldVals ? (typeof oldVals === 'string' ? JSON.parse(oldVals) : oldVals) : {};
    const n = newVals ? (typeof newVals === 'string' ? JSON.parse(newVals) : newVals) : {};
    const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])];
    return keys.map(k => ({
      field: k.replace(/_/g,' '),
      old:   o[k] ?? null,
      new:   n[k] ?? null,
      changed: String(o[k]) !== String(n[k]),
    })).filter(r => r.changed || r.old !== null || r.new !== null);
  } catch { return null; }
}

module.exports = auditRouter;

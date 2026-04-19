// ─────────────────────────────────────────────────────────────
// audit.js
// ─────────────────────────────────────────────────────────────
const auditRouter = require('express').Router();
const db          = require('../config/db');
const { authenticate, adminOnly } = require('../middleware/auth');

auditRouter.use(authenticate, adminOnly);

auditRouter.get('/', async (req, res, next) => {
  try {
    const { table_name, user_id, date_from, date_to, page = 1, limit = 100 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT al.*, u.name AS user_name, u.email AS user_email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE 1=1`;
    const params = [];

    if (table_name) { sql += ' AND al.table_name = ?'; params.push(table_name); }
    if (user_id)    { sql += ' AND al.user_id = ?';    params.push(user_id); }
    if (date_from)  { sql += ' AND al.created_at >= ?'; params.push(date_from); }
    if (date_to)    { sql += ' AND al.created_at <= ?'; params.push(date_to + ' 23:59:59'); }

    sql += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(+limit, offset);

    const [rows] = await db.query(sql, params);
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM audit_logs');

    res.json({ success: true, data: rows, pagination: { page: +page, limit: +limit, total } });
  } catch (err) { next(err); }
});

module.exports = auditRouter;

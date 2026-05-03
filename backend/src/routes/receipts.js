const router = require('express').Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { customer_type, status, date_from, date_to } = req.query;
    let sql = `SELECT r.*, c.name AS customer_name, c.customer_type AS ctype
      FROM receipts r LEFT JOIN customers c ON c.id=r.customer_id WHERE 1=1`;
    const p = [];
    let i = 1;
    if (customer_type) { sql += ` AND r.customer_type=$${i++}`; p.push(customer_type); }
    if (status)        { sql += ` AND r.status=$${i++}`;        p.push(status); }
    if (date_from)     { sql += ` AND r.receipt_date>=$${i++}`; p.push(date_from); }
    if (date_to)       { sql += ` AND r.receipt_date<=$${i++}`; p.push(date_to); }
    sql += ' ORDER BY r.created_at DESC LIMIT 200';
    const [rows] = await db.query(sql, p);
    res.json({ success:true, data:rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const r = await db.queryOne(`SELECT r.*,c.name AS customer_name FROM receipts r LEFT JOIN customers c ON c.id=r.customer_id WHERE r.id=$1`, [req.params.id]);
    if (!r) return res.status(404).json({ success:false, message:'Not found' });
    const [items] = await db.query('SELECT * FROM receipt_items WHERE receipt_id=$1', [req.params.id]);
    res.json({ success:true, data:{ ...r, items } });
  } catch (err) { next(err); }
});

module.exports = router;

const router = require('express').Router();
const { body } = require('express-validator');
const db = require('../config/db');
const { validate } = require('../middleware/validate');
const { authenticate, adminOnly } = require('../middleware/auth');

router.use(authenticate);

// GET all customers
router.get('/', async (req, res, next) => {
  try {
    const { type, search = '' } = req.query;
    let sql = `SELECT c.*, 
      COUNT(cs.id) AS total_sales,
      COALESCE(SUM(cs.total_amount),0) AS total_revenue
      FROM customers c
      LEFT JOIN customer_sales cs ON cs.customer_id = c.id
      WHERE c.is_active = TRUE AND (c.name ILIKE $1 OR c.phone ILIKE $1)`;
    const params = [`%${search}%`];
    if (type) { sql += ` AND c.type = $2`; params.push(type); }
    sql += ' GROUP BY c.id ORDER BY c.name';
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST add customer (prevent duplicate phone)
router.post('/', adminOnly,
  [body('name').trim().notEmpty(), body('type').isIn(['household','cash','walkin'])],
  validate,
  async (req, res, next) => {
    try {
      const { name, phone, address, type, rate_per_liter, credit_limit } = req.body;

      // Prevent duplicate phone
      if (phone) {
        const existing = await db.queryOne('SELECT id, name FROM customers WHERE phone = $1', [phone]);
        if (existing) return res.status(409).json({
          success: false,
          message: `Phone already registered to: ${existing.name}`
        });
      }

      const maxRow = await db.queryOne('SELECT COALESCE(MAX(id),0) AS maxid FROM customers');
      const code = `CUS-${String(Number(maxRow.maxid)+1).padStart(4,'0')}`;

      const [result] = await db.query(
        `INSERT INTO customers (customer_code,name,phone,address,type,rate_per_liter,credit_limit,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [code, name, phone||null, address||null, type, rate_per_liter||0, credit_limit||0, req.user.id]
      );
      res.status(201).json({ success: true, message: 'Customer added.', data: { id: result.insertId, code } });
    } catch (err) { next(err); }
  }
);

// GET single customer with sales history
router.get('/:id', async (req, res, next) => {
  try {
    const customer = await db.queryOne('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const [sales] = await db.query(
      'SELECT * FROM customer_sales WHERE customer_id = $1 ORDER BY sale_date DESC LIMIT 50',
      [req.params.id]
    );
    res.json({ success: true, data: { ...customer, sales } });
  } catch (err) { next(err); }
});

// POST record customer sale
router.post('/:id/sales',
  [body('sale_date').isDate(), body('quantity_liters').isFloat({min:0.1}), body('rate_per_liter').isFloat({min:0})],
  validate,
  async (req, res, next) => {
    try {
      const { sale_date, quantity_liters, rate_per_liter, payment_mode = 'cash', payment_status = 'paid', notes } = req.body;
      const total = parseFloat(quantity_liters) * parseFloat(rate_per_liter);

      const [result] = await db.query(
        `INSERT INTO customer_sales (customer_id,sale_date,quantity_liters,rate_per_liter,total_amount,payment_mode,payment_status,notes,recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [req.params.id, sale_date, quantity_liters, rate_per_liter, total.toFixed(2), payment_mode, payment_status, notes||null, req.user.id]
      );

      // Update outstanding if credit
      if (payment_status === 'pending') {
        await db.query('UPDATE customers SET outstanding = outstanding + $1 WHERE id = $2', [total, req.params.id]);
      }

      res.status(201).json({ success: true, message: 'Sale recorded.', data: { id: result.insertId, total_amount: total } });
    } catch (err) { next(err); }
  }
);

// PATCH mark customer sale as paid
router.patch('/sales/:saleId/pay', adminOnly, async (req, res, next) => {
  try {
    const sale = await db.queryOne('SELECT * FROM customer_sales WHERE id = $1', [req.params.saleId]);
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });
    if (sale.payment_status === 'paid') return res.status(400).json({ success: false, message: 'Already paid.' });

    await db.query('UPDATE customer_sales SET payment_status=$1 WHERE id=$2', ['paid', req.params.saleId]);
    await db.query('UPDATE customers SET outstanding = GREATEST(0, outstanding - $1) WHERE id = $2',
      [sale.total_amount, sale.customer_id]);

    res.json({ success: true, message: 'Payment recorded.' });
  } catch (err) { next(err); }
});

// GET customer types summary
router.get('/summary/types', async (_req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT type, COUNT(*) AS count, COALESCE(SUM(outstanding),0) AS total_outstanding
       FROM customers WHERE is_active=TRUE GROUP BY type`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

module.exports = router;

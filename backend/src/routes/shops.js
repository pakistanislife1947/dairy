const router   = require('express').Router();
const { body } = require('express-validator');
const db       = require('../config/db');
const { validate }              = require('../middleware/validate');
const { authenticate, adminOnly } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*,
         COALESCE(SUM(srp.amount),0) AS total_rent_paid,
         COUNT(srp.id)               AS payments_count
       FROM shops s
       LEFT JOIN shop_rent_payments srp ON srp.shop_id = s.id
       WHERE s.is_active = TRUE
       GROUP BY s.id ORDER BY s.shop_name`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/', adminOnly,
  [
    body('shop_name').trim().notEmpty().isLength({ max: 150 }),
    body('ownership_type').isIn(['owned','rented']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { shop_name, location, ownership_type, owner_name, owner_phone,
              monthly_rent, rent_due_day, latitude, longitude } = req.body;
      const [result] = await db.query(`INSERT INTO shops
           (shop_name, location, ownership_type, owner_name, owner_phone,
            monthly_rent, rent_due_day, latitude, longitude, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [shop_name, location || null, ownership_type,
         owner_name || null, owner_phone || null,
         ownership_type === 'rented' ? (monthly_rent || null) : null,
         rent_due_day || null, latitude || null, longitude || null, req.user.id]
      );
      res.status(201).json({ success: true, message: 'Shop added.', data: { id: result.insertId } });
    } catch (err) { next(err); }
  }
);

router.put('/:id', adminOnly, async (req, res, next) => {
  try {
    const { shop_name, location, ownership_type, owner_name, owner_phone,
            monthly_rent, rent_due_day, latitude, longitude } = req.body;
    await db.query(
      `UPDATE shops SET shop_name=?, location=?, ownership_type=?, owner_name=?, owner_phone=?,
         monthly_rent=?, rent_due_day=?, latitude=?, longitude=? WHERE id=?`,
      [shop_name, location || null, ownership_type, owner_name || null, owner_phone || null,
       monthly_rent || null, rent_due_day || null, latitude || null, longitude || null, req.params.id]
    );
    res.json({ success: true, message: 'Shop updated.' });
  } catch (err) { next(err); }
});

// Rent payments
router.get('/:id/rent-payments', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM shop_rent_payments WHERE shop_id = ? ORDER BY paid_date DESC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/:id/rent-payments',
  [body('paid_date').isDate(), body('amount').isFloat({ min: 0.01 }), body('paid_for').matches(/^\d{4}-\d{2}$/)],
  validate,
  async (req, res, next) => {
    try {
      const { paid_for, paid_date, amount, notes } = req.body;
      const [result] = await db.query(`INSERT INTO shop_rent_payments (shop_id, paid_for, paid_date, amount, notes, recorded_by)
         VALUES (?,?,?,?,?,?)`,
        [req.params.id, paid_for, paid_date, amount, notes || null, req.user.id]
      );

      // Central ledger
      const [_catRows] = await db.query("SELECT id FROM expense_categories WHERE name = 'Rent' LIMIT 1");
      const cat = _catRows[0];
      if (cat) {
        await db.query(
          `INSERT INTO expenses (category_id, expense_date, amount, description, reference_type, reference_id, created_by)
           VALUES (?,?,?,?,?,?,?)`,
          [cat.id, paid_date, amount, `Shop rent: ${paid_for}`, 'shops', req.params.id, req.user.id]
        );
      }

      res.status(201).json({ success: true, message: 'Rent payment recorded.', data: { id: result.insertId } });
    } catch (err) { next(err); }
  }
);

module.exports = router;

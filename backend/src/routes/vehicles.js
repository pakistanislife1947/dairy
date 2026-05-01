const router   = require('express').Router();
const { body } = require('express-validator');
const db       = require('../config/db');
const { validate }              = require('../middleware/validate');
const { authenticate, adminOnly } = require('../middleware/auth');

router.use(authenticate);

// ── Vehicles ───────────────────────────────────────────────
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT v.*,
         COALESCE(SUM(ve.amount),0) AS total_expenses,
         COUNT(ve.id)               AS expense_count
       FROM vehicles v
       LEFT JOIN vehicle_expenses ve ON ve.vehicle_id = v.id
       WHERE v.is_active = TRUE
       GROUP BY v.id ORDER BY v.reg_number`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/', adminOnly,
  [
    body('reg_number').trim().notEmpty(),
    body('ownership_type').isIn(['owned','rented']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { reg_number, make_model, ownership_type, owner_name, owner_phone, monthly_rent, notes } = req.body;
      const [result] = await db.query(`INSERT INTO vehicles (reg_number, make_model, ownership_type, owner_name, owner_phone, monthly_rent, capacity_liters, notes, created_by)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [reg_number, make_model || null, ownership_type,
         owner_name || null, owner_phone || null,
         ownership_type === 'rented' ? (monthly_rent || null) : null,
         req.body.capacity_liters || null, notes || null, req.user.id]
      );
      res.status(201).json({ success: true, message: 'Vehicle added.', data: { id: result.insertId } });
    } catch (err) { next(err); }
  }
);

router.put('/:id', adminOnly, async (req, res, next) => {
  try {
    const { reg_number, make_model, ownership_type, owner_name, owner_phone, monthly_rent, notes } = req.body;
    await db.query(
      `UPDATE vehicles SET reg_number=?, make_model=?, ownership_type=?,
         owner_name=?, owner_phone=?, monthly_rent=?, capacity_liters=?, notes=? WHERE id=?`,
      [reg_number, make_model || null, ownership_type, owner_name || null,
       owner_phone || null, monthly_rent || null, req.body.capacity_liters || null, notes || null, req.params.id]
    );
    res.json({ success: true, message: 'Vehicle updated.' });
  } catch (err) { next(err); }
});

router.patch('/:id/deactivate', adminOnly, async (req, res, next) => {
  try {
    await db.query('UPDATE vehicles SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Vehicle deactivated.' });
  } catch (err) { next(err); }
});

// ── Vehicle Expenses ───────────────────────────────────────
router.get('/:id/expenses', async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    let sql = 'SELECT * FROM vehicle_expenses WHERE vehicle_id = ?';
    const params = [req.params.id];
    if (date_from) { sql += ' AND expense_date >= ?'; params.push(date_from); }
    if (date_to)   { sql += ' AND expense_date <= ?'; params.push(date_to); }
    sql += ' ORDER BY expense_date DESC';
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/:id/expenses',
  [
    body('expense_date').isDate(),
    body('expense_type').isIn(['diesel','service','rent','insurance','other']),
    body('amount').isFloat({ min: 0.01 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { expense_date, expense_type, amount, odometer_km, notes } = req.body;
      const [result] = await db.query(`INSERT INTO vehicle_expenses (vehicle_id, expense_date, expense_type, amount, odometer_km, notes, recorded_by)
         VALUES (?,?,?,?,?,?,?)`,
        [req.params.id, expense_date, expense_type, amount, odometer_km || null, notes || null, req.user.id]
      );

      // Also log to central expenses ledger
      const [_dc] = await db.query("SELECT id FROM expense_categories WHERE name = 'Diesel' LIMIT 1");
      const dieselCat = _dc[0];
      const [_sc] = await db.query("SELECT id FROM expense_categories WHERE name = 'Vehicle Service' LIMIT 1");
      const serviceCat = _sc[0];
      const catId = expense_type === 'diesel' ? dieselCat?.id : serviceCat?.id;
      if (catId) {
        await db.query(
          `INSERT INTO expenses (category_id, expense_date, amount, description, reference_type, reference_id, created_by)
           VALUES (?,?,?,?,?,?,?)`,
          [catId, expense_date, amount, `Vehicle ${expense_type}`, 'vehicles', req.params.id, req.user.id]
        );
      }

      res.status(201).json({ success: true, message: 'Expense recorded.', data: { id: result.insertId } });
    } catch (err) { next(err); }
  }
);

module.exports = router;

const router   = require('express').Router();
const { body } = require('express-validator');
const db       = require('../config/db');
const { validate }              = require('../middleware/validate');
const { authenticate, adminOnly } = require('../middleware/auth');

router.use(authenticate);

const rules = [
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('phone').trim().notEmpty().isLength({ max: 20 }),
  body('address').trim().notEmpty(),
  body('base_rate').isFloat({ min: 0.01 }),
  body('ideal_fat').isFloat({ min: 0, max: 20 }),
  body('ideal_snf').isFloat({ min: 0, max: 20 }),
  body('fat_correction').isFloat({ min: 0 }),
  body('snf_correction').isFloat({ min: 0 }),
  body('bank_name').optional({ nullable: true }).isLength({ max: 100 }),
  body('bank_account').optional({ nullable: true }).isLength({ max: 50 }),
];

// GET /api/farmers
router.get('/', async (req, res, next) => {
  try {
    const { search = '', active = '1', page = 1, limit = 25 } = req.query;
    const offset   = (parseInt(page) - 1) * parseInt(limit);
    const isActive = active === 'all' ? null : parseInt(active);

    let sql = `
      SELECT f.*,
        COUNT(mr.id)                   AS total_records,
        COALESCE(SUM(mr.quantity_liters), 0) AS total_liters,
        COALESCE(SUM(mr.total_amount), 0)    AS total_earned
      FROM farmers f
      LEFT JOIN milk_records mr ON mr.farmer_id = f.id
      WHERE f.name LIKE ?`;
    const params = [`%${search}%`];

    if (isActive !== null) { sql += ' AND f.is_active = ?'; params.push(isActive); }
    sql += ' GROUP BY f.id ORDER BY f.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(sql, params);

    let cSql = 'SELECT COUNT(*) AS total FROM farmers WHERE name LIKE ?';
    const cParams = [`%${search}%`];
    if (isActive !== null) { cSql += ' AND is_active = ?'; cParams.push(isActive); }
    const [[{ total }]] = await db.query(cSql, cParams);

    res.json({ success: true, data: rows, pagination: { page: +page, limit: +limit, total } });
  } catch (err) { next(err); }
});

// GET /api/farmers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT f.*,
         COUNT(mr.id)                        AS total_records,
         COALESCE(SUM(mr.quantity_liters),0) AS total_liters,
         COALESCE(SUM(mr.total_amount),0)    AS total_earned,
         COALESCE(AVG(mr.fat_percentage),0)  AS avg_fat
       FROM farmers f
       LEFT JOIN milk_records mr ON mr.farmer_id = f.id
       WHERE f.id = ? GROUP BY f.id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Farmer not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// POST /api/farmers
router.post('/', rules, validate, async (req, res, next) => {
  try {
    const { name, phone, address, bank_name, bank_account,
            base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction } = req.body;

    const [[{ maxId }]] = await db.query('SELECT COALESCE(MAX(id),0) AS maxId FROM farmers');
    const farmerCode = `FRM-${String(maxId + 1).padStart(4, '0')}`;

    const [result] = await db.query(
      `INSERT INTO farmers
         (farmer_code, name, phone, address, bank_name, bank_account,
          base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [farmerCode, name, phone, address, bank_name || null, bank_account || null,
       base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction, req.user.id]
    );

    res.status(201).json({
      success: true, message: 'Farmer added.',
      data: { id: result.insertId, farmer_code: farmerCode, name },
    });
  } catch (err) { next(err); }
});

// PUT /api/farmers/:id
router.put('/:id', rules, validate, async (req, res, next) => {
  try {
    const { name, phone, address, bank_name, bank_account,
            base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction } = req.body;

    const [result] = await db.query(
      `UPDATE farmers SET
         name=?, phone=?, address=?, bank_name=?, bank_account=?,
         base_rate=?, ideal_fat=?, ideal_snf=?, fat_correction=?, snf_correction=?
       WHERE id=?`,
      [name, phone, address, bank_name || null, bank_account || null,
       base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Farmer not found.' });
    res.json({ success: true, message: 'Farmer updated.' });
  } catch (err) { next(err); }
});

// PATCH /api/farmers/:id/deactivate  (admin only)
router.patch('/:id/deactivate', adminOnly, async (req, res, next) => {
  try {
    const [result] = await db.query('UPDATE farmers SET is_active = 0 WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Farmer not found.' });
    res.json({ success: true, message: 'Farmer deactivated.' });
  } catch (err) { next(err); }
});

module.exports = router;

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
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT f.*,
        COUNT(mr.id)                        AS total_records,
        COALESCE(SUM(mr.quantity_liters),0) AS total_liters,
        COALESCE(SUM(mr.total_amount),0)    AS total_earned
      FROM farmers f
      LEFT JOIN milk_records mr ON mr.farmer_id = f.id
      WHERE f.name ILIKE $1`;
    const params = [`%${search}%`];
    let idx = 2;

    if (active !== 'all') {
      sql += ` AND f.is_active = $${idx++}`;
      params.push(active === '1');  // PostgreSQL boolean
    }
    sql += ` GROUP BY f.id ORDER BY f.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(sql, params);

    let cSql = 'SELECT COUNT(*) AS total FROM farmers WHERE name ILIKE $1';
    const cParams = [`%${search}%`];
    if (active !== 'all') { cSql += ' AND is_active = $2'; cParams.push(active === '1'); }
    const countRow = await db.queryOne(cSql, cParams);

    res.json({ success: true, data: rows, pagination: { page: +page, limit: +limit, total: Number(countRow.total) } });
  } catch (err) { next(err); }
});

// GET /api/farmers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const row = await db.queryOne(
      `SELECT f.*, COUNT(mr.id) AS total_records,
         COALESCE(SUM(mr.quantity_liters),0) AS total_liters,
         COALESCE(SUM(mr.total_amount),0) AS total_earned,
         COALESCE(AVG(mr.fat_percentage),0) AS avg_fat
       FROM farmers f
       LEFT JOIN milk_records mr ON mr.farmer_id = f.id
       WHERE f.id = $1 GROUP BY f.id`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Farmer not found.' });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

// POST /api/farmers
router.post('/', rules, validate, async (req, res, next) => {
  try {
    const { name, phone, address, bank_name, bank_account,
            base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction } = req.body;
    const maxRow = await db.queryOne('SELECT COALESCE(MAX(id),0) AS maxid FROM farmers');
    const farmerCode = `FRM-${String(Number(maxRow.maxid) + 1).padStart(4,'0')}`;
    const [result] = await db.query(
      `INSERT INTO farmers
         (farmer_code,name,phone,address,bank_name,bank_account,
          base_rate,ideal_fat,ideal_snf,fat_correction,snf_correction,created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [farmerCode, name, phone, address, bank_name||null, bank_account||null,
       base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Farmer added.', data: { id: result.insertId, farmer_code: farmerCode, name } });
  } catch (err) { next(err); }
});

// PUT /api/farmers/:id
router.put('/:id', rules, validate, async (req, res, next) => {
  try {
    const { name, phone, address, bank_name, bank_account,
            base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction } = req.body;
    const [result] = await db.query(
      `UPDATE farmers SET name=?,phone=?,address=?,bank_name=?,bank_account=?,
         base_rate=?,ideal_fat=?,ideal_snf=?,fat_correction=?,snf_correction=?
       WHERE id=?`,
      [name, phone, address, bank_name||null, bank_account||null,
       base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Farmer not found.' });
    res.json({ success: true, message: 'Farmer updated.' });
  } catch (err) { next(err); }
});

// PATCH /api/farmers/:id/deactivate (admin only)
router.patch('/:id/deactivate', adminOnly, async (req, res, next) => {
  try {
    const [result] = await db.query('UPDATE farmers SET is_active = FALSE WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Farmer not found.' });
    res.json({ success: true, message: 'Farmer deactivated.' });
  } catch (err) { next(err); }
});

module.exports = router;

const router   = require('express').Router();
const { body } = require('express-validator');
const db       = require('../config/db');
const { validate }    = require('../middleware/validate');
const { authenticate, adminOnly } = require('../middleware/auth');
const { computeRate, computeAmount } = require('../utils/pricingEngine');

router.use(authenticate);

const rules = [
  body('farmer_id').isInt({ min: 1 }),
  body('collection_date').isDate(),
  body('shift').isIn(['morning', 'evening']),
  body('quantity_liters').isFloat({ min: 0.01 }),
  body('fat_percentage').isFloat({ min: 0, max: 20 }),
  body('snf_percentage').optional({ nullable: true }).isFloat({ min: 0, max: 20 }),
  body('notes').optional({ nullable: true }).isString(),
];

// GET /api/milk  — list with filters
router.get('/', async (req, res, next) => {
  try {
    const { farmer_id, date_from, date_to, shift, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT mr.*, f.name AS farmer_name, f.farmer_code,
             u.name AS recorded_by_name
      FROM milk_records mr
      JOIN farmers f ON f.id = mr.farmer_id
      LEFT JOIN users u ON u.id = mr.recorded_by
      WHERE 1=1`;
    const params = [];

    if (farmer_id)  { sql += ' AND mr.farmer_id = ?';         params.push(farmer_id); }
    if (date_from)  { sql += ' AND mr.collection_date >= ?';   params.push(date_from); }
    if (date_to)    { sql += ' AND mr.collection_date <= ?';   params.push(date_to); }
    if (shift)      { sql += ' AND mr.shift = ?';              params.push(shift); }

    sql += ' ORDER BY mr.collection_date DESC, mr.shift DESC, mr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(sql, params);

    // Count
    let cSql = 'SELECT COUNT(*) AS total FROM milk_records mr WHERE 1=1';
    const cParams = [];
    if (farmer_id) { cSql += ' AND mr.farmer_id = ?'; cParams.push(farmer_id); }
    if (date_from) { cSql += ' AND mr.collection_date >= ?'; cParams.push(date_from); }
    if (date_to)   { cSql += ' AND mr.collection_date <= ?'; cParams.push(date_to); }
    if (shift)     { cSql += ' AND mr.shift = ?'; cParams.push(shift); }
    const [_totalRows] = await db.query(cSql, cParams);
      const total = _totalRows[0]?.total ?? 0;

    res.json({ success: true, data: rows, pagination: { page: +page, limit: +limit, total } });
  } catch (err) { next(err); }
});

// GET /api/milk/summary  — daily/shift totals
router.get('/summary', async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    const [rows] = await db.query(
      `SELECT collection_date, shift,
              COUNT(*)                     AS farmer_count,
              SUM(quantity_liters)         AS total_liters,
              AVG(fat_percentage)          AS avg_fat,
              AVG(snf_percentage)          AS avg_snf,
              SUM(total_amount)            AS total_amount
       FROM milk_records
       WHERE collection_date BETWEEN ? AND ?
       GROUP BY collection_date, shift
       ORDER BY collection_date DESC, shift`,
      [date_from || '2000-01-01', date_to || '2099-12-31']
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/milk/preview-rate — compute rate before saving
router.post('/preview-rate', authenticate, async (req, res, next) => {
  try {
    const { farmer_id, fat_percentage, snf_percentage, quantity_liters } = req.body;
    const [farmers] = await db.query(
      'SELECT base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction FROM farmers WHERE id = ? AND is_active = TRUE',
      [farmer_id]
    );
    if (!farmers.length) return res.status(404).json({ success: false, message: 'Farmer not found.' });

    const f = farmers[0];
    const computed_rate = computeRate({
      base_rate:      f.base_rate,
      ideal_fat:      f.ideal_fat,
      ideal_snf:      f.ideal_snf,
      fat_correction: f.fat_correction,
      snf_correction: f.snf_correction,
      actual_fat:     parseFloat(fat_percentage),
      actual_snf:     snf_percentage != null ? parseFloat(snf_percentage) : null,
    });
    const total_amount = computeAmount(quantity_liters, computed_rate);

    res.json({ success: true, data: { computed_rate, total_amount } });
  } catch (err) { next(err); }
});

// GET /api/milk/:id
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT mr.*, f.name AS farmer_name, f.farmer_code
       FROM milk_records mr JOIN farmers f ON f.id = mr.farmer_id
       WHERE mr.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Record not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// POST /api/milk
router.post('/', rules, validate, async (req, res, next) => {
  try {
    const { farmer_id, collection_date, shift, quantity_liters, fat_percentage, snf_percentage, notes } = req.body;

    // Prevent duplicate shift entry
    const [dup] = await db.query(
      'SELECT id FROM milk_records WHERE farmer_id=? AND collection_date=? AND shift=?',
      [farmer_id, collection_date, shift]
    );
    if (dup.length) {
      return res.status(409).json({ success: false, message: `${shift} record for this farmer on ${collection_date} already exists.` });
    }

    // Fetch farmer pricing config
    const [farmers] = await db.query(
      'SELECT base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction FROM farmers WHERE id = ? AND is_active = TRUE',
      [farmer_id]
    );
    if (!farmers.length) return res.status(404).json({ success: false, message: 'Farmer not found or inactive.' });

    const f = farmers[0];
    const computed_rate = computeRate({
      base_rate:      f.base_rate,
      ideal_fat:      f.ideal_fat,
      ideal_snf:      f.ideal_snf,
      fat_correction: f.fat_correction,
      snf_correction: f.snf_correction,
      actual_fat:     parseFloat(fat_percentage),
      actual_snf:     snf_percentage != null ? parseFloat(snf_percentage) : null,
    });
    const total_amount = computeAmount(quantity_liters, computed_rate);

    const [result] = await db.query(`INSERT INTO milk_records
         (farmer_id, collection_date, shift, quantity_liters, fat_percentage, snf_percentage,
          base_rate, fat_correction, snf_correction, computed_rate, total_amount, notes, recorded_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [farmer_id, collection_date, shift, quantity_liters, fat_percentage, snf_percentage || null,
       f.base_rate, f.fat_correction, f.snf_correction, computed_rate, total_amount,
       notes || null, req.user.id]
    );

    res.status(201).json({
      success: true, message: 'Milk record saved.',
      data: { id: result.insertId, computed_rate, total_amount },
    });
  } catch (err) { next(err); }
});

// PUT /api/milk/:id  (admin only — corrections are sensitive)
router.put('/:id', adminOnly, rules, validate, async (req, res, next) => {
  try {
    const { farmer_id, collection_date, shift, quantity_liters, fat_percentage, snf_percentage, notes } = req.body;

    const [farmers] = await db.query(
      'SELECT base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction FROM farmers WHERE id = ?',
      [farmer_id]
    );
    if (!farmers.length) return res.status(404).json({ success: false, message: 'Farmer not found.' });

    const f = farmers[0];
    const computed_rate = computeRate({
      base_rate: f.base_rate, ideal_fat: f.ideal_fat, ideal_snf: f.ideal_snf,
      fat_correction: f.fat_correction, snf_correction: f.snf_correction,
      actual_fat: parseFloat(fat_percentage),
      actual_snf: snf_percentage != null ? parseFloat(snf_percentage) : null,
    });
    const total_amount = computeAmount(quantity_liters, computed_rate);

    const [result] = await db.query(
      `UPDATE milk_records SET
         farmer_id=?, collection_date=?, shift=?, quantity_liters=?, fat_percentage=?,
         snf_percentage=?, computed_rate=?, total_amount=?, notes=?
       WHERE id=?`,
      [farmer_id, collection_date, shift, quantity_liters, fat_percentage,
       snf_percentage || null, computed_rate, total_amount, notes || null, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Record not found.' });
    res.json({ success: true, message: 'Milk record updated.', data: { computed_rate, total_amount } });
  } catch (err) { next(err); }
});

// DELETE /api/milk/:id (admin only)
router.delete('/:id', adminOnly, async (req, res, next) => {
  try {
    const [result] = await db.query('DELETE FROM milk_records WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Record not found.' });
    res.json({ success: true, message: 'Record deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;

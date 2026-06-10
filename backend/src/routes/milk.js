const router   = require('express').Router();
const { body } = require('express-validator');
const db       = require('../config/db');
const { validate }    = require('../middleware/validate');
const { authenticate, adminOnly } = require('../middleware/auth');
const { computeTS, validateConfig } = require('../utils/pricingEngine');

router.use(authenticate);

// Helper: load pricing config from settings
async function getPricingConfig() {
  const [rows] = await db.query(
    `SELECT key, value FROM settings
     WHERE key IN ('target_ts','base_rate','constant_c1','constant_c2','constant_c3','constant_scale')`
  );
  const cfg = {};
  rows.forEach(r => { cfg[r.key] = r.value; });
  return cfg;
}

// Is this user a purchase-role employee? (no price visibility)
function isPurchaseRole(user) {
  return user?.role === 'staff' && user?.department === 'milk_collection';
}

const rules = [
  body('farmer_id').isInt({ min: 1 }),
  body('collection_date').isDate(),
  body('shift').isIn(['morning', 'evening']),
  body('quantity_liters').isFloat({ min: 0.01 }),
  body('fat_percentage').isFloat({ min: 0, max: 20 }),
  body('lactometer_reading').optional({ nullable: true }).isFloat({ min: 0 }),
  body('snf_percentage').optional({ nullable: true }).isFloat({ min: 0, max: 20 }),
  body('notes').optional({ nullable: true }).isString(),
];

// ── GET list ──────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { farmer_id, date_from, date_to, shift, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions = ['1=1'];
    const params   = [];
    let   pi       = 1;

    // Purchase employees only see their own entries
    if (isPurchaseRole(req.user)) {
      conditions.push(`mr.recorded_by = $${pi++}`);
      params.push(req.user.id);
    }

    if (farmer_id) { conditions.push(`mr.farmer_id = $${pi++}`);         params.push(farmer_id); }
    if (date_from) { conditions.push(`mr.collection_date >= $${pi++}`);  params.push(date_from); }
    if (date_to)   { conditions.push(`mr.collection_date <= $${pi++}`);  params.push(date_to); }
    if (shift)     { conditions.push(`mr.shift = $${pi++}`);             params.push(shift); }

    const where = conditions.join(' AND ');
    const sql = `
      SELECT mr.id, mr.farmer_id, mr.collection_date, mr.shift,
             mr.quantity_liters, mr.fat_percentage, mr.snf_percentage,
             mr.lactometer_reading, mr.ts_value, mr.standardised_ts,
             mr.computed_rate, mr.total_amount,
             mr.notes, mr.recorded_by, mr.created_at,
             f.name AS farmer_name, f.farmer_code,
             u.name AS recorded_by_name
      FROM milk_records mr
      JOIN farmers f ON f.id = mr.farmer_id
      LEFT JOIN users u ON u.id = mr.recorded_by
      WHERE ${where}
      ORDER BY mr.collection_date DESC, mr.shift DESC, mr.created_at DESC
      LIMIT $${pi++} OFFSET $${pi++}`;
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(sql, params);

    // Hide pricing for purchase employees
    const data = isPurchaseRole(req.user)
      ? rows.map(r => ({ ...r, computed_rate: undefined, total_amount: undefined, ts_value: undefined, standardised_ts: undefined }))
      : rows;

    const countRow = await db.queryOne(
      `SELECT COUNT(*) AS total FROM milk_records mr WHERE ${where}`,
      params.slice(0, -2)
    );

    res.json({ success: true, data, pagination: { page: +page, limit: +limit, total: Number(countRow?.total || 0) } });
  } catch (err) { next(err); }
});

// ── GET summary ───────────────────────────────────────────────────────────
router.get('/summary', async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().slice(0,10);
    const to   = date_to   || new Date().toISOString().slice(0,10);

    let extra = '';
    const params = [from, to];
    if (isPurchaseRole(req.user)) {
      extra = ` AND recorded_by = $3`;
      params.push(req.user.id);
    }

    const [rows] = await db.query(
      `SELECT collection_date, shift,
              COUNT(*)               AS farmer_count,
              SUM(quantity_liters)   AS total_liters,
              AVG(fat_percentage)    AS avg_fat,
              AVG(snf_percentage)    AS avg_snf,
              SUM(total_amount)      AS total_amount
       FROM milk_records
       WHERE collection_date BETWEEN $1 AND $2 ${extra}
       GROUP BY collection_date, shift
       ORDER BY collection_date DESC, shift`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── POST preview-rate ─────────────────────────────────────────────────────
router.post('/preview-rate', async (req, res, next) => {
  try {
    const { fat_percentage, lactometer_reading, quantity_liters } = req.body;
    if (!fat_percentage || !lactometer_reading || !quantity_liters) {
      return res.status(400).json({ success: false, message: 'fat_percentage, lactometer_reading, quantity_liters required.' });
    }

    // Load config — fall back to defaults if settings not seeded yet
    let cfg = {};
    try { cfg = await getPricingConfig(); } catch {}

    const result = computeTS({
      cfg,
      fat:    parseFloat(fat_percentage),
      lr:     parseFloat(lactometer_reading),
      weight: parseFloat(quantity_liters),
    });

    // Hide pricing for purchase employees
    if (isPurchaseRole(req.user)) {
      return res.json({ success: true, data: { ts: result.ts, standardised_ts: result.standardised_ts } });
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── GET single ────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const row = await db.queryOne(
      `SELECT mr.*, f.name AS farmer_name, f.farmer_code
       FROM milk_records mr JOIN farmers f ON f.id = mr.farmer_id
       WHERE mr.id = $1`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Record not found.' });
    if (isPurchaseRole(req.user) && row.recorded_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

// ── POST create ───────────────────────────────────────────────────────────
router.post('/', rules, validate, async (req, res, next) => {
  try {
    const { farmer_id, collection_date, shift, quantity_liters, fat_percentage,
            lactometer_reading, snf_percentage, notes } = req.body;

    // Duplicate check
    const dup = await db.queryOne(
      'SELECT id FROM milk_records WHERE farmer_id=$1 AND collection_date=$2 AND shift=$3',
      [farmer_id, collection_date, shift]
    );
    if (dup) return res.status(409).json({ success: false, message: `${shift} record for this farmer on ${collection_date} already exists.` });

    // Pricing config — fall back to defaults if not seeded yet
    let cfg = {};
    try { cfg = await getPricingConfig(); } catch {}
    validateConfig(cfg);

    const { ts, standardised_ts, rate_per_unit, total_payout } = computeTS({
      cfg,
      fat:    parseFloat(fat_percentage),
      lr:     parseFloat(lactometer_reading),
      weight: parseFloat(quantity_liters),
    });

    const [result] = await db.query(
      `INSERT INTO milk_records
         (farmer_id, collection_date, shift, quantity_liters, fat_percentage, snf_percentage,
          lactometer_reading, ts_value, standardised_ts, computed_rate, total_amount,
          notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [farmer_id, collection_date, shift, quantity_liters, fat_percentage,
       snf_percentage || null, lactometer_reading, ts, standardised_ts,
       rate_per_unit, total_payout, notes || null, req.user.id]
    );

    const responseData = isPurchaseRole(req.user)
      ? { id: result[0]?.id, ts, standardised_ts }
      : { id: result[0]?.id, ts, standardised_ts, computed_rate: rate_per_unit, total_amount: total_payout };

    res.status(201).json({ success: true, message: 'Milk record saved.', data: responseData });
  } catch (err) {
    if (err.message?.includes('target_ts') || err.message?.includes('constant_c3')) {
      return res.status(422).json({ success: false, message: err.message });
    }
    next(err);
  }
});

// ── PUT update (admin only) ───────────────────────────────────────────────
router.put('/:id', adminOnly, rules, validate, async (req, res, next) => {
  try {
    const { farmer_id, collection_date, shift, quantity_liters, fat_percentage,
            lactometer_reading, snf_percentage, notes } = req.body;

    let cfg = {};
    try { cfg = await getPricingConfig(); } catch {}
    validateConfig(cfg);

    const { ts, standardised_ts, rate_per_unit, total_payout } = computeTS({
      cfg,
      fat:    parseFloat(fat_percentage),
      lr:     parseFloat(lactometer_reading),
      weight: parseFloat(quantity_liters),
    });

    await db.query(
         farmer_id=$1, collection_date=$2, shift=$3, quantity_liters=$4,
         fat_percentage=$5, snf_percentage=$6, lactometer_reading=$7,
         ts_value=$8, standardised_ts=$9, computed_rate=$10, total_amount=$11, notes=$12
       WHERE id=$13`,
      [farmer_id, collection_date, shift, quantity_liters, fat_percentage,
       snf_percentage || null, lactometer_reading, ts, standardised_ts,
       rate_per_unit, total_payout, notes || null, req.params.id]
    );

    res.json({ success: true, message: 'Updated.', data: { ts, standardised_ts, computed_rate: rate_per_unit, total_amount: total_payout } });
  } catch (err) { next(err); }
});

// ── DELETE (admin only) ───────────────────────────────────────────────────
router.delete('/:id', adminOnly, async (req, res, next) => {
  try {
    await db.query('DELETE FROM milk_records WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;

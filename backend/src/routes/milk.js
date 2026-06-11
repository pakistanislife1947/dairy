const router   = require('express').Router();
const { body } = require('express-validator');
const db       = require('../config/db');
const { validate }    = require('../middleware/validate');
const { authenticate, adminOnly } = require('../middleware/auth');
const { computeTS }   = require('../utils/pricingEngine');

router.use(authenticate);

async function getPricingConfig() {
  const [rows] = await db.query(
    `SELECT key, value FROM settings
     WHERE key IN ('target_ts','base_rate','constant_c1','constant_c2','constant_c3','constant_scale')`
  );
  const cfg = {};
  rows.forEach(r => { cfg[r.key] = r.value; });
  return cfg;
}

const isPurchase = user => user?.role === 'staff' && user?.department === 'milk_collection';

const rules = [
  body('farmer_id').isInt({ min: 1 }),
  body('collection_date').isDate(),
  body('quantity_liters').isFloat({ min: 0.01 }),
  body('fat_percentage').isFloat({ min: 0, max: 20 }),
  body('lactometer_reading').optional({ nullable: true }).isFloat({ min: 0 }),
  body('snf_percentage').optional({ nullable: true }).isFloat({ min: 0, max: 20 }),
  body('shop_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('notes').optional({ nullable: true }).isString(),
];

// ── GET list ──────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { farmer_id, shop_id, date_from, date_to, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let pi = 1;
    const conds = ['1=1'];

    if (isPurchase(req.user)) { conds.push(`mr.recorded_by = $${pi++}`); params.push(req.user.id); }
    if (farmer_id) { conds.push(`mr.farmer_id = $${pi++}`); params.push(farmer_id); }
    if (shop_id)   { conds.push(`mr.shop_id = $${pi++}`);   params.push(shop_id); }
    if (date_from) { conds.push(`mr.collection_date >= $${pi++}`); params.push(date_from); }
    if (date_to)   { conds.push(`mr.collection_date <= $${pi++}`); params.push(date_to); }

    const where = conds.join(' AND ');
    const [rows] = await db.query(
      `SELECT mr.id, mr.farmer_id, mr.collection_date, mr.collection_time,
              mr.quantity_liters, mr.fat_percentage, mr.snf_percentage,
              mr.lactometer_reading, mr.ts_value, mr.standardised_ts,
              mr.snf_computed, mr.sp_gravity, mr.computed_rate, mr.total_amount,
              mr.shop_id, mr.notes, mr.recorded_by, mr.created_at,
              f.name AS farmer_name, COALESCE(f.centre_name, f.name) AS centre_name, f.farmer_code,
              s.shop_name,
              u.name AS recorded_by_name
       FROM milk_records mr
       JOIN farmers f ON f.id = mr.farmer_id
       LEFT JOIN shops s ON s.id = mr.shop_id
       LEFT JOIN users u ON u.id = mr.recorded_by
       WHERE ${where}
       ORDER BY mr.collection_date DESC, mr.collection_time DESC
       LIMIT $${pi++} OFFSET $${pi++}`,
      [...params, parseInt(limit), offset]
    );

    const data = isPurchase(req.user)
      ? rows.map(r => ({ ...r, computed_rate: undefined, total_amount: undefined }))
      : rows;

    const [countRow] = await db.query(
      `SELECT COUNT(*) AS total FROM milk_records mr WHERE ${where}`, params
    );

    res.json({ success: true, data, pagination: { page: +page, limit: +limit, total: Number(countRow?.[0]?.total || 0) } });
  } catch (err) { next(err); }
});

// ── POST preview-rate ─────────────────────────────────────────────────────
router.post('/preview-rate', async (req, res, next) => {
  try {
    const { fat_percentage, lactometer_reading, quantity_liters } = req.body;
    if (!fat_percentage || !lactometer_reading || !quantity_liters)
      return res.status(400).json({ success: false, message: 'fat_percentage, lactometer_reading, quantity_liters required.' });

    let cfg = {};
    try { cfg = await getPricingConfig(); } catch {}

    const result = computeTS({
      cfg,
      fat: parseFloat(fat_percentage),
      lr:  parseFloat(lactometer_reading),
      weight: parseFloat(quantity_liters),
    });

    // Purchase staff: only see TS + SNF, NO price
    if (isPurchase(req.user)) {
      return res.json({ success: true, data: {
        ts:              result.ts,
        standardised_ts: result.standardised_ts,
        snf_computed:    result.snf_computed,
        sp_gravity:      result.sp_gravity,
      }});
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── POST create ───────────────────────────────────────────────────────────
router.post('/', rules, validate, async (req, res, next) => {
  try {
    const {
      farmer_id, collection_date, quantity_liters, fat_percentage,
      lactometer_reading, snf_percentage, shop_id, notes
    } = req.body;

    let cfg = {};
    try { cfg = await getPricingConfig(); } catch {}

    const lr = lactometer_reading ? parseFloat(lactometer_reading) : 0;

    const { ts, standardised_ts, snf_computed, sp_gravity, rate_per_unit, total_payout } = computeTS({
      cfg,
      fat:    parseFloat(fat_percentage),
      lr,
      weight: parseFloat(quantity_liters),
    });

    const collection_time = new Date().toISOString();

    const [result] = await db.query(
      `INSERT INTO milk_records
         (farmer_id, collection_date, collection_time, quantity_liters, fat_percentage,
          snf_percentage, lactometer_reading, ts_value, standardised_ts, snf_computed,
          sp_gravity, computed_rate, total_amount, shop_id, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [farmer_id, collection_date, collection_time, quantity_liters, fat_percentage,
       snf_percentage || null, lr, ts, standardised_ts, snf_computed,
       sp_gravity, rate_per_unit, total_payout, shop_id || null, notes || null, req.user.id]
    );

    const id = result[0]?.id;

    // Purchase staff: no price in response
    if (isPurchase(req.user)) {
      return res.status(201).json({ success: true, message: 'Saved.', data: { id, ts, standardised_ts, snf_computed, sp_gravity } });
    }

    res.status(201).json({ success: true, message: 'Saved.', data: { id, ts, standardised_ts, snf_computed, sp_gravity, rate_per_unit, total_payout } });
  } catch (err) { next(err); }
});

// ── PUT update (admin only) ───────────────────────────────────────────────
router.put('/:id', adminOnly, rules, validate, async (req, res, next) => {
  try {
    const { farmer_id, collection_date, quantity_liters, fat_percentage,
            lactometer_reading, snf_percentage, shop_id, notes } = req.body;

    let cfg = {};
    try { cfg = await getPricingConfig(); } catch {}

    const lr = lactometer_reading ? parseFloat(lactometer_reading) : 0;
    const { ts, standardised_ts, snf_computed, sp_gravity, rate_per_unit, total_payout } = computeTS({
      cfg, fat: parseFloat(fat_percentage), lr, weight: parseFloat(quantity_liters),
    });

    await db.query(
      `UPDATE milk_records SET
         farmer_id=$1, collection_date=$2, quantity_liters=$3, fat_percentage=$4,
         snf_percentage=$5, lactometer_reading=$6, ts_value=$7, standardised_ts=$8,
         snf_computed=$9, sp_gravity=$10, computed_rate=$11, total_amount=$12,
         shop_id=$13, notes=$14
       WHERE id=$15`,
      [farmer_id, collection_date, quantity_liters, fat_percentage,
       snf_percentage || null, lr, ts, standardised_ts, snf_computed,
       sp_gravity, rate_per_unit, total_payout, shop_id || null, notes || null, req.params.id]
    );

    res.json({ success: true, data: { ts, standardised_ts, snf_computed, sp_gravity, rate_per_unit, total_payout } });
  } catch (err) { next(err); }
});

router.delete('/:id', adminOnly, async (req, res, next) => {
  try {
    await db.query('DELETE FROM milk_records WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;

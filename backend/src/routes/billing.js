const router   = require('express').Router();
const { body } = require('express-validator');
const db       = require('../config/db');
const { validate }              = require('../middleware/validate');
const { authenticate, adminOnly } = require('../middleware/auth');

router.use(authenticate);

// ── Billing Periods ────────────────────────────────────────

// GET /api/billing/periods
router.get('/periods', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT bp.*,
         COUNT(b.id)              AS bill_count,
         COALESCE(SUM(b.net_payable),0) AS total_payable
       FROM billing_periods bp
       LEFT JOIN bills b ON b.billing_period_id = bp.id
       GROUP BY bp.id ORDER BY bp.period_year DESC, bp.period_month DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /api/billing/periods  (admin only)
router.post('/periods', adminOnly,
  [body('period_month').isInt({ min: 1, max: 12 }), body('period_year').isInt({ min: 2020 })],
  validate,
  async (req, res, next) => {
    try {
      const { period_month, period_year } = req.body;
      const [result] = await db.query(
        'INSERT INTO billing_periods (period_month, period_year, created_by) VALUES (?,?,?)',
        [period_month, period_year, req.user.id]
      );
      res.status(201).json({ success: true, message: 'Billing period created.', data: { id: result.insertId } });
    } catch (err) { next(err); }
  }
);

// PATCH /api/billing/periods/:id/close (admin only)
router.patch('/periods/:id/close', adminOnly, async (req, res, next) => {
  try {
    const [result] = await db.query(
      `UPDATE billing_periods SET status = 'closed', closed_at = NOW()
       WHERE id = ? AND status = 'open'`,
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(400).json({ success: false, message: 'Period already closed or not found.' });
    res.json({ success: true, message: 'Period closed.' });
  } catch (err) { next(err); }
});

// ── Bill Generation ────────────────────────────────────────

/**
 * POST /api/billing/generate
 * Generates bills for all active farmers in a billing period.
 * Pulls milk records for that month, applies advance deductions.
 */
router.post('/generate', adminOnly,
  [body('billing_period_id').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const { billing_period_id } = req.body;

      // Validate period
      const [[period]] = await conn.query(
        'SELECT * FROM billing_periods WHERE id = ? AND status = "open"',
        [billing_period_id]
      );
      if (!period) {
        await conn.rollback(); conn.release();
        return res.status(400).json({ success: false, message: 'Period not found or already closed.' });
      }

      // Get all farmers with milk records in this period
      const [farmers] = await conn.query(
        `SELECT DISTINCT mr.farmer_id, f.name
         FROM milk_records mr
         JOIN farmers f ON f.id = mr.farmer_id
         WHERE MONTH(mr.collection_date) = ? AND YEAR(mr.collection_date) = ?`,
        [period.period_month, period.period_year]
      );

      const bills = [];
      let billSeq = 0;

      for (const farmer of farmers) {
        // Check if bill already generated
        const [[existingBill]] = await conn.query(
          'SELECT id FROM bills WHERE billing_period_id = ? AND farmer_id = ?',
          [billing_period_id, farmer.farmer_id]
        );
        if (existingBill) continue;

        // Get milk records for this farmer + period
        const [records] = await conn.query(
          `SELECT * FROM milk_records
           WHERE farmer_id = ?
             AND MONTH(collection_date) = ?
             AND YEAR(collection_date) = ?
           ORDER BY collection_date, shift`,
          [farmer.farmer_id, period.period_month, period.period_year]
        );
        if (!records.length) continue;

        const totalLiters = records.reduce((s, r) => s + parseFloat(r.quantity_liters), 0);
        const totalAmount = records.reduce((s, r) => s + parseFloat(r.total_amount), 0);
        const avgFat      = records.reduce((s, r) => s + parseFloat(r.fat_percentage), 0) / records.length;
        const avgSnf      = records.filter(r => r.snf_percentage).length
          ? records.filter(r => r.snf_percentage).reduce((s, r) => s + parseFloat(r.snf_percentage), 0) / records.filter(r => r.snf_percentage).length
          : null;

        // Auto-deduct pending advance salary
        const [[advanceRow]] = await conn.query(
          `SELECT COALESCE(SUM(amount - recovered), 0) AS pending
           FROM advance_salary
           WHERE employee_id = (
             SELECT id FROM employees WHERE user_id = (
               SELECT user_id FROM farmers WHERE id = ? LIMIT 1
             ) LIMIT 1
           ) AND status != 'recovered'`,
          [farmer.farmer_id]
        );
        const advanceDeduction = Math.min(parseFloat(advanceRow?.pending || 0), totalAmount);

        billSeq++;
        const billNumber = `BILL-${period.period_year}${String(period.period_month).padStart(2,'0')}-${String(billSeq).padStart(4,'0')}`;
        const netPayable = parseFloat((totalAmount - advanceDeduction).toFixed(2));

        const [billResult] = await conn.query(
          `INSERT INTO bills
             (bill_number, billing_period_id, farmer_id, total_liters, avg_fat, avg_snf,
              total_amount, advance_deduction, net_payable, generated_by)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [billNumber, billing_period_id, farmer.farmer_id,
           totalLiters.toFixed(2), avgFat.toFixed(2), avgSnf ? avgSnf.toFixed(2) : null,
           totalAmount.toFixed(2), advanceDeduction.toFixed(2), netPayable, req.user.id]
        );

        // Insert line items
        for (const r of records) {
          await conn.query(
            `INSERT INTO bill_line_items
               (bill_id, milk_record_id, collection_date, shift, quantity_liters,
                fat_percentage, snf_percentage, computed_rate, line_amount)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [billResult.insertId, r.id, r.collection_date, r.shift,
             r.quantity_liters, r.fat_percentage, r.snf_percentage,
             r.computed_rate, r.total_amount]
          );
        }

        bills.push({ id: billResult.insertId, bill_number: billNumber, farmer: farmer.name, net_payable: netPayable });
      }

      await conn.commit();
      conn.release();

      res.json({
        success: true,
        message: `${bills.length} bill(s) generated.`,
        data: bills,
      });
    } catch (err) {
      await conn.rollback();
      conn.release();
      next(err);
    }
  }
);

// GET /api/billing/bills
router.get('/bills', async (req, res, next) => {
  try {
    const { period_id, farmer_id, status } = req.query;
    let sql = `
      SELECT b.*, f.name AS farmer_name, f.farmer_code,
             bp.period_month, bp.period_year
      FROM bills b
      JOIN farmers f ON f.id = b.farmer_id
      JOIN billing_periods bp ON bp.id = b.billing_period_id
      WHERE 1=1`;
    const params = [];

    if (period_id)  { sql += ' AND b.billing_period_id = ?'; params.push(period_id); }
    if (farmer_id)  { sql += ' AND b.farmer_id = ?';          params.push(farmer_id); }
    if (status)     { sql += ' AND b.status = ?';             params.push(status); }
    sql += ' ORDER BY bp.period_year DESC, bp.period_month DESC, f.name';

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/billing/bills/:id  (with line items)
router.get('/bills/:id', async (req, res, next) => {
  try {
    const [[bill]] = await db.query(
      `SELECT b.*, f.name AS farmer_name, f.farmer_code, f.phone, f.bank_name, f.bank_account,
              bp.period_month, bp.period_year
       FROM bills b
       JOIN farmers f ON f.id = b.farmer_id
       JOIN billing_periods bp ON bp.id = b.billing_period_id
       WHERE b.id = ?`,
      [req.params.id]
    );
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });

    const [lineItems] = await db.query(
      'SELECT * FROM bill_line_items WHERE bill_id = ? ORDER BY collection_date, shift',
      [req.params.id]
    );
    res.json({ success: true, data: { ...bill, line_items: lineItems } });
  } catch (err) { next(err); }
});

// PATCH /api/billing/bills/:id/pay (admin only)
router.patch('/bills/:id/pay', adminOnly, async (req, res, next) => {
  try {
    const [result] = await db.query(
      `UPDATE bills SET status = 'paid', paid_at = NOW() WHERE id = ? AND status = 'generated'`,
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(400).json({ success: false, message: 'Bill not found or already paid.' });
    res.json({ success: true, message: 'Bill marked as paid.' });
  } catch (err) { next(err); }
});

module.exports = router;

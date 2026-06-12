const express = require('express');
const db      = require('../config/db');
const { authenticate, adminOnly } = require('../middleware/auth');

const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

function getPeriod(tenure, date_from, date_to) {
  const today = new Date();
  if (tenure === 'custom' && date_from && date_to) return { start: date_from, end: date_to };
  const end = fmt(today);
  if (tenure === '7d')  { const s = new Date(today); s.setDate(s.getDate()-6);  return { start: fmt(s), end }; }
  if (tenure === '30d') { const s = new Date(today); s.setDate(s.getDate()-29); return { start: fmt(s), end }; }
  return { start: end, end };
}

// ── Check centre_name column exists ──────────────────────────────────────────
let _hasCentre = null;
async function hasCentreCol() {
  if (_hasCentre !== null) return _hasCentre;
  try {
    const row = await db.queryOne(`SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_name='farmers' AND column_name='centre_name'`);
    _hasCentre = parseInt(row.c) > 0;
  } catch { _hasCentre = false; }
  return _hasCentre;
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────
const dashRouter = express.Router();
dashRouter.use(authenticate, adminOnly);

dashRouter.get('/', async (req, res, next) => {
  try {
    const { tenure = '1d', date_from, date_to } = req.query;
    const { start: periodStart, end: periodEnd } = getPeriod(tenure, date_from, date_to);
    const hasCentre = await hasCentreCol();
    const centreExpr = hasCentre ? `COALESCE(f.centre_name, f.name)` : `f.name`;

    // Core KPIs
    const milkStats = await db.queryOne(
      `SELECT
         COALESCE(SUM(quantity_liters),0)  AS total_liters,
         COALESCE(SUM(total_amount),0)     AS purchase_cost,
         COALESCE(AVG(fat_percentage),0)   AS avg_fat,
         COUNT(DISTINCT farmer_id)         AS active_farmers,
         COUNT(*)                          AS record_count
       FROM milk_records
       WHERE collection_date BETWEEN $1 AND $2`,
      [periodStart, periodEnd]
    );

    const salesStats = await db.queryOne(
      `SELECT
         COALESCE(SUM(total_amount),0)    AS total_revenue,
         COALESCE(SUM(received_amount),0) AS received,
         COALESCE(SUM(quantity_liters),0) AS sold_liters
       FROM milk_sales
       WHERE sale_date BETWEEN $1 AND $2`,
      [periodStart, periodEnd]
    ).catch(() => ({ total_revenue: 0, received: 0, sold_liters: 0 }));

    const expenseStats = await db.queryOne(
      `SELECT COALESCE(SUM(amount),0) AS total_expenses FROM expenses WHERE expense_date BETWEEN $1 AND $2`,
      [periodStart, periodEnd]
    ).catch(() => ({ total_expenses: 0 }));

    // Stock (overall)
    const stockRow = await db.queryOne(
      `SELECT
         COALESCE((SELECT SUM(quantity_liters) FROM milk_records WHERE collection_date <= $1),0)
         - COALESCE((SELECT SUM(quantity_liters) FROM milk_sales WHERE sale_date <= $1),0)
         AS stock_liters`,
      [periodEnd]
    ).catch(() => ({ stock_liters: 0 }));

    // Purchase breakdown per supplier
    const [purchaseBreakdown] = await db.query(
      `SELECT f.name AS farmer_name,
              ${centreExpr} AS centre_name,
              f.farmer_code,
              COALESCE(f.address, '—') AS location,
              SUM(mr.quantity_liters)  AS liters,
              COALESCE(SUM(mr.total_amount),0) AS amount,
              AVG(mr.fat_percentage)   AS avg_fat,
              COUNT(*)                 AS records
       FROM milk_records mr
       JOIN farmers f ON f.id = mr.farmer_id
       WHERE mr.collection_date BETWEEN $1 AND $2
       GROUP BY mr.farmer_id, f.name, ${hasCentre ? 'f.centre_name,' : ''} f.farmer_code, f.address
       ORDER BY liters DESC`,
      [periodStart, periodEnd]
    ).catch(() => [[]]);

    // Top farmers
    const [topFarmers] = await db.query(
      `SELECT f.name, ${centreExpr} AS centre_name, f.farmer_code,
              SUM(mr.quantity_liters) AS liters,
              COALESCE(SUM(mr.total_amount),0) AS amount
       FROM milk_records mr JOIN farmers f ON f.id = mr.farmer_id
       WHERE mr.collection_date BETWEEN $1 AND $2
       GROUP BY mr.farmer_id, f.name, ${hasCentre ? 'f.centre_name,' : ''} f.farmer_code
       ORDER BY liters DESC LIMIT 5`,
      [periodStart, periodEnd]
    ).catch(() => [[]]);

    // Monthly trend (last 6 months)
    const [milkTrend] = await db.query(
      `SELECT TO_CHAR(collection_date,'YYYY-MM') AS month,
              SUM(quantity_liters) AS liters,
              COALESCE(SUM(total_amount),0) AS cost
       FROM milk_records
       WHERE collection_date >= (CURRENT_DATE - INTERVAL '5 months')
       GROUP BY TO_CHAR(collection_date,'YYYY-MM')
       ORDER BY month`,
      []
    ).catch(() => [[]]);

    const profit = parseFloat(salesStats.total_revenue || 0)
                 - parseFloat(milkStats.purchase_cost || 0)
                 - parseFloat(expenseStats.total_expenses || 0);

    res.json({
      success: true,
      data: {
        tenure,
        period: { from: periodStart, to: periodEnd },
        kpi: {
          total_liters:     parseFloat(milkStats.total_liters || 0),
          purchase_cost:    parseFloat(milkStats.purchase_cost || 0),
          avg_fat:          parseFloat(milkStats.avg_fat || 0),
          active_farmers:   parseInt(milkStats.active_farmers || 0),
          record_count:     parseInt(milkStats.record_count || 0),
          total_revenue:    parseFloat(salesStats.total_revenue || 0),
          sold_liters:      parseFloat(salesStats.sold_liters || 0),
          total_expenses:   parseFloat(expenseStats.total_expenses || 0),
          stock_liters:     parseFloat(stockRow.stock_liters || 0).toFixed(1),
          profit:           profit.toFixed(2),
          margin: salesStats.total_revenue > 0
            ? ((profit / salesStats.total_revenue) * 100).toFixed(1) : '0.0',
        },
        purchase_breakdown: purchaseBreakdown || [],
        top_farmers:        topFarmers || [],
        milk_trend:         milkTrend || [],
      },
    });
  } catch (err) {
    console.error('Admin dashboard error:', err.message);
    next(err);
  }
});

// ── Staff Dashboard ───────────────────────────────────────────────────────────
const staffDashRouter = express.Router();
staffDashRouter.use(authenticate);

staffDashRouter.get('/', async (req, res, next) => {
  try {
    const { tenure = '1d', date_from, date_to } = req.query;
    const { start: periodStart, end: periodEnd } = getPeriod(tenure, date_from, date_to);
    const userId    = req.user.id;
    const hasCentre = await hasCentreCol();
    const centreExpr = hasCentre ? `COALESCE(f.centre_name, f.name)` : `f.name`;

    const kpi = await db.queryOne(
      `SELECT
         COALESCE(SUM(quantity_liters),0) AS total_liters,
         COALESCE(AVG(fat_percentage),0)  AS avg_fat,
         COUNT(*) AS entries
       FROM milk_records
       WHERE recorded_by = $1 AND collection_date BETWEEN $2 AND $3`,
      [userId, periodStart, periodEnd]
    );

    const [details] = await db.query(
      `SELECT mr.id, mr.collection_date,
              mr.quantity_liters, mr.fat_percentage,
              mr.lactometer_reading,
              mr.ts_value,
              mr.snf_computed,
              mr.sp_gravity,
              mr.collection_time,
              ${centreExpr} AS centre_name,
              f.name AS farmer_name,
              f.farmer_code,
              s.shop_name
       FROM milk_records mr
       JOIN farmers f ON f.id = mr.farmer_id
       LEFT JOIN shops s ON s.id = mr.shop_id
       WHERE mr.recorded_by = $1 AND mr.collection_date BETWEEN $2 AND $3
       ORDER BY mr.collection_date DESC, mr.created_at DESC NULLS LAST`,
      [userId, periodStart, periodEnd]
    ).catch(() => [[]]);

    res.json({
      success: true,
      data: {
        tenure,
        period: { from: periodStart, to: periodEnd },
        kpi: {
          total_liters: parseFloat(kpi?.total_liters || 0),
          avg_fat:      parseFloat(kpi?.avg_fat || 0),
          entries:      parseInt(kpi?.entries || 0),
        },
        details: details || [],
      },
    });
  } catch (err) {
    console.error('Staff dashboard error:', err.message);
    next(err);
  }
});

module.exports = { dashRouter, staffDashRouter };

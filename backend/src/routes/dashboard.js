// backend/src/routes/dashboard.js
const dashRouter = require('express').Router();
const db         = require('../config/db');
const { authenticate, adminOnly } = require('../middleware/auth');

dashRouter.use(authenticate, adminOnly);

dashRouter.get('/', async (req, res, next) => {
  try {
    // ── Tenure / date range ──────────────────────────────────────────
    // tenure: '1d' | '7d' | '30d' | 'custom'
    const { tenure = '1d', date_from, date_to } = req.query;

    let periodStart, periodEnd;
    const today = new Date();
    const pad   = n => String(n).padStart(2, '0');
    const fmt   = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

    if (tenure === 'custom' && date_from && date_to) {
      periodStart = date_from;
      periodEnd   = date_to;
    } else {
      periodEnd = fmt(today);
      if (tenure === '7d') {
        const s = new Date(today); s.setDate(s.getDate() - 6);
        periodStart = fmt(s);
      } else if (tenure === '30d') {
        const s = new Date(today); s.setDate(s.getDate() - 29);
        periodStart = fmt(s);
      } else {
        periodStart = fmt(today); // 1d default
      }
    }

    // ── Core KPIs ────────────────────────────────────────────────────
    const milkStats = await db.queryOne(
      `SELECT
         COALESCE(SUM(quantity_liters),0)  AS total_liters,
         COALESCE(SUM(total_amount),0)     AS purchase_cost,
         COALESCE(AVG(fat_percentage),0)   AS avg_fat,
         COALESCE(AVG(snf_percentage),0)   AS avg_snf,
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
    );

    const expenseStats = await db.queryOne(
      `SELECT COALESCE(SUM(amount),0) AS total_expenses
       FROM expenses
       WHERE expense_date BETWEEN $1 AND $2`,
      [periodStart, periodEnd]
    );

    // ── Stock Left (overall) ─────────────────────────────────────────
    // All milk ever collected up to periodEnd minus all milk ever sold up to periodEnd
    const stockOverall = await db.queryOne(
      `SELECT
         COALESCE((SELECT SUM(quantity_liters) FROM milk_records WHERE collection_date <= $1),0)
         - COALESCE((SELECT SUM(quantity_liters) FROM milk_sales WHERE sale_date <= $1),0)
         AS stock_liters`,
      [periodEnd]
    );

    // ── Stock Per Shop ───────────────────────────────────────────────
    // Walk-in sales go through shops (walkin_sales table)
    const [shopStock] = await db.query(
      `SELECT s.id, s.shop_name,
         COALESCE(ws.sold, 0) AS sold_liters
       FROM shops s
       LEFT JOIN (
         SELECT shop_id, SUM(quantity_liters) AS sold
         FROM walkin_sales
         WHERE sale_date <= $1
         GROUP BY shop_id
       ) ws ON ws.shop_id = s.id
       WHERE s.is_active = TRUE
       ORDER BY s.shop_name`,
      [periodEnd]
    );

    // ── Purchase Breakdown (per farmer/collection centre) ────────────
    const [purchaseBreakdown] = await db.query(
      `SELECT f.name AS farmer_name, f.farmer_code,
              COALESCE(f.village, f.address, '—') AS location,
              SUM(mr.quantity_liters) AS liters,
              SUM(mr.total_amount)    AS amount,
              AVG(mr.fat_percentage)  AS avg_fat,
              COUNT(*)                AS records
       FROM milk_records mr
       JOIN farmers f ON f.id = mr.farmer_id
       WHERE mr.collection_date BETWEEN $1 AND $2
       GROUP BY mr.farmer_id, f.name, f.farmer_code, f.village, f.address
       ORDER BY liters DESC`,
      [periodStart, periodEnd]
    );

    // ── 6-month Trends ───────────────────────────────────────────────
    const [milkTrend] = await db.query(
      `SELECT TO_CHAR(collection_date,'YYYY-MM') AS month,
              SUM(quantity_liters) AS liters,
              SUM(total_amount)    AS cost
       FROM milk_records
       WHERE collection_date >= ($1::date - INTERVAL '5 months')
       GROUP BY TO_CHAR(collection_date,'YYYY-MM')
       ORDER BY month`,
      [periodStart]
    );

    const [salesTrend] = await db.query(
      `SELECT TO_CHAR(sale_date,'YYYY-MM') AS month,
              SUM(quantity_liters) AS liters,
              SUM(total_amount)    AS revenue
       FROM milk_sales
       WHERE sale_date >= ($1::date - INTERVAL '5 months')
       GROUP BY TO_CHAR(sale_date,'YYYY-MM')
       ORDER BY month`,
      [periodStart]
    );

    const [topFarmers] = await db.query(
      `SELECT f.name, f.farmer_code,
              SUM(mr.quantity_liters) AS liters,
              SUM(mr.total_amount)    AS amount
       FROM milk_records mr JOIN farmers f ON f.id = mr.farmer_id
       WHERE mr.collection_date BETWEEN $1 AND $2
       GROUP BY mr.farmer_id, f.name, f.farmer_code
       ORDER BY liters DESC LIMIT 5`,
      [periodStart, periodEnd]
    );

    const profit = parseFloat(salesStats.total_revenue)
                 - parseFloat(milkStats.purchase_cost)
                 - parseFloat(expenseStats.total_expenses);

    res.json({
      success: true,
      data: {
        tenure,
        period: { from: periodStart, to: periodEnd },
        kpi: {
          ...milkStats,
          ...salesStats,
          ...expenseStats,
          stock_liters: parseFloat(stockOverall.stock_liters || 0).toFixed(1),
          profit:  profit.toFixed(2),
          margin:  salesStats.total_revenue > 0
                     ? ((profit / salesStats.total_revenue) * 100).toFixed(1)
                     : '0.0',
        },
        shop_stock:         shopStock,
        purchase_breakdown: purchaseBreakdown,
        milk_trend:         milkTrend,
        sales_trend:        salesTrend,
        top_farmers:        topFarmers,
      },
    });
  } catch (err) { next(err); }
});

module.exports = dashRouter;

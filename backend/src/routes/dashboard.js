// backend/src/routes/dashboard.js
const dashRouter = require('express').Router();
const db         = require('../config/db');
const { authenticate, adminOnly } = require('../middleware/auth');

dashRouter.use(authenticate, adminOnly);

dashRouter.get('/', async (req, res, next) => {
  try {
    const { month } = req.query;
    const m  = month || new Date().toISOString().slice(0, 7);
    const [yr, mn] = m.split('-');
    // month start/end for range queries — avoids MySQL MONTH()/YEAR()
    const periodStart = `${yr}-${mn}-01`;
    const periodEnd   = new Date(parseInt(yr), parseInt(mn), 0).toISOString().slice(0,10); // last day

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

    const [billStatus] = await db.query(
      `SELECT b.status, COUNT(*) AS count, COALESCE(SUM(b.net_payable),0) AS amount
       FROM bills b
       JOIN billing_periods bp ON bp.id = b.billing_period_id
       WHERE bp.period_month = $1 AND bp.period_year = $2
       GROUP BY b.status`,
      [parseInt(mn), parseInt(yr)]
    );

    // 6-month milk trend — TO_CHAR is PostgreSQL
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

    const profit = parseFloat(salesStats.total_revenue) - parseFloat(milkStats.purchase_cost) - parseFloat(expenseStats.total_expenses);

    res.json({
      success: true,
      data: {
        period: m,
        kpi: { ...milkStats, ...salesStats, ...expenseStats, profit: profit.toFixed(2),
          margin: salesStats.total_revenue > 0 ? ((profit / salesStats.total_revenue) * 100).toFixed(1) : '0.0' },
        bill_status:  billStatus,
        milk_trend:   milkTrend,
        sales_trend:  salesTrend,
        top_farmers:  topFarmers,
      },
    });
  } catch (err) { next(err); }
});

module.exports = dashRouter;

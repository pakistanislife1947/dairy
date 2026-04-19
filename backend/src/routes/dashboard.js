// ─────────────────────────────────────────────────────────────
// dashboard.js — Admin KPI aggregates
// ─────────────────────────────────────────────────────────────
const dashRouter = require('express').Router();
const db         = require('../config/db');
const { authenticate, adminOnly } = require('../middleware/auth');

dashRouter.use(authenticate, adminOnly);

dashRouter.get('/', async (req, res, next) => {
  try {
    const { month } = req.query; // YYYY-MM, defaults to current
    const m = month || new Date().toISOString().slice(0, 7);
    const [yr, mn] = m.split('-');

    const [[milkStats]] = await db.query(
      `SELECT
         COALESCE(SUM(quantity_liters),0)  AS total_liters,
         COALESCE(SUM(total_amount),0)     AS purchase_cost,
         COALESCE(AVG(fat_percentage),0)   AS avg_fat,
         COALESCE(AVG(snf_percentage),0)   AS avg_snf,
         COUNT(DISTINCT farmer_id)         AS active_farmers,
         COUNT(*)                          AS record_count
       FROM milk_records
       WHERE MONTH(collection_date)=? AND YEAR(collection_date)=?`,
      [mn, yr]
    );

    const [[salesStats]] = await db.query(
      `SELECT
         COALESCE(SUM(total_amount),0)    AS total_revenue,
         COALESCE(SUM(received_amount),0) AS received,
         COALESCE(SUM(quantity_liters),0) AS sold_liters
       FROM milk_sales
       WHERE MONTH(sale_date)=? AND YEAR(sale_date)=?`,
      [mn, yr]
    );

    const [[expenseStats]] = await db.query(
      `SELECT COALESCE(SUM(amount),0) AS total_expenses
       FROM expenses
       WHERE MONTH(expense_date)=? AND YEAR(expense_date)=?`,
      [mn, yr]
    );

    // Bills status count
    const [billStatus] = await db.query(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(net_payable),0) AS amount
       FROM bills b
       JOIN billing_periods bp ON bp.id = b.billing_period_id
       WHERE bp.period_month=? AND bp.period_year=?
       GROUP BY status`,
      [mn, yr]
    );

    // 6-month milk trend
    const [milkTrend] = await db.query(
      `SELECT DATE_FORMAT(collection_date,'%Y-%m') AS month,
              SUM(quantity_liters) AS liters,
              SUM(total_amount)    AS cost
       FROM milk_records
       WHERE collection_date >= DATE_SUB(LAST_DAY(CONCAT(?,'-01')), INTERVAL 5 MONTH)
       GROUP BY DATE_FORMAT(collection_date,'%Y-%m')
       ORDER BY month`,
      [m]
    );

    // 6-month sales trend
    const [salesTrend] = await db.query(
      `SELECT DATE_FORMAT(sale_date,'%Y-%m') AS month,
              SUM(quantity_liters) AS liters,
              SUM(total_amount)    AS revenue
       FROM milk_sales
       WHERE sale_date >= DATE_SUB(LAST_DAY(CONCAT(?,'-01')), INTERVAL 5 MONTH)
       GROUP BY DATE_FORMAT(sale_date,'%Y-%m')
       ORDER BY month`,
      [m]
    );

    // Top farmers by volume
    const [topFarmers] = await db.query(
      `SELECT f.name, f.farmer_code,
              SUM(mr.quantity_liters) AS liters,
              SUM(mr.total_amount)    AS amount
       FROM milk_records mr JOIN farmers f ON f.id = mr.farmer_id
       WHERE MONTH(mr.collection_date)=? AND YEAR(mr.collection_date)=?
       GROUP BY mr.farmer_id ORDER BY liters DESC LIMIT 5`,
      [mn, yr]
    );

    const profit = parseFloat(salesStats.total_revenue) - parseFloat(milkStats.purchase_cost) - parseFloat(expenseStats.total_expenses);

    res.json({
      success: true,
      data: {
        period: m,
        kpi: {
          ...milkStats,
          ...salesStats,
          ...expenseStats,
          profit: profit.toFixed(2),
          margin: salesStats.total_revenue > 0
            ? ((profit / salesStats.total_revenue) * 100).toFixed(1)
            : '0.0',
        },
        bill_status:  billStatus,
        milk_trend:   milkTrend,
        sales_trend:  salesTrend,
        top_farmers:  topFarmers,
      },
    });
  } catch (err) { next(err); }
});

module.exports = dashRouter;

const router   = require('express').Router();
const { body } = require('express-validator');
const db       = require('../config/db');
const { validate }              = require('../middleware/validate');
const { authenticate, adminOnly } = require('../middleware/auth');

router.use(authenticate, adminOnly);

// ── Employees ──────────────────────────────────────────────
router.get('/employees', async (_req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*,
         COALESCE(SUM(CASE WHEN a.status != 'recovered' THEN a.amount - a.recovered ELSE 0 END), 0) AS pending_advance
       FROM employees e
       LEFT JOIN advance_salary a ON a.employee_id = e.id
       WHERE e.is_active = 1
       GROUP BY e.id ORDER BY e.name`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/employees',
  [body('name').trim().notEmpty(), body('base_salary').isFloat({ min: 0 })],
  validate,
  async (req, res, next) => {
    try {
      const { name, phone, address, designation, department, base_salary, join_date, user_id } = req.body;

      const [[{ maxId }]] = await db.query('SELECT COALESCE(MAX(id),0) AS maxId FROM employees');
      const emp_code = `EMP-${String(maxId + 1).padStart(4,'0')}`;

      const [result] = await db.query(
        `INSERT INTO employees
           (emp_code, name, phone, address, designation, department, base_salary, join_date, user_id, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [emp_code, name, phone || null, address || null, designation || null,
         department || null, base_salary, join_date || null, user_id || null, req.user.id]
      );
      res.status(201).json({ success: true, message: 'Employee added.', data: { id: result.insertId, emp_code } });
    } catch (err) { next(err); }
  }
);

router.put('/employees/:id', async (req, res, next) => {
  try {
    const { name, phone, address, designation, department, base_salary, join_date } = req.body;
    await db.query(
      `UPDATE employees SET name=?, phone=?, address=?, designation=?, department=?, base_salary=?, join_date=?
       WHERE id=?`,
      [name, phone || null, address || null, designation || null, department || null, base_salary, join_date || null, req.params.id]
    );
    res.json({ success: true, message: 'Employee updated.' });
  } catch (err) { next(err); }
});

// ── Advance Salary ─────────────────────────────────────────
router.get('/employees/:id/advances', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM advance_salary WHERE employee_id = ? ORDER BY advance_date DESC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/employees/:id/advances',
  [body('amount').isFloat({ min: 1 }), body('advance_date').isDate()],
  validate,
  async (req, res, next) => {
    try {
      const { amount, advance_date, notes } = req.body;
      const [result] = await db.query(
        `INSERT INTO advance_salary (employee_id, amount, advance_date, notes, created_by)
         VALUES (?,?,?,?,?)`,
        [req.params.id, amount, advance_date, notes || null, req.user.id]
      );
      res.status(201).json({ success: true, message: 'Advance recorded.', data: { id: result.insertId } });
    } catch (err) { next(err); }
  }
);

// ── Payroll ────────────────────────────────────────────────
router.get('/payroll', async (req, res, next) => {
  try {
    const { month } = req.query; // YYYY-MM
    let sql = `
      SELECT p.*, e.name AS employee_name, e.emp_code, e.designation
      FROM payroll p JOIN employees e ON e.id = p.employee_id WHERE 1=1`;
    const params = [];
    if (month) { sql += ' AND p.payroll_month = ?'; params.push(month); }
    sql += ' ORDER BY p.payroll_month DESC, e.name';
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

/**
 * POST /api/hr/payroll/process
 * Generates payroll for all active employees for given month.
 * Auto-deducts pending advances.
 */
router.post('/payroll/process',
  [body('payroll_month').matches(/^\d{4}-\d{2}$/)],
  validate,
  async (req, res, next) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const { payroll_month, allowances_map = {} } = req.body;

      const [employees] = await conn.query(
        'SELECT * FROM employees WHERE is_active = 1'
      );

      const results = [];
      for (const emp of employees) {
        // Skip if already processed
        const [[existing]] = await conn.query(
          'SELECT id FROM payroll WHERE employee_id = ? AND payroll_month = ?',
          [emp.id, payroll_month]
        );
        if (existing) continue;

        // Get pending advance
        const [[advRow]] = await conn.query(
          `SELECT COALESCE(SUM(amount - recovered),0) AS pending
           FROM advance_salary WHERE employee_id = ? AND status != 'recovered'`,
          [emp.id]
        );
        const pendingAdvance = parseFloat(advRow.pending || 0);
        const allowances     = parseFloat(allowances_map[emp.id] || 0);
        const advDeduction   = Math.min(pendingAdvance, parseFloat(emp.base_salary));
        const netSalary      = parseFloat(emp.base_salary) + allowances - advDeduction;

        const [pr] = await conn.query(
          `INSERT INTO payroll
             (employee_id, payroll_month, base_salary, allowances, advance_deduction, net_salary, processed_by)
           VALUES (?,?,?,?,?,?,?)`,
          [emp.id, payroll_month, emp.base_salary, allowances, advDeduction, netSalary.toFixed(2), req.user.id]
        );

        // Update advance recovered amount
        if (advDeduction > 0) {
          const [advances] = await conn.query(
            `SELECT id, amount, recovered FROM advance_salary
             WHERE employee_id = ? AND status != 'recovered' ORDER BY advance_date`,
            [emp.id]
          );
          let remaining = advDeduction;
          for (const adv of advances) {
            if (remaining <= 0) break;
            const balance = parseFloat(adv.amount) - parseFloat(adv.recovered);
            const apply   = Math.min(balance, remaining);
            const newRec  = parseFloat(adv.recovered) + apply;
            const newStat = newRec >= parseFloat(adv.amount) ? 'recovered' : 'partial';
            await conn.query(
              'UPDATE advance_salary SET recovered=?, status=? WHERE id=?',
              [newRec.toFixed(2), newStat, adv.id]
            );
            remaining -= apply;
          }
        }

        // Central expense ledger
        const [[salCat]] = await conn.query("SELECT id FROM expense_categories WHERE name='Salaries' LIMIT 1");
        if (salCat) {
          const [yr, mn] = payroll_month.split('-');
          await conn.query(
            `INSERT INTO expenses (category_id, expense_date, amount, description, reference_type, reference_id, created_by)
             VALUES (?,?,?,?,?,?,?)`,
            [salCat.id, `${yr}-${mn}-01`, netSalary.toFixed(2),
             `Salary: ${emp.name} (${payroll_month})`, 'payroll', pr.insertId, req.user.id]
          );
        }

        results.push({ id: pr.insertId, employee: emp.name, net_salary: netSalary.toFixed(2) });
      }

      await conn.commit(); conn.release();
      res.json({ success: true, message: `${results.length} payroll entries processed.`, data: results });
    } catch (err) {
      await conn.rollback(); conn.release();
      next(err);
    }
  }
);

// Mark payroll as paid
router.patch('/payroll/:id/pay', async (req, res, next) => {
  try {
    await db.query(
      `UPDATE payroll SET status='paid', paid_at=NOW() WHERE id=?`,
      [req.params.id]
    );
    res.json({ success: true, message: 'Payroll marked as paid.' });
  } catch (err) { next(err); }
});

// Users list (for admin user management)
router.get('/users', async (_req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, is_active, email_verified, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.patch('/users/:id/toggle', async (req, res, next) => {
  try {
    await db.query(
      'UPDATE users SET is_active = NOT is_active WHERE id = ? AND id != 1',
      [req.params.id]
    );
    res.json({ success: true, message: 'User status toggled.' });
  } catch (err) { next(err); }
});

module.exports = router;

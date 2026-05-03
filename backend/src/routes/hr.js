const router   = require('express').Router();
const { body } = require('express-validator');
const bcrypt   = require('bcryptjs');
const db       = require('../config/db');
const { validate }              = require('../middleware/validate');
const { authenticate, adminOnly } = require('../middleware/auth');

router.use(authenticate, adminOnly);

const DEPARTMENTS = ['milk_collection','sales','accounts','hr','manager','other'];

// GET employees
router.get('/employees', async (_req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*, u.email, u.is_active AS user_active, u.department AS user_dept,
         u.permissions AS extra_perms,
         COALESCE((SELECT SUM(amount-recovered) FROM advance_salary WHERE employee_id=e.id AND status!='recovered'),0) AS pending_advance
       FROM employees e
       LEFT JOIN users u ON u.id=e.user_id
       WHERE e.is_active=TRUE ORDER BY e.name`
    );
    res.json({ success:true, data:rows });
  } catch (err) { next(err); }
});

// POST add employee
router.post('/employees',
  [body('name').trim().notEmpty(), body('base_salary').isFloat({min:0})],
  validate,
  async (req, res, next) => {
    try {
      const { name, phone, address, designation, department='other', base_salary, join_date, email, password, extra_permissions=[] } = req.body;
      const maxRow = await db.queryOne('SELECT COALESCE(MAX(id),0) AS m FROM employees');
      const emp_code = `EMP-${String(Number(maxRow.m)+1).padStart(4,'0')}`;
      let user_id = null;
      if (email && password) {
        const ex = await db.queryOne('SELECT id FROM users WHERE email=$1', [email]);
        if (ex) return res.status(409).json({ success:false, message:'Email already in use.' });
        const hash = await bcrypt.hash(password, 12);
        const [ur] = await db.query(
          `INSERT INTO users (name,email,password_hash,role,is_active,email_verified,department,permissions)
           VALUES ($1,$2,$3,'staff',true,true,$4,$5) RETURNING id`,
          [name, email, hash, department, JSON.stringify(extra_permissions)]
        );
        user_id = ur.insertId;
      }
      const [r] = await db.query(
        `INSERT INTO employees (emp_code,name,phone,address,designation,department,base_salary,join_date,user_id,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [emp_code,name,phone||null,address||null,designation||null,department,base_salary,join_date||null,user_id,req.user.id]
      );
      res.status(201).json({ success:true, data:{ id:r.insertId, emp_code, user_id } });
    } catch (err) { next(err); }
  }
);

// PUT update employee
router.put('/employees/:id', async (req, res, next) => {
  try {
    const { name, phone, designation, department, base_salary, extra_permissions } = req.body;
    await db.query(
      'UPDATE employees SET name=$1,phone=$2,designation=$3,department=$4,base_salary=$5 WHERE id=$6',
      [name,phone||null,designation||null,department,base_salary,req.params.id]
    );
    // Update user permissions if linked
    if (extra_permissions !== undefined) {
      await db.query(
        'UPDATE users SET department=$1,permissions=$2 WHERE id=(SELECT user_id FROM employees WHERE id=$3)',
        [department, JSON.stringify(extra_permissions), req.params.id]
      );
    }
    res.json({ success:true, message:'Employee updated.' });
  } catch (err) { next(err); }
});

// PATCH fire/deactivate employee
router.patch('/employees/:id/fire', async (req, res, next) => {
  try {
    await db.query('UPDATE employees SET is_active=FALSE WHERE id=$1', [req.params.id]);
    // Deactivate linked user account too
    await db.query(
      'UPDATE users SET is_active=FALSE WHERE id=(SELECT user_id FROM employees WHERE id=$1)',
      [req.params.id]
    );
    res.json({ success:true, message:'Employee deactivated.' });
  } catch (err) { next(err); }
});

// PATCH reactivate
router.patch('/employees/:id/activate', async (req, res, next) => {
  try {
    await db.query('UPDATE employees SET is_active=TRUE WHERE id=$1', [req.params.id]);
    await db.query('UPDATE users SET is_active=TRUE WHERE id=(SELECT user_id FROM employees WHERE id=$1)', [req.params.id]);
    res.json({ success:true, message:'Employee reactivated.' });
  } catch (err) { next(err); }
});

// GET all employees including fired
router.get('/employees/all', async (_req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*,u.email,u.is_active AS user_active FROM employees e
       LEFT JOIN users u ON u.id=e.user_id ORDER BY e.is_active DESC, e.name`
    );
    res.json({ success:true, data:rows });
  } catch (err) { next(err); }
});

// Advances
router.get('/employees/:id/advances', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM advance_salary WHERE employee_id=$1 ORDER BY advance_date DESC', [req.params.id]);
    res.json({ success:true, data:rows });
  } catch (err) { next(err); }
});

router.post('/employees/:id/advances',
  [body('amount').isFloat({min:1}), body('advance_date').isDate()],
  validate,
  async (req, res, next) => {
    try {
      const { amount, advance_date, notes } = req.body;
      const [r] = await db.query(
        'INSERT INTO advance_salary (employee_id,amount,advance_date,notes,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [req.params.id,amount,advance_date,notes||null,req.user.id]
      );
      res.status(201).json({ success:true, data:{ id:r.insertId } });
    } catch (err) { next(err); }
  }
);

// Payroll
router.get('/payroll', async (req, res, next) => {
  try {
    const { month } = req.query;
    let sql = `SELECT p.*,e.name AS employee_name,e.emp_code,e.designation FROM payroll p JOIN employees e ON e.id=p.employee_id WHERE 1=1`;
    const params = [];
    if (month) { sql += ' AND p.payroll_month=$1'; params.push(month); }
    sql += ' ORDER BY p.payroll_month DESC,e.name';
    const [rows] = await db.query(sql, params);
    res.json({ success:true, data:rows });
  } catch (err) { next(err); }
});

router.post('/payroll/process',
  [body('payroll_month').matches(/^\d{4}-\d{2}$/)],
  validate,
  async (req, res, next) => {
    try {
      const { payroll_month, allowances_map={} } = req.body;
      const results = await db.transaction(async (conn) => {
        const [emps] = await conn.query('SELECT * FROM employees WHERE is_active=TRUE');
        const processed = [];
        for (const emp of emps) {
          const ex = await conn.queryOne('SELECT id FROM payroll WHERE employee_id=$1 AND payroll_month=$2', [emp.id, payroll_month]);
          if (ex) continue;
          const advRow = await conn.queryOne(
            "SELECT COALESCE(SUM(amount-recovered),0) AS p FROM advance_salary WHERE employee_id=$1 AND status!='recovered'",
            [emp.id]
          );
          const pending   = parseFloat(advRow?.p||0);
          const allowances = parseFloat(allowances_map[emp.id]||0);
          const advDed    = Math.min(pending, parseFloat(emp.base_salary));
          const net       = parseFloat(emp.base_salary) + allowances - advDed;
          const [pr] = await conn.query(
            `INSERT INTO payroll (employee_id,payroll_month,base_salary,allowances,advance_deduction,net_salary,processed_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [emp.id,payroll_month,emp.base_salary,allowances,advDed.toFixed(2),net.toFixed(2),req.user.id]
          );
          if (advDed > 0) {
            const [advs] = await conn.query(
              "SELECT id,amount,recovered FROM advance_salary WHERE employee_id=$1 AND status!='recovered' ORDER BY advance_date",
              [emp.id]
            );
            let rem = advDed;
            for (const adv of advs) {
              if (rem<=0) break;
              const bal = parseFloat(adv.amount)-parseFloat(adv.recovered);
              const apply = Math.min(bal,rem);
              const newRec = parseFloat(adv.recovered)+apply;
              const stat = newRec>=parseFloat(adv.amount)?'recovered':'partial';
              await conn.query('UPDATE advance_salary SET recovered=$1,status=$2 WHERE id=$3',[newRec.toFixed(2),stat,adv.id]);
              rem -= apply;
            }
          }
          // Auto expense entry
          const salCat = await conn.queryOne("SELECT id FROM expense_categories WHERE name='Salaries' LIMIT 1");
          if (salCat) {
            const [yr,mn] = payroll_month.split('-');
            await conn.query(
              'INSERT INTO expenses (category_id,expense_date,amount,description,reference_type,reference_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
              [salCat.id,`${yr}-${mn}-01`,net.toFixed(2),`Salary: ${emp.name} (${payroll_month})`,'payroll',pr.insertId,req.user.id]
            );
          }
          processed.push({ id:pr.insertId, employee:emp.name, net_salary:net.toFixed(2) });
        }
        return processed;
      });
      res.json({ success:true, message:`${results.length} payroll entries processed.`, data:results });
    } catch (err) { next(err); }
  }
);

router.patch('/payroll/:id/pay', async (req, res, next) => {
  try {
    await db.query("UPDATE payroll SET status='paid',paid_at=NOW() WHERE id=$1", [req.params.id]);
    res.json({ success:true });
  } catch (err) { next(err); }
});

// Users list
router.get('/users', async (_req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id,name,email,role,department,is_active,created_at FROM users ORDER BY created_at DESC');
    res.json({ success:true, data:rows });
  } catch (err) { next(err); }
});

router.patch('/users/:id/toggle', async (req, res, next) => {
  try {
    await db.query('UPDATE users SET is_active=NOT is_active WHERE id=$1 AND id!=1', [req.params.id]);
    res.json({ success:true });
  } catch (err) { next(err); }
});

// GET departments list
router.get('/departments', (_req, res) => {
  res.json({ success:true, data: DEPARTMENTS });
});

module.exports = router;

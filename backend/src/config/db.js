// backend/src/config/db.js
// Replaces mysql2 pool with pg (node-postgres) connected to Supabase

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

pool.on('connect', () => {
  console.log('Connected to Supabase PostgreSQL');
});

// ─── Compatibility wrapper ───────────────────────────────────────────────────
// The existing routes use mysql2 style:
//   const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id])
//
// This wrapper:
//   1. Converts ? placeholders → $1, $2, $3 (PostgreSQL syntax)
//   2. Returns [rows, fields] so existing destructuring [rows] = await db.query(...)
//      still works without touching every route file

const db = {
  // General SELECT / UPDATE / DELETE
  async query(sql, params = []) {
    try {
      const pgSql = convertPlaceholders(sql);
      const result = await pool.query(pgSql, params);
      return [result.rows, result.fields];
    } catch (err) {
      console.error('DB query error:', err.message, '\nSQL:', sql);
      throw err;
    }
  },

  // INSERT — automatically appends RETURNING id so you get insertId back
  // Usage: const [result] = await db.insert('INSERT INTO farmers (...) VALUES (?,...)', [...])
  //        result.insertId gives you the new row id
  async insert(sql, params = []) {
    try {
      const pgSql = convertPlaceholders(sql) + ' RETURNING id';
      const result = await pool.query(pgSql, params);
      return [
        {
          insertId: result.rows[0]?.id ?? null,
          affectedRows: result.rowCount,
        },
      ];
    } catch (err) {
      console.error('DB insert error:', err.message, '\nSQL:', sql);
      throw err;
    }
  },

  // Raw pg pool access for transactions / complex queries
  pool,

  // Transaction helper
  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

// Converts MySQL ? placeholders → PostgreSQL $1, $2, $3 ...
function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

module.exports = db;

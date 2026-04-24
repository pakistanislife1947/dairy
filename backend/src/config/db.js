// backend/src/config/db.js
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => console.error('PG pool error:', err.message));
pool.on('connect', () => console.log('Connected to Supabase PostgreSQL'));

function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function sanitizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === 'bigint' ? Number(v) : v;
  }
  return out;
}

async function smartExec(executor, sql, params = []) {
  const type = sql.trim().match(/^\s*(\w+)/)?.[1]?.toUpperCase();
  const pgSql = convertPlaceholders(sql);

  if (type === 'INSERT') {
    const returnSql = /RETURNING/i.test(pgSql) ? pgSql : pgSql + ' RETURNING id';
    const result = await executor(returnSql, params);
    return [{ insertId: result.rows[0]?.id ?? null, affectedRows: result.rowCount }, result.fields];
  }

  if (type === 'UPDATE' || type === 'DELETE') {
    const result = await executor(pgSql, params);
    return [{ affectedRows: result.rowCount }, result.fields];
  }

  const result = await executor(pgSql, params);
  return [result.rows.map(sanitizeRow), result.fields];
}

const db = {
  async query(sql, params = []) {
    try {
      return await smartExec((s, p) => pool.query(s, p), sql, params);
    } catch (err) {
      console.error('DB query error:', err.message, '\nSQL:', sql);
      throw err;
    }
  },

  async queryOne(sql, params = []) {
    try {
      const pgSql = convertPlaceholders(sql);
      const result = await pool.query(pgSql, params);
      return result.rows[0] ? sanitizeRow(result.rows[0]) : null;
    } catch (err) {
      console.error('DB queryOne error:', err.message, '\nSQL:', sql);
      throw err;
    }
  },

  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const conn = {
        async query(sql, params = []) {
          return smartExec((s, p) => client.query(s, p), sql, params);
        },
        async queryOne(sql, params = []) {
          const pgSql = convertPlaceholders(sql);
          const result = await client.query(pgSql, params);
          return result.rows[0] ? sanitizeRow(result.rows[0]) : null;
        },
      };
      const result = await fn(conn);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  pool,
};

module.exports = db;

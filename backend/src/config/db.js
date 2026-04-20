// src/config/db.js
// Uses node-postgres (pg) — NOT mysql2
// Supabase requires the POOLER connection (port 6543)

const { Pool } = require('pg');

// ── Validate critical env vars on startup ──────────────────
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Check Railway → Variables tab.');
  process.exit(1);
}

// Warn about JWT secrets early so you know before first login
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET is not set — logins will fail with 500.');
}
if (!process.env.REFRESH_TOKEN_SECRET) {
  console.warn('⚠️  REFRESH_TOKEN_SECRET is not set.');
}

// ── Create pool ────────────────────────────────────────────
// DATABASE_URL format for Supabase pooler:
//   postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Supabase pooler (PgBouncer) requires SSL
  ssl: { rejectUnauthorized: false },

  // Pool tuned for Railway + Supabase free tier
  max:                    10,
  min:                    1,
  idleTimeoutMillis:      30000,
  connectionTimeoutMillis: 10000,
  statement_timeout:      15000,   // kills hanging queries, prevents crashes
});

// ── Test connection on startup (non-fatal) ─────────────────
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Supabase connection FAILED:', err.message);
    console.error('   Fix DATABASE_URL. Server stays up but DB calls will return 500.');
    return;
  }
  client.query('SELECT current_database(), current_user', (qErr, result) => {
    release();
    if (qErr) { console.error('❌ Test query failed:', qErr.message); return; }
    const { current_database, current_user } = result.rows[0];
    console.log(`✅ Supabase connected → db:${current_database} user:${current_user}`);
  });
});

// CRITICAL: without this, any pool error crashes Node.js
pool.on('error', (err) => {
  console.error('⚠️  pg pool error (auto-recovering):', err.message);
});

// ── Query helpers ──────────────────────────────────────────
// NOTE: PostgreSQL uses $1,$2 placeholders — NOT ? like MySQL
const db = {
  // Returns array of rows. Throws on DB error (caught by route try-catch).
  async query(text, params) {
    const result = await pool.query(text, params);
    return result.rows;
  },

  // Returns single row object or null (never throws "no rows" error)
  async queryOne(text, params) {
    const rows = await this.query(text, params);
    return rows.length > 0 ? rows[0] : null;
  },

  pool, // expose for transactions
};

module.exports = db;

// src/config/db.js
// Supabase PostgreSQL — handles both pooler (port 6543) and direct (port 5432)
// "Tenant not found" = wrong username format for pooler — see notes below

const { Pool } = require('pg');

// ── Validate DATABASE_URL exists ───────────────────────────────────────
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set.');
  console.error('   Railway → Variables → add DATABASE_URL');
  process.exit(1);
}

// ── Warn about missing JWT secrets early ──────────────────────────────
if (!process.env.JWT_SECRET)          console.warn('⚠️  JWT_SECRET not set — logins will fail.');
if (!process.env.REFRESH_TOKEN_SECRET) console.warn('⚠️  REFRESH_TOKEN_SECRET not set.');

// ── Detect which connection type is being used and log it ─────────────
//
//  POOLER (transaction mode, port 6543) — use for Railway/serverless:
//    postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
//    ↑ username MUST be postgres.PROJECT_ID (with dot + project ID)
//
//  DIRECT (persistent, port 5432) — use if pooler gives "Tenant not found":
//    postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres
//    ↑ username is just postgres, host is db.PROJECT_ID.supabase.co
//
//  "Tenant not found" means you are hitting port 6543 (pooler)
//  but your username is still "postgres" (direct format).
//  Fix: either switch to port 5432 direct URL, or add .PROJECT_ID to username.

const dbUrl = process.env.DATABASE_URL;
const isPooler = dbUrl.includes(':6543') || dbUrl.includes('pooler.supabase.com');
const isDirect = dbUrl.includes(':5432') || dbUrl.includes('db.') && dbUrl.includes('.supabase.co');

if (isPooler) {
  console.log('ℹ️  Using Supabase POOLER connection (port 6543)');
  // Check for "Tenant not found" mistake — pooler needs postgres.PROJECT_ID format
  // Extract username from URL to verify format
  try {
    const urlObj = new URL(dbUrl);
    const username = urlObj.username;
    if (!username.includes('.')) {
      console.error('❌ "Tenant not found" will occur with this URL!');
      console.error(`   Pooler username is "${username}" but must be "postgres.YOUR_PROJECT_ID"`);
      console.error('   Fix option A — Change your DATABASE_URL username:');
      console.error('     postgresql://postgres.abcdefghijkl:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres');
      console.error('   Fix option B — Use the direct connection instead (switch to port 5432):');
      console.error('     postgresql://postgres:PASSWORD@db.abcdefghijkl.supabase.co:5432/postgres');
      console.error('   Find both strings in: Supabase → Project Settings → Database → Connection string');
    } else {
      console.log(`   Pooler username format looks correct: "${username}"`);
    }
  } catch {
    console.warn('   Could not parse DATABASE_URL to validate format.');
  }
} else if (isDirect) {
  console.log('ℹ️  Using Supabase DIRECT connection (port 5432)');
  console.log('   Note: Direct connections may be slower on Railway. Pooler is recommended when format is correct.');
} else {
  console.log('ℹ️  Using custom database connection');
}

// ── Create connection pool ─────────────────────────────────────────────
const poolConfig = {
  connectionString: dbUrl,

  // SSL is always required for Supabase
  ssl: {
    rejectUnauthorized: false, // needed for Supabase self-signed certs
  },

  // Pool settings
  max:                     10,
  min:                     1,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 15000,

  // Kills hung queries so they don't block the whole server
  statement_timeout:       20000,

  // Keeps connections alive — prevents Railway from dropping idle connections
  keepAlive:               true,
  keepAliveInitialDelayMillis: 10000,
};

const pool = new Pool(poolConfig);

// ── CRITICAL: handle pool-level errors without crashing ───────────────
// Without this listener, any idle-connection error kills the Node process.
pool.on('error', (err, client) => {
  console.error('⚠️  pg pool idle client error:', err.message);
  console.error('   Server stays up — pool will auto-recover.');
  // Do NOT re-throw. Let the pool manage reconnection.
});

// ── Test connection on startup ─────────────────────────────────────────
pool.connect()
  .then(client => {
    console.log('✅ Supabase database connected');
    return client.query('SELECT current_database(), version()')
      .then(res => {
        const { current_database } = res.rows[0];
        const pgVersion = res.rows[0].version.split(' ').slice(0, 2).join(' ');
        console.log(`   DB: ${current_database} | ${pgVersion}`);
        client.release();
      })
      .catch(err => { client.release(); throw err; });
  })
  .catch(err => {
    // Specific error diagnosis
    if (err.message.includes('Tenant or user not found')) {
      console.error('\n❌ Supabase error: "Tenant or user not found"');
      console.error('   CAUSE: You are using the POOLER URL (port 6543) but with the wrong username format.');
      console.error('   Your username should be:  postgres.YOUR_PROJECT_ID');
      console.error('   Not just:                 postgres');
      console.error('\n   QUICK FIX — use the direct connection string instead:');
      console.error('   1. Go to Supabase → Project Settings → Database');
      console.error('   2. Under "Connection string", select "URI"');
      console.error('   3. Make sure "Use connection pooling" is UNCHECKED');
      console.error('   4. Copy that URL (it uses port 5432) and set as DATABASE_URL in Railway');
      console.error('   OR');
      console.error('   5. Keep port 6543 but change username from "postgres" to "postgres.YOUR_PROJECT_ID"');
    } else if (err.message.includes('password authentication failed')) {
      console.error('\n❌ Database password is wrong.');
      console.error('   Reset it: Supabase → Project Settings → Database → Reset database password');
    } else if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
      console.error('\n❌ Cannot reach database host:', err.message);
      console.error('   Check that DATABASE_URL hostname is correct.');
    } else {
      console.error('\n❌ Database connection failed:', err.message);
    }
    console.error('\n   Server will stay up but all DB calls will return 500 until fixed.\n');
    // Do NOT process.exit — Railway health check needs the HTTP server running
  });

// ── Query helpers ──────────────────────────────────────────────────────
//
// IMPORTANT: PostgreSQL uses $1, $2, $3 placeholders — NOT ? like MySQL
// Example:  db.query('SELECT * FROM users WHERE email = $1', [email])
//
const db = {
  /**
   * Run a query. Returns array of row objects.
   * Throws on DB error — must be caught by route try/catch.
   */
  async query(text, params) {
    try {
      const result = await pool.query(text, params);
      return result.rows;
    } catch (err) {
      // Add context to the error before re-throwing
      console.error('[db.query] Error:', err.message);
      console.error('[db.query] SQL:', text.slice(0, 120));
      if (params?.length) console.error('[db.query] Params:', params);
      throw err;
    }
  },

  /**
   * Run a query and return the first row, or null if no rows found.
   * Never throws a "no rows" error — returns null instead.
   */
  async queryOne(text, params) {
    const rows = await this.query(text, params);
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Get a client for manual transactions.
   * Always call client.release() in a finally block.
   * Usage:
   *   const client = await db.getClient();
   *   try {
   *     await client.query('BEGIN');
   *     await client.query('INSERT INTO ...');
   *     await client.query('COMMIT');
   *   } catch (e) {
   *     await client.query('ROLLBACK');
   *   } finally {
   *     client.release();
   *   }
   */
  async getClient() {
    return pool.connect();
  },

  pool,
};

module.exports = db;

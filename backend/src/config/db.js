const { Pool } = require('pg');

// Supabase/Railway ke liye simple SSL config
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Verify connectivity on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    process.exit(1);
  }
  console.log('✅ PostgreSQL connected successfully to Supabase!');
  release();
});

module.exports = pool;

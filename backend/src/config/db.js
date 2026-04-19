const mysql = require('mysql2/promise');

// Build SSL config — Railway and PlanetScale require SSL in production
const sslConfig = process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
  : false;

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306'),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASS     || '',
  database:           process.env.DB_NAME     || 'dairy_erp',
  ssl:                sslConfig,
  charset:            'utf8mb4',
  waitForConnections: true,
  connectionLimit:    parseInt(process.env.DB_POOL_LIMIT || '10'),
  queueLimit:         0,
  timezone:           '+00:00',
  decimalNumbers:     true,
  // Keep connections alive on Railway (they close idle connections)
  enableKeepAlive:    true,
  keepAliveInitialDelay: 10000,
});

// Verify connectivity on startup
pool.getConnection()
  .then(conn => {
    console.log(`✅ MySQL connected → ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  });

module.exports = pool;

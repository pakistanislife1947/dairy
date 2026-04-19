const db = require('../config/db');

/**
 * Write an audit log entry from application code.
 * DB triggers handle row-level logging automatically.
 * Use this for business-level events (login, report generation, etc.)
 */
async function logAction({ userId, action, tableName, recordId, oldValues, newValues, req }) {
  try {
    await db.query(
      `INSERT INTO audit_logs
         (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId   || null,
        action,
        tableName || null,
        recordId  || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        req?.ip_address || null,
        req?.user_agent || null,
      ]
    );
  } catch (err) {
    // Never let audit failures break request flow
    console.error('Audit log error:', err.message);
  }
}

module.exports = { logAction };

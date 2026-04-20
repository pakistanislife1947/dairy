// src/middleware/errorHandler.js
// Global error handler — catches anything that slips through route try-catch

function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

function errorHandler(err, req, res, _next) {
  // Always log the full error server-side
  console.error(`[ERROR] ${req.method} ${req.originalUrl}`);
  console.error(`        ${err.message}`);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // PostgreSQL error codes
  if (err.code === '23505') { // unique_violation
    return res.status(409).json({ success: false, message: 'Duplicate entry — record already exists.' });
  }
  if (err.code === '23503') { // foreign_key_violation
    return res.status(409).json({ success: false, message: 'Cannot delete — record is referenced by other data.' });
  }
  if (err.code === '23502') { // not_null_violation
    return res.status(400).json({ success: false, message: `Missing required field: ${err.column}` });
  }
  if (err.code === '42P01') { // undefined_table
    return res.status(500).json({ success: false, message: 'Database table missing — run schema.sql first.' });
  }
  if (err.code === '42703') { // undefined_column
    return res.status(500).json({ success: false, message: `Database column error: ${err.message}` });
  }

  const status  = err.status || err.statusCode || 500;
  const message = (process.env.NODE_ENV === 'production' && status === 500)
    ? 'Internal server error. Please try again.'
    : err.message;

  return res.status(status).json({ success: false, message });
}

module.exports = { notFound, errorHandler };

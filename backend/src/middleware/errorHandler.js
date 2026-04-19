function notFound(req, res, next) {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
}

function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'Duplicate entry. Record already exists.' });
  }
  // MySQL FK constraint
  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ success: false, message: 'Cannot delete: record is referenced by other data.' });
  }

  const status = err.status || err.statusCode || 500;
  const msg    = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal server error.'
    : err.message;

  res.status(status).json({ success: false, message: msg });
}

module.exports = { notFound, errorHandler };

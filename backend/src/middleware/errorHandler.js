const log = require('../utils/logger');

// Central error handler — never leaks stack traces to client
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.expose ? err.message : (status < 500 ? err.message : 'Internal server error');

  if (status >= 500) {
    log.error(`${req.method} ${req.path} →`, err.message, err.stack);
  }

  res.status(status).json({ success: false, error: message });
}

function notFound(req, res) {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
}

module.exports = { errorHandler, notFound };

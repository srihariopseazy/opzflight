require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { errorHandler, notFound } = require('./middleware/errorHandler');
const healthRouter = require('./routes/health');
const log = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security & Middleware ─────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Rate Limiter ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please slow down.' },
});
app.use('/api', limiter);

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/health',   healthRouter);
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/airports', require('./routes/airports'));
app.use('/api/flights',  require('./routes/flights'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/config',       require('./routes/config'));
app.use('/api/live-flights', require('./routes/live-flights'));
app.use('/api/hotels',     require('./routes/hotels'));

// ─── 404 + Error Handler ──────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  log.info(`OPSEAZY API listening on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;

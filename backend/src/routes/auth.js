const express = require('express');
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query } = require('../db/pool');
const { issueTokens, clearTokens, verifyRefresh, signAccess } = require('../utils/tokens');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
const BCRYPT_ROUNDS = 12;

// ─── POST /api/auth/register ──────────────────────────────────
router.post('/register',
  body('name').trim().notEmpty().isLength({ max: 120 }).withMessage('Name is required (max 120 chars)'),
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be 8–128 characters'),
  body('phone').optional().trim().isLength({ max: 20 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const err = new Error(errors.array()[0].msg);
      err.status = 422; err.expose = true;
      return next(err);
    }

    const { name, email, password, phone } = req.body;
    try {
      const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (exists.rows.length) {
        const err = new Error('An account with this email already exists');
        err.status = 409; err.expose = true;
        return next(err);
      }

      const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const result = await query(
        `INSERT INTO users (name, email, password_hash, phone)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, phone, role, created_at`,
        [name, email, password_hash, phone || null]
      );
      const user = result.rows[0];
      const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
      issueTokens(res, payload, req);
      res.status(201).json({ success: true, user: payload });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/login ─────────────────────────────────────
router.post('/login',
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const err = new Error(errors.array()[0].msg);
      err.status = 422; err.expose = true;
      return next(err);
    }

    const { email, password } = req.body;
    try {
      const result = await query(
        'SELECT id, name, email, password_hash, phone, role FROM users WHERE email = $1',
        [email]
      );
      const user = result.rows[0];
      // Constant-time compare even if user not found (prevent timing attacks)
      const hash = user?.password_hash || '$2a$12$invalidhashpadding000000000000000000000000000000000000000';
      const match = await bcrypt.compare(password, hash);
      if (!user || !match) {
        const err = new Error('Invalid email or password');
        err.status = 401; err.expose = true;
        return next(err);
      }

      const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
      issueTokens(res, payload, req);
      res.json({ success: true, user: payload });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/logout ────────────────────────────────────
router.post('/logout', (req, res) => {
  clearTokens(res);
  res.json({ success: true });
});

// ─── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, email, phone, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      const err = new Error('User not found'); err.status = 404; err.expose = true;
      return next(err);
    }
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  const token = req.cookies?.refresh_token;
  if (!token) {
    const err = new Error('No refresh token'); err.status = 401; err.expose = true;
    return next(err);
  }
  try {
    const decoded = verifyRefresh(token);
    const result = await query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [decoded.id]
    );
    const user = result.rows[0];
    if (!user) {
      const err = new Error('User not found'); err.status = 401; err.expose = true;
      return next(err);
    }
    const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const access = signAccess(payload);
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('access_token', access, {
      httpOnly: true,
      sameSite: 'strict',
      secure,
      maxAge: 15 * 60 * 1000,
    });
    res.json({ success: true, user: payload });
  } catch (err) {
    const e = new Error('Invalid or expired refresh token');
    e.status = 401; e.expose = true;
    next(e);
  }
});

module.exports = router;

const express = require('express');
const { query } = require('../db/pool');
const { requireAdmin } = require('../middleware/authenticate');

const router = express.Router();
const PAGE_SIZE = 20;

// GET /api/admin/bookings?page=1
router.get('/bookings', requireAdmin, async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page || 1));
  const offset = (page - 1) * PAGE_SIZE;
  try {
    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT b.id, b.pnr, b.origin_code, b.destination_code, b.departure_date,
                b.trip_type, b.cabin_class, b.passenger_count, b.total_fare, b.currency,
                b.status, b.created_at,
                u.name AS user_name, u.email AS user_email
         FROM bookings b
         JOIN users u ON u.id = b.user_id
         ORDER BY b.created_at DESC
         LIMIT $1 OFFSET $2`,
        [PAGE_SIZE, offset]
      ),
      query('SELECT COUNT(*) FROM bookings'),
    ]);
    const total = parseInt(countRes.rows[0].count);
    res.json({
      success: true,
      bookings: dataRes.rows,
      total,
      page,
      pages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

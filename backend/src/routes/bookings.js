const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

// All booking routes require auth
router.use(authenticate);

// ─── POST /api/bookings — create booking ─────────────────────
router.post('/', async (req, res, next) => {
  const { flightOffer, passengers, searchParams, confirmedFare } = req.body;

  if (!flightOffer || !passengers?.length || !searchParams) {
    const err = new Error('Missing booking data'); err.status = 400; err.expose = true;
    return next(err);
  }

  const userId = req.user.id;
  const { origin, dest, depart, returnDate, tripType = 'one-way', cabinClass = 'ECONOMY' } = searchParams;
  const totalPax = passengers.length;
  const currency = confirmedFare?.currency || flightOffer?.price?.currency || 'USD';
  const totalFare = parseFloat(confirmedFare?.total || flightOffer?.price?.total || 0) * Math.max(1, passengers.filter(p => p.passenger_type === 'adult' || p.passenger_type === 'child').length);

  // Generate PNR: 6 uppercase alphanumeric
  const pnr = uuidv4().replace(/-/g, '').toUpperCase().slice(0, 6);

  const client = await require('../db/pool').getClient();
  try {
    await client.query('BEGIN');

    const bookingRes = await client.query(
      `INSERT INTO bookings
         (user_id, pnr, origin_code, destination_code, departure_date, return_date,
          trip_type, cabin_class, passenger_count, total_fare, currency,
          status, duffel_offer_id, duffel_offer_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'confirmed',$12,$13)
       RETURNING *`,
      [
        userId,
        pnr,
        (origin || '').toUpperCase().slice(0, 3),
        (dest   || '').toUpperCase().slice(0, 3),
        depart,
        returnDate || null,
        tripType,
        cabinClass,
        totalPax,
        totalFare.toFixed(2),
        currency,
        flightOffer.id || null,
        JSON.stringify(flightOffer),
      ]
    );
    const booking = bookingRes.rows[0];

    const savedPassengers = [];
    for (const p of passengers) {
      const pRes = await client.query(
        `INSERT INTO passengers (booking_id, full_name, dob, gender, passenger_type, document_number)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [booking.id, p.full_name, p.dob, p.gender, p.passenger_type, p.document_number || null]
      );
      savedPassengers.push(pRes.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, booking: { ...booking, passengers: savedPassengers } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── GET /api/bookings/mine ───────────────────────────────────
router.get('/mine', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, pnr, origin_code, destination_code, departure_date, return_date,
              trip_type, cabin_class, passenger_count, total_fare, currency, status, created_at
       FROM bookings
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, bookings: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/bookings/:id ────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  const id = parseInt(req.params.id);
  if (!id) {
    const err = new Error('Invalid booking ID'); err.status = 400; err.expose = true;
    return next(err);
  }
  try {
    const bRes = await query(
      `SELECT b.*, u.name as user_name, u.email as user_email
       FROM bookings b JOIN users u ON u.id = b.user_id
       WHERE b.id = $1`,
      [id]
    );
    const booking = bRes.rows[0];
    if (!booking) {
      const err = new Error('Booking not found'); err.status = 404; err.expose = true;
      return next(err);
    }
    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      const err = new Error('Access denied'); err.status = 403; err.expose = true;
      return next(err);
    }
    const pRes = await query('SELECT * FROM passengers WHERE booking_id = $1 ORDER BY id', [id]);
    res.json({ success: true, booking: { ...booking, passengers: pRes.rows } });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/bookings/:id/cancel ──────────────────────────
router.patch('/:id/cancel', async (req, res, next) => {
  const id = parseInt(req.params.id);
  if (!id) {
    const err = new Error('Invalid booking ID'); err.status = 400; err.expose = true;
    return next(err);
  }
  try {
    const check = await query(
      'SELECT id, user_id, status FROM bookings WHERE id = $1',
      [id]
    );
    const booking = check.rows[0];
    if (!booking) {
      const err = new Error('Booking not found'); err.status = 404; err.expose = true;
      return next(err);
    }
    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      const err = new Error('Access denied'); err.status = 403; err.expose = true;
      return next(err);
    }
    if (booking.status === 'cancelled') {
      const err = new Error('Booking is already cancelled'); err.status = 409; err.expose = true;
      return next(err);
    }
    await query('UPDATE bookings SET status = $1 WHERE id = $2', ['cancelled', id]);
    res.json({ success: true, message: 'Booking cancelled' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../db/pool');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

// ─── GET /api/hotels/cities — autocomplete seed list ────────────
router.get('/cities', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT DISTINCT city, country FROM hotels WHERE is_active = true ORDER BY city`
    );
    res.json({ success: true, cities: result.rows });
  } catch (err) { next(err); }
});

// ─── GET /api/hotels/my-bookings — auth-gated ───────────────────
router.get('/my-bookings', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT hb.*,
              COALESCE(json_agg(json_build_object('full_name', hg.full_name, 'type', hg.type))
                FILTER (WHERE hg.id IS NOT NULL), '[]') AS guests_list
       FROM hotel_bookings hb
       LEFT JOIN hotel_guests hg ON hg.hotel_booking_id = hb.id
       WHERE hb.user_id = $1
       GROUP BY hb.id
       ORDER BY hb.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, bookings: result.rows });
  } catch (err) { next(err); }
});

// ─── GET /api/hotels/search ──────────────────────────────────────
router.get('/search', async (req, res, next) => {
  const { city, checkin, checkout, guests = 1, rooms = 1 } = req.query;

  if (!city || city.trim().length < 2)
    return res.status(400).json({ success: false, error: 'city is required (min 2 chars)' });
  if (!checkin || !/^\d{4}-\d{2}-\d{2}$/.test(checkin))
    return res.status(400).json({ success: false, error: 'checkin must be YYYY-MM-DD' });
  if (!checkout || !/^\d{4}-\d{2}-\d{2}$/.test(checkout))
    return res.status(400).json({ success: false, error: 'checkout must be YYYY-MM-DD' });

  const nights = Math.ceil(
    (new Date(checkout) - new Date(checkin)) / (1000 * 60 * 60 * 24)
  );
  if (nights < 1)
    return res.status(400).json({ success: false, error: 'checkout must be after checkin' });

  console.log(`[hotels/search] city="${city}" ${checkin}→${checkout} | ${guests} guests | ${rooms} rooms | ${nights} nights`);

  try {
    const result = await query(
      `SELECT h.*,
              MIN(r.price_per_night_inr) AS min_price_per_night,
              COUNT(r.id) AS room_type_count
       FROM hotels h
       LEFT JOIN hotel_rooms r
         ON r.hotel_id = h.id AND r.is_active = true AND r.max_guests >= $2
       WHERE LOWER(h.city) LIKE LOWER($1) AND h.is_active = true
       GROUP BY h.id
       ORDER BY h.star_rating DESC, h.name ASC`,
      [`%${city.trim()}%`, parseInt(guests)]
    );

    res.json({
      success: true,
      city: city.trim(),
      checkin, checkout,
      guests: parseInt(guests),
      rooms:  parseInt(rooms),
      nights,
      count:  result.rows.length,
      hotels: result.rows,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/hotels/:id — property detail + rooms ──────────────
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid hotel id' });

  try {
    const [hotelRes, roomsRes] = await Promise.all([
      query('SELECT * FROM hotels WHERE id = $1 AND is_active = true', [id]),
      query('SELECT * FROM hotel_rooms WHERE hotel_id = $1 AND is_active = true ORDER BY price_per_night_inr ASC', [id]),
    ]);

    if (!hotelRes.rows.length)
      return res.status(404).json({ success: false, error: 'Hotel not found' });

    res.json({ success: true, hotel: hotelRes.rows[0], rooms: roomsRes.rows });
  } catch (err) { next(err); }
});

// ─── POST /api/hotels/book — auth-gated ─────────────────────────
router.post('/book', authenticate, async (req, res, next) => {
  const {
    hotelId, roomId, checkin, checkout,
    guests = 1, rooms = 1,
    primaryGuest, allGuests,
  } = req.body;

  if (!hotelId || !roomId || !checkin || !checkout || !primaryGuest) {
    const err = new Error('Missing required booking fields');
    err.status = 400; err.expose = true;
    return next(err);
  }

  const nights = Math.ceil(
    (new Date(checkout) - new Date(checkin)) / (1000 * 60 * 60 * 24)
  );
  if (nights < 1) {
    const err = new Error('checkout must be after checkin');
    err.status = 400; err.expose = true;
    return next(err);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const [hotelRes, roomRes] = await Promise.all([
      client.query('SELECT * FROM hotels WHERE id = $1 AND is_active = true', [hotelId]),
      client.query('SELECT * FROM hotel_rooms WHERE id = $1 AND hotel_id = $2 AND is_active = true', [roomId, hotelId]),
    ]);

    if (!hotelRes.rows.length)
      throw Object.assign(new Error('Hotel not found'), { status: 404, expose: true });
    if (!roomRes.rows.length)
      throw Object.assign(new Error('Room not found'), { status: 404, expose: true });

    const hotel     = hotelRes.rows[0];
    const room      = roomRes.rows[0];
    const totalFare = room.price_per_night_inr * nights * parseInt(rooms);
    const bookingRef = uuidv4().replace(/-/g, '').toUpperCase().slice(0, 8);

    const bookingRes = await client.query(
      `INSERT INTO hotel_bookings
         (user_id, booking_ref, hotel_id, room_id, hotel_name, room_type,
          city, checkin_date, checkout_date, guests, rooms, nights, total_fare, currency, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'INR','confirmed')
       RETURNING *`,
      [
        req.user.id, bookingRef,
        hotelId, roomId,
        hotel.name, room.room_type,
        hotel.city, checkin, checkout,
        parseInt(guests), parseInt(rooms), nights, totalFare,
      ]
    );
    const booking = bookingRes.rows[0];

    const guestList = Array.isArray(allGuests) && allGuests.length
      ? allGuests
      : [{ full_name: primaryGuest, type: 'adult' }];

    for (const g of guestList) {
      await client.query(
        'INSERT INTO hotel_guests (hotel_booking_id, full_name, type) VALUES ($1,$2,$3)',
        [booking.id, g.full_name, g.type || 'adult']
      );
    }

    await client.query('COMMIT');

    console.log(
      `[hotels/book] ref=${bookingRef} user=${req.user.id} ` +
      `hotel="${hotel.name}" room="${room.room_type}" ` +
      `${checkin}→${checkout} ${nights}N ₹${totalFare}`
    );

    res.status(201).json({
      success: true,
      booking: {
        ...booking,
        hotel_name:  hotel.name,
        thumb_url:   hotel.thumb_url,
        star_rating: hotel.star_rating,
        room_type:   room.room_type,
        guests_list: guestList,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── PATCH /api/hotels/bookings/:id/cancel — auth-gated ─────────
router.patch('/bookings/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE hotel_bookings SET status = 'cancelled'
       WHERE id = $1 AND user_id = $2 AND status = 'confirmed'
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Booking not found or already cancelled' });
    res.json({ success: true, booking: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;

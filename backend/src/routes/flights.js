const express = require('express');
const { createOfferRequest, getOffer, refreshOffer } = require('../services/duffel');

const router = express.Router();

/**
 * GET /api/flights/search
 *
 * Query params (all from the homepage search form):
 *   origin       IATA code          e.g. DEL
 *   dest         IATA code          e.g. BOM
 *   depart       YYYY-MM-DD
 *   returnDate   YYYY-MM-DD         (only for round-trip)
 *   tripType     one-way|round-trip
 *   adults       integer >= 1       default 1
 *   children     integer >= 0       default 0
 *   infants      integer >= 0       default 0
 *   cabinClass   ECONOMY|PREMIUM_ECONOMY|BUSINESS|FIRST
 */
router.get('/search', async (req, res, next) => {
  const {
    origin, dest, depart, returnDate,
    tripType   = 'one-way',
    adults     = 1,
    children   = 0,
    infants    = 0,
    cabinClass = 'ECONOMY',
  } = req.query;

  /* ── Input validation ──────────────────────────────────────── */
  if (!origin || origin.length < 2) {
    return res.status(400).json({ success: false, error: 'origin is required (IATA code)' });
  }
  if (!dest || dest.length < 2) {
    return res.status(400).json({ success: false, error: 'dest is required (IATA code)' });
  }
  if (!depart || !/^\d{4}-\d{2}-\d{2}$/.test(depart)) {
    return res.status(400).json({ success: false, error: 'depart must be YYYY-MM-DD' });
  }
  if (tripType === 'round-trip' && returnDate && returnDate <= depart) {
    return res.status(400).json({ success: false, error: 'returnDate must be after depart' });
  }

  console.log(`[flights/search] ${origin}→${dest} ${depart}${tripType === 'round-trip' ? ' ↩ ' + returnDate : ''} | ${adults}A ${children}C ${infants}I | ${cabinClass}`);

  try {
    const result = await createOfferRequest({
      origin:        origin.toUpperCase().trim(),
      destination:   dest.toUpperCase().trim(),
      departureDate: depart,
      returnDate:    returnDate || null,
      tripType,
      adults,
      children,
      infants,
      cabinClass,
    });

    return res.json({
      success:        true,
      offerRequestId: result.offerRequestId,
      count:          result.offers.length,
      flights:        result.offers,
    });
  } catch (err) {
    console.error('[flights/search] Duffel error:', err.response?.data || err.message);

    /* Surface Duffel's own error message when it's useful */
    const duffelMsg = err.response?.data?.errors?.[0]?.message;
    return next(
      Object.assign(new Error(duffelMsg || 'Flight search failed'), {
        status: err.response?.status || 502,
        expose: !!duffelMsg,
      }),
    );
  }
});

/**
 * GET /api/flights/offers/:id
 * Fetch a single offer by its Duffel offer ID (for the booking confirmation page).
 */
router.get('/offers/:id', async (req, res, next) => {
  const { id } = req.params;
  console.log(`[flights/offer] fetching ${id}`);
  try {
    const offer = await getOffer(id);
    res.json({ success: true, offer });
  } catch (err) {
    console.error('[flights/offer] Duffel error:', err.response?.data || err.message);
    const duffelMsg = err.response?.data?.errors?.[0]?.message;
    next(Object.assign(new Error(duffelMsg || 'Offer not found'), {
      status: err.response?.status || 502,
      expose: !!duffelMsg,
    }));
  }
});

/**
 * POST /api/flights/price
 * Re-price / refresh an offer before booking to confirm it's still available.
 * Body: { offerId }
 */
router.post('/price', async (req, res, next) => {
  const { offerId } = req.body;
  if (!offerId) return res.status(400).json({ success: false, error: 'offerId required' });

  console.log(`[flights/price] refreshing ${offerId}`);
  try {
    const offer = await refreshOffer(offerId);
    res.json({ success: true, offer });
  } catch (err) {
    console.error('[flights/price] Duffel error:', err.response?.data || err.message);
    const duffelMsg = err.response?.data?.errors?.[0]?.message;
    next(Object.assign(new Error(duffelMsg || 'Fare confirmation failed'), {
      status: err.response?.status || 502,
      expose: !!duffelMsg,
    }));
  }
});

module.exports = router;

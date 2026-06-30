const express = require('express');
const { fetchFlights, fetchAirlineInfo } = require('../services/aviationstack');

const router = express.Router();

/* Carriers we support for the live-schedules panel.
   Extend this list freely — each entry costs one cached AviationStack call. */
const SUPPORTED_AIRLINES = {
  '6E': { name: 'IndiGo',     color: '#2563EB', accent: '#DBEAFE' },
  'AI': { name: 'Air India',  color: '#B91C1C', accent: '#FEE2E2' },
  'SG': { name: 'SpiceJet',   color: '#D97706', accent: '#FEF3C7' },
  'UK': { name: 'Vistara',    color: '#6D28D9', accent: '#EDE9FE' },
};

/**
 * GET /api/live-flights?airline=6E[&airline=AI]
 *
 * Query multiple airlines at once by repeating the param:
 *   ?airline=6E&airline=AI
 *
 * Response:
 *   { success: true, airlines: [ { iata, name, flights, quota_exceeded } ] }
 */
router.get('/', async (req, res, next) => {
  try {
    /* Accept ?airline=6E or ?airline=6E&airline=AI */
    let codes = req.query.airline
      ? (Array.isArray(req.query.airline) ? req.query.airline : [req.query.airline])
      : Object.keys(SUPPORTED_AIRLINES);

    /* Restrict to known carriers */
    codes = codes
      .map(c => c.toUpperCase().trim())
      .filter(c => SUPPORTED_AIRLINES[c])
      .slice(0, 4); /* cap at 4 to protect quota */

    if (!codes.length) {
      return res.json({ success: true, airlines: [] });
    }

    const results = await Promise.all(
      codes.map(async iata => {
        const meta   = SUPPORTED_AIRLINES[iata];
        const result = await fetchFlights(iata, 8);
        return {
          iata,
          name:          meta.name,
          color:         meta.color,
          accent:        meta.accent,
          flights:       result.flights,
          quota_exceeded: result.quota_exceeded,
          error:         result.error || null,
        };
      }),
    );

    res.json({ success: true, airlines: results });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/live-flights/airline-info?iata=6E
 * Returns static airline metadata (name, country, callsign).
 */
router.get('/airline-info', async (req, res, next) => {
  const iata = (req.query.iata || '').toUpperCase().trim();
  if (!iata) return res.status(400).json({ success: false, error: 'iata required' });
  try {
    const info = await fetchAirlineInfo(iata);
    res.json({ success: true, airline: info });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

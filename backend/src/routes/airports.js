const express  = require('express');
const NodeCache = require('node-cache');
const { query } = require('../db/pool');
const { searchByName, searchByIata } = require('../services/duffel');

const router = express.Router();

/* Cache Duffel results for 3 minutes to avoid rate-limiting on rapid keystrokes */
const cache = new NodeCache({ stdTTL: 180, checkperiod: 60 });

/* Deduplicate by IATA code; items earlier in the array win */
function dedupe(airports) {
  const seen = new Set();
  return airports.filter(a => {
    const key = (a.iataCode || '').toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/*
 * Simple fuzzy prefix fallback: if Duffel returned nothing for the full
 * keyword, retry with the first 4 characters.  This handles common
 * cases like "banglore" → try "bang" → returns Bangalore results.
 */
async function duffelSearch(keyword) {
  const cacheKey = `duffel:${keyword.toLowerCase()}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  let results = [];
  try {
    results = await searchByName(keyword, 10);

    /* If keyword looks like an IATA code, also try exact lookup */
    if (/^[a-zA-Z]{3}$/.test(keyword)) {
      const exact = await searchByIata(keyword);
      results = dedupe([...exact, ...results]);
    }

    /* Prefix fallback: no results + keyword long enough → broaden to first 4 chars */
    if (results.length === 0 && keyword.length >= 4) {
      results = await searchByName(keyword.slice(0, 4), 10);
    }
  } catch (err) {
    /* Duffel unavailable — caller will fall back to local DB */
    console.error('[airports] Duffel search error:', err.message);
  }

  cache.set(cacheKey, results);
  return results;
}

/*
 * Local DB search — ILIKE with prefix priority ordering.
 * Returns at most `limit` rows in the same normalised shape.
 */
async function localSearch(keyword, limit = 10) {
  const pattern = `%${keyword}%`;
  const result  = await query(
    `SELECT iata_code, name, city, country, lat, lng
       FROM airports
      WHERE iata_code ILIKE $1
         OR city      ILIKE $1
         OR name      ILIKE $1
         OR country   ILIKE $1
      ORDER BY
        CASE WHEN iata_code ILIKE $2 THEN 0
             WHEN city      ILIKE $2 THEN 1
             ELSE 2 END,
        city
      LIMIT $3`,
    [pattern, `${keyword}%`, limit],
  );
  return result.rows.map(r => ({
    iataCode: r.iata_code,
    name:     r.name,
    city:     r.city,
    country:  r.country,
    lat:      r.lat,
    lng:      r.lng,
    address:  { cityName: r.city, countryName: r.country },
    _source:  'local',
  }));
}

// GET /api/airports/search?keyword=bangalore
router.get('/search', async (req, res, next) => {
  const keyword = (req.query.keyword || '').trim();
  if (!keyword || keyword.length < 2) {
    return res.json({ success: true, airports: [] });
  }

  try {
    /* Run Duffel + local in parallel — local is always fast */
    const [duffelResults, localResults] = await Promise.allSettled([
      duffelSearch(keyword),
      localSearch(keyword),
    ]);

    const fromDuffel = duffelResults.status === 'fulfilled' ? duffelResults.value : [];
    const fromLocal  = localResults.status  === 'fulfilled' ? localResults.value  : [];

    /* Duffel results take precedence; local fills in any gaps */
    const merged = dedupe([...fromDuffel, ...fromLocal]).slice(0, 10);

    res.json({ success: true, airports: merged });
  } catch (err) {
    next(err);
  }
});

// GET /api/airports/:iata
router.get('/:iata', async (req, res, next) => {
  const iata = (req.params.iata || '').toUpperCase().trim();
  if (!iata || iata.length !== 3) {
    const err = new Error('Invalid IATA code'); err.status = 400; err.expose = true;
    return next(err);
  }
  try {
    const result = await query(
      'SELECT iata_code, name, city, country, lat, lng FROM airports WHERE iata_code = $1',
      [iata],
    );
    if (!result.rows.length) return res.json({ success: true, airport: null });
    const r = result.rows[0];
    res.json({
      success: true,
      airport: {
        iata_code: r.iata_code, name: r.name,
        city: r.city, country: r.country,
        lat: parseFloat(r.lat), lng: parseFloat(r.lng),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

/**
 * AviationStack API client
 *
 * Used for reference/display data only (real airline names, scheduled flights).
 * Booking still runs through Duffel — this is separate.
 *
 * Free-tier limits:
 *   - 100 requests / month
 *   - HTTP only (not HTTPS) — set AVIATIONSTACK_BASE_URL=http://api.aviationstack.com/v1
 *   - No real-time live tracking (scheduled data only)
 *
 * All responses are cached aggressively (30 min) to protect the monthly quota.
 */
const axios    = require('axios');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 30 * 60, checkperiod: 120 });

/* Sentinel cached when quota is exceeded — don't retry for 6 hours */
const QUOTA_SENTINEL = '__quota_exceeded__';
const QUOTA_TTL      = 6 * 60 * 60;

const client = axios.create({
  baseURL: process.env.AVIATIONSTACK_BASE_URL || 'http://api.aviationstack.com/v1',
  timeout: 10000,
  /* Do NOT put access_key here — it is read from process.env at request time
     so that a duplicate key in .env (last-wins) doesn't lock in a stale value
     at module-load time. */
});

client.interceptors.request.use(req => {
  /* Inject the key at request time, not at module initialisation */
  req.params = { access_key: process.env.AVIATIONSTACK_ACCESS_KEY, ...req.params };

  const safe = { ...req.params, access_key: '[REDACTED]' };
  console.log(`[aviationstack] GET ${req.baseURL}${req.url}`, safe);
  return req;
});

/* Normalise one AviationStack flight record to our shape */
function normalizeFlight(f) {
  return {
    flightNumber:       f.flight?.iata  || f.flight?.icao || '—',
    airline: {
      name: f.airline?.name || '—',
      iata: f.airline?.iata || '—',
    },
    origin: {
      iata:     f.departure?.iata     || '—',
      name:     f.departure?.airport  || '—',
      terminal: f.departure?.terminal || null,
    },
    destination: {
      iata:     f.arrival?.iata    || '—',
      name:     f.arrival?.airport || '—',
      terminal: f.arrival?.terminal || null,
    },
    scheduledDeparture: f.departure?.scheduled || null,
    scheduledArrival:   f.arrival?.scheduled   || null,
    status:             f.flight_status || 'unknown',
    delayMinutes:       f.departure?.delay ?? null,
    flightDate:         f.flight_date || null,
  };
}

/**
 * Fetch scheduled flights for a given airline IATA code.
 * Returns { flights, quota_exceeded, error }.
 */
async function fetchFlights(airlineIata, limit = 10) {
  const key = `flights:${airlineIata.toUpperCase()}`;

  const hit = cache.get(key);
  if (hit === QUOTA_SENTINEL) return { flights: [], quota_exceeded: true };
  if (hit)                   return { flights: hit,  quota_exceeded: false };

  if (!process.env.AVIATIONSTACK_ACCESS_KEY) {
    return { flights: [], quota_exceeded: false, error: 'AVIATIONSTACK_ACCESS_KEY not configured' };
  }

  try {
    const res = await client.get('/flights', {
      params: {
        airline_iata:  airlineIata.toUpperCase(),
        flight_status: 'scheduled',
        limit,
      },
    });

    /* Quota-exceeded is returned as a 200 with an error body */
    if (res.data?.error) {
      const code = res.data.error?.code || '';
      if (code === 'usage_limit_reached' || code === 'function_access_restricted') {
        console.warn('[aviationstack] Quota exceeded — suppressing for 6 hours');
        cache.set(key, QUOTA_SENTINEL, QUOTA_TTL);
        return { flights: [], quota_exceeded: true };
      }
      throw new Error(res.data.error?.message || 'AviationStack error');
    }

    const flights = (res.data?.data || []).map(normalizeFlight);
    cache.set(key, flights);
    return { flights, quota_exceeded: false };
  } catch (err) {
    console.error('[aviationstack] fetchFlights error:', err.message);
    return { flights: [], quota_exceeded: false, error: err.message };
  }
}

/**
 * Fetch static airline reference info (name, country, ICAO).
 * Returns null on failure.
 */
async function fetchAirlineInfo(airlineIata) {
  const key = `airline:${airlineIata.toUpperCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  if (!process.env.AVIATIONSTACK_ACCESS_KEY) return null;

  try {
    const res = await client.get('/airlines', {
      params: { airline_iata: airlineIata.toUpperCase(), limit: 1 },
    });
    if (res.data?.error) return null;
    const rec = res.data?.data?.[0] || null;
    if (!rec) return null;
    const info = {
      name:        rec.airline_name,
      iata:        rec.iata_code,
      icao:        rec.icao_code,
      country:     rec.country_name,
      callsign:    rec.callsign,
      type:        rec.type,
    };
    cache.set(key, info, 24 * 60 * 60); /* airline metadata changes rarely — cache 24 h */
    return info;
  } catch (err) {
    console.error('[aviationstack] fetchAirlineInfo error:', err.message);
    return null;
  }
}

module.exports = { fetchFlights, fetchAirlineInfo };

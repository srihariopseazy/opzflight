const axios = require('axios');

const duffelHttp = axios.create({
  baseURL: process.env.DUFFEL_API_URL || 'https://api.duffel.com',
  timeout: 8000,
  headers: {
    Authorization: `Bearer ${process.env.DUFFEL_ACCESS_TOKEN}`,
    'Duffel-Version': 'v2',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

/* Log outgoing Duffel requests so we can confirm params are forwarded */
duffelHttp.interceptors.request.use(req => {
  console.log(`[duffel] ${req.method?.toUpperCase()} ${req.baseURL}${req.url}`, req.params || '');
  return req;
});

/* Normalize a Duffel place/airport object into our standard shape.
   Works for both /places/suggestions items and /air/airports items. */
function normalizeDuffelAirport(d) {
  return {
    iataCode: d.iata_code,
    name:     d.name,
    city:     d.city_name || d.city?.name || d.iata_city_code || d.iata_code,
    country:  d.iata_country_code || '',
    lat:      d.latitude  ?? null,
    lng:      d.longitude ?? null,
    address: {
      cityName:    d.city_name || d.city?.name || '',
      countryName: d.iata_country_code || '',
    },
    _source: 'duffel',
  };
}

/*
 * Search Duffel using the Places Suggestions endpoint.
 * /air/airports does NOT support text search — it only returns a
 * paginated alphabetical list when called without an iata_code param.
 * /places/suggestions?query=<keyword> is the correct search API.
 * We filter results to type==='airport' so city codes (e.g. LON vs LHR)
 * don't appear in the dropdown.
 */
async function searchByName(keyword, limit = 10) {
  const res = await duffelHttp.get('/places/suggestions', {
    params: { query: keyword },
  });
  return (res.data?.data || [])
    .filter(p => p.type === 'airport')
    .slice(0, limit)
    .map(normalizeDuffelAirport);
}

/* Look up a single airport by exact IATA code (this param IS supported) */
async function searchByIata(iata) {
  const res = await duffelHttp.get('/air/airports', {
    params: { iata_code: iata.toUpperCase(), limit: 1 },
  });
  return (res.data?.data || []).map(normalizeDuffelAirport);
}

/* ── Cabin class mapping ───────────────────────────────────────────
   Our UI sends ECONOMY / PREMIUM_ECONOMY / BUSINESS / FIRST.
   Duffel expects lowercase: economy / premium_economy / business / first  */
const CABIN_CLASS_MAP = {
  ECONOMY:         'economy',
  PREMIUM_ECONOMY: 'premium_economy',
  BUSINESS:        'business',
  FIRST:           'first',
};

/* Build the passengers array Duffel expects.
   Children need an explicit age; we use 8 as a generic placeholder
   since the actual age isn't collected in the search form. */
function buildPassengers(adults = 1, children = 0, infants = 0) {
  const pax = [];
  for (let i = 0; i < Number(adults);   i++) pax.push({ type: 'adult' });
  for (let i = 0; i < Number(children); i++) pax.push({ type: 'child', age: 8 });
  for (let i = 0; i < Number(infants);  i++) pax.push({ type: 'infant_without_seat' });
  return pax;
}

/*
 * Normalise a Duffel offer into the shape results.js expects.
 *
 * results.js was built with Amadeus field names.  Rather than touching the
 * frontend, we translate here once.  Field mapping (Duffel → Amadeus):
 *
 *   offer.total_amount              → price.total
 *   offer.total_currency            → price.currency
 *   offer.number_of_bookable_seats  → numberOfBookableSeats
 *   offer.slices[]                  → itineraries[]
 *   slice.duration                  → itineraries[i].duration
 *   slice.segments[].departing_at   → segments[j].departure.at
 *   slice.segments[].origin.iata_code → segments[j].departure.iataCode
 *   slice.segments[].arriving_at    → segments[j].arrival.at
 *   slice.segments[].destination.iata_code → segments[j].arrival.iataCode
 *   seg.marketing_carrier.iata_code → segments[j].carrierCode
 *   seg.marketing_carrier_flight_number → segments[j].number
 */
function normalizeOffer(offer) {
  /* Derive airline name from the first segment of the first slice */
  const firstSeg = offer.slices?.[0]?.segments?.[0];
  const airlineName =
    firstSeg?.marketing_carrier?.name ||
    firstSeg?.operating_carrier?.name  ||
    '—';

  return {
    /* Duffel offer ID — used by the booking flow */
    id:        offer.id,
    expiresAt: offer.expires_at,
    cabinClass: offer.cabin_class,

    /* Amadeus-compatible price block */
    price: {
      total:    offer.total_amount,
      base:     offer.base_amount,
      currency: offer.total_currency,
    },

    /* Seats remaining (field present in Duffel live; may be null in test) */
    numberOfBookableSeats: offer.number_of_bookable_seats ?? null,

    /* Top-level airline name used by the filter sidebar */
    _airlineName: airlineName,

    /* Amadeus-compatible itineraries — one entry per slice (leg) */
    itineraries: (offer.slices || []).map(sl => ({
      duration: sl.duration,
      segments: (sl.segments || []).map(seg => {
        const carrierCode =
          seg.marketing_carrier?.iata_code ||
          seg.operating_carrier?.iata_code  || '—';
        return {
          id:          seg.id,
          carrierCode,
          number:      seg.marketing_carrier_flight_number || '—',
          departure: {
            iataCode: seg.origin?.iata_code || '—',
            terminal: seg.origin?.terminal  || null,
            at:       seg.departing_at      || null,
          },
          arrival: {
            iataCode: seg.destination?.iata_code || '—',
            terminal: seg.destination?.terminal  || null,
            at:       seg.arriving_at            || null,
          },
          duration: seg.duration,
          aircraft: seg.aircraft
            ? { code: seg.aircraft.iata_code, name: seg.aircraft.name }
            : null,
          /* Extra carrier detail for the flight-detail page */
          _carrierName:
            seg.marketing_carrier?.name ||
            seg.operating_carrier?.name || '—',
        };
      }),
    })),

    /* Preserve raw slices so the booking page can send the offer ID + slice IDs */
    _rawSlices: (offer.slices || []).map(sl => ({
      id:          sl.id,
      origin:      sl.origin?.iata_code,
      destination: sl.destination?.iata_code,
    })),

    /* Fare conditions for the detail page */
    conditions: {
      refundBeforeDeparture: offer.conditions?.refund_before_departure ?? null,
      changeBeforeDeparture: offer.conditions?.change_before_departure ?? null,
    },
  };
}

/**
 * POST /air/offer_requests?return_offers=true
 *
 * Creates an offer request and returns the offers inline (one round-trip).
 * Returns { offerRequestId, offers[] } on success.
 */
async function createOfferRequest({ origin, destination, departureDate, returnDate, tripType, adults, children, infants, cabinClass }) {
  const slices = [
    { origin, destination, departure_date: departureDate },
  ];
  if (tripType === 'round-trip' && returnDate) {
    slices.push({ origin: destination, destination: origin, departure_date: returnDate });
  }

  const body = {
    data: {
      slices,
      passengers:  buildPassengers(adults, children, infants),
      cabin_class: CABIN_CLASS_MAP[cabinClass] || 'economy',
    },
  };

  console.log('[duffel] offer-request body:', JSON.stringify(body));

  const res = await duffelHttp.post('/air/offer_requests', body, {
    params: { return_offers: true },
  });

  const data   = res.data?.data;
  const offers = data?.offers || [];
  console.log(`[duffel] offer-request ${data?.id} → ${offers.length} offers`);

  /* Log the first raw offer so we can verify field paths */
  if (offers.length > 0) {
    console.log('[duffel] SAMPLE RAW OFFER:', JSON.stringify(offers[0], null, 2));
  }

  return {
    offerRequestId: data?.id,
    offers:         offers.map(normalizeOffer),
  };
}

/**
 * GET /air/offers/:id — fetch a single offer by its Duffel offer ID.
 */
async function getOffer(offerId) {
  const res = await duffelHttp.get(`/air/offers/${offerId}`);
  return normalizeOffer(res.data?.data);
}

/**
 * POST /air/offers/:id/actions/refresh — re-price / confirm an offer is still available.
 */
async function refreshOffer(offerId) {
  const res = await duffelHttp.post(`/air/offers/${offerId}/actions/refresh`);
  return normalizeOffer(res.data?.data);
}

module.exports = {
  duffelHttp,
  searchByName,
  searchByIata,
  normalizeDuffelAirport,
  createOfferRequest,
  getOffer,
  refreshOffer,
};

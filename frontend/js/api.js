/**
 * OPSEAZY API Client
 * All calls go through /api/* which nginx proxies to the backend.
 * Never calls Duffel or external services directly from the browser.
 */

const BASE = '/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({ success: false, error: 'Invalid server response' }));

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),

  // ─── Auth ────────────────────────────────────────────────────
  register: (data) => request('POST', '/auth/register', data),
  login:    (data) => request('POST', '/auth/login', data),
  logout:   ()     => request('POST', '/auth/logout'),
  me:       ()     => request('GET',  '/auth/me'),
  refresh:  ()     => request('POST', '/auth/refresh'),

  // ─── Airports ────────────────────────────────────────────────
  searchAirports: (keyword) => request('GET', `/airports/search?keyword=${encodeURIComponent(keyword)}`),

  // ─── Flights ─────────────────────────────────────────────────
  searchFlights: (params) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/flights/search?${q}`);
  },
  priceOffer: (offerId, offerData) => request('POST', '/flights/price', { offerId, offerData }),

  // ─── Bookings ────────────────────────────────────────────────
  createBooking: (data)     => request('POST', '/bookings', data),
  myBookings:    ()         => request('GET',  '/bookings/mine'),
  getBooking:    (id)       => request('GET',  `/bookings/${id}`),
  cancelBooking: (id)       => request('PATCH', `/bookings/${id}/cancel`),

  // ─── Admin ───────────────────────────────────────────────────
  adminBookings: (page = 1) => request('GET', `/admin/bookings?page=${page}`),

  // ─── Hotels ──────────────────────────────────────────────────
  hotelCities:    ()          => request('GET', '/hotels/cities'),
  searchHotels:   (params)    => request('GET', `/hotels/search?${new URLSearchParams(params)}`),
  getHotel:       (id)        => request('GET', `/hotels/${id}`),
  bookHotel:      (data)      => request('POST', '/hotels/book', data),
  myHotelBookings: ()         => request('GET', '/hotels/my-bookings'),
  cancelHotelBooking: (id)    => request('PATCH', `/hotels/bookings/${id}/cancel`),
};

window.api = api;

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/db/pool');

const migrations = `
-- ─── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  phone       VARCHAR(20),
  role        VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── AIRPORTS (seed data for autocomplete fallback + map pins) ──
CREATE TABLE IF NOT EXISTS airports (
  id          SERIAL PRIMARY KEY,
  iata_code   CHAR(3) NOT NULL,
  name        VARCHAR(200) NOT NULL,
  city        VARCHAR(100) NOT NULL,
  country     VARCHAR(100) NOT NULL,
  lat         NUMERIC(9,6) NOT NULL,
  lng         NUMERIC(9,6) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_airports_iata ON airports(iata_code);

-- ─── BOOKINGS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  pnr             VARCHAR(10) NOT NULL,
  origin_code     CHAR(3) NOT NULL,
  destination_code CHAR(3) NOT NULL,
  departure_date  DATE NOT NULL,
  return_date     DATE,
  trip_type       VARCHAR(10) NOT NULL CHECK (trip_type IN ('one-way','round-trip')),
  cabin_class     VARCHAR(20) NOT NULL,
  passenger_count INTEGER NOT NULL DEFAULT 1,
  total_fare      NUMERIC(12,2) NOT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'USD',
  status          VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('confirmed','cancelled','pending')),
  duffel_offer_id TEXT,
  duffel_offer_data JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_pnr ON bookings(pnr);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);

-- ─── PASSENGERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS passengers (
  id              SERIAL PRIMARY KEY,
  booking_id      INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  full_name       VARCHAR(120) NOT NULL,
  dob             DATE NOT NULL,
  gender          VARCHAR(10) NOT NULL CHECK (gender IN ('male','female','other')),
  passenger_type  VARCHAR(10) NOT NULL CHECK (passenger_type IN ('adult','child','infant')),
  document_number VARCHAR(30)
);
CREATE INDEX IF NOT EXISTS idx_passengers_booking_id ON passengers(booking_id);

-- ─── HOTELS (seeded inventory) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS hotels (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  city          VARCHAR(100) NOT NULL,
  country       VARCHAR(100) NOT NULL DEFAULT 'India',
  star_rating   SMALLINT NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
  address       TEXT,
  description   TEXT,
  amenities     TEXT[] DEFAULT '{}',
  thumb_url     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hotels_name_city ON hotels(name, city);
CREATE INDEX IF NOT EXISTS idx_hotels_city ON hotels(LOWER(city));

CREATE TABLE IF NOT EXISTS hotel_rooms (
  id                    SERIAL PRIMARY KEY,
  hotel_id              INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_type             VARCHAR(100) NOT NULL,
  description           TEXT,
  max_guests            SMALLINT NOT NULL DEFAULT 2,
  price_per_night_inr   NUMERIC(10,2) NOT NULL,
  amenities             TEXT[] DEFAULT '{}',
  is_active             BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_hotel ON hotel_rooms(hotel_id);

CREATE TABLE IF NOT EXISTS hotel_bookings (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  booking_ref   VARCHAR(10) NOT NULL,
  hotel_id      INTEGER REFERENCES hotels(id),
  room_id       INTEGER REFERENCES hotel_rooms(id),
  hotel_name    VARCHAR(200) NOT NULL,
  room_type     VARCHAR(100) NOT NULL,
  city          VARCHAR(100) NOT NULL,
  checkin_date  DATE NOT NULL,
  checkout_date DATE NOT NULL,
  guests        INTEGER NOT NULL DEFAULT 1,
  rooms         INTEGER NOT NULL DEFAULT 1,
  nights        INTEGER NOT NULL DEFAULT 1,
  total_fare    NUMERIC(12,2) NOT NULL,
  currency      CHAR(3) NOT NULL DEFAULT 'INR',
  status        VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                CHECK (status IN ('confirmed','cancelled','pending')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hotel_bookings_ref ON hotel_bookings(booking_ref);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_user ON hotel_bookings(user_id);

CREATE TABLE IF NOT EXISTS hotel_guests (
  id                SERIAL PRIMARY KEY,
  hotel_booking_id  INTEGER NOT NULL REFERENCES hotel_bookings(id) ON DELETE CASCADE,
  full_name         VARCHAR(120) NOT NULL,
  type              VARCHAR(20) NOT NULL DEFAULT 'adult'
);
CREATE INDEX IF NOT EXISTS idx_hotel_guests_booking ON hotel_guests(hotel_booking_id);
`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('[migrate] Running migrations…');
    await client.query(migrations);
    console.log('[migrate] All migrations applied.');
  } catch (err) {
    console.error('[migrate] Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

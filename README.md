# OPSEAZY — Flight Ticket Booking Application

A production-quality flight search & booking platform powered by the Duffel API and Google Maps.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20 + Express.js |
| Frontend | Plain HTML5 + CSS3 + Vanilla JS (no frameworks) |
| Database | PostgreSQL 16 (via `pg` driver) |
| Flight Data | [Duffel API](https://duffel.com/docs) (test mode) |
| Maps | Google Maps JavaScript API |
| Auth | JWT (access + refresh tokens via httpOnly cookies) |
| Deploy | Docker + docker-compose |

## Prerequisites

- **Docker Desktop** installed and running
- **Duffel API token** — sign up free at [app.duffel.com](https://app.duffel.com)
  - Go to Settings → Access tokens → Create token
  - Select **Test mode** — token starts with `duffel_test_`
  - Copy the token (only shown once)
- **Google Maps API key** — enable in [Google Cloud Console](https://console.cloud.google.com):
  - Enable: **Maps JavaScript API** and **Places API**
  - Restrict the key to your domain via: APIs & Services → Credentials → HTTP referrers
  - Restrict to `localhost:3000/*` for local dev, then your domain in production

## Setup

### 1. Clone and configure

```bash
cp .env.example backend/.env
```

Edit `backend/.env` with your real keys:

```env
DUFFEL_ACCESS_TOKEN=duffel_test_your_token_here
GOOGLE_MAPS_KEY=your_maps_key_here
JWT_SECRET=a_random_secret_at_least_32_chars
```

### 2. Run with Docker (recommended)

```bash
docker-compose up --build
```

- Frontend → http://localhost:3000
- Backend API → http://localhost:3001/api/health

First boot automatically runs DB migrations and seeds airport data.

### 3. Run locally (without Docker)

**Backend:**
```bash
cd backend
npm install
# Ensure PostgreSQL is running locally; set POSTGRES_HOST=localhost in .env
npm run migrate
npm run seed
npm run dev        # hot reload with nodemon
```

**Frontend:**
```bash
# Serve the frontend folder with any static server:
cd frontend
npx serve . -p 3000
# Or use VS Code Live Server extension
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_HOST` | Yes | DB host (`postgres` in Docker, `localhost` locally) |
| `POSTGRES_PORT` | Yes | DB port (default 5432) |
| `POSTGRES_DB` | Yes | Database name |
| `POSTGRES_USER` | Yes | DB user |
| `POSTGRES_PASSWORD` | Yes | DB password |
| `DUFFEL_ACCESS_TOKEN` | Yes | Duffel API bearer token (`duffel_test_…`) |
| `DUFFEL_API_URL` | Yes | `https://api.duffel.com` |
| `GOOGLE_MAPS_KEY` | Yes | Google Maps JavaScript API key |
| `JWT_SECRET` | Yes | Random string ≥ 32 chars |
| `JWT_ACCESS_EXPIRES` | No | Access token TTL (default `15m`) |
| `JWT_REFRESH_EXPIRES` | No | Refresh token TTL (default `7d`) |
| `PORT` | No | Backend port (default `3001`) |
| `FRONTEND_URL` | No | CORS origin (default `http://localhost:3000`) |

## Duffel Test Mode — Known-Good Routes

In Duffel test mode, the API returns simulated offers from fictional airlines.
Any IATA code pair should work, but the following have been verified:

| Origin | Destination | Notes |
|---|---|---|
| LHR | JFK | London → New York (long-haul) |
| LHR | CDG | London → Paris (short-haul) |
| JFK | LAX | New York → Los Angeles (domestic US) |
| SYD | MEL | Sydney → Melbourne (domestic AU) |
| DEL | BOM | Delhi → Mumbai (domestic IN) |

Use any departure date **7–90 days from today** for best results.
These defaults are surfaced in the app's home page search suggestions.

## Project Structure

```
flight/
├── backend/
│   ├── src/
│   │   ├── server.js               # Express app entry point
│   │   ├── routes/
│   │   │   ├── health.js
│   │   │   ├── auth.js
│   │   │   ├── airports.js
│   │   │   ├── flights.js
│   │   │   ├── bookings.js
│   │   │   ├── admin.js
│   │   │   └── config.js
│   │   ├── middleware/
│   │   │   ├── errorHandler.js
│   │   │   └── authenticate.js
│   │   ├── services/
│   │   │   └── duffel.js           # Duffel API client
│   │   ├── db/pool.js
│   │   └── utils/logger.js
│   ├── migrations/
│   │   ├── run.js                  # DB schema
│   │   └── seed.js                 # Airport seed data
│   ├── .env                        # Secrets (gitignored)
│   └── package.json
├── frontend/
│   ├── index.html                  # Home + search
│   ├── pages/
│   │   ├── results.html
│   │   ├── flight-detail.html
│   │   ├── booking.html
│   │   ├── confirmation.html
│   │   ├── login.html
│   │   ├── register.html
│   │   ├── my-bookings.html
│   │   └── admin.html
│   ├── css/
│   └── js/
├── nginx/
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/health | — | Health check + DB status |
| POST | /api/auth/register | — | Register user |
| POST | /api/auth/login | — | Login → httpOnly cookie |
| POST | /api/auth/logout | — | Clear tokens |
| GET | /api/auth/me | ✓ | Current user profile |
| POST | /api/auth/refresh | — | Refresh access token |
| GET | /api/airports/search?keyword= | — | Place/airport autocomplete (Duffel) |
| GET | /api/airports/:iata | — | Airport detail by IATA code |
| POST | /api/flights/search | — | Create offer request (Duffel) |
| GET | /api/flights/offers/:id | — | Single offer detail |
| POST | /api/bookings | ✓ | Create booking |
| GET | /api/bookings/mine | ✓ | My bookings |
| GET | /api/bookings/:id | ✓ | Booking detail |
| PATCH | /api/bookings/:id/cancel | ✓ | Cancel booking |
| GET | /api/admin/bookings | admin | All bookings |
| GET | /api/config/maps-key | — | Google Maps key for frontend |

## Security Notes

- Duffel token is **never sent to the browser** — all Duffel calls are proxied through the backend
- Google Maps API key IS visible to the browser (normal for Maps JS API) — restrict it to your domain
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens stored as httpOnly, SameSite=Strict cookies
- All /api routes rate-limited (200 req / 15 min per IP)
- Input validated on both frontend and backend

## Creating an Admin User

After first run, promote a user to admin in the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

Then visit `/pages/admin.html`.

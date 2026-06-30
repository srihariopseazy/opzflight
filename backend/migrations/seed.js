require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db/pool');

// Major airports — covers Amadeus sandbox supported routes + globally useful set
const airports = [
  // India
  { iata: 'DEL', name: 'Indira Gandhi International Airport', city: 'Delhi', country: 'India', lat: 28.5562, lng: 77.1000 },
  { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', country: 'India', lat: 19.0896, lng: 72.8656 },
  { iata: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', country: 'India', lat: 13.1979, lng: 77.7063 },
  { iata: 'MAA', name: 'Chennai International Airport', city: 'Chennai', country: 'India', lat: 12.9941, lng: 80.1709 },
  { iata: 'HYD', name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', country: 'India', lat: 17.2403, lng: 78.4294 },
  { iata: 'CCU', name: 'Netaji Subhas Chandra Bose International Airport', city: 'Kolkata', country: 'India', lat: 22.6520, lng: 88.4463 },
  { iata: 'COK', name: 'Cochin International Airport', city: 'Kochi', country: 'India', lat: 10.1520, lng: 76.4019 },
  { iata: 'PNQ', name: 'Pune Airport', city: 'Pune', country: 'India', lat: 18.5822, lng: 73.9197 },
  { iata: 'GOI', name: 'Goa International Airport', city: 'Goa', country: 'India', lat: 15.3808, lng: 73.8314 },
  { iata: 'AMD', name: 'Sardar Vallabhbhai Patel International Airport', city: 'Ahmedabad', country: 'India', lat: 23.0772, lng: 72.6347 },
  // Europe
  { iata: 'LHR', name: 'Heathrow Airport', city: 'London', country: 'United Kingdom', lat: 51.4700, lng: -0.4543 },
  { iata: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', lat: 49.0097, lng: 2.5479 },
  { iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lng: 8.5622 },
  { iata: 'AMS', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands', lat: 52.3086, lng: 4.7639 },
  { iata: 'MAD', name: 'Adolfo Suárez Madrid-Barajas Airport', city: 'Madrid', country: 'Spain', lat: 40.4936, lng: -3.5668 },
  { iata: 'FCO', name: 'Leonardo da Vinci International Airport', city: 'Rome', country: 'Italy', lat: 41.8003, lng: 12.2389 },
  { iata: 'ZRH', name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland', lat: 47.4582, lng: 8.5555 },
  { iata: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'Germany', lat: 48.3538, lng: 11.7861 },
  // North America
  { iata: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'USA', lat: 40.6413, lng: -73.7781 },
  { iata: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'USA', lat: 33.9425, lng: -118.4081 },
  { iata: 'ORD', name: "O'Hare International Airport", city: 'Chicago', country: 'USA', lat: 41.9742, lng: -87.9073 },
  { iata: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'USA', lat: 37.6213, lng: -122.3790 },
  { iata: 'MIA', name: 'Miami International Airport', city: 'Miami', country: 'USA', lat: 25.7959, lng: -80.2870 },
  { iata: 'YYZ', name: 'Toronto Pearson International Airport', city: 'Toronto', country: 'Canada', lat: 43.6777, lng: -79.6248 },
  // Middle East
  { iata: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'UAE', lat: 25.2532, lng: 55.3657 },
  { iata: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar', lat: 25.2731, lng: 51.6081 },
  { iata: 'AUH', name: 'Abu Dhabi International Airport', city: 'Abu Dhabi', country: 'UAE', lat: 24.4330, lng: 54.6511 },
  // Asia-Pacific
  { iata: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', lat: 1.3644, lng: 103.9915 },
  { iata: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', lat: 13.6900, lng: 100.7501 },
  { iata: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'China', lat: 22.3080, lng: 113.9185 },
  { iata: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan', lat: 35.7720, lng: 140.3929 },
  { iata: 'ICN', name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea', lat: 37.4691, lng: 126.4505 },
  { iata: 'SYD', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'Australia', lat: -33.9399, lng: 151.1753 },
  { iata: 'KUL', name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'Malaysia', lat: 2.7456, lng: 101.7072 },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('[seed] Seeding airports…');
    for (const a of airports) {
      await client.query(
        `INSERT INTO airports (iata_code, name, city, country, lat, lng)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (iata_code) DO UPDATE
           SET name=$2, city=$3, country=$4, lat=$5, lng=$6`,
        [a.iata, a.name, a.city, a.country, a.lat, a.lng]
      );
    }
    console.log(`[seed] Inserted/updated ${airports.length} airports.`);

    // ── Demo user ──────────────────────────────────────────────
    console.log('[seed] Seeding demo user…');
    const DEMO_EMAIL    = 'demo@opseazy.com';
    const DEMO_PASSWORD = 'Demo@123';
    const DEMO_NAME     = 'Demo Traveler';

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

    const userRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [DEMO_NAME, DEMO_EMAIL, passwordHash]
    );
    const demoUserId = userRes.rows[0].id;
    console.log(`[seed] Demo user id=${demoUserId} (${DEMO_EMAIL})`);

    // ── Pre-existing bookings for the demo user ───────────────
    // Delete existing demo bookings so re-seeding is idempotent
    await client.query(
      `DELETE FROM bookings WHERE user_id = $1 AND pnr IN ('DEMO01','DEMO02')`,
      [demoUserId]
    );

    const booking1 = await client.query(
      `INSERT INTO bookings
         (user_id, pnr, origin_code, destination_code, departure_date,
          trip_type, cabin_class, passenger_count, total_fare, currency, status)
       VALUES ($1,'DEMO01','DEL','BOM','2025-11-20','one-way','economy',1,3499,'INR','confirmed')
       RETURNING id`,
      [demoUserId]
    );
    await client.query(
      `INSERT INTO passengers (booking_id, full_name, dob, gender, passenger_type)
       VALUES ($1,'Demo Traveler','1990-05-14','male','adult')`,
      [booking1.rows[0].id]
    );

    const booking2 = await client.query(
      `INSERT INTO bookings
         (user_id, pnr, origin_code, destination_code, departure_date,
          trip_type, cabin_class, passenger_count, total_fare, currency, status)
       VALUES ($1,'DEMO02','DXB','SIN','2025-12-15','one-way','business',2,29998,'INR','confirmed')
       RETURNING id`,
      [demoUserId]
    );
    await client.query(
      `INSERT INTO passengers (booking_id, full_name, dob, gender, passenger_type)
       VALUES ($1,'Demo Traveler','1990-05-14','male','adult'),
              ($1,'Guest Traveler','1992-08-22','female','adult')`,
      [booking2.rows[0].id]
    );

    console.log('[seed] Demo bookings seeded (DEMO01: DEL→BOM, DEMO02: DXB→SIN).');

    // ── Hotel inventory ────────────────────────────────────────
    console.log('[seed] Seeding hotel inventory…');

    const hotels = [
      // ── Mumbai ──────────────────────────────────────────────
      { name: 'Sea Breeze Inn', city: 'Mumbai', country: 'India', stars: 2,
        address: '12 Colaba Causeway, Colaba, Mumbai 400001',
        desc: 'A clean, comfortable budget stay steps from the Gateway of India and Colaba market. Perfect for travellers who want location without the luxury price tag.',
        amenities: ['Free WiFi', 'Air Conditioning', 'TV', '24-hour Reception'],
        thumb: 'https://picsum.photos/seed/hotel-mum-1/800/500',
        rooms: [
          { type: 'Standard Room', desc: 'Cozy room with city view, AC, and en-suite bathroom.', guests: 2, price: 1800, amens: ['AC', 'TV', 'WiFi'] },
          { type: 'Deluxe Room',   desc: 'Larger room with sea-facing window and upgraded bedding.', guests: 2, price: 2500, amens: ['AC', 'TV', 'WiFi', 'Mini Fridge'] },
        ],
      },
      { name: 'Harbour View Hotel', city: 'Mumbai', country: 'India', stars: 3,
        address: '45 Marine Drive, Churchgate, Mumbai 400020',
        desc: 'A mid-range hotel on the iconic Marine Drive promenade. Enjoy city views, a rooftop lounge, and easy access to South Mumbai attractions.',
        amenities: ['Free WiFi', 'AC', 'Swimming Pool', 'Restaurant', 'Gym', 'Rooftop Bar'],
        thumb: 'https://picsum.photos/seed/hotel-mum-2/800/500',
        rooms: [
          { type: 'Standard Room', desc: 'Comfortable room with garden view.', guests: 2, price: 4000, amens: ['AC', 'TV', 'WiFi'] },
          { type: 'Deluxe Sea View', desc: 'Spacious room with panoramic Marine Drive views.', guests: 2, price: 5500, amens: ['AC', 'TV', 'WiFi', 'Mini Bar'] },
          { type: 'Superior Suite',  desc: 'Corner suite with wrap-around sea views and living area.', guests: 3, price: 8000, amens: ['AC', 'TV', 'WiFi', 'Mini Bar', 'Lounge Area'] },
        ],
      },
      { name: 'The Bandra Collective', city: 'Mumbai', country: 'India', stars: 4,
        address: '18 Pali Hill, Bandra West, Mumbai 400050',
        desc: 'A boutique design hotel in the heart of Bandra. Thoughtfully designed rooms, an award-winning restaurant, and a rooftop pool make this a Mumbai favourite.',
        amenities: ['Free WiFi', 'AC', 'Rooftop Pool', 'Spa', 'Restaurant', 'Bar', 'Room Service', 'Gym'],
        thumb: 'https://picsum.photos/seed/hotel-mum-3/800/500',
        rooms: [
          { type: 'Deluxe Room',    desc: 'Stylish room with city views and premium amenities.', guests: 2, price: 10500, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'Bathrobe'] },
          { type: 'Club Room',      desc: 'Access to exclusive Club Lounge with complimentary cocktails.', guests: 2, price: 14000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'Club Lounge Access'] },
          { type: 'Junior Suite',   desc: 'Separate living area, soaking tub, and Bandra skyline views.', guests: 3, price: 21000, amens: ['AC', 'Smart TV', 'WiFi', 'Bathtub', 'Club Lounge'] },
        ],
      },
      { name: 'Four Seasons Mumbai', city: 'Mumbai', country: 'India', stars: 5,
        address: '114 Dr E Moses Road, Worli, Mumbai 400018',
        desc: 'Mumbai\'s tallest luxury hotel, soaring above Worli with uninterrupted sea views. Impeccable service, three dining venues, and a spectacular infinity pool define the experience.',
        amenities: ['Free WiFi', 'AC', 'Infinity Pool', 'Spa', 'Multiple Restaurants', 'Bar', 'Concierge', 'Butler Service', 'Airport Transfer', 'Gym'],
        thumb: 'https://picsum.photos/seed/hotel-mum-4/800/500',
        rooms: [
          { type: 'Deluxe Room',     desc: 'Floor-to-ceiling windows with city or sea views, marble bathroom.', guests: 2, price: 34000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'Bathrobe', 'Nespresso'] },
          { type: 'Premier Suite',   desc: 'Expansive suite with separate living room and private dining area.', guests: 2, price: 65000, amens: ['AC', 'Smart TV', 'WiFi', 'Bar', 'Butler Service', 'Soaking Tub'] },
          { type: 'Grand Penthouse', desc: 'Two-bedroom penthouse with panoramic 270° Mumbai skyline views.', guests: 4, price: 120000, amens: ['AC', 'Smart TV', 'WiFi', 'Private Bar', 'Butler', 'Personal Chef'] },
        ],
      },
      // ── Delhi ───────────────────────────────────────────────
      { name: 'Capital Budget Inn', city: 'Delhi', country: 'India', stars: 2,
        address: 'Main Bazaar, Paharganj, New Delhi 110055',
        desc: 'Centrally located near New Delhi Railway Station. No-frills but spotlessly clean rooms at unbeatable prices. Great base for backpackers and budget travellers.',
        amenities: ['Free WiFi', 'AC', 'TV', '24-hour Reception', 'Luggage Storage'],
        thumb: 'https://picsum.photos/seed/hotel-del-1/800/500',
        rooms: [
          { type: 'Standard Room', desc: 'Clean, compact room with attached bathroom.', guests: 2, price: 1200, amens: ['AC', 'TV', 'WiFi'] },
          { type: 'Deluxe Room',   desc: 'Larger room with upgraded bedding and city view.', guests: 2, price: 1800, amens: ['AC', 'TV', 'WiFi', 'Mini Fridge'] },
        ],
      },
      { name: 'Park Central Hotel', city: 'Delhi', country: 'India', stars: 3,
        address: 'K Block, Connaught Place, New Delhi 110001',
        desc: 'A smart business hotel at the heart of Connaught Place. Walking distance to Rajiv Chowk Metro, Parliament Street, and India Gate.',
        amenities: ['Free WiFi', 'AC', 'Restaurant', 'Business Centre', 'Gym', 'Meeting Rooms'],
        thumb: 'https://picsum.photos/seed/hotel-del-2/800/500',
        rooms: [
          { type: 'Standard Room', desc: 'Well-appointed room with work desk and city views.', guests: 2, price: 4800, amens: ['AC', 'TV', 'WiFi'] },
          { type: 'Deluxe Room',   desc: 'Spacious room with CP views and sitting area.', guests: 2, price: 6500, amens: ['AC', 'TV', 'WiFi', 'Mini Bar'] },
          { type: 'Executive Suite', desc: 'Separate living room, executive lounge access.', guests: 3, price: 9500, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'Lounge Access'] },
        ],
      },
      { name: 'The Metropolitan Delhi', city: 'Delhi', country: 'India', stars: 4,
        address: 'Bangla Sahib Road, Connaught Place, New Delhi 110001',
        desc: 'A landmark luxury hotel in the diplomatic quarter. Known for exceptional service, award-winning cuisine, and lush garden views in the middle of the capital.',
        amenities: ['Free WiFi', 'AC', 'Pool', 'Spa', 'Multiple Restaurants', 'Bar', 'Gym', 'Room Service', 'Valet Parking'],
        thumb: 'https://picsum.photos/seed/hotel-del-3/800/500',
        rooms: [
          { type: 'Deluxe Room',  desc: 'Contemporary room with garden or city views.', guests: 2, price: 12000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar'] },
          { type: 'Club Room',    desc: 'Enhanced amenities with Club Lounge access.', guests: 2, price: 16500, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'Club Lounge'] },
          { type: 'Junior Suite', desc: 'Separate sitting room with garden facing terrace.', guests: 3, price: 25000, amens: ['AC', 'Smart TV', 'WiFi', 'Bathrobe', 'Club Lounge'] },
        ],
      },
      { name: 'The Leela Palace New Delhi', city: 'Delhi', country: 'India', stars: 5,
        address: 'Diplomatic Enclave, Chanakyapuri, New Delhi 110023',
        desc: 'Inspired by the grandeur of Lutyens\' Delhi, The Leela Palace is a tribute to India\'s rich heritage. Six restaurants, an iconic pool, and impeccable butler service.',
        amenities: ['Free WiFi', 'AC', 'Outdoor Pool', 'Spa', 'Six Restaurants', 'Bar', 'Butler Service', 'Concierge', 'Airport Transfer', 'Gym'],
        thumb: 'https://picsum.photos/seed/hotel-del-4/800/500',
        rooms: [
          { type: 'Deluxe Room',   desc: 'Palatial room with garden or pool views, marble bathroom.', guests: 2, price: 42000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'Bathrobe'] },
          { type: 'Royal Suite',   desc: 'Opulent suite with separate dining room and private terrace.', guests: 2, price: 95000, amens: ['AC', 'Smart TV', 'WiFi', 'Bar', 'Butler', 'Terrace'] },
          { type: 'Grand Presidential', desc: 'Two-bedroom presidential suite with panoramic Delhi views.', guests: 4, price: 200000, amens: ['AC', 'Smart TV', 'WiFi', 'Private Bar', 'Butler', 'Chef'] },
        ],
      },
      // ── Goa ─────────────────────────────────────────────────
      { name: 'Palm Beach Huts', city: 'Goa', country: 'India', stars: 2,
        address: 'Calangute Beach Road, Calangute, Goa 403516',
        desc: 'Charming beach huts just steps from Calangute Beach. Simple, breezy and affordable — the classic Goa backpacker experience.',
        amenities: ['Free WiFi', 'Fan', 'Beach Access', 'Outdoor Seating', 'Bicycle Rental'],
        thumb: 'https://picsum.photos/seed/hotel-goa-1/800/500',
        rooms: [
          { type: 'Beach Hut',     desc: 'Cozy bamboo hut with fan, 50m from the beach.', guests: 2, price: 1800, amens: ['Fan', 'WiFi', 'Beach Access'] },
          { type: 'Deluxe Hut',    desc: 'Larger hut with AC and sea-facing veranda.', guests: 2, price: 2800, amens: ['AC', 'WiFi', 'Beach Access', 'Veranda'] },
        ],
      },
      { name: 'Sandy Shores Resort', city: 'Goa', country: 'India', stars: 3,
        address: 'Baga Beach Road, Baga, Goa 403516',
        desc: 'A well-loved mid-range resort right on Baga Beach. Pool parties, live music, water sports, and sunset cocktails make this a perennial favourite.',
        amenities: ['Free WiFi', 'AC', 'Pool', 'Beach Access', 'Restaurant', 'Bar', 'Water Sports'],
        thumb: 'https://picsum.photos/seed/hotel-goa-2/800/500',
        rooms: [
          { type: 'Pool-Facing Room', desc: 'Bright room overlooking the pool with balcony.', guests: 2, price: 5800, amens: ['AC', 'TV', 'WiFi', 'Balcony'] },
          { type: 'Sea View Room',    desc: 'Elevated room with direct views of the Arabian Sea.', guests: 2, price: 7500, amens: ['AC', 'TV', 'WiFi', 'Balcony', 'Mini Bar'] },
          { type: 'Beach Cottage',    desc: 'Private cottage steps from the sand with outdoor shower.', guests: 3, price: 11000, amens: ['AC', 'TV', 'WiFi', 'Private Garden', 'Mini Bar'] },
        ],
      },
      { name: 'Alila South Goa', city: 'Goa', country: 'India', stars: 4,
        address: 'Cavelossim, Majorda, South Goa 403731',
        desc: 'Tucked away in peaceful south Goa, Alila offers a sanctuary of contemporary design surrounded by rice paddies and coconut groves, with a pristine private beach.',
        amenities: ['Free WiFi', 'AC', 'Infinity Pool', 'Spa', 'Restaurant', 'Bar', 'Private Beach', 'Yoga', 'Gym'],
        thumb: 'https://picsum.photos/seed/hotel-goa-3/800/500',
        rooms: [
          { type: 'Studio Suite',   desc: 'Open-plan studio with outdoor deck and rice field views.', guests: 2, price: 16000, amens: ['AC', 'Smart TV', 'WiFi', 'Outdoor Shower', 'Mini Bar'] },
          { type: 'Pool Villa',     desc: 'Private plunge pool villa surrounded by lush greenery.', guests: 2, price: 28000, amens: ['AC', 'Smart TV', 'WiFi', 'Private Pool', 'Butler', 'Bar'] },
          { type: 'Beach Villa',    desc: 'Beachfront villa with direct sand access and sunset terrace.', guests: 4, price: 45000, amens: ['AC', 'Smart TV', 'WiFi', 'Private Pool', 'Butler', 'Chef'] },
        ],
      },
      { name: 'Vagator Cliff Resort', city: 'Goa', country: 'India', stars: 5,
        address: 'Ozran Beach, Vagator, North Goa 403509',
        desc: 'Perched dramatically on the Vagator cliffs above the Arabian Sea, this ultra-luxe property offers some of Goa\'s most spectacular views with world-class dining.',
        amenities: ['Free WiFi', 'AC', 'Cliff-Edge Pool', 'Spa', 'Fine Dining', 'Bar', 'Private Beach Access', 'Helipad', 'Concierge', 'Butler'],
        thumb: 'https://picsum.photos/seed/hotel-goa-4/800/500',
        rooms: [
          { type: 'Cliff Villa',    desc: 'Dramatic clifftop villa with private infinity plunge pool.', guests: 2, price: 38000, amens: ['AC', 'Smart TV', 'WiFi', 'Private Pool', 'Butler', 'Mini Bar'] },
          { type: 'Ocean Suite',    desc: 'Panoramic 180° sea views, outdoor tub, butler on call.', guests: 2, price: 58000, amens: ['AC', 'Smart TV', 'WiFi', 'Outdoor Tub', 'Butler', 'Bar'] },
          { type: 'Penthouse Retreat', desc: 'Duplex penthouse with personal chef, private pool and helipad transfer.', guests: 4, price: 120000, amens: ['AC', 'Smart TV', 'WiFi', 'Private Pool', 'Chef', 'Helicopter'] },
        ],
      },
      // ── Bangalore ───────────────────────────────────────────
      { name: 'MG Road Budget Inn', city: 'Bangalore', country: 'India', stars: 2,
        address: '14 Residency Road, Near MG Road Metro, Bangalore 560025',
        desc: 'No-frills accommodation right on the MG Road Metro corridor. Ideal for business travellers who need clean, affordable rooms in a prime central location.',
        amenities: ['Free WiFi', 'AC', 'TV', 'Luggage Storage', '24-hour Reception'],
        thumb: 'https://picsum.photos/seed/hotel-blr-1/800/500',
        rooms: [
          { type: 'Standard Room', desc: 'Clean, compact room with private bathroom and metro access.', guests: 2, price: 1500, amens: ['AC', 'TV', 'WiFi'] },
          { type: 'Deluxe Room',   desc: 'Slightly larger with city views and upgraded linen.', guests: 2, price: 2200, amens: ['AC', 'TV', 'WiFi', 'Mini Fridge'] },
        ],
      },
      { name: 'Vivanta Bangalore', city: 'Bangalore', country: 'India', stars: 4,
        address: '75 MG Road, Residency Road, Bangalore 560025',
        desc: 'An upscale hotel in the heart of Bengaluru\'s business district. Combines contemporary design with personalised service, rooftop bar, and a celebrated dining scene.',
        amenities: ['Free WiFi', 'AC', 'Pool', 'Spa', 'Rooftop Restaurant', 'Bar', 'Gym', 'Meeting Rooms', 'Room Service'],
        thumb: 'https://picsum.photos/seed/hotel-blr-2/800/500',
        rooms: [
          { type: 'Deluxe Room',  desc: 'Stylish room with garden or pool views and Smart TV.', guests: 2, price: 10500, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar'] },
          { type: 'Club Room',    desc: 'Access to exclusive Club Lounge with breakfast and evening cocktails.', guests: 2, price: 14000, amens: ['AC', 'Smart TV', 'WiFi', 'Club Lounge', 'Mini Bar'] },
          { type: 'Junior Suite', desc: 'Open-plan suite with city skyline views and soaking tub.', guests: 3, price: 22000, amens: ['AC', 'Smart TV', 'WiFi', 'Bathtub', 'Butler'] },
        ],
      },
      // ── Jaipur ──────────────────────────────────────────────
      { name: 'Pink City Guest House', city: 'Jaipur', country: 'India', stars: 2,
        address: 'Near Hawa Mahal, Walled City, Jaipur 302002',
        desc: 'A heritage-style budget guesthouse inside the iconic Walled City, steps from Hawa Mahal. Rooftop breakfast with views of Jaipur\'s pink facades.',
        amenities: ['Free WiFi', 'AC', 'Rooftop Terrace', 'Heritage Property', 'Breakfast Included'],
        thumb: 'https://picsum.photos/seed/hotel-jai-1/800/500',
        rooms: [
          { type: 'Heritage Room',   desc: 'Traditionally decorated room with jharokha windows.', guests: 2, price: 1400, amens: ['AC', 'WiFi', 'Heritage Decor'] },
          { type: 'Rooftop Room',    desc: 'Upper floor room with private terrace and Pink City views.', guests: 2, price: 2100, amens: ['AC', 'WiFi', 'Private Terrace'] },
        ],
      },
      { name: 'Jai Mahal Palace', city: 'Jaipur', country: 'India', stars: 5,
        address: 'Jacob Road, Civil Lines, Jaipur 302006',
        desc: 'A restored 18th-century palace in expansive Mughal gardens. Experience royal Rajput living with hand-painted frescoes, vintage furnishings, and authentic cuisine.',
        amenities: ['Free WiFi', 'AC', 'Heritage Pool', 'Ayurvedic Spa', 'Royal Dining', 'Bar', 'Elephant Polo', 'Concierge', 'Butler', 'Elephant Rides'],
        thumb: 'https://picsum.photos/seed/hotel-jai-2/800/500',
        rooms: [
          { type: 'Palace Room',       desc: 'Opulent room with original frescoes and garden views.', guests: 2, price: 28000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'Bathrobe'] },
          { type: 'Royal Suite',        desc: 'Former royal chamber with private dining and butler service.', guests: 2, price: 65000, amens: ['AC', 'Smart TV', 'WiFi', 'Bar', 'Butler', 'Private Dining'] },
          { type: 'Maharaja Suite',     desc: 'The crown jewel — two-bedroom palatial suite with own garden and pool.', guests: 4, price: 160000, amens: ['AC', 'Smart TV', 'WiFi', 'Private Pool', 'Butler', 'Chef'] },
        ],
      },
      { name: 'Clarks Amer Jaipur', city: 'Jaipur', country: 'India', stars: 4,
        address: 'Jawaharlal Nehru Marg, Jaipur 302018',
        desc: 'A popular business hotel near the airport with generous room sizes, a relaxing pool, and reliable service — a dependable choice for both leisure and corporate travel.',
        amenities: ['Free WiFi', 'AC', 'Pool', 'Spa', 'Restaurant', 'Bar', 'Gym', 'Business Centre'],
        thumb: 'https://picsum.photos/seed/hotel-jai-3/800/500',
        rooms: [
          { type: 'Standard Room', desc: 'Comfortable room with pool or garden views.', guests: 2, price: 7500, amens: ['AC', 'TV', 'WiFi'] },
          { type: 'Deluxe Room',   desc: 'Larger room with sitting area and upgraded amenities.', guests: 2, price: 10000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar'] },
          { type: 'Club Suite',    desc: 'Suite with private lounge access and Aravallis views.', guests: 3, price: 16000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'Club Lounge'] },
        ],
      },
      // ── Chennai ─────────────────────────────────────────────
      { name: 'Marina Bay Inn', city: 'Chennai', country: 'India', stars: 3,
        address: '32 Kamarajar Salai, Marina, Chennai 600005',
        desc: 'An affordable mid-range hotel on the Marina Beach boulevard. Walking distance to the beach, Anna Square, and central government offices.',
        amenities: ['Free WiFi', 'AC', 'Restaurant', 'TV', 'Laundry', 'Meeting Room'],
        thumb: 'https://picsum.photos/seed/hotel-che-1/800/500',
        rooms: [
          { type: 'Standard Room', desc: 'Clean room with partial sea view and work desk.', guests: 2, price: 4200, amens: ['AC', 'TV', 'WiFi'] },
          { type: 'Deluxe Room',   desc: 'Larger room with full sea view and balcony.', guests: 2, price: 5800, amens: ['AC', 'TV', 'WiFi', 'Balcony'] },
          { type: 'Suite',         desc: 'Corner suite with sweeping Marina Beach panoramas.', guests: 3, price: 9000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'Balcony'] },
        ],
      },
      { name: 'The Residency Chennai', city: 'Chennai', country: 'India', stars: 4,
        address: '49 GN Chetty Road, T Nagar, Chennai 600017',
        desc: 'A consistently rated 5-star in the T Nagar business hub. Renowned for excellent south Indian dining, spa, and proximity to major shopping and corporate areas.',
        amenities: ['Free WiFi', 'AC', 'Pool', 'Spa', 'Restaurant', 'Bar', 'Gym', 'Business Centre', 'Room Service'],
        thumb: 'https://picsum.photos/seed/hotel-che-2/800/500',
        rooms: [
          { type: 'Deluxe Room',  desc: 'Stylish contemporary room with city views.', guests: 2, price: 8500, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar'] },
          { type: 'Club Room',    desc: 'Premium room with Club Lounge access and evening canapés.', guests: 2, price: 12000, amens: ['AC', 'Smart TV', 'WiFi', 'Club Lounge', 'Mini Bar'] },
          { type: 'Junior Suite', desc: 'Expansive suite with T Nagar skyline views and butler.', guests: 3, price: 19000, amens: ['AC', 'Smart TV', 'WiFi', 'Bathtub', 'Butler'] },
        ],
      },
      // ── Dubai ────────────────────────────────────────────────
      { name: 'Reva Hotel Deira', city: 'Dubai', country: 'UAE', stars: 2,
        address: 'Al Rigga Street, Deira, Dubai 12345',
        desc: 'A compact budget hotel in the buzzing Deira district. Easy access to the Gold Souk, Spice Souk, and Dubai Metro for hassle-free exploration.',
        amenities: ['Free WiFi', 'AC', 'TV', 'Laundry', '24-hour Reception'],
        thumb: 'https://picsum.photos/seed/hotel-dxb-1/800/500',
        rooms: [
          { type: 'Standard Room', desc: 'Compact, well-maintained room near the souk district.', guests: 2, price: 3200, amens: ['AC', 'TV', 'WiFi'] },
          { type: 'Deluxe Room',   desc: 'Larger room with creek views and upgraded linen.', guests: 2, price: 4500, amens: ['AC', 'TV', 'WiFi', 'Mini Fridge'] },
        ],
      },
      { name: 'Citymax Hotel Bur Dubai', city: 'Dubai', country: 'UAE', stars: 3,
        address: 'Al Fahidi Street, Bur Dubai, Dubai 13245',
        desc: 'A reliable mid-range choice in the historic Bur Dubai quarter. Large rooms, a rooftop pool, and value dining make it ideal for families and first-time Dubai visitors.',
        amenities: ['Free WiFi', 'AC', 'Pool', 'Restaurant', 'Gym', 'Bar', 'Concierge'],
        thumb: 'https://picsum.photos/seed/hotel-dxb-2/800/500',
        rooms: [
          { type: 'Standard Room', desc: 'Spacious room with heritage district views.', guests: 2, price: 7500, amens: ['AC', 'TV', 'WiFi'] },
          { type: 'Deluxe Room',   desc: 'Larger room with pool views and sitting area.', guests: 3, price: 10000, amens: ['AC', 'TV', 'WiFi', 'Mini Bar'] },
          { type: 'Family Suite',  desc: 'Two-room suite perfect for families with sofa bed.', guests: 4, price: 15000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'Sofa Bed'] },
        ],
      },
      { name: 'Sofitel Dubai Downtown', city: 'Dubai', country: 'UAE', stars: 4,
        address: 'Sheikh Zayed Road, Downtown Dubai, Dubai 29000',
        desc: 'French elegance meets Arabian hospitality in the heart of Downtown. Breathtaking Burj Khalifa views, a rooftop pool with panorama, and exceptional dining.',
        amenities: ['Free WiFi', 'AC', 'Rooftop Pool', 'Spa', 'Restaurant', 'Bar', 'Gym', 'Concierge', 'Room Service'],
        thumb: 'https://picsum.photos/seed/hotel-dxb-3/800/500',
        rooms: [
          { type: 'Luxury Room',   desc: 'Floor-to-ceiling Burj Khalifa views with French décor.', guests: 2, price: 20000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar'] },
          { type: 'Club Room',     desc: 'Access to Sofitel Club with premium F&B included.', guests: 2, price: 27000, amens: ['AC', 'Smart TV', 'WiFi', 'Club Access', 'Mini Bar'] },
          { type: 'Junior Suite',  desc: 'Expansive suite with Burj view terrace and butler service.', guests: 3, price: 42000, amens: ['AC', 'Smart TV', 'WiFi', 'Terrace', 'Butler', 'Bar'] },
        ],
      },
      { name: 'Atlantis The Palm', city: 'Dubai', country: 'UAE', stars: 5,
        address: 'Crescent Road, The Palm Jumeirah, Dubai 74925',
        desc: 'The iconic resort on the tip of the Palm. Aquaventure Waterpark, Ambassador Lagoon, 23 restaurants and bars, and private beach — Dubai\'s ultimate indulgence.',
        amenities: ['Free WiFi', 'AC', 'Multiple Pools', 'Waterpark', 'Spa', '23 Restaurants', 'Private Beach', 'Aquarium', 'Concierge', 'Butler'],
        thumb: 'https://picsum.photos/seed/hotel-dxb-4/800/500',
        rooms: [
          { type: 'Terrace Room',        desc: 'Palm views with exclusive Aquaventure access included.', guests: 2, price: 58000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'Waterpark Access'] },
          { type: 'Ocean Suite',         desc: 'Sunset-facing suite with underwater tunnel views.', guests: 3, price: 100000, amens: ['AC', 'Smart TV', 'WiFi', 'Butler', 'Bar', 'Terrace'] },
          { type: 'Royal Bridge Suite',  desc: 'The legendary two-storey suite connecting the two hotel towers.', guests: 4, price: 450000, amens: ['AC', 'Smart TV', 'WiFi', 'Private Pool', 'Butler', 'Chef', 'Rolls Royce'] },
        ],
      },
      // ── Singapore ────────────────────────────────────────────
      { name: 'Pod Hostel Singapore', city: 'Singapore', country: 'Singapore', stars: 2,
        address: '289 South Bridge Road, Chinatown, Singapore 058837',
        desc: 'Award-winning capsule hotel in Chinatown with private sleeping pods, social rooftop terrace, and unbeatable location. Top-rated for cleanliness and design.',
        amenities: ['Free WiFi', 'AC', 'Rooftop Terrace', 'Lockers', 'Common Kitchen', 'Social Lounge'],
        thumb: 'https://picsum.photos/seed/hotel-sin-1/800/500',
        rooms: [
          { type: 'Capsule Pod',  desc: 'Private capsule with reading light, power outlets, locker.', guests: 1, price: 2200, amens: ['AC', 'WiFi', 'Pod Light', 'Locker'] },
          { type: 'Private Room', desc: 'Small private room with bunk bed and ensuite.', guests: 2, price: 3800, amens: ['AC', 'WiFi', 'Ensuite'] },
        ],
      },
      { name: 'Naumi Hotel Singapore', city: 'Singapore', country: 'Singapore', stars: 4,
        address: '41 Seah Street, City Hall, Singapore 188396',
        desc: 'A stunning boutique hotel near Raffles, Park, and City Hall. Just 73 rooms with hyper-personalised service, rooftop infinity pool, and thoughtful local design touches.',
        amenities: ['Free WiFi', 'AC', 'Rooftop Infinity Pool', 'Gym', 'Restaurant', 'Bar', 'Concierge', 'Room Service'],
        thumb: 'https://picsum.photos/seed/hotel-sin-2/800/500',
        rooms: [
          { type: 'Deluxe Room',  desc: 'Bold, design-led room with premium bedding and smart controls.', guests: 2, price: 17000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar'] },
          { type: 'Club Suite',   desc: 'Generous suite with living area, tub, and city views.', guests: 2, price: 24000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'Bathtub'] },
          { type: 'Penthouse',    desc: 'Crown suite with private rooftop access and Singapore skyline.', guests: 3, price: 45000, amens: ['AC', 'Smart TV', 'WiFi', 'Roof Access', 'Butler', 'Bar'] },
        ],
      },
      { name: 'Marina Bay Sands', city: 'Singapore', country: 'Singapore', stars: 5,
        address: '10 Bayfront Avenue, Marina Bay, Singapore 018956',
        desc: 'One of the world\'s most iconic hotels. Three towers topped by the legendary SkyPark infinity pool. Direct access to Casino, Shoppes, and ArtScience Museum.',
        amenities: ['Free WiFi', 'AC', 'SkyPark Infinity Pool', 'Spa', 'Celebrity Restaurants', 'Casino', 'Shopping Mall', 'Museum', 'Concierge', 'Butler'],
        thumb: 'https://picsum.photos/seed/hotel-sin-3/800/500',
        rooms: [
          { type: 'Deluxe Room',    desc: 'Floor-to-ceiling windows with city or bay views, SkyPark access.', guests: 2, price: 62000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'SkyPark Access'] },
          { type: 'Premier Suite',  desc: 'Expansive suite with panoramic bay views and lounge area.', guests: 2, price: 120000, amens: ['AC', 'Smart TV', 'WiFi', 'Bar', 'Butler', 'SkyPark Access'] },
          { type: 'Chairman Suite', desc: 'The ultimate MBS experience — dedicated floor, personal butler team.', guests: 4, price: 350000, amens: ['AC', 'Smart TV', 'WiFi', 'Private Pool', 'Butler Team', 'Chef'] },
        ],
      },
      { name: 'The Fullerton Hotel', city: 'Singapore', country: 'Singapore', stars: 5,
        address: '1 Fullerton Square, Raffles Place, Singapore 049178',
        desc: 'A Singapore landmark in a magnificent 1928 Palladian building. Overlooks Marina Bay with impeccable service, a rooftop pool, and one of Singapore\'s best brunches.',
        amenities: ['Free WiFi', 'AC', 'Rooftop Pool', 'Spa', 'Multiple Restaurants', 'Bar', 'Concierge', 'Heritage Tours'],
        thumb: 'https://picsum.photos/seed/hotel-sin-4/800/500',
        rooms: [
          { type: 'Heritage Room',    desc: 'Classic room within the original 1928 heritage building.', guests: 2, price: 40000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar'] },
          { type: 'Courtyard Suite',  desc: 'Airy suite around the luminous inner courtyard with garden views.', guests: 2, price: 78000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'Bathtub'] },
          { type: 'Presidential Suite', desc: 'Penthouse suite with private infinity pool overlooking Marina Bay.', guests: 4, price: 200000, amens: ['AC', 'Smart TV', 'WiFi', 'Private Pool', 'Butler', 'Chef'] },
        ],
      },
      // ── Bangkok ──────────────────────────────────────────────
      { name: 'Bangkok Budget Lodge', city: 'Bangkok', country: 'Thailand', stars: 2,
        address: 'Sukhumvit Soi 11, Bangkok 10110',
        desc: 'A well-located budget option on the lively Sukhumvit strip. Steps from BTS Nana station, rooftop bar, and Bangkok\'s best street food.',
        amenities: ['Free WiFi', 'AC', 'TV', 'Rooftop Bar', 'Laundry', '24hr Reception'],
        thumb: 'https://picsum.photos/seed/hotel-bkk-1/800/500',
        rooms: [
          { type: 'Standard Room', desc: 'Clean room with AC, TV, and en-suite hot shower.', guests: 2, price: 1800, amens: ['AC', 'TV', 'WiFi'] },
          { type: 'Deluxe Room',   desc: 'Larger room with city views and updated bathroom.', guests: 2, price: 2600, amens: ['AC', 'TV', 'WiFi', 'Mini Fridge'] },
        ],
      },
      { name: 'Mandarin Oriental Bangkok', city: 'Bangkok', country: 'Thailand', stars: 5,
        address: '48 Oriental Avenue, Bangrak, Bangkok 10500',
        desc: 'The legendary "Oriental" — voted the world\'s best hotel many times over. Joseph Conrad, Somerset Maugham, and Noël Coward slept here. Timeless elegance on the Chao Phraya river.',
        amenities: ['Free WiFi', 'AC', 'River Pool', 'Award-winning Spa', 'Nine Restaurants', 'River Shuttle', 'Cooking School', 'Butler', 'Concierge', 'Heritage Art Collection'],
        thumb: 'https://picsum.photos/seed/hotel-bkk-2/800/500',
        rooms: [
          { type: 'Superior Room',   desc: 'Elegant room with river or garden views, classic Thai décor.', guests: 2, price: 36000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar'] },
          { type: 'State Room',      desc: 'Historic room once occupied by literary guests, with river views.', guests: 2, price: 68000, amens: ['AC', 'Smart TV', 'WiFi', 'Mini Bar', 'Butler'] },
          { type: 'Authors\' Suite', desc: 'Named for a famous author — the pinnacle of Bangkok river luxury.', guests: 3, price: 180000, amens: ['AC', 'Smart TV', 'WiFi', 'Bar', 'Butler', 'River Terrace'] },
        ],
      },
    ];

    let hotelCount = 0, roomCount = 0;
    for (const h of hotels) {
      const hRes = await client.query(
        `INSERT INTO hotels (name, city, country, star_rating, address, description, amenities, thumb_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (name, city) DO UPDATE
           SET star_rating=EXCLUDED.star_rating, description=EXCLUDED.description,
               amenities=EXCLUDED.amenities, thumb_url=EXCLUDED.thumb_url
         RETURNING id`,
        [h.name, h.city, h.country, h.stars, h.address, h.desc, h.amenities, h.thumb]
      );
      const hotelId = hRes.rows[0].id;
      await client.query('DELETE FROM hotel_rooms WHERE hotel_id = $1', [hotelId]);
      for (const r of h.rooms) {
        await client.query(
          `INSERT INTO hotel_rooms (hotel_id, room_type, description, max_guests, price_per_night_inr, amenities)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [hotelId, r.type, r.desc, r.guests, r.price, r.amens]
        );
        roomCount++;
      }
      hotelCount++;
    }
    console.log(`[seed] Hotels seeded: ${hotelCount} properties, ${roomCount} room types.`);
  } catch (err) {
    console.error('[seed] Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

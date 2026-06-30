document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar('');
  await Auth.tryRestoreSession();

  const p = getParams();
  const { id, checkin, checkout, guests = 2, rooms = 1 } = p;

  if (!id || !checkin || !checkout) {
    Toast.error('Missing parameters');
    setTimeout(() => window.location.href = '/', 1500);
    return;
  }

  const nights = Math.ceil((new Date(checkout) - new Date(checkin)) / 86400000);

  // Back link preserves search context
  document.getElementById('back-link').href =
    `/pages/hotel-results.html?city=&checkin=${checkin}&checkout=${checkout}&guests=${guests}&rooms=${rooms}`;

  try {
    const data = await api.getHotel(id);
    document.getElementById('page-loading').classList.add('hidden');
    document.getElementById('page-content').classList.remove('hidden');

    const { hotel, rooms: roomList } = data;

    // Hero image
    document.getElementById('hotel-hero-img').src = hotel.thumb_url || 'https://picsum.photos/seed/hotel-fallback/800/500';
    document.getElementById('hotel-hero-img').alt = hotel.name;

    // Stars
    document.getElementById('hotel-stars').textContent = '★'.repeat(hotel.star_rating) + '☆'.repeat(5 - hotel.star_rating);

    // Title + meta
    document.getElementById('hotel-name').textContent = hotel.name;
    document.getElementById('hotel-meta').textContent = `📍 ${hotel.address || hotel.city + ', ' + hotel.country}`;
    document.title = `${hotel.name} — OPSEAZY`;

    // Description
    document.getElementById('hotel-description').textContent = hotel.description || '';

    // Amenities
    document.getElementById('hotel-amenities').innerHTML = (hotel.amenities || []).map(a =>
      `<span class="amenity-tag">✓ ${escHtml(a)}</span>`
    ).join('');

    // Summary sidebar
    document.getElementById('sum-checkin').textContent  = formatDate(checkin);
    document.getElementById('sum-checkout').textContent = formatDate(checkout);
    document.getElementById('sum-nights').textContent   = `${nights} night${nights !== 1 ? 's' : ''}`;
    document.getElementById('sum-guests').textContent   = `${guests} guest${guests > 1 ? 's' : ''}`;
    document.getElementById('sum-rooms').textContent    = `${rooms} room${rooms > 1 ? 's' : ''}`;

    // Room cards
    const container = document.getElementById('rooms-container');
    if (!roomList.length) {
      container.innerHTML = '<p style="color:var(--color-gray-400);">No rooms available for the selected dates.</p>';
    } else {
      container.innerHTML = roomList.map(room => {
        const totalFare = room.price_per_night_inr * nights * parseInt(rooms);
        const bookingUrl = `/pages/hotel-booking.html?hotelId=${hotel.id}&roomId=${room.id}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&guests=${guests}&rooms=${rooms}`;
        const amens = (room.amenities || []).map(a => `<span class="room-amenity">${escHtml(a)}</span>`).join('');

        return `
          <div class="room-card">
            <div>
              <div class="room-type-name">${escHtml(room.room_type)}</div>
              <div class="room-type-desc">${escHtml(room.description || '')}</div>
              <div class="room-amenities">${amens}</div>
              <div class="room-guests-badge">👤 Max ${room.max_guests} guest${room.max_guests > 1 ? 's' : ''}</div>
            </div>
            <div class="room-price-block">
              <div class="room-price-night">per night</div>
              <span class="room-price-value">${formatCurrency(room.price_per_night_inr, 'INR')}</span>
              <div class="room-price-total">${nights}N × ${rooms}R = ${formatCurrency(totalFare, 'INR')}</div>
              <a href="${escHtml(bookingUrl)}" class="btn btn-primary" style="margin-top:var(--space-3);display:block;text-align:center;">
                Book Now →
              </a>
            </div>
          </div>`;
      }).join('');
    }
  } catch (err) {
    document.getElementById('page-loading').classList.add('hidden');
    Toast.error(err.message || 'Failed to load hotel');
  }
});

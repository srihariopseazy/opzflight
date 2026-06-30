document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar('');
  await Auth.tryRestoreSession();
  if (!Auth.requireAuth()) return;

  const p = getParams();
  const { hotelId, roomId, checkin, checkout, guests = 2, rooms = 1 } = p;

  if (!hotelId || !roomId || !checkin || !checkout) {
    Toast.error('Missing booking parameters');
    setTimeout(() => window.location.href = '/', 1500);
    return;
  }

  const nights = Math.ceil((new Date(checkout) - new Date(checkin)) / 86400000);
  let hotel, room, totalFare;
  let currentStep = 1;
  const user = Auth.getUser();

  // ─── Helpers ────────────────────────────────────────────────
  function goToStep(n) {
    [1, 2].forEach(i => {
      document.getElementById(`step-content-${i}`)?.classList.add('hidden');
      const stepEl = document.getElementById(`step-${i}`);
      stepEl?.classList.remove('active', 'done');
      if (i < n) stepEl?.classList.add('done');
      if (i === n) stepEl?.classList.add('active');
      if (i < n) document.getElementById(`conn-${i}`)?.classList.add('done');
    });
    document.getElementById(`step-content-${n}`)?.classList.remove('hidden');
    currentStep = n;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderSidebar(hotelNameElId, breakdownElId, totalElId) {
    document.getElementById(hotelNameElId).textContent = hotel?.name || '—';
    const bd = document.getElementById(breakdownElId);
    bd.innerHTML = `
      <div class="fare-line"><span>${escHtml(room?.room_type || '—')}</span><span>${formatCurrency(room?.price_per_night_inr, 'INR')}/night</span></div>
      <div class="fare-line"><span>${nights} night${nights !== 1 ? 's' : ''}</span><span>× ${nights}</span></div>
      <div class="fare-line"><span>${rooms} room${rooms > 1 ? 's' : ''}</span><span>× ${rooms}</span></div>
    `;
    document.getElementById(totalElId).textContent = formatCurrency(totalFare, 'INR');
  }

  // ─── Load hotel + room ───────────────────────────────────────
  try {
    const data = await api.getHotel(hotelId);
    hotel = data.hotel;
    room  = (data.rooms || []).find(r => String(r.id) === String(roomId));

    if (!hotel || !room) throw new Error('Hotel or room not found');

    totalFare = room.price_per_night_inr * nights * parseInt(rooms);

    document.getElementById('booking-loading').classList.add('hidden');
    document.title = `Book ${hotel.name} — OPSEAZY`;

    // Hotel recap
    document.getElementById('hotel-recap-body').innerHTML = `
      <div style="display:grid;grid-template-columns:auto 1fr;gap:var(--space-4);align-items:center;">
        <img src="${escHtml(hotel.thumb_url || 'https://picsum.photos/seed/hotel-fallback/800/500')}"
             alt="${escHtml(hotel.name)}"
             style="width:100px;height:70px;object-fit:cover;border-radius:var(--radius-lg);"
             onerror="this.src='https://picsum.photos/seed/hotel-fallback/800/500'">
        <div>
          <div style="font-family:var(--font-display);font-weight:700;font-size:1rem;">${escHtml(hotel.name)}</div>
          <div style="color:var(--color-amber);font-size:0.8125rem;">${'★'.repeat(hotel.star_rating)}</div>
          <div style="font-size:0.875rem;color:var(--color-gray-500);">📍 ${escHtml(hotel.city)}</div>
        </div>
      </div>
      <div style="margin-top:var(--space-4);display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--space-3);">
        <div><div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--color-gray-400);">Room Type</div>
             <div style="font-weight:700;">${escHtml(room.room_type)}</div></div>
        <div><div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--color-gray-400);">Check-in</div>
             <div style="font-weight:700;">${formatDate(checkin)}</div></div>
        <div><div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--color-gray-400);">Check-out</div>
             <div style="font-weight:700;">${formatDate(checkout)}</div></div>
        <div><div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--color-gray-400);">Guests / Rooms</div>
             <div style="font-weight:700;">${guests} guests · ${rooms} room${rooms > 1 ? 's' : ''}</div></div>
      </div>`;

    // Pre-fill guest name from logged-in user
    if (user?.name) document.getElementById('guest-name').value = user.name;

    renderSidebar('sidebar-hotel-name', 'sidebar-breakdown', 'sidebar-total');
    goToStep(1);

  } catch (err) {
    document.getElementById('booking-loading').classList.add('hidden');
    Toast.error(err.message || 'Failed to load hotel details');
    return;
  }

  // ─── Step 1 → 2 ─────────────────────────────────────────────
  document.getElementById('btn-next-step1').addEventListener('click', () => {
    const name  = document.getElementById('guest-name').value.trim();
    const email = document.getElementById('guest-email').value.trim();
    if (!name)  { Toast.error('Please enter the primary guest name');  return; }
    if (!email) { Toast.error('Please enter an email address'); return; }

    // Build review
    document.getElementById('review-body').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--space-4);">
        <div>
          <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--color-gray-400);">Hotel</div>
          <div style="font-weight:700;">${escHtml(hotel.name)}</div>
        </div>
        <div>
          <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--color-gray-400);">Room</div>
          <div style="font-weight:700;">${escHtml(room.room_type)}</div>
        </div>
        <div>
          <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--color-gray-400);">Primary Guest</div>
          <div style="font-weight:700;">${escHtml(name)}</div>
        </div>
        <div>
          <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--color-gray-400);">Check-in → Check-out</div>
          <div style="font-weight:700;">${formatDate(checkin)} → ${formatDate(checkout)}</div>
        </div>
        <div>
          <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--color-gray-400);">Duration</div>
          <div style="font-weight:700;">${nights} night${nights !== 1 ? 's' : ''}</div>
        </div>
        <div>
          <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--color-gray-400);">Total</div>
          <div style="font-weight:700;color:var(--color-orange);">${formatCurrency(totalFare, 'INR')}</div>
        </div>
      </div>`;

    renderSidebar('sidebar-hotel-name-2', 'sidebar-breakdown-2', 'sidebar-total-2');
    goToStep(2);

    // Pre-fill demo card
    document.getElementById('card-name').value   = name;
    document.getElementById('card-number').value = '4242 4242 4242 4242';
    document.getElementById('card-expiry').value = '12/28';
    document.getElementById('card-cvv').value    = '123';
    document.getElementById('card-num-preview').textContent    = '•••• •••• •••• 4242';
    document.getElementById('card-holder-preview').textContent = name.toUpperCase();
  });

  // ─── Card preview formatters ─────────────────────────────────
  document.getElementById('card-number').addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').substring(0, 16);
    e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
    document.getElementById('card-num-preview').textContent = `•••• •••• •••• ${v.slice(-4).padStart(4, '•')}`;
  });
  document.getElementById('card-name').addEventListener('input', e => {
    document.getElementById('card-holder-preview').textContent = e.target.value.toUpperCase() || 'YOUR NAME';
  });
  document.getElementById('card-expiry').addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2, 4);
    e.target.value = v;
  });

  // ─── Step 2 back ────────────────────────────────────────────
  document.getElementById('btn-back-step2').addEventListener('click', () => goToStep(1));

  // ─── Pay ────────────────────────────────────────────────────
  document.getElementById('btn-pay').addEventListener('click', async () => {
    const btn   = document.getElementById('btn-pay');
    const errEl = document.getElementById('payment-error');
    errEl.classList.add('hidden');

    const cardName = document.getElementById('card-name').value.trim();
    const cardNum  = document.getElementById('card-number').value.replace(/\s/g, '');
    const expiry   = document.getElementById('card-expiry').value;
    const cvv      = document.getElementById('card-cvv').value;

    if (!cardName || !cardNum || !expiry || !cvv) {
      errEl.textContent = 'Please fill in all payment fields (demo — any values work)';
      errEl.classList.remove('hidden');
      return;
    }

    setButtonLoading(btn, true);
    // 1.5s simulated processing delay
    await new Promise(r => setTimeout(r, 1500));

    const primaryGuest = document.getElementById('guest-name').value.trim();

    try {
      const res = await api.bookHotel({
        hotelId, roomId, checkin, checkout,
        guests: parseInt(guests),
        rooms:  parseInt(rooms),
        primaryGuest,
        allGuests: [{ full_name: primaryGuest, type: 'adult' }],
      });
      sessionStorage.setItem('opseazy_hotel_booking_result', JSON.stringify(res.booking));
      window.location.href = '/pages/hotel-confirmation.html';
    } catch (err) {
      errEl.textContent = err.message || 'Booking failed. Please try again.';
      errEl.classList.remove('hidden');
      setButtonLoading(btn, false, '🔒 Pay & Confirm Hotel');
    }
  });
});

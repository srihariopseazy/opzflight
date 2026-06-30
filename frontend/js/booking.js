/**
 * Booking flow controller
 * Steps: 1) Passenger details → 2) Review + add-ons → 3) Mock payment → confirmation
 */
document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar('');
  await Auth.tryRestoreSession();
  if (!Auth.requireAuth()) return;

  const flight = JSON.parse(sessionStorage.getItem('opseazy_selected_flight') || 'null');
  const searchParams = JSON.parse(sessionStorage.getItem('opseazy_search_params') || '{}');

  const loading = document.getElementById('booking-loading');

  if (!flight) {
    loading.innerHTML = '<div class="empty-state"><div class="empty-icon">✈</div><h3>No flight selected</h3><a href="/" class="btn btn-secondary" style="margin-top:1rem;">← Search Flights</a></div>';
    return;
  }

  const { origin, dest, adults = 1, children = 0, infants = 0, cabinClass = 'ECONOMY' } = searchParams;
  const totalPax = parseInt(adults) + parseInt(children) + parseInt(infants);
  const price = parseFloat(flight.price?.total || 0);
  const currency = flight.price?.currency || 'USD';
  const totalFare = price * parseInt(adults) + price * parseInt(children) * 0.75 + price * parseInt(infants) * 0.1;

  let currentStep = 1;
  let passengerData = [];
  let confirmedFare = null;

  // ─── Fare re-confirmation via backend ─────────────────────
  loading.querySelector('p').textContent = 'Confirming your fare…';
  try {
    const res = await api.priceOffer(flight.id, flight);
    confirmedFare = res.confirmedFare || { total: price, currency, base: flight.price?.base };
  } catch {
    confirmedFare = { total: price, currency, base: flight.price?.base || price * 0.8 };
  }
  loading.classList.add('hidden');

  const confirmedTotal = parseFloat(confirmedFare.total || price) * parseInt(adults);

  // ─── Helper: render fare sidebar ──────────────────────────
  function renderFareSidebar(routeId, breakdownId, totalId) {
    const itin = flight.itineraries?.[0];
    const segs = itin?.segments || [];
    const dep = formatTime(segs[0]?.departure?.at);
    const arr = formatTime(segs[segs.length - 1]?.arrival?.at);
    const stops = segs.length - 1;

    document.getElementById(routeId).innerHTML =
      `${escHtml(origin)} <span style="opacity:0.6">→</span> ${escHtml(dest)}`;

    const base = parseFloat(confirmedFare.base || price * 0.8);
    const taxes = parseFloat(confirmedFare.total || price) - base;

    document.getElementById(breakdownId).innerHTML = `
      <div class="fare-line"><span>Base fare × ${adults}</span><span>${formatCurrency(base * adults, currency)}</span></div>
      <div class="fare-line"><span>Taxes & fees</span><span>${formatCurrency(taxes * adults, currency)}</span></div>
      <div class="fare-line"><span>Seat class</span><span>${cabinClass.replace('_', ' ')}</span></div>
    `;
    document.getElementById(totalId).textContent = formatCurrency(confirmedTotal, currency);
  }

  // ─── Step 1: Passenger forms ──────────────────────────────
  function buildPassengerForms() {
    const itin = flight.itineraries?.[0];
    const segs = itin?.segments || [];
    const dep  = segs[0]?.departure?.at?.substring(0, 10);

    const recapEl = document.getElementById('flight-recap-body');
    recapEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
        <div>
          <div style="font-family:var(--font-display);font-size:1.25rem;font-weight:700;">${escHtml(origin)} → ${escHtml(dest)}</div>
          <div style="color:var(--color-gray-500);font-size:0.9375rem;">${formatDate(dep)} · ${formatDuration(itin?.duration)} · ${stopsLabel(segs.length - 1)}</div>
        </div>
        <div style="font-family:var(--font-display);font-size:1.5rem;font-weight:800;color:var(--color-orange);">${formatCurrency(confirmedTotal, currency)}</div>
      </div>`;

    const container = document.getElementById('passenger-forms-container');
    const paxDefs = [
      ...Array(parseInt(adults)).fill('adult'),
      ...Array(parseInt(children)).fill('child'),
      ...Array(parseInt(infants)).fill('infant'),
    ];

    container.innerHTML = paxDefs.map((type, idx) => `
      <div class="booking-section">
        <div class="booking-section-header">
          <div class="section-icon section-icon-sky">👤</div>
          <h3>Passenger ${idx + 1} <span style="font-size:0.8125rem;text-transform:capitalize;color:var(--color-gray-400);">(${type})</span></h3>
        </div>
        <div class="booking-section-body">
          <div class="passenger-form-grid" id="pax-form-${idx}">
            <div class="form-group full-width">
              <label class="form-label" for="pax-name-${idx}">Full Name (as on passport/ID)</label>
              <input class="form-input" type="text" id="pax-name-${idx}" placeholder="First Middle Last" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="pax-dob-${idx}">Date of Birth</label>
              <input class="form-input" type="date" id="pax-dob-${idx}" required max="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
              <label class="form-label" for="pax-gender-${idx}">Gender</label>
              <select class="form-select" id="pax-gender-${idx}">
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="pax-doc-${idx}">Passport / ID Number <span style="font-weight:400;color:var(--color-gray-400);">(optional)</span></label>
              <input class="form-input" type="text" id="pax-doc-${idx}" placeholder="A1234567">
            </div>
          </div>
        </div>
      </div>`).join('');

    renderFareSidebar('sidebar-route', 'sidebar-breakdown', 'sidebar-total');
    document.getElementById('step-content-1').classList.remove('hidden');
  }

  buildPassengerForms();
  goToStep(1);

  // ─── Step navigation ──────────────────────────────────────
  function goToStep(n) {
    [1, 2, 3].forEach(i => {
      document.getElementById(`step-content-${i}`)?.classList.add('hidden');
      const stepEl = document.getElementById(`step-${i}`);
      stepEl?.classList.remove('active', 'done');
      if (i < n) stepEl?.classList.add('done');
      if (i === n) stepEl?.classList.add('active');
      if (i < n && document.getElementById(`conn-${i}`)) document.getElementById(`conn-${i}`).classList.add('done');
    });
    document.getElementById(`step-content-${n}`)?.classList.remove('hidden');
    currentStep = n;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Step 1 → Step 2
  document.getElementById('btn-next-step1').addEventListener('click', () => {
    const paxDefs = [
      ...Array(parseInt(adults)).fill('adult'),
      ...Array(parseInt(children)).fill('child'),
      ...Array(parseInt(infants)).fill('infant'),
    ];
    passengerData = [];
    let valid = true;

    paxDefs.forEach((type, idx) => {
      const name   = document.getElementById(`pax-name-${idx}`)?.value.trim();
      const dob    = document.getElementById(`pax-dob-${idx}`)?.value;
      const gender = document.getElementById(`pax-gender-${idx}`)?.value;
      const doc    = document.getElementById(`pax-doc-${idx}`)?.value.trim();

      if (!name)   { markError(`pax-name-${idx}`, 'Name required'); valid = false; }
      if (!dob)    { markError(`pax-dob-${idx}`, 'Date of birth required'); valid = false; }
      if (!gender) { markError(`pax-gender-${idx}`, 'Gender required'); valid = false; }

      passengerData.push({ full_name: name, dob, gender, passenger_type: type, document_number: doc || null });
    });

    if (!valid) { Toast.error('Please fill in all passenger details'); return; }

    // Build review
    buildReview();
    renderFareSidebar('sidebar-route-2', 'sidebar-breakdown-2', 'sidebar-total-2');
    goToStep(2);
  });

  function markError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('error'); el.setAttribute('placeholder', msg); }
  }

  function buildReview() {
    const body = document.getElementById('review-body');
    body.innerHTML = `
      <h4 style="margin-bottom:var(--space-4);font-size:0.9375rem;color:var(--color-gray-600);">Passenger Information</h4>
      ${passengerData.map((p, i) => `
        <div style="padding:var(--space-4);background:var(--color-gray-50);border-radius:var(--radius-lg);margin-bottom:var(--space-3);display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--space-3);">
          <div><div style="font-size:0.75rem;color:var(--color-gray-400);text-transform:uppercase;letter-spacing:0.05em;">Passenger ${i + 1}</div>
               <div style="font-weight:700;">${escHtml(p.full_name)}</div></div>
          <div><div style="font-size:0.75rem;color:var(--color-gray-400);text-transform:uppercase;letter-spacing:0.05em;">DOB</div>
               <div style="font-weight:600;">${p.dob}</div></div>
          <div><div style="font-size:0.75rem;color:var(--color-gray-400);text-transform:uppercase;letter-spacing:0.05em;">Gender</div>
               <div style="font-weight:600;text-transform:capitalize;">${p.gender}</div></div>
          <div><div style="font-size:0.75rem;color:var(--color-gray-400);text-transform:uppercase;letter-spacing:0.05em;">Type</div>
               <div style="font-weight:600;text-transform:capitalize;">${p.passenger_type}</div></div>
        </div>`).join('')}`;
  }

  // Add-on toggle
  document.querySelectorAll('.addon-card').forEach(card => {
    card.addEventListener('click', () => card.classList.toggle('selected'));
  });

  // Step 2 → back / next
  document.getElementById('btn-back-step2').addEventListener('click', () => goToStep(1));
  document.getElementById('btn-next-step2').addEventListener('click', () => {
    renderFareSidebar('sidebar-route-3', 'sidebar-breakdown-3', 'sidebar-total-3');
    goToStep(3);
    /* Pre-fill demo card so the user can just click Pay without typing */
    document.getElementById('card-name').value   = 'Demo Traveler';
    document.getElementById('card-number').value = '4242 4242 4242 4242';
    document.getElementById('card-expiry').value = '12/28';
    document.getElementById('card-cvv').value    = '123';
    document.getElementById('card-num-preview').textContent    = '•••• •••• •••• 4242';
    document.getElementById('card-holder-preview').textContent = 'DEMO TRAVELER';
  });

  // Card number formatter
  document.getElementById('card-number').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').substring(0, 16);
    e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
    const last4 = v.slice(-4).padStart(4, '•');
    document.getElementById('card-num-preview').textContent = `•••• •••• •••• ${last4}`;
  });
  document.getElementById('card-name').addEventListener('input', (e) => {
    document.getElementById('card-holder-preview').textContent = e.target.value.toUpperCase() || 'YOUR NAME';
  });
  document.getElementById('card-expiry').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2, 4);
    e.target.value = v;
  });

  // Step 3 → back / pay
  document.getElementById('btn-back-step3').addEventListener('click', () => goToStep(2));
  document.getElementById('btn-pay').addEventListener('click', async () => {
    const btn = document.getElementById('btn-pay');
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
    /* Simulate ~1.5s payment-processing delay (cosmetic only — card data is never sent) */
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      const res = await api.createBooking({
        flightOffer: flight,
        passengers: passengerData,
        searchParams,
        confirmedFare,
      });
      sessionStorage.setItem('opseazy_booking_result', JSON.stringify(res.booking));
      window.location.href = `/pages/confirmation.html`;
    } catch (err) {
      errEl.textContent = err.message || 'Booking failed. Please try again.';
      errEl.classList.remove('hidden');
    } finally {
      setButtonLoading(btn, false, '🔒 Pay & Confirm Booking');
    }
  });
});

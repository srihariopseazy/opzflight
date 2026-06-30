/**
 * Home page controller
 */
document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar('home');
  await Auth.tryRestoreSession();

  // ─── Module tabs ────────────────────────────────────────────
  const COMING_SOON_MODULES = new Set(['packages', 'cars', 'taxi', 'insurance']);
  document.querySelectorAll('.module-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const mod = tab.dataset.module;
      if (COMING_SOON_MODULES.has(mod)) {
        Toast.info('Coming soon! Hotels is live — more modules landing next.');
        return;
      }
      document.querySelectorAll('.module-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('flights-search-form').classList.toggle('hidden', mod !== 'flights');
      document.getElementById('hotels-search-form').classList.toggle('hidden', mod !== 'hotels');
    });
  });

  // Popular demo routes — prices in INR (work in Duffel test mode)
  const popularRoutes = [
    { from: 'DEL', to: 'BOM', fromCity: 'Delhi',       toCity: 'Mumbai',       price: 3499  },
    { from: 'BOM', to: 'BLR', fromCity: 'Mumbai',      toCity: 'Bengaluru',    price: 2999  },
    { from: 'DEL', to: 'MAA', fromCity: 'Delhi',       toCity: 'Chennai',      price: 4499  },
    { from: 'DXB', to: 'SIN', fromCity: 'Dubai',       toCity: 'Singapore',    price: 14999 },
    { from: 'JFK', to: 'LAX', fromCity: 'New York',    toCity: 'Los Angeles',  price: 6799  },
    { from: 'LHR', to: 'CDG', fromCity: 'London',      toCity: 'Paris',        price: 5499  },
    { from: 'SIN', to: 'BKK', fromCity: 'Singapore',   toCity: 'Bangkok',      price: 5199  },
    { from: 'BLR', to: 'HYD', fromCity: 'Bengaluru',   toCity: 'Hyderabad',    price: 1899  },
  ];

  const grid = document.getElementById('popular-routes');
  grid.innerHTML = popularRoutes.map(r => `
    <div class="route-card" data-from="${r.from}" data-to="${r.to}" role="button" tabindex="0"
         aria-label="Search flights from ${r.fromCity} to ${r.toCity}">
      <div class="route-card-content">
        <div class="route-from-to">
          ${r.from} <span class="route-arrow">→</span> ${r.to}
        </div>
        <div class="route-cities">${r.fromCity} → ${r.toCity}</div>
        <div class="route-price">${formatCurrency(r.price, 'INR')}</div>
        <div class="route-price-label">per person</div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.route-card').forEach(card => {
    const activate = () => {
      setAirport('origin', card.dataset.from, card.dataset.from);
      setAirport('dest', card.dataset.to, card.dataset.to);
    };
    card.addEventListener('click', activate);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') activate(); });
  });

  // ─── State ──────────────────────────────────────────────────
  let tripType = 'one-way';
  let adults = 1, children = 0, infants = 0;
  let cabinClass = 'ECONOMY';
  let selectedOrigin = { iata: '', city: '' };
  let selectedDest   = { iata: '', city: '' };

  // ─── Trip type tabs ──────────────────────────────────────────
  document.querySelectorAll('.trip-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.trip-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tripType = btn.dataset.type;
      const returnWrapper = document.getElementById('return-date-wrapper');
      returnWrapper.style.display = tripType === 'round-trip' ? '' : 'none';
    });
  });

  // ─── Default date (tomorrow) ─────────────────────────────────
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('depart-date').value = tomorrow.toISOString().split('T')[0];
  document.getElementById('depart-date').min = new Date().toISOString().split('T')[0];

  // ─── Airport autocomplete ────────────────────────────────────
  function setAirport(which, iata, label) {
    const isOrigin = which === 'origin';
    const inputId  = isOrigin ? 'origin-input' : 'dest-input';
    const cityId   = isOrigin ? 'origin-city'  : 'dest-city';
    const obj      = isOrigin ? selectedOrigin  : selectedDest;

    document.getElementById(inputId).value = iata;
    document.getElementById(cityId).textContent = label;
    obj.iata = iata;
    obj.city = label;
    if (isOrigin) selectedOrigin = { iata, city: label };
    else          selectedDest   = { iata, city: label };

    document.getElementById(isOrigin ? 'origin-dropdown' : 'dest-dropdown').classList.remove('open');
  }

  function buildDropdown(dropdownEl, results, which, onSelect) {
    dropdownEl.innerHTML = '';
    if (!results.length) {
      dropdownEl.innerHTML = '<div class="autocomplete-empty">No airports found</div>';
      dropdownEl.classList.add('open');
      return;
    }
    results.forEach((a, idx) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.setAttribute('role', 'option');
      item.dataset.idx = idx;
      const cityLine = [
        escHtml(a.address?.cityName || a.city || ''),
        a.address?.countryName ? escHtml(a.address.countryName) : '',
      ].filter(Boolean).join(', ');
      item.innerHTML = `
        <span class="autocomplete-iata">${escHtml(a.iataCode)}</span>
        <div class="autocomplete-info">
          <span class="autocomplete-name">${escHtml(a.name || a.iataCode)}</span>
          ${cityLine ? `<span class="autocomplete-city">${cityLine}</span>` : ''}
        </div>`;
      item.addEventListener('mousedown', (e) => {
        /* mousedown fires before blur so the dropdown stays open long enough */
        e.preventDefault();
        onSelect(a);
      });
      dropdownEl.appendChild(item);
    });
    dropdownEl.classList.add('open');
  }

  function setupAirportInput(inputId, dropdownId, which) {
    const input    = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    const cityEl   = document.getElementById(which === 'origin' ? 'origin-city' : 'dest-city');

    /* Track in-flight requests — discard responses for superseded queries */
    let reqSeq = 0;

    function closeDropdown() {
      dropdown.classList.remove('open');
      dropdown.querySelectorAll('.autocomplete-item.focused')
              .forEach(el => el.classList.remove('focused'));
    }

    function onSelect(a) {
      const city = [
        a.address?.cityName || a.city || a.iataCode,
        a.address?.countryName || a.country || '',
      ].filter(Boolean).join(', ');
      setAirport(which, a.iataCode, city);
    }

    const doSearch = debounce(async (val) => {
      if (val.length < 2) { closeDropdown(); return; }

      const seq = ++reqSeq;
      /* Clear stale city label while the user is actively searching */
      cityEl.textContent = '';

      try {
        const data = await api.searchAirports(val);
        if (seq !== reqSeq) return; /* stale — a newer request is in flight */
        buildDropdown(dropdown, data.airports || [], which, onSelect);
      } catch {
        if (seq !== reqSeq) return;
        closeDropdown();
      }
    }, 300);

    input.addEventListener('input', (e) => doSearch(e.target.value.trim()));
    input.addEventListener('focus', (e) => {
      if (e.target.value.length >= 2) doSearch(e.target.value.trim());
    });
    input.addEventListener('blur', () => {
      /* Small delay so mousedown on an item fires first */
      setTimeout(closeDropdown, 150);
    });

    /* Keyboard navigation: ↑ ↓ Enter Escape */
    input.addEventListener('keydown', (e) => {
      const items = [...dropdown.querySelectorAll('.autocomplete-item')];
      const focused = dropdown.querySelector('.autocomplete-item.focused');
      const idx = focused ? parseInt(focused.dataset.idx, 10) : -1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = items[Math.min(idx + 1, items.length - 1)];
        items.forEach(i => i.classList.remove('focused'));
        next?.classList.add('focused');
        next?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = items[Math.max(idx - 1, 0)];
        items.forEach(i => i.classList.remove('focused'));
        prev?.classList.add('focused');
        prev?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && focused) {
        e.preventDefault();
        focused.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      } else if (e.key === 'Escape') {
        closeDropdown();
      }
    });
  }

  setupAirportInput('origin-input', 'origin-dropdown', 'origin');
  setupAirportInput('dest-input',   'dest-dropdown',   'dest');

  /* Bridge for carousel.js so card clicks pre-fill the search */
  window._homeSetAirport = setAirport;

  // Swap
  document.getElementById('swap-btn').addEventListener('click', () => {
    const o = { ...selectedOrigin }, d = { ...selectedDest };
    setAirport('origin', d.iata, d.city);
    setAirport('dest',   o.iata, o.city);
  });

  // ─── Passenger selector ──────────────────────────────────────
  const paxTrigger = document.getElementById('pax-trigger');
  const paxPopover = document.getElementById('pax-popover');

  paxTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    paxPopover.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!paxPopover.contains(e.target) && e.target !== paxTrigger) {
      paxPopover.classList.remove('open');
    }
  });
  document.getElementById('pax-done').addEventListener('click', () => paxPopover.classList.remove('open'));

  function updatePaxLabel() {
    const total = adults + children + infants;
    const classLabel = { ECONOMY: 'Economy', PREMIUM_ECONOMY: 'Prem. Economy', BUSINESS: 'Business', FIRST: 'First' }[cabinClass] || 'Economy';
    paxTrigger.textContent = `${total} Traveller${total > 1 ? 's' : ''} • ${classLabel}`;
  }

  function makePaxBtn(btnId, getter, setter, min, max) {
    document.getElementById(btnId)?.addEventListener('click', () => {
      const cur = getter();
      const next = btnId.includes('inc') ? Math.min(cur + 1, max) : Math.max(cur - 1, min);
      setter(next);
      const countId = btnId.replace('-inc','').replace('-dec','') + '-count';
      document.getElementById(countId).textContent = next;
      updatePaxLabel();
    });
  }

  makePaxBtn('adult-dec', () => adults, v => adults = v, 1, 9);
  makePaxBtn('adult-inc', () => adults, v => adults = v, 1, 9);
  makePaxBtn('child-dec', () => children, v => children = v, 0, 8);
  makePaxBtn('child-inc', () => children, v => children = v, 0, 8);
  makePaxBtn('infant-dec', () => infants, v => infants = v, 0, 4);
  makePaxBtn('infant-inc', () => infants, v => infants = v, 0, 4);

  document.getElementById('cabin-class').addEventListener('change', (e) => {
    cabinClass = e.target.value;
    updatePaxLabel();
  });

  // ─── Search ──────────────────────────────────────────────────
  document.getElementById('btn-search').addEventListener('click', () => {
    const origin  = (document.getElementById('origin-input').value.trim()).toUpperCase().slice(0, 3);
    const dest    = (document.getElementById('dest-input').value.trim()).toUpperCase().slice(0, 3);
    const depart  = document.getElementById('depart-date').value;
    const returnD = document.getElementById('return-date').value;

    if (!origin || origin.length < 2) { Toast.error('Please enter an origin airport'); return; }
    if (!dest   || dest.length < 2)   { Toast.error('Please enter a destination airport'); return; }
    if (origin === dest)               { Toast.error('Origin and destination cannot be the same'); return; }
    if (!depart)                       { Toast.error('Please select a departure date'); return; }
    if (tripType === 'round-trip' && returnD && returnD < depart) {
      Toast.error('Return date must be after departure date'); return;
    }

    const params = new URLSearchParams({
      origin, dest, depart, tripType,
      adults, children, infants,
      cabinClass,
    });
    if (tripType === 'round-trip' && returnD) params.set('returnDate', returnD);

    const url = `/pages/results.html?${params.toString()}`;

    /* Let the 3D landing animation handle navigation if it's active.
       If hero-3d.js responds within the same tick it fires opseazy:search:handled
       synchronously, setting `handled` before the setTimeout runs. */
    let handled = false;
    document.addEventListener('opseazy:search:handled', () => { handled = true; }, { once: true });
    document.dispatchEvent(new CustomEvent('opseazy:search', { detail: { url } }));
    /* Fallback: navigate directly if WebGL/3D isn't available */
    setTimeout(() => { if (!handled) window.location.href = url; }, 150);
  });

  // Allow enter key on airport inputs to trigger search
  ['origin-input', 'dest-input'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-search').click();
    });
  });

  // ─── Hotel search ────────────────────────────────────────────
  const HOTEL_CITIES = [
    'Mumbai', 'Delhi', 'Goa', 'Bangalore', 'Jaipur', 'Chennai',
    'Dubai', 'Singapore', 'Bangkok',
  ];

  const hotelCityInput    = document.getElementById('hotel-city-input');
  const hotelCityDropdown = document.getElementById('hotel-city-dropdown');

  function showHotelCities(filter = '') {
    const matches = filter.length < 1
      ? HOTEL_CITIES
      : HOTEL_CITIES.filter(c => c.toLowerCase().startsWith(filter.toLowerCase()));
    if (!matches.length) { hotelCityDropdown.classList.remove('open'); return; }
    hotelCityDropdown.innerHTML = matches.map(c =>
      `<div class="autocomplete-item" role="option"><span class="autocomplete-iata">🏙</span>
       <div class="autocomplete-info"><span class="autocomplete-name">${escHtml(c)}</span></div></div>`
    ).join('');
    hotelCityDropdown.classList.add('open');
    hotelCityDropdown.querySelectorAll('.autocomplete-item').forEach((el, i) => {
      el.addEventListener('mousedown', e => { e.preventDefault(); hotelCityInput.value = matches[i]; hotelCityDropdown.classList.remove('open'); });
    });
  }

  hotelCityInput.addEventListener('focus', () => showHotelCities(hotelCityInput.value));
  hotelCityInput.addEventListener('input', () => showHotelCities(hotelCityInput.value.trim()));
  hotelCityInput.addEventListener('blur', () => setTimeout(() => hotelCityDropdown.classList.remove('open'), 150));

  // Default hotel dates
  const today    = new Date();
  const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 3);
  document.getElementById('hotel-checkin').value  = tomorrow.toISOString().split('T')[0];
  document.getElementById('hotel-checkout').value = dayAfter.toISOString().split('T')[0];
  document.getElementById('hotel-checkin').min    = today.toISOString().split('T')[0];
  document.getElementById('hotel-checkout').min   = tomorrow.toISOString().split('T')[0];

  document.getElementById('btn-search-hotels').addEventListener('click', () => {
    const city     = hotelCityInput.value.trim();
    const checkin  = document.getElementById('hotel-checkin').value;
    const checkout = document.getElementById('hotel-checkout').value;
    const guests   = document.getElementById('hotel-guests').value;
    const rooms    = document.getElementById('hotel-rooms').value;

    if (!city)     { Toast.error('Please enter a destination city'); return; }
    if (!checkin)  { Toast.error('Please select a check-in date'); return; }
    if (!checkout) { Toast.error('Please select a check-out date'); return; }
    if (checkout <= checkin) { Toast.error('Check-out must be after check-in'); return; }

    const params = new URLSearchParams({ city, checkin, checkout, guests, rooms });
    window.location.href = `/pages/hotel-results.html?${params}`;
  });
});

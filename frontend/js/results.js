/**
 * Results page controller
 */
document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar('');
  await Auth.tryRestoreSession();

  const params = getParams();
  const { origin, dest, depart, tripType, adults = 1, children = 0, infants = 0, cabinClass = 'ECONOMY', returnDate } = params;

  // Update header
  document.getElementById('results-route-title').textContent = `${origin} → ${dest}`;
  const totalPax = parseInt(adults) + parseInt(children) + parseInt(infants);
  document.getElementById('results-meta').textContent =
    `${formatDate(depart)}${returnDate ? ' → ' + formatDate(returnDate) : ''} · ${totalPax} Traveller${totalPax > 1 ? 's' : ''} · ${cabinClass.replace('_', ' ')}`;

  let allFlights = [];
  let filteredFlights = [];
  let currentSort = 'price-asc';
  let activeAirlines = new Set();

  // ─── Fetch flights ──────────────────────────────────────────
  async function loadFlights() {
    document.getElementById('results-loading').classList.remove('hidden');
    document.getElementById('flight-list').innerHTML = '';
    document.getElementById('results-empty').classList.add('hidden');

    try {
      const data = await api.searchFlights({ origin, dest, depart, adults, children, infants, cabinClass, tripType, returnDate: returnDate || '' });
      allFlights = data.flights || [];
      buildAirlineFilter(allFlights);
      applyFiltersAndRender();
    } catch (err) {
      Toast.error(err.message || 'Failed to search flights. Please try again.');
      showEmpty();
    } finally {
      document.getElementById('results-loading').classList.add('hidden');
    }
  }

  function showEmpty() {
    document.getElementById('results-empty').classList.remove('hidden');
    document.getElementById('flight-list').innerHTML = '';
    document.getElementById('results-count').textContent = '0 flights';
  }

  // ─── Airline filter build ────────────────────────────────────
  function buildAirlineFilter(flights) {
    const airlines = {};
    flights.forEach(f => {
      const seg = f.itineraries?.[0]?.segments?.[0];
      if (seg) {
        const code = seg.carrierCode;
        const name = f._airlineName || code;
        airlines[code] = name;
      }
    });
    const list = document.getElementById('airline-filter-list');
    list.innerHTML = Object.entries(airlines).map(([code, name]) => `
      <label class="filter-option">
        <input type="checkbox" value="${code}" name="airline" checked>
        <span class="filter-option-label">${escHtml(name)}</span>
        <span class="filter-count">${flights.filter(f => f.itineraries?.[0]?.segments?.[0]?.carrierCode === code).length}</span>
      </label>
    `).join('');
    list.querySelectorAll('input[name="airline"]').forEach(cb => {
      activeAirlines.add(cb.value);
      cb.addEventListener('change', () => {
        if (cb.checked) activeAirlines.add(cb.value);
        else activeAirlines.delete(cb.value);
        applyFiltersAndRender();
      });
    });
  }

  // ─── Apply filters & sort ────────────────────────────────────
  function applyFiltersAndRender() {
    const checkedStops = [...document.querySelectorAll('input[name="stops"]:checked')].map(c => parseInt(c.value));
    const checkedTimes = [...document.querySelectorAll('input[name="deptime"]:checked')].map(c => c.value);
    const maxPrice = parseInt(document.getElementById('price-range').value);

    filteredFlights = allFlights.filter(f => {
      const price = parseFloat(f.price?.total || 0);
      if (price > maxPrice) return false;

      const seg = f.itineraries?.[0]?.segments || [];
      const stops = seg.length - 1;
      if (checkedStops.length) {
        const stopVal = stops >= 2 ? 2 : stops;
        if (!checkedStops.includes(stopVal)) return false;
      }

      const code = seg[0]?.carrierCode;
      if (code && !activeAirlines.has(code)) return false;

      if (checkedTimes.length) {
        const depHour = parseInt((seg[0]?.departure?.at || '').substring(11, 13) || 0);
        const inSlot = checkedTimes.some(slot => {
          if (slot === 'early')     return depHour < 6;
          if (slot === 'morning')   return depHour >= 6  && depHour < 12;
          if (slot === 'afternoon') return depHour >= 12 && depHour < 18;
          if (slot === 'night')     return depHour >= 18;
          return true;
        });
        if (!inSlot) return false;
      }

      return true;
    });

    sortFlights();
    renderFlights();
  }

  function sortFlights() {
    filteredFlights.sort((a, b) => {
      if (currentSort === 'price-asc')  return parseFloat(a.price?.total) - parseFloat(b.price?.total);
      if (currentSort === 'price-desc') return parseFloat(b.price?.total) - parseFloat(a.price?.total);
      if (currentSort === 'duration') {
        const da = a.itineraries?.[0]?.duration || '';
        const db = b.itineraries?.[0]?.duration || '';
        return da.localeCompare(db);
      }
      if (currentSort === 'depart') {
        const ta = a.itineraries?.[0]?.segments?.[0]?.departure?.at || '';
        const tb = b.itineraries?.[0]?.segments?.[0]?.departure?.at || '';
        return ta.localeCompare(tb);
      }
      return 0;
    });
  }

  // ─── Render flight cards ─────────────────────────────────────
  function renderFlights() {
    const list = document.getElementById('flight-list');
    const count = document.getElementById('results-count');

    if (!filteredFlights.length) { showEmpty(); count.textContent = '0 flights'; return; }

    document.getElementById('results-empty').classList.add('hidden');
    count.textContent = `${filteredFlights.length} flight${filteredFlights.length !== 1 ? 's' : ''} found`;

    list.innerHTML = filteredFlights.map((flight, idx) => {
      const itin = flight.itineraries?.[0];
      const segs = itin?.segments || [];
      const firstSeg = segs[0];
      const lastSeg  = segs[segs.length - 1];
      const stops = segs.length - 1;
      const price = parseFloat(flight.price?.total || 0);
      const currency = flight.price?.currency || 'USD';
      const carrierCode = firstSeg?.carrierCode || '??';
      const flightNum = `${carrierCode}${firstSeg?.number || ''}`;
      const airlineName = flight._airlineName || carrierCode;
      const logoFallback = carrierCode.substring(0, 2);

      return `
      <div class="flight-card" data-idx="${idx}" role="article">
        <div class="flight-card-main">
          <!-- Airline -->
          <div class="airline-info">
            <div class="airline-logo" title="${escHtml(airlineName)}">
              <img src="https://content.airhex.com/content/logos/airlines_${carrierCode}_64_64_s.png"
                   alt="${escHtml(airlineName)}"
                   onerror="this.style.display='none';this.parentElement.textContent='${escHtml(logoFallback)}'">
            </div>
            <div class="airline-name">${escHtml(airlineName)}</div>
            <div class="flight-number">${escHtml(flightNum)}</div>
          </div>

          <!-- Route -->
          <div class="flight-route">
            <div class="route-time">
              <div class="route-time-value">${formatTime(firstSeg?.departure?.at)}</div>
              <div class="route-time-iata">${escHtml(firstSeg?.departure?.iataCode || '')}</div>
              <div class="route-time-city">${formatDate(firstSeg?.departure?.at?.substring(0,10))}</div>
            </div>
            <div class="route-middle">
              <div class="route-duration">${formatDuration(itin?.duration)}</div>
              <div class="route-line-wrapper"><div class="route-line"></div></div>
              <div class="route-stops-badge ${stopsClass(stops)}">${stopsLabel(stops)}</div>
            </div>
            <div class="route-time" style="text-align:right;">
              <div class="route-time-value">${formatTime(lastSeg?.arrival?.at)}</div>
              <div class="route-time-iata">${escHtml(lastSeg?.arrival?.iataCode || '')}</div>
              <div class="route-time-city">${formatDate(lastSeg?.arrival?.at?.substring(0,10))}</div>
            </div>
          </div>

          <!-- Price -->
          <div class="flight-price-area">
            <div>
              <div class="flight-fare">${formatCurrency(price, currency)}</div>
              <div class="flight-fare-label">per person</div>
            </div>
            <button class="btn-book-flight" data-idx="${idx}">Book Now</button>
          </div>
        </div>

        <div class="flight-card-footer">
          <div class="flight-badges">
            <span class="badge badge-sky">${escHtml(cabinClass.replace('_',' '))}</span>
            ${stops === 0 ? '<span class="badge badge-mint">Non-stop</span>' : ''}
            ${flight.numberOfBookableSeats ? `<span class="badge badge-amber">${flight.numberOfBookableSeats} seats left</span>` : ''}
          </div>
          <button class="flight-detail-toggle" data-idx="${idx}">Flight details ▾</button>
        </div>
      </div>`;
    }).join('');

    // Book now buttons
    list.querySelectorAll('.btn-book-flight').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        goToBooking(parseInt(btn.dataset.idx));
      });
    });

    // Card click → detail page
    list.querySelectorAll('.flight-card').forEach(card => {
      card.addEventListener('click', () => goToDetail(parseInt(card.dataset.idx)));
    });
    list.querySelectorAll('.flight-detail-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); goToDetail(parseInt(btn.dataset.idx)); });
    });
  }

  function goToDetail(idx) {
    const flight = filteredFlights[idx];
    sessionStorage.setItem('opseazy_selected_flight', JSON.stringify(flight));
    sessionStorage.setItem('opseazy_search_params', JSON.stringify(params));
    window.location.href = `/pages/flight-detail.html`;
  }

  function goToBooking(idx) {
    const flight = filteredFlights[idx];
    sessionStorage.setItem('opseazy_selected_flight', JSON.stringify(flight));
    sessionStorage.setItem('opseazy_search_params', JSON.stringify(params));
    window.location.href = `/pages/booking.html`;
  }

  // ─── Sort buttons ────────────────────────────────────────────
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSort = btn.dataset.sort;
      sortFlights();
      renderFlights();
    });
  });

  // ─── Price range ─────────────────────────────────────────────
  const priceRange = document.getElementById('price-range');
  priceRange.addEventListener('input', () => {
    const val = parseInt(priceRange.value);
    document.getElementById('price-range-value').textContent = val >= 5000 ? '$5000+' : `$${val}`;
    applyFiltersAndRender();
  });

  // ─── Stops checkboxes ────────────────────────────────────────
  document.querySelectorAll('input[name="stops"]').forEach(cb => {
    cb.addEventListener('change', applyFiltersAndRender);
  });

  // ─── Dep time checkboxes ─────────────────────────────────────
  document.querySelectorAll('input[name="deptime"]').forEach(cb => {
    cb.addEventListener('change', applyFiltersAndRender);
  });

  // ─── Reset filters ───────────────────────────────────────────
  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('price-range').value = 5000;
    document.getElementById('price-range-value').textContent = '$5000+';
    document.querySelectorAll('input[name="airline"]').forEach(cb => {
      cb.checked = true;
      activeAirlines.add(cb.value);
    });
    applyFiltersAndRender();
  });

  loadFlights();
});

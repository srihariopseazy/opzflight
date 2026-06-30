/**
 * Flight detail page controller + Google Maps integration
 */
document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar('');
  await Auth.tryRestoreSession();

  const flight = JSON.parse(sessionStorage.getItem('opseazy_selected_flight') || 'null');
  const searchParams = JSON.parse(sessionStorage.getItem('opseazy_search_params') || '{}');

  const loading = document.getElementById('detail-loading');
  const content = document.getElementById('detail-content');

  if (!flight) {
    loading.innerHTML = '<div class="empty-state"><div class="empty-icon">✈</div><h3>No flight selected</h3><p><a href="/">Go back to search</a></p></div>';
    return;
  }

  // Route header
  const origin = searchParams.origin || '???';
  const dest   = searchParams.dest   || '???';
  document.getElementById('detail-route-title').textContent = `${origin} → ${dest}`;
  document.getElementById('detail-meta').textContent =
    `${formatDate(searchParams.depart)} · ${searchParams.cabinClass?.replace('_',' ') || 'Economy'}`;

  // ─── Itinerary render ──────────────────────────────────────
  function renderItinerary(itin, legLabel) {
    const segs = itin.segments || [];
    let html = `<div class="segment-card"><div class="segment-header"><span class="segment-leg">${legLabel}</span>
      <span style="font-size:0.875rem;color:var(--color-gray-500);">${formatDuration(itin.duration)} total</span></div>
      <div class="segment-timeline">`;

    segs.forEach((seg, i) => {
      const depTime = formatTime(seg.departure?.at);
      const arrTime = formatTime(seg.arrival?.at);
      const depDate = formatDate(seg.departure?.at?.substring(0, 10));
      const arrDate = formatDate(seg.arrival?.at?.substring(0, 10));
      const isLast  = i === segs.length - 1;

      html += `
        <div class="timeline-stop" style="position:relative;">
          <div class="timeline-dot" style="top:6px;"></div>
          ${!isLast ? '<div class="timeline-line"></div>' : ''}
          <div style="padding-bottom:var(--space-3);">
            <div class="timeline-time">${depTime} <span style="font-size:0.8125rem;font-weight:500;color:var(--color-gray-400);">${depDate}</span></div>
            <div class="timeline-airport"><span class="timeline-iata">${seg.departure?.iataCode}</span> — ${seg.departure?.terminal ? 'Terminal ' + seg.departure.terminal : 'Terminal info N/A'}</div>
          </div>
          <div class="timeline-dur">
            <span>✈ ${escHtml(seg.carrierCode)}${escHtml(seg.number || '')} · ${formatDuration(seg.duration)} · ${escHtml(seg.aircraft?.code || 'Unknown aircraft')}</span>
          </div>
          <div style="padding-bottom:${isLast ? '0' : 'var(--space-4)'};">
            <div class="timeline-time">${arrTime} <span style="font-size:0.8125rem;font-weight:500;color:var(--color-gray-400);">${arrDate}</span></div>
            <div class="timeline-airport"><span class="timeline-iata">${seg.arrival?.iataCode}</span> — ${seg.arrival?.terminal ? 'Terminal ' + seg.arrival.terminal : 'Terminal info N/A'}</div>
          </div>
          ${!isLast ? `<div class="badge badge-amber" style="margin:var(--space-2) 0 var(--space-4);">Layover at ${seg.arrival?.iataCode}</div>` : ''}
        </div>`;
    });

    html += `</div></div>`;
    return html;
  }

  const itins = flight.itineraries || [];
  const itinSection = document.getElementById('itinerary-section');
  itinSection.innerHTML = itins.map((itin, i) =>
    renderItinerary(itin, i === 0 ? 'Outbound' : 'Return')
  ).join('');

  // ─── Fare breakdown ────────────────────────────────────────
  const price = flight.price || {};
  const total = parseFloat(price.total || 0);
  const base  = parseFloat(price.base  || 0);
  const taxes = total - base;
  const currency = price.currency || 'USD';
  const pax = parseInt(searchParams.adults || 1);

  document.getElementById('detail-total-fare').textContent = formatCurrency(total, currency);
  document.getElementById('detail-fare-sub').textContent   = `${pax} passenger${pax > 1 ? 's' : ''} · All taxes included`;
  document.getElementById('detail-fare-total').textContent = formatCurrency(total * pax, currency);

  const breakdown = document.getElementById('fare-breakdown');
  breakdown.innerHTML = `
    <div class="fare-row"><span>Base fare × ${pax}</span><span>${formatCurrency(base * pax, currency)}</span></div>
    <div class="fare-row"><span>Taxes & surcharges</span><span>${formatCurrency(taxes * pax, currency)}</span></div>
    ${flight.pricingOptions?.includedCheckedBagsOnly ? '<div class="fare-row"><span>Checked bags</span><span>Included</span></div>' : ''}
  `;

  // ─── Map ────────────────────────────────────────────────────
  // Fetch airport coordinates from our backend
  let originAirport = null, destAirport = null;
  try {
    const [oRes, dRes] = await Promise.all([
      api.get(`/airports/${origin}`),
      api.get(`/airports/${dest}`),
    ]);
    originAirport = oRes.airport;
    destAirport   = dRes.airport;
  } catch {}

  if (originAirport && destAirport) {
    const distKm = haversineKm(originAirport.lat, originAirport.lng, destAirport.lat, destAirport.lng);
    document.getElementById('map-distance').textContent = `${distKm.toLocaleString()} km`;
    document.getElementById('map-origin').textContent   = `${origin} — ${originAirport.name}`;
    document.getElementById('map-dest').textContent     = `${dest} — ${destAirport.name}`;

    // Load Google Maps key from backend config endpoint, then render map
    try {
      const cfgRes = await api.get('/config/maps-key');
      if (cfgRes.key) {
        loadGoogleMap(cfgRes.key, originAirport, destAirport);
      }
    } catch {
      // No maps key — show placeholder
    }
  }

  function loadGoogleMap(apiKey, origin, dest) {
    const placeholder = document.getElementById('map-placeholder');
    const mapEl = document.getElementById('flight-map');

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initFlightMap`;
    script.async = true;
    document.head.appendChild(script);

    window.initFlightMap = function () {
      placeholder.style.display = 'none';
      mapEl.style.display = 'block';

      const midLat = (parseFloat(origin.lat) + parseFloat(dest.lat)) / 2;
      const midLng = (parseFloat(origin.lng) + parseFloat(dest.lng)) / 2;

      const map = new google.maps.Map(mapEl, {
        center: { lat: midLat, lng: midLng },
        zoom: 3,
        mapTypeId: 'roadmap',
        styles: [{ featureType: 'water', stylers: [{ color: '#E0F2FE' }] }],
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
      });

      // Origin marker
      new google.maps.Marker({
        position: { lat: parseFloat(origin.lat), lng: parseFloat(origin.lng) },
        map,
        title: origin.name,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#4F46E5', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
        label: { text: origin.iata_code, color: '#fff', fontFamily: 'Plus Jakarta Sans', fontWeight: '700', fontSize: '10px' },
      });

      // Dest marker
      new google.maps.Marker({
        position: { lat: parseFloat(dest.lat), lng: parseFloat(dest.lng) },
        map,
        title: dest.name,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#F97316', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
        label: { text: dest.iata_code, color: '#fff', fontFamily: 'Plus Jakarta Sans', fontWeight: '700', fontSize: '10px' },
      });

      // Geodesic flight route line
      new google.maps.Polyline({
        path: [
          { lat: parseFloat(origin.lat), lng: parseFloat(origin.lng) },
          { lat: parseFloat(dest.lat),   lng: parseFloat(dest.lng) },
        ],
        geodesic: true,
        strokeColor: '#0EA5E9',
        strokeOpacity: 0.85,
        strokeWeight: 3,
        map,
        icons: [{
          icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, fillColor: '#0EA5E9', fillOpacity: 1, strokeWeight: 0 },
          offset: '50%',
        }],
      });

      // Auto-fit bounds
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: parseFloat(origin.lat), lng: parseFloat(origin.lng) });
      bounds.extend({ lat: parseFloat(dest.lat),   lng: parseFloat(dest.lng) });
      map.fitBounds(bounds, { padding: 60 });
    };
  }

  // ─── Proceed to booking ────────────────────────────────────
  document.getElementById('btn-proceed-booking').addEventListener('click', () => {
    if (!Auth.isLoggedIn()) {
      Toast.warning('Please log in to continue booking');
      setTimeout(() => { window.location.href = `/pages/login.html?redirect=${encodeURIComponent('/pages/booking.html')}`; }, 1200);
      return;
    }
    window.location.href = '/pages/booking.html';
  });

  loading.classList.add('hidden');
  content.classList.remove('hidden');
});

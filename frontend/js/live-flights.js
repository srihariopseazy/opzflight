/**
 * Live Airline Schedules — homepage section
 *
 * Fetches real scheduled flight data from AviationStack (via our backend)
 * for IndiGo (6E) and Air India (AI).
 *
 * This is REFERENCE DATA only — booking still runs through Duffel.
 */
(function () {
  const AIRLINES = ['6E', 'AI'];

  /* In-memory store for the fetched data, keyed by IATA */
  let _data = {};
  let _activeTab = AIRLINES[0];

  /* ── DOM refs (resolved after DOMContentLoaded) ────────────── */
  let grid, tabsEl;

  /* ── Helpers ────────────────────────────────────────────────── */
  function formatTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function formatDateShort(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function statusClass(status) {
    const map = {
      scheduled: 'lf-status-scheduled',
      active:    'lf-status-active',
      landed:    'lf-status-landed',
      cancelled: 'lf-status-cancelled',
      incident:  'lf-status-cancelled',
      diverted:  'lf-status-delayed',
    };
    return map[status] || 'lf-status-unknown';
  }

  function statusLabel(status, delayMin) {
    if (status === 'active')    return 'In Air';
    if (status === 'landed')    return 'Landed';
    if (status === 'cancelled') return 'Cancelled';
    if (status === 'diverted')  return 'Diverted';
    if (delayMin > 0)           return `+${delayMin}m`;
    return 'On Time';
  }

  /* ── Render ─────────────────────────────────────────────────── */
  function renderFlights(airlineIata) {
    const entry = _data[airlineIata];
    if (!entry) { renderLoading(); return; }

    if (entry.quota_exceeded) {
      grid.innerHTML = `
        <div class="live-quota">
          <div class="live-quota-icon">🔒</div>
          <h4>Monthly quota reached</h4>
          <p>AviationStack's free plan allows 100 requests/month. Upgrade your plan or wait until the quota resets.</p>
        </div>`;
      return;
    }

    if (entry.error && !entry.flights.length) {
      grid.innerHTML = `
        <div class="live-error">
          <div class="live-quota-icon">⚠️</div>
          <h4>Schedules unavailable</h4>
          <p>Could not reach AviationStack — check that AVIATIONSTACK_ACCESS_KEY is set and the service is reachable.</p>
        </div>`;
      return;
    }

    if (!entry.flights.length) {
      grid.innerHTML = `
        <div class="live-empty">
          <div class="live-empty-icon">🛫</div>
          <h4>No scheduled flights found</h4>
          <p>AviationStack returned no upcoming scheduled flights for ${entry.name}. Try again in a few minutes.</p>
        </div>`;
      return;
    }

    grid.innerHTML = entry.flights.map(f => {
      const depTime  = formatTime(f.scheduledDeparture);
      const arrTime  = formatTime(f.scheduledArrival);
      const depDate  = formatDateShort(f.scheduledDeparture);
      const sClass   = statusClass(f.status);
      const sLabel   = statusLabel(f.status, f.delayMinutes);

      return `
        <div class="lf-card" style="--airline-color:${entry.color}">
          <div class="lf-card-inner">
            <div class="lf-top">
              <div class="lf-airline">
                <div class="lf-airline-logo" style="background:${entry.color}">${escHtml(f.airline.iata)}</div>
                <span class="lf-airline-name">${escHtml(f.airline.name)}</span>
              </div>
              <span class="lf-flight-num">${escHtml(f.flightNumber)}</span>
            </div>

            <div class="lf-route">
              <span class="lf-iata">${escHtml(f.origin.iata)}</span>
              <div class="lf-route-line">
                <div class="lf-plane-icon">✈</div>
                <div class="lf-route-dash"></div>
              </div>
              <span class="lf-iata">${escHtml(f.destination.iata)}</span>
            </div>
            <div class="lf-airports">
              <span class="lf-airport-name">${escHtml(f.origin.name)}</span>
              <span class="lf-airport-name">${escHtml(f.destination.name)}</span>
            </div>

            <div class="lf-times">
              <div class="lf-time-group">
                <span class="lf-time-label">Departs</span>
                <span class="lf-time">${escHtml(depTime)}</span>
                <span class="lf-date">${escHtml(depDate)}</span>
              </div>
              <span class="lf-status ${sClass}">${escHtml(sLabel)}</span>
              <div class="lf-time-group" style="text-align:right">
                <span class="lf-time-label">Arrives</span>
                <span class="lf-time">${escHtml(arrTime)}</span>
              </div>
            </div>
          </div>
          <div style="position:absolute;top:0;left:0;bottom:0;width:4px;background:${entry.color};border-radius:var(--radius-xl) 0 0 var(--radius-xl);"></div>
        </div>`;
    }).join('');
  }

  function renderLoading() {
    grid.innerHTML = `
      <div class="live-loading">
        <div class="spinner spinner-dark"></div>
        <span style="color:var(--color-gray-400);font-size:0.875rem;">Loading schedules…</span>
      </div>`;
  }

  function activateTab(iata) {
    _activeTab = iata;
    tabsEl.querySelectorAll('.live-tab').forEach(btn => {
      const active = btn.dataset.iata === iata;
      btn.classList.toggle('active', active);
      if (active) {
        const entry = _data[iata];
        btn.style.background  = entry ? entry.color : '#64748B';
        btn.style.borderColor = entry ? entry.color : '#64748B';
      } else {
        btn.style.background  = '';
        btn.style.borderColor = '';
      }
    });
    renderFlights(iata);
  }

  /* ── Fetch ──────────────────────────────────────────────────── */
  async function loadSchedules() {
    renderLoading();
    try {
      const qs  = AIRLINES.map(a => `airline=${a}`).join('&');
      const res = await fetch(`/api/live-flights?${qs}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();

      (body.airlines || []).forEach(entry => {
        _data[entry.iata] = entry;
      });
    } catch (err) {
      console.warn('[live-flights] fetch failed:', err.message);
      /* Populate error state for all airlines so the UI can show it */
      AIRLINES.forEach(iata => {
        if (!_data[iata]) _data[iata] = { iata, name: iata, flights: [], error: err.message, color: '#64748B', accent: '#F1F5F9' };
      });
    }
    activateTab(_activeTab);
  }

  /* ── Bootstrap ──────────────────────────────────────────────── */
  function init() {
    const section = document.getElementById('live-section');
    if (!section) return;

    grid   = document.getElementById('live-grid');
    tabsEl = document.getElementById('live-tabs');

    tabsEl.addEventListener('click', e => {
      const tab = e.target.closest('.live-tab');
      if (tab) activateTab(tab.dataset.iata);
    });

    loadSchedules();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

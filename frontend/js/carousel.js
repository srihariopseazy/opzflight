/**
 * Upcoming Flights Carousel
 * Auto-slides every 4s, pauses on hover, responds to IntersectionObserver.
 * Manual prev/next arrows, progress dots. Fully static data.
 */
(function () {
  /* ── Static curated cards (Duffel test-compatible routes) ──────
     All prices already in INR — no conversion needed.           */
  const FLIGHTS = [
    { from: 'DEL', to: 'BOM', fromCity: 'Delhi',     toCity: 'Mumbai',      airline: 'IndiGo',            code: '6E', price: 3499,  stops: 0 },
    { from: 'BOM', to: 'BLR', fromCity: 'Mumbai',    toCity: 'Bengaluru',   airline: 'Air India',         code: 'AI', price: 2999,  stops: 0 },
    { from: 'DEL', to: 'MAA', fromCity: 'Delhi',     toCity: 'Chennai',     airline: 'SpiceJet',          code: 'SG', price: 4499,  stops: 1 },
    { from: 'DXB', to: 'SIN', fromCity: 'Dubai',     toCity: 'Singapore',   airline: 'Emirates',          code: 'EK', price: 14999, stops: 0 },
    { from: 'JFK', to: 'LAX', fromCity: 'New York',  toCity: 'Los Angeles', airline: 'United Airlines',   code: 'UA', price: 6799,  stops: 0 },
    { from: 'LHR', to: 'CDG', fromCity: 'London',    toCity: 'Paris',       airline: 'British Airways',   code: 'BA', price: 5499,  stops: 0 },
    { from: 'SIN', to: 'BKK', fromCity: 'Singapore', toCity: 'Bangkok',     airline: 'Singapore Airlines',code: 'SQ', price: 5199,  stops: 0 },
    { from: 'BLR', to: 'HYD', fromCity: 'Bengaluru', toCity: 'Hyderabad',  airline: 'IndiGo',            code: '6E', price: 1899,  stops: 0 },
    { from: 'DEL', to: 'GOI', fromCity: 'Delhi',     toCity: 'Goa',         airline: 'GoAir',             code: 'G8', price: 3999,  stops: 0 },
  ];

  function formatINR(amount) {
    if (typeof window.formatCurrency === 'function') return window.formatCurrency(amount, 'INR');
    return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
  }

  function buildCard(f) {
    const stopBadge = f.stops === 0
      ? `<span class="cc-stop-badge cc-stop-nonstop">Non-stop</span>`
      : `<span class="cc-stop-badge cc-stop-1">1 Stop</span>`;

    return `
      <div class="carousel-card" role="button" tabindex="0"
           data-from="${f.from}" data-to="${f.to}"
           aria-label="Fly ${f.fromCity} to ${f.toCity} from ${formatINR(f.price)}">
        <div class="cc-airline">
          <div class="cc-airline-logo">${f.code}</div>
          <span class="cc-airline-name">${f.airline}</span>
        </div>
        <div class="cc-route">
          <span class="cc-iata">${f.from}</span>
          <span class="cc-arrow">→</span>
          <span class="cc-iata">${f.to}</span>
        </div>
        <div class="cc-cities">${f.fromCity} → ${f.toCity}</div>
        <div class="cc-bottom">
          <div>
            <div class="cc-price-label">from</div>
            <div class="cc-price">${formatINR(f.price)}</div>
          </div>
          ${stopBadge}
        </div>
      </div>`;
  }

  function init() {
    const section   = document.getElementById('carousel-section');
    const track     = document.getElementById('carousel-track');
    const dotsWrap  = document.getElementById('carousel-dots');
    const prevBtn   = document.getElementById('carousel-prev');
    const nextBtn   = document.getElementById('carousel-next');
    if (!section || !track) return;

    /* ── Render cards ─────────────────────────────────────────── */
    track.innerHTML = FLIGHTS.map(buildCard).join('');
    dotsWrap.innerHTML = FLIGHTS.map((_, i) =>
      `<button class="carousel-dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Slide ${i + 1}"></button>`
    ).join('');

    /* ── State ────────────────────────────────────────────────── */
    let current    = 0;
    let autoTimer  = null;
    let isHovered  = false;
    let isVisible  = true;

    function visibleCount() {
      const w = section.offsetWidth;
      if (w >= 1024) return 4;
      if (w >= 768)  return 3;
      if (w >= 480)  return 2;
      return 1;
    }

    function maxIndex() {
      return Math.max(0, FLIGHTS.length - visibleCount());
    }

    function go(idx) {
      current = Math.min(Math.max(idx, 0), maxIndex());

      /* Pixel-based translate (accounts for gap=16px) */
      const cardEl  = track.firstElementChild;
      const cardW   = cardEl ? cardEl.offsetWidth + 16 : 0;
      track.style.transform = `translateX(-${current * cardW}px)`;

      /* Dots */
      dotsWrap.querySelectorAll('.carousel-dot').forEach((d, i) => {
        d.classList.toggle('active', i === current);
      });
    }

    function next() { go(current < maxIndex() ? current + 1 : 0); }
    function prev() { go(current > 0 ? current - 1 : maxIndex()); }

    /* ── Auto-slide ───────────────────────────────────────────── */
    function startAuto() {
      clearInterval(autoTimer);
      if (!isHovered && isVisible) autoTimer = setInterval(next, 4000);
    }
    function stopAuto() { clearInterval(autoTimer); }

    /* ── Hover pause ──────────────────────────────────────────── */
    section.addEventListener('mouseenter', () => { isHovered = true;  stopAuto(); });
    section.addEventListener('mouseleave', () => { isHovered = false; startAuto(); });

    /* ── IntersectionObserver (pause when off-screen) ─────────── */
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      isVisible ? startAuto() : stopAuto();
    }, { threshold: 0.25 });
    observer.observe(section);

    /* ── Buttons ──────────────────────────────────────────────── */
    nextBtn.addEventListener('click', () => { next(); startAuto(); });
    prevBtn.addEventListener('click', () => { prev(); startAuto(); });

    /* ── Dots ─────────────────────────────────────────────────── */
    dotsWrap.addEventListener('click', (e) => {
      const dot = e.target.closest('.carousel-dot');
      if (dot) { go(parseInt(dot.dataset.index, 10)); startAuto(); }
    });

    /* ── Card click → pre-fill search ────────────────────────── */
    track.addEventListener('click', (e) => {
      const card = e.target.closest('.carousel-card');
      if (!card) return;
      const { from, to } = card.dataset;
      /* setAirport is defined in home.js scope — use global bridge */
      if (typeof window._homeSetAirport === 'function') {
        window._homeSetAirport('origin', from, from);
        window._homeSetAirport('dest',   to,   to);
        document.getElementById('origin-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    track.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.target.closest('.carousel-card')?.click();
      }
    });

    /* ── Recalculate on resize ────────────────────────────────── */
    window.addEventListener('resize', () => go(current));

    startAuto();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

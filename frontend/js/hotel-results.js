document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar('');
  await Auth.tryRestoreSession();

  const p = getParams();
  const { city, checkin, checkout, guests = 2, rooms = 1 } = p;

  if (!city || !checkin || !checkout) {
    Toast.error('Missing search parameters');
    setTimeout(() => window.location.href = '/', 1500);
    return;
  }

  // Header
  document.getElementById('results-city-title').textContent = `Hotels in ${city}`;
  const nights = Math.ceil((new Date(checkout) - new Date(checkin)) / 86400000);
  document.getElementById('results-meta').textContent =
    `${formatDate(checkin)} → ${formatDate(checkout)}  ·  ${nights} night${nights !== 1 ? 's' : ''}  ·  ${guests} guest${guests > 1 ? 's' : ''}  ·  ${rooms} room${rooms > 1 ? 's' : ''}`;

  let allHotels = [];
  let activeStarFilter = 0;
  let activePriceMax   = 200000;

  function starsHtml(n) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function renderGrid(hotels) {
    const grid  = document.getElementById('hotel-grid');
    const count = document.getElementById('results-count');

    const filtered = hotels.filter(h => {
      if (activeStarFilter && h.star_rating !== activeStarFilter) return false;
      const price = parseFloat(h.min_price_per_night || 0);
      if (price > activePriceMax) return false;
      return true;
    });

    count.textContent = `${filtered.length} hotel${filtered.length !== 1 ? 's' : ''} found`;

    if (!filtered.length) {
      grid.innerHTML = '';
      document.getElementById('results-empty').classList.remove('hidden');
      return;
    }
    document.getElementById('results-empty').classList.add('hidden');

    grid.innerHTML = filtered.map(h => {
      const price = h.min_price_per_night
        ? `<div class="hotel-price-from">From per night</div>
           <div class="hotel-price-value">${formatCurrency(h.min_price_per_night, 'INR')}</div>`
        : `<div class="hotel-price-value" style="font-size:1rem;color:var(--color-gray-400);">Enquire</div>`;

      const amenities = (h.amenities || []).slice(0, 3).map(a =>
        `<span class="hotel-amenity-chip">${escHtml(a)}</span>`
      ).join('');

      const detailUrl = `/pages/hotel-detail.html?id=${h.id}&checkin=${checkin}&checkout=${checkout}&guests=${guests}&rooms=${rooms}`;

      return `
        <div class="hotel-card">
          <img class="hotel-card-img" src="${escHtml(h.thumb_url || 'https://picsum.photos/seed/hotel-default/800/500')}"
               alt="${escHtml(h.name)}" loading="lazy"
               onerror="this.src='https://picsum.photos/seed/hotel-fallback/800/500'">
          <div class="hotel-card-body">
            <div class="hotel-card-name">${escHtml(h.name)}</div>
            <div class="hotel-card-stars">${starsHtml(h.star_rating)}</div>
            <div class="hotel-card-city">📍 ${escHtml(h.city)}, ${escHtml(h.country)}</div>
            <div class="hotel-card-amenities">${amenities}</div>
            <div class="hotel-demo-pill">⚡ Demo · Simulated data</div>
          </div>
          <div class="hotel-card-footer">
            <div>
              ${price}
              <div class="hotel-price-night">/ night</div>
            </div>
            <a href="${escHtml(detailUrl)}" class="btn btn-primary">View Details →</a>
          </div>
        </div>`;
    }).join('');
  }

  // Star filter
  document.getElementById('star-filter-row').addEventListener('click', e => {
    const btn = e.target.closest('.filter-star-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-star-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeStarFilter = parseInt(btn.dataset.stars);
    renderGrid(allHotels);
  });

  // Price filter
  const priceSlider = document.getElementById('price-filter');
  const priceLabel  = document.getElementById('price-filter-label');
  priceSlider.addEventListener('input', () => {
    activePriceMax = parseInt(priceSlider.value);
    priceLabel.textContent = activePriceMax >= 200000 ? 'Any' : formatCurrency(activePriceMax, 'INR');
    renderGrid(allHotels);
  });

  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    activeStarFilter = 0;
    activePriceMax   = 200000;
    priceSlider.value = 200000;
    priceLabel.textContent = 'Any';
    document.querySelectorAll('.filter-star-btn').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
    });
    renderGrid(allHotels);
  });

  // Fetch results
  try {
    const data = await api.searchHotels({ city, checkin, checkout, guests, rooms });
    document.getElementById('results-loading').classList.add('hidden');
    allHotels = data.hotels || [];

    if (!allHotels.length) {
      document.getElementById('results-empty').classList.remove('hidden');
      return;
    }
    renderGrid(allHotels);
  } catch (err) {
    document.getElementById('results-loading').classList.add('hidden');
    Toast.error(err.message || 'Failed to load hotels');
    document.getElementById('results-empty').classList.remove('hidden');
  }
});

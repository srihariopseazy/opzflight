/**
 * Shared utilities — OPSEAZY frontend
 *
 * Currency: all prices are displayed in INR (₹) with Indian number formatting
 * (en-IN locale: 1,00,000 not 100,000).
 * If a non-INR amount arrives, it's converted using EXCHANGE_RATES_TO_INR
 * before display. These rates mirror backend/src/utils/currency.js — keep in sync.
 */

// ─── Exchange rates (INR = base) ─────────────────────────────
const EXCHANGE_RATES_TO_INR = {
  INR: 1.00,
  USD: 84.50,
  EUR: 91.20,
  GBP: 107.30,
  AED: 23.00,
  SGD: 63.00,
  AUD: 55.00,
  JPY: 0.56,
  CAD: 62.00,
  CHF: 95.00,
  HKD: 10.80,
  THB: 2.40,
  MYR: 19.00,
  QAR: 23.20,
  NZD: 51.00,
};

function convertToINR(amount, fromCurrency = 'USD') {
  const src = (fromCurrency || 'USD').toUpperCase().trim();
  const rate = EXCHANGE_RATES_TO_INR[src] ?? EXCHANGE_RATES_TO_INR.USD;
  return Math.round(parseFloat(amount || 0) * rate);
}

// Always displays in INR with Indian number formatting (₹12,499 / ₹1,00,000)
function formatCurrency(amount, fromCurrency = 'INR') {
  const inrAmount = convertToINR(amount, fromCurrency);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(inrAmount);
}

// Format ISO duration (PT2H30M → 2h 30m)
function formatDuration(iso) {
  if (!iso) return '--';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return iso;
  const h = parseInt(match[1] || 0);
  const m = parseInt(match[2] || 0);
  return h ? `${h}h ${m}m` : `${m}m`;
}

// Format date (2024-12-25 → Dec 25, 2024)
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// Format time from ISO datetime string
function formatTime(isoDateTime) {
  if (!isoDateTime) return '--';
  return isoDateTime.substring(11, 16);
}

// Format datetime (short date + time)
function formatDateTime(isoDateTime) {
  if (!isoDateTime) return '--';
  const d = new Date(isoDateTime);
  return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Debounce
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Parse URL search params
function getParams() {
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

// Haversine distance in km between two lat/lng points
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function stopsLabel(count) {
  if (count === 0) return 'Non-stop';
  if (count === 1) return '1 Stop';
  return `${count} Stops`;
}

function stopsClass(count) {
  if (count === 0) return 'nonstop';
  if (count === 1) return 'one-stop';
  return 'multi-stop';
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

function setButtonLoading(btn, loading, originalText) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> Loading…`;
  } else {
    btn.disabled = false;
    btn.innerHTML = originalText || btn.dataset.originalText || 'Submit';
  }
}

window.EXCHANGE_RATES_TO_INR = EXCHANGE_RATES_TO_INR;
window.convertToINR     = convertToINR;
window.formatCurrency   = formatCurrency;
window.formatDuration   = formatDuration;
window.formatDate       = formatDate;
window.formatTime       = formatTime;
window.formatDateTime   = formatDateTime;
window.debounce         = debounce;
window.getParams        = getParams;
window.haversineKm      = haversineKm;
window.stopsLabel       = stopsLabel;
window.stopsClass       = stopsClass;
window.escHtml          = escHtml;
window.setButtonLoading = setButtonLoading;

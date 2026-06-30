/**
 * Currency conversion utilities.
 * Duffel test-mode may return fares in GBP, USD, EUR, etc. depending on route origin.
 * All fares are normalised to INR before sending to the frontend.
 *
 * To update rates: change the values in EXCHANGE_RATES_TO_INR.
 * These are approximate mid-market rates (update periodically or replace with a
 * live FX feed in production).
 */

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

/**
 * Convert an amount from a given currency to INR.
 * Falls back to USD rate if the source currency is unknown.
 */
function toINR(amount, fromCurrency = 'USD') {
  const src = (fromCurrency || 'USD').toUpperCase().trim();
  const rate = EXCHANGE_RATES_TO_INR[src] ?? EXCHANGE_RATES_TO_INR.USD;
  return Math.round(parseFloat(amount) * rate);
}

module.exports = { EXCHANGE_RATES_TO_INR, toINR };

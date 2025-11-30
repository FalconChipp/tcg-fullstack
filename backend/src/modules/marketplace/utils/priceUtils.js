// backend/src/modules/marketplace/utils/priceUtils.js

/**
 * priceUtils
 * -----------------------------------------------------------------------------
 * Centralized helpers for money handling.
 * Your DB stores DECIMAL(12,2) as strings/decimals; Stripe needs integer minor units.
 * These helpers are safe and predictable.
 * -----------------------------------------------------------------------------
 */

/**
 * Convert decimal (e.g., "12.34" or 12.34) into minor units (pence) integer (1234).
 * Rounds to nearest penny to protect against FP rounding issues.
 */
export function decimalToMinorUnits(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${value}`);
  return Math.round(n * 100);
}

/**
 * Convert minor units integer (e.g., 1234) back to decimal string "12.34".
 */
export function minorUnitsToDecimal(minor) {
  const n = Number(minor);
  if (!Number.isFinite(n)) throw new Error(`Invalid minor units: ${minor}`);
  return (n / 100).toFixed(2);
}

/**
 * Format a decimal amount (string/number) with currency code, e.g. "£12.34".
 * Defaults to GBP. Uses Intl for consistent formatting.
 */
export function formatCurrency(amount, currency = 'GBP', locale = 'en-GB') {
  const n = Number(amount);
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${amount}`);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Sum decimal amounts safely (returns string with 2dp).
 * Accepts array of numbers/strings. Filters out null/undefined.
 */
export function sumDecimals(items = []) {
  const totalMinor = items
    .filter((v) => v !== null && v !== undefined)
    .map(decimalToMinorUnits)
    .reduce((acc, v) => acc + v, 0);

  return minorUnitsToDecimal(totalMinor);
}

/**
 * Apply a percentage (e.g., fee or tax) to a decimal amount.
 * pct as a number, e.g. 2.9 means 2.9%.
 */
export function applyPercent(amount, pct) {
  const baseMinor = decimalToMinorUnits(amount);
  const deltaMinor = Math.round(baseMinor * (pct / 100));
  return minorUnitsToDecimal(baseMinor + deltaMinor);
}

/**
 * Calculate a percentage of an amount, returned as decimal string.
 * Useful for showing fees/taxes separately.
 */
export function percentOf(amount, pct) {
  const baseMinor = decimalToMinorUnits(amount);
  const valueMinor = Math.round(baseMinor * (pct / 100));
  return minorUnitsToDecimal(valueMinor);
}

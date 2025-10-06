// src/modules/alerts/priceAlert.config.js
// Centralised defaults + helpers for price alert thresholds.

const FALLBACK_UP = 10;
const FALLBACK_DOWN = 10;

function parsePercent(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.abs(n);
}

const defaultPctUp = parsePercent(process.env.PRICE_ALERT_DEFAULT_PCT_UP, FALLBACK_UP);
const defaultPctDown = parsePercent(process.env.PRICE_ALERT_DEFAULT_PCT_DOWN, FALLBACK_DOWN);

export function getDefaultThresholds() {
  return {
    pctUp: defaultPctUp,
    pctDown: defaultPctDown,
  };
}

export function resolvePercentThreshold(condition, input) {
  const numeric = parsePercent(input, null);
  if (numeric != null) return numeric;
  if (condition === 'pct_down') return defaultPctDown;
  return defaultPctUp;
}

export function normalizeAlertOptions(options = {}) {
  const thresholds = getDefaultThresholds();
  const pctUp = parsePercent(options.pctUp, thresholds.pctUp);
  const pctDown = parsePercent(options.pctDown, thresholds.pctDown);
  return { pctUp, pctDown };
}

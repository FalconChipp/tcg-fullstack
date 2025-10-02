#!/usr/bin/env node
import 'dotenv/config';
import { refreshExchangeRates, getRates, toGBP } from '../../src/modules/marketdata/utils/exchangeRates.js';

(async () => {
  const rates = await refreshExchangeRates({ timeoutMs: 8000 });
  console.log('Fresh rates (per 1 USD):', rates);
  console.log('£ examples:');
  console.log('  $10  -> £', toGBP(10, 'USD'));
  console.log('  €10  -> £', toGBP(10, 'EUR'));
  console.log('  ¥500 -> £', toGBP(500, 'JPY'));
})();

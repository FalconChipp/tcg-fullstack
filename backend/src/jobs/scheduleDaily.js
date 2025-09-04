// src/jobs/scheduleDaily.js
import cron from 'node-cron';
import { refreshExchangeRates } from '../modules/search/api/exchangeRates.js';
import { updateCardPricesDaily } from './updateCardPricesDaily.js';

export function scheduleDailyJobs() {
  // Run at 03:05 every day (server local time)
  cron.schedule('5 3 * * *', async () => {
    try {
      console.log('[CRON] Refreshing exchange rates…');
      await refreshExchangeRates({ timeoutMs: 8000 });
      console.log('[CRON] Rates refreshed. Updating card prices…');
      await updateCardPricesDaily();
      console.log('[CRON] Daily price update complete.');
    } catch (e) {
      console.error('[CRON] Daily job failed:', e);
    }
  });
}

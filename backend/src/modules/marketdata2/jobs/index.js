// src/modules/marketdata2/jobs/index.js
import IngestSet from './ingestSet.job.js';
import CollectPrices from './collectPrices.job.js';
import CollectBoth from './collectBoth.job.js';
import PatchGaps from './patchGaps.job.js';
import PriceRollup from './priceRollup.job.js';

export default { IngestSet, CollectPrices, CollectBoth, PatchGaps, PriceRollup };

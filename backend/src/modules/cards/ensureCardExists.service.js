// CHANGED: ensures m_cards row exists; ingests set if needed

import { m_Card } from '../../models/index.js';
import { ingestSet } from '../cardsearch/jobs/ingestSet.job.js';

export async function ensureCardExists(cardId, { transaction } = {}) {
  if (!cardId) throw new Error('cardId required');
  const normalized = String(cardId).trim();
  if (!normalized) throw new Error('cardId required');

  const found = await m_Card.findByPk(normalized, { transaction });
  if (found) return found;

  const dashIndex = normalized.indexOf('-');
  if (dashIndex <= 0) throw new Error(`cannot infer set from ${normalized}`);
  const setCode = normalized.slice(0, dashIndex);

  await ingestSet({ set: setCode, refreshSet: true, logger: console });
  const after = await m_Card.findByPk(normalized, { transaction });
  if (!after) throw new Error(`not found after ingest: ${normalized}`);
  return after;
}

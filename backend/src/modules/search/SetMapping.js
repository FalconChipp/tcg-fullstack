// src/modules/search/SetMapping.js
// Minimal mapping shim so legacy search helpers still function.

import { ALIASES, resolveSet } from '../cardsearch/services/setMapping.service.js';

const SET_MAPPING = Object.create(null);
const synonymIndex = new Map();

function toLogo(tcgdex) {
  if (!tcgdex) return null;
  const base = String(tcgdex).toLowerCase();
  const familyMatch = base.match(/^([a-z]+)/);
  const family = familyMatch ? familyMatch[1] : base;
  return 'https://assets.tcgdex.net/en/' + family + '/' + base + '/symbol';
}

function normalize(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

function registerSynonym(entry, value) {
  if (!value) return;
  const raw = normalize(value);
  if (!raw) return;
  const variants = new Set([raw, raw.replace(/[\s._-]+/g, ''), raw.replace(/\./g, '')]);
  for (const token of variants) {
    entry.synonyms.add(token);
    if (!synonymIndex.has(token)) synonymIndex.set(token, entry.code);
  }
}

for (const [abbr, ids] of Object.entries(ALIASES)) {
  const resolved = resolveSet(abbr);
  const canonical = normalize(resolved?.tcgdex || ids.tcgdex || abbr);
  if (!canonical) continue;

  const entry = SET_MAPPING[canonical] || {
    code: canonical,
    abbr,
    tcgdex: ids.tcgdex || canonical,
    ptcg: ids.ptcg || null,
    name: abbr,
    logo: ids.tcgdex ? toLogo(ids.tcgdex) : null,
    synonyms: new Set(),
  };

  entry.abbr = entry.abbr || abbr;
  entry.tcgdex = entry.tcgdex || ids.tcgdex || canonical;
  entry.ptcg = entry.ptcg || ids.ptcg || null;
  if (!entry.logo && entry.tcgdex) entry.logo = toLogo(entry.tcgdex);

  registerSynonym(entry, abbr);
  registerSynonym(entry, ids.tcgdex);
  registerSynonym(entry, ids.ptcg);
  registerSynonym(entry, canonical);

  SET_MAPPING[canonical] = entry;
}

for (const entry of Object.values(SET_MAPPING)) {
  entry.synonyms = Array.from(entry.synonyms);
}

export function getSetCandidates(input) {
  const raw = normalize(input);
  if (!raw) return [];
  const candidates = new Set();
  const direct = synonymIndex.get(raw);
  if (direct) candidates.add(direct);
  const squished = raw.replace(/[\s._-]+/g, '');
  const squishedHit = synonymIndex.get(squished);
  if (squishedHit) candidates.add(squishedHit);
  const resolved = resolveSet(input);
  if (resolved?.tcgdex) candidates.add(normalize(resolved.tcgdex));
  return Array.from(candidates);
}

export { SET_MAPPING };




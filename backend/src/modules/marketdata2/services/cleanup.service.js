// src/modules/marketdata2/services/cleanup.service.js
// Safely delete MD2 caches (sets, cards, index) and recreate folders.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.env.MD2_DATA_ROOT
  ? path.resolve(process.env.MD2_DATA_ROOT)
  : path.resolve(process.cwd(), 'data', 'marketdata2');

const DIR_SETS  = path.join(ROOT, 'sets');
const DIR_CARDS = path.join(ROOT, 'cards');
const INDEX_NEW = path.join(ROOT, 'sets.index.json');
const INDEX_OLD = path.join(ROOT, 'index.json');

function exists(p){ try { fs.accessSync(p); return true; } catch { return false; } }

async function rmrf(p){
  await fsp.rm(p, { recursive: true, force: true }).catch(()=>{});
}

async function mkdirp(p){
  await fsp.mkdir(p, { recursive: true }).catch(()=>{});
}

export async function wipeCaches({
  includeIndex = true,
  includeSets  = true,
  includeCards = true,
} = {}) {
  const removed = { index:false, sets:false, cards:false };

  // remove index files
  if (includeIndex) {
    if (exists(INDEX_NEW)) { await rmrf(INDEX_NEW); removed.index = true; }
    if (exists(INDEX_OLD)) { await rmrf(INDEX_OLD); removed.index = true; }
  }

  // remove dirs
  if (includeSets)  { await rmrf(DIR_SETS);  removed.sets  = true; }
  if (includeCards) { await rmrf(DIR_CARDS); removed.cards = true; }

  // recreate clean tree
  await mkdirp(DIR_SETS);
  await mkdirp(DIR_CARDS);

  return {
    ok: true,
    removed,
    paths: { ROOT, DIR_SETS, DIR_CARDS, INDEX_NEW, INDEX_OLD },
    note: 'Caches wiped. Re-ingest sets to repopulate.',
  };
}

export default { wipeCaches };

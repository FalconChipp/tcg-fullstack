﻿// src/admin/adminScript.js
// ORIGINAL UI kept.
// FIXES (based on your sv08.json):
// - Code: uses `code` (falls back to setCode/id)
// - Name: uses top-level `name`
// - Abbr: uses `abbreviation.official`
// - Cards: uses `totalCardsComputed` (fallbacks to cards.length, officialCardCount, etc.)
// - Variants: sums cards[i].variants.length across the set
// - Cards last: uses `sourceAt`
// - Prices last: left blank unless backend provides a price timestamp
//
// Everything else (providers, FX, rules, logs, schedule fallback) unchanged.

export function adminScriptJs() {
  return `
const $  = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));

const state = {
  token: localStorage.getItem('md2_admin_token') || '',
  erasOrder: ['sv','swsh','sm','xy','bw','dp','ex','neo','gym','base','other'],
  socket: null,
  setsCache: []
};

const headers = () => state.token ? { 'x-admin-token': state.token } : {};

async function fetchJSON(url, opts={}, scope='') {
  let res, text;
  try {
    res  = await fetch(url, { ...opts, headers: { ...headers(), ...(opts.headers||{}) } });
    text = await res.text();
    if (!res.ok) {
      appendLog('warn', \`\${scope} \${res.status}: \${(text||'').slice(0,160)}\`);
      return { ok:false, data:null };
    }
    try { return { ok:true, data: JSON.parse(text) }; }
    catch { appendLog('warn', \`\${scope} 200 but invalid JSON\`); return { ok:false, data:null }; }
  } catch (e) {
    appendLog('err', \`\${scope} failed: \${String(e)}\`);
    return { ok:false, data:null };
  }
}

function setToast(text='Refreshed'){ const t=$('#toast'); t.textContent=text; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),900); }
function fmtDate(s){ if(!s) return ''; const d=new Date(s); return isNaN(+d)?'':d.toLocaleString(); }
function pick(){ for (let i=0;i<arguments.length;i++){ const v=arguments[i]; if (v!==undefined && v!==null && v!=='') return v; } return undefined; }
function detectEra(code=''){ const c=String(code).toLowerCase();
  if(c.startsWith('sv')) return 'sv'; if(c.startsWith('swsh')) return 'swsh'; if(c.startsWith('sm')) return 'sm';
  if(c.startsWith('xy')) return 'xy'; if(c.startsWith('bw')) return 'bw'; if(c.startsWith('dp')) return 'dp';
  if(c.startsWith('ex')) return 'ex'; if(c.startsWith('neo')) return 'neo'; if(c.startsWith('gym')) return 'gym';
  if(c.startsWith('base')) return 'base'; return 'other';
}
function groupByEra(items, getEra){ const m=new Map(); (items||[]).forEach(x=>{const e=getEra(x)||'other'; (m.get(e)||m.set(e,[]).get(e)).push(x);}); return m;}
function td(v, cls){ const e=document.createElement('td'); if(cls) e.className=cls; e.textContent = (v===0||v) ? String(v) : (v || '—'); return e; }
function buildTabs(container, eras, onPick){
  container.innerHTML = '';
  eras.forEach((era,i)=>{
    const b=document.createElement('button');
    b.className='tab'+(i===0?' active':''); b.dataset.era=era; b.textContent=era.toUpperCase();
    b.onclick = () => { $$('.tab', container).forEach(x=>x.classList.remove('active')); b.classList.add('active'); onPick(era); };
    container.appendChild(b);
  });
}

/* ---------------- Token / Top buttons ---------------- */
$('#admintoken').value = state.token;
$('#saveToken').onclick     = () => { state.token=$('#admintoken').value.trim(); localStorage.setItem('md2_admin_token', state.token); setToast('Saved token'); refreshAll(); };
$('#refreshAll').onclick    = () => refreshAll(true);
$('#fxRefresh').onclick     = async () => { await fetchJSON('/admin/md2/fx/refresh',{method:'POST'}, 'fx/refresh'); await loadFx(); setToast('FX refreshed'); };
$('#rollupRebuild').onclick = async () => { await fetchJSON('/admin/md2/rollups/rebuild',{method:'POST'}, 'rollups/rebuild'); setToast('Rollups rebuild started'); };

/* ---------------- Jobs ---------------- */
$('#btnIngest').onclick = () => runJob('ingest-set');
$('#btnPrices').onclick = () => runJob('collect-prices');
$('#btnBoth').onclick   = () => runJob('collect-both');

function runJob(kind){
  const setCode = $('#setCodeInput').value.trim();
  if(!setCode){ appendLog('warn','Please enter a set code'); return; }
  const url = (kind==='ingest-set') ? '/admin/md2/ingest-set'
            : (kind==='collect-prices') ? '/admin/md2/collect-prices'
            : '/admin/md2/collect-both';
  appendLog('info','▶ ' + kind + ' for ' + setCode);
  fetchJSON(url,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ setCode }) }, kind)
    .then(({ok,data}) => appendLog(ok ? 'ok':'err', ok ? 'started' : (data && data.error) || 'error'));
}

/* ---------------- Providers / FX / Rules ---------------- */
async function loadProviders(){
  const {ok, data} = await fetchJSON('/admin/md2/providers?t='+Date.now(), {}, 'providers');
  if (!ok) return;
  const list = data || [];
  const host = $('#providers'); host.innerHTML='';
  const table=document.createElement('table');
  table.innerHTML='<thead><tr><th>Provider</th><th>Status</th><th>Latency</th><th>Checked</th></tr></thead>';
  const tb=document.createElement('tbody');
  list.forEach(x=>{
    const tr=document.createElement('tr');
    tr.appendChild(td(x.name||''));
    tr.appendChild(td((x.ok?'OK':'Issue') + (x.message?' — '+x.message:''), x.ok?'ok':'err'));
    tr.appendChild(td(x.latencyMs!=null ? (x.latencyMs+' ms') : ''));
    tr.appendChild(td(fmtDate(x.checkedAt),'muted'));
    tb.appendChild(tr);
  });
  table.appendChild(tb); host.appendChild(table);
}

async function loadFx(){
  const {ok, data} = await fetchJSON('/admin/md2/fx?t='+Date.now(), {}, 'fx');
  if (!ok) return;
  const fx = data || {};
  const tb=$('#fxTable tbody'); tb.innerHTML='';
  Object.keys(fx).sort().forEach(k=>{ const tr=document.createElement('tr'); tr.appendChild(td(k)); tr.appendChild(td(String(fx[k]))); tb.appendChild(tr); });
}

async function loadRules(){
  const {ok, data} = await fetchJSON('/admin/md2/rules?t='+Date.now(), {}, 'rules');
  if (!ok) return;
  const ul=$('#rulesList'); ul.innerHTML='';
  (data||[]).forEach(s=>{ const li=document.createElement('li'); li.textContent=s; ul.appendChild(li); });
}

/* ---------------- Sets: map to your svXX JSON fields ---------------- */

// accept: [..], {sets:[..]}, {sets:{code:meta}}, {ok:true, sets:[..]|{..}}
function normalizeSetsPayload(j){
  if (Array.isArray(j)) return j;
  if (j && typeof j==='object') {
    if (Array.isArray(j.sets)) return j.sets;
    if (j.sets && typeof j.sets==='object')
      return Object.entries(j.sets).map(([code, meta]) => ({ code, ...meta }));
  }
  return [];
}

// CHANGED: compute variants from cards[].variants.length, prefer totalCardsComputed, name, and abbreviation.official
function mapSetRecord(raw){
  const code = pick(raw.setCode, raw.code, raw.id, '');
  const name = pick(raw.name, raw.title, raw.displayName, code); // ← use top-level name from your file
  const abbr = pick(
    raw.abbr,
    (raw.abbreviation && (raw.abbreviation.official || raw.abbreviation.short || raw.abbreviation.value)),
    raw.abbreviation, // if it’s a plain string on some sets
    ''
  );
  const era = pick(raw.era, detectEra(code));

  // Cards count
  const cardsFromArray = Array.isArray(raw.cards) ? raw.cards.length : undefined;
  const cards = pick(
    raw.totalCardsComputed,   // ← your file
    raw.totalCards,
    raw.officialCardCount,
    raw.cardsCount,
    raw.counts && raw.counts.cards,
    cardsFromArray
  );

  // Variants count (sum variants per card)
  let variantsComputed;
  if (Array.isArray(raw.cards)) {
    variantsComputed = raw.cards.reduce((acc, c) => acc + (Array.isArray(c?.variants) ? c.variants.length : 0), 0);
  }
  const variants = pick(
    raw.totalVariantsComputed,
    raw.variantsCount,
    raw.counts && raw.counts.variants,
    variantsComputed
  );

  // Last timestamps
  const cardsLast  = pick(raw.cardsLastIngestedAt, raw.lastIngestAt, raw.lastFetchedCardsAt, raw.cardsLast, raw.sourceAt /* ← your file */);
  const pricesLast = pick(raw.pricesLastFetchedAt, raw.lastPricesFetchedAt, raw.lastCollectAt, raw.pricesLast);

  return {
    ...raw,
    setCode: code,   // normalize for UI
    era,
    name,
    abbr: (typeof abbr === 'string') ? abbr : String(abbr || ''),
    cardsCount: (cards===undefined ? undefined : Number(cards)),
    variantsCount: (variants===undefined ? undefined : Number(variants)),
    _cardsLast: cardsLast,
    _pricesLast: pricesLast
  };
}

async function loadSets(){
  const {ok, data} = await fetchJSON('/admin/md2/sets?t='+Date.now(), {}, 'sets');
  if (!ok) { $('#setsEmpty').classList.remove('hide'); return; }

  let sets = normalizeSetsPayload(data).map(mapSetRecord);

  state.setsCache = sets.slice();

  const byEra = groupByEra(sets, x=>x.era);
  let eras = state.erasOrder.filter(e=>byEra.has(e))
              .concat(Array.from(byEra.keys()).filter(e=>!state.erasOrder.includes(e)));
  if (!eras.length && sets.length) eras = ['all'];

  $('#setsEmpty').classList.toggle('hide', sets.length>0);
  buildTabs($('#eraTabs'), eras, showEra);
  if (eras.length) renderEra(eras[0]);

  function renderEra(era){
    const host = $('#setsTables'); host.innerHTML='';
    const rows = (era==='all') ? sets : (byEra.get(era) || []);
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr>'
      + '<th>Code</th><th>Name</th><th>Abbr</th>'
      + '<th class="muted">Cards</th><th class="muted">Variants</th>'
      + '<th>Cards last</th><th>Prices last</th>'
      + '</tr></thead>';
    const tb = document.createElement('tbody');
    rows.forEach(s=>{
      const tr=document.createElement('tr');
      tr.appendChild(td(s.setCode || ''));
      tr.appendChild(td(s.name || s.setCode));
      tr.appendChild(td(s.abbr || ''));
      tr.appendChild(td(s.cardsCount, 'muted'));
      tr.appendChild(td(s.variantsCount, 'muted'));
      tr.appendChild(td(fmtDate(s._cardsLast), 'muted'));
      tr.appendChild(td(fmtDate(s._pricesLast), 'muted'));
      tb.appendChild(tr);
    });
    table.appendChild(tb); host.appendChild(table);
  }
  function showEra(e){ renderEra(e); }
  $$('#eraTabs .tab').forEach(b => b.onclick = () => {
    $$('#eraTabs .tab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); showEra(b.dataset.era);
  });
}

/* ---------------- Schedule: preview + sets fallback ---------------- */
function normalizeSchedulePayload(j){
  if (Array.isArray(j)) return j;
  if (j && typeof j==='object' && Array.isArray(j.orderedSets)) return j.orderedSets;
  return [];
}

async function loadSchedule(){
  const {ok, data} = await fetchJSON('/admin/md2/schedule?t='+Date.now(), {}, 'schedule');
  let ordered = ok ? normalizeSchedulePayload(data) : [];

  if (!ordered.length && state.setsCache.length){
    const t = v => v ? Date.parse(v) : Number.POSITIVE_INFINITY;
    ordered = state.setsCache.map(s => ({
      era: s.era || detectEra(s.setCode),
      set: s.setCode,
      nextFetchAt: pick(s.cardsNextScheduledAt, s.nextFetchAt),
      nextCollectAt: pick(s.pricesNextScheduledAt, s.nextCollectAt),
    }))
    .sort((a,b)=> (t(a.nextCollectAt)-t(b.nextCollectAt)) || (t(a.nextFetchAt)-t(b.nextFetchAt)) || String(a.set).localeCompare(String(b.set)));
  }

  const byEra = groupByEra(ordered, x => x.era || detectEra(x.set || x.setCode));
  let eras = state.erasOrder.filter(e=>byEra.has(e))
              .concat(Array.from(byEra.keys()).filter(e=>!state.erasOrder.includes(e)));
  if (!eras.length && ordered.length) eras = ['all'];

  $('#scheduleEmpty').classList.toggle('hide', ordered.length>0);
  buildTabs($('#schEraTabs'), eras, showEra);
  if (eras.length) renderEra(eras[0]);

  function renderEra(era){
    const host = $('#scheduleTables'); host.innerHTML='';
    const rows = (era==='all') ? ordered : (byEra.get(era) || []);
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>#</th><th>Set</th><th>Next cards</th><th>Next prices</th></tr></thead>';
    const tb = document.createElement('tbody');
    rows.forEach((r,i)=>{
      const tr=document.createElement('tr');
      tr.appendChild(td(String(i+1)));
      tr.appendChild(td(r.set || r.setCode || ''));
      tr.appendChild(td(fmtDate(r.nextFetchAt),'muted'));
      tr.appendChild(td(fmtDate(r.nextCollectAt),'muted'));
      tb.appendChild(tr);
    });
    table.appendChild(tb); host.appendChild(table);
  }
  function showEra(e){ renderEra(e); }
  $$('#schEraTabs .tab').forEach(b => b.onclick = () => {
    $$('#schEraTabs .tab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); showEra(b.dataset.era);
  });
}

/* ---------------- Logs ---------------- */
const logEl = $('#liveLog');
function appendLog(level, msg, scope){
  const ts=new Date().toLocaleTimeString();
  logEl.textContent += '['+ts+'] ['+(String(level||'info').toUpperCase())+']'+(scope?' ['+scope+']':'')+' '+(msg||'')+'\\n';
  logEl.scrollTop = logEl.scrollHeight;
}
function connectSocket(){
  try{
    const s = io();
    state.socket = s;
    s.on('connect', ()=>appendLog('ok','socket connected'));
    s.on('disconnect', ()=>appendLog('warn','socket disconnected'));
    s.on('md2:log', e=>{ if(!e) return; appendLog(e.level||'info', e.msg||e.message||'', e.scope||null); });
  }catch(e){ appendLog('warn','socket init failed: ' + String(e)); }
}

/* ---------------- Boot ---------------- */
connectSocket();
refreshAll(true);
setInterval(()=>refreshAll(false), 15000);

async function refreshAll(showToast){
  await Promise.all([loadProviders(), loadFx(), loadRules(), loadSets(), loadSchedule()]);
  if (showToast) setToast('Panels refreshed');
}
`;
}

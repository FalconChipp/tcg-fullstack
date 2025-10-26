// src/admin/adminScript.js
// Cardsearch-focused admin client script for the redesigned UI.

export function adminScriptJs() {
  return `
const BASE = '/admin/cardsearch';
const TOKEN_KEY = 'CARDSEARCH_ADMIN_TOKEN';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  tasks: [],
  sets: [],
  fx: null,
};

const els = {
  tokenInput: $('#admintoken'),
  saveToken: $('#saveToken'),
  refreshAll: $('#refreshAll'),
  fxDaily: $('#fxRefresh'),
  rollups: $('#rollupRebuild'),
  toast: $('#toast'),
  lastRefresh: $('#lastRefreshValue'),
  setsSummary: $('#setsSnapshot'),
  tasksSummary: $('#scheduleSnapshot'),
  schedulerSummary: $('#providersSnapshot'),
  log: $('#liveLog'),
};

const headers = () => (state.token ? { 'x-admin-token': state.token } : {});

async function fetchJSON(url, opts = {}, scope = '') {
  let res;
  let text;
  try {
    res = await fetch(url, {
      cache: 'no-store',
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...headers(),
        ...(opts.headers || {}),
      },
    });
    text = await res.text();
    if (!res.ok) {
      appendLog('warn', \`\${scope} \${res.status}: \${(text || '').slice(0, 180)}\`);
      throw new Error(\`HTTP \${res.status}\`);
    }
    if (!text) return null;
    try { return JSON.parse(text); }
    catch {
      appendLog('warn', \`\${scope} returned non-JSON payload\`);
      return text;
    }
  } catch (error) {
    const message = error?.message || String(error);
    appendLog('err', \`\${scope} failed: \${message}\`);
    throw error;
  }
}

function setToast(message = 'Refreshed', tone = 'ok') {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.remove('ok', 'warn', 'err');
  els.toast.classList.add('show', tone);
  setTimeout(() => els.toast?.classList.remove('show'), 1200);
}

function appendLog(level, message) {
  if (!els.log) return;
  const ts = new Date().toLocaleTimeString();
  els.log.textContent += \`[\${ts}] [\${String(level || 'info').toUpperCase()}] \${message || ''}\n\`;
  els.log.scrollTop = els.log.scrollHeight;
}

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(+d) ? '' : d.toLocaleString();
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(+d) ? null : d;
}

function timeAgo(value) {
  const d = toDate(value);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 0) return 'future';
  const mins = Math.round(diff / 6e4);
  if (mins < 1) return 'just now';
  if (mins < 60) return \`\${mins}m ago\`;
  const hours = Math.round(diff / 36e5);
  if (hours < 48) return \`\${hours}h ago\`;
  const days = Math.round(diff / 8.64e7);
  return \`\${days}d ago\`;
}

function timeUntil(value) {
  const d = toDate(value);
  if (!d) return '';
  const diff = d.getTime() - Date.now();
  if (diff < 0) return 'overdue';
  const mins = Math.round(diff / 6e4);
  if (mins < 1) return 'now';
  if (mins < 60) return \`\${mins}m\`;
  const hours = Math.round(diff / 36e5);
  if (hours < 48) return \`\${hours}h\`;
  const days = Math.round(diff / 8.64e7);
  return \`\${days}d\`;
}

function titleize(value) {
  if (!value) return '';
  return String(value)
    .replace(/[_:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function formatNumber(value) {
  if (value === undefined || value === null) return '0';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString();
}

function renderSummary(host, items) {
  if (!host) return;
  host.innerHTML = '';
  if (!items || !items.length) {
    const span = document.createElement('span');
    span.className = 'mini';
    span.textContent = 'Waiting for data';
    host.appendChild(span);
    return;
  }
  items.forEach((item) => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (item.tone ? \` \${item.tone}\` : '');
    const val = document.createElement('strong');
    val.textContent = item.value;
    chip.appendChild(val);
    const label = document.createElement('span');
    label.textContent = item.label;
    chip.appendChild(label);
    if (item.meta) {
      const meta = document.createElement('small');
      meta.textContent = item.meta;
      chip.appendChild(meta);
    }
    host.appendChild(chip);
  });
}

function setsSummaryData(sets) {
  if (!sets.length) return [];
  const enabled = sets.filter((s) => s.enabled).length;
  const disabled = sets.length - enabled;
  const latest = sets[0];
  return [
    { value: formatNumber(sets.length), label: 'Total sets', meta: 'Cardsearch catalogue' },
    { value: formatNumber(enabled), label: 'Enabled', tone: disabled ? 'warn' : '', meta: disabled ? \`\${disabled} disabled\` : 'All active' },
    disabled ? { value: formatNumber(disabled), label: 'Disabled', tone: 'warn', meta: 'Review coverage' } : null,
    latest ? { value: latest.releasedAt ? latest.releasedAt.slice(0, 10) : '--', label: 'Latest release', meta: latest.code || '' } : null,
  ].filter(Boolean);
}

function scheduleSummaryData(tasks) {
  if (!tasks.length) return [];
  const cronTasks = tasks.filter((t) => t.plan?.kind === 'cron');
  const paused = cronTasks.filter((t) => t.status === 'paused').length;
  const running = tasks.filter((t) => t.status === 'running').length;
  const errorCount = tasks.filter((t) => t.status === 'error').length;
  const nextTimes = tasks
    .map((t) => toDate(t.nextRunAt))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  const next = nextTimes[0];
  return [
    { value: formatNumber(tasks.length), label: 'Total tasks', meta: \`\${formatNumber(cronTasks.length)} cron\` },
    { value: formatNumber(running), label: 'Running now', tone: running ? 'warn' : '', meta: running ? 'Active execution' : 'Idle' },
    { value: formatNumber(paused), label: 'Paused', tone: paused ? 'warn' : '', meta: paused ? 'Temporarily disabled' : 'All enabled' },
    errorCount ? { value: formatNumber(errorCount), label: 'Errors', tone: 'danger', meta: 'Last check' } : null,
    next ? { value: timeUntil(next), label: 'Next run', meta: next.toLocaleString() } : null,
  ].filter(Boolean);
}

function schedulerSnapshotRows(tasks) {
  const host = $('#providers');
  if (!host) return;
  host.innerHTML = '';
  if (!tasks.length) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.textContent = 'No tasks registered.';
    host.appendChild(div);
    return;
  }
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Task</th><th>Status</th><th>Next</th></tr></thead>';
  const tbody = document.createElement('tbody');
  tasks.slice(0, 8).forEach((task) => {
    const tr = document.createElement('tr');
    const name = titleize(task.name || task.id);
    tr.appendChild(td(name));
    tr.appendChild(td(task.status ? titleize(task.status) : '-', task.status === 'error' ? 'err' : task.status === 'paused' ? 'warn' : 'muted'));
    tr.appendChild(td(task.nextRunAt ? fmtDate(task.nextRunAt) : '-', 'muted'));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  host.appendChild(table);
}

function renderCronList(tasks) {
  const list = $('#rulesList');
  if (!list) return;
  list.innerHTML = '';
  if (!tasks.length) {
    const li = document.createElement('li');
    li.textContent = 'No cron tasks configured.';
    list.appendChild(li);
    return;
  }
  tasks
    .filter((task) => task.plan?.kind === 'cron')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .slice(0, 12)
    .forEach((task) => {
      const li = document.createElement('li');
      const expr = task.plan?.cronExp || '';
      const tz = task.plan?.timezone ? \` (\${task.plan.timezone})\` : '';
      li.innerHTML = \`<strong>\${titleize(task.name || task.id)}</strong> ? \${expr || 'custom'}\${tz}\`;
      list.appendChild(li);
    });
}

function td(value, cls) {
  const el = document.createElement('td');
  if (cls) el.className = cls;
  el.textContent = value ?? '';
  return el;
}

async function loadSets() {
  try {
    const data = await fetchJSON(\`\${BASE}/sets?limit=500\`, {}, 'sets');
    const sets = Array.isArray(data) ? data : [];
    state.sets = sets;
    renderSummary(els.setsSummary, setsSummaryData(sets));
    renderSetsTable(sets);
  } catch (error) {
    renderSummary(els.setsSummary, []);
    $('#setsTables')?.replaceChildren();
  }
}

function renderSetsTable(sets) {
  const container = $('#setsTables');
  if (!container) return;
  container.innerHTML = '';
  if (!sets.length) {
    return;
  }
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Code</th><th>Name</th><th>Abbr</th><th>Total</th><th>Status</th><th>Action</th></tr></thead>';
  const tbody = document.createElement('tbody');
  sets.forEach((set) => {
    const tr = document.createElement('tr');
    tr.appendChild(td(set.code || ''));
    tr.appendChild(td(set.name || set.code || ''));
    tr.appendChild(td(set.abbr || ''));
    tr.appendChild(td(set.total != null ? formatNumber(set.total) : '-', 'muted'));
    const status = set.enabled ? 'Enabled' : 'Disabled';
    tr.appendChild(td(status, set.enabled ? 'ok' : 'warn'));
    const actionCell = document.createElement('td');
    const btn = document.createElement('button');
    btn.className = 'btn secondary';
    btn.textContent = set.enabled ? 'Disable' : 'Enable';
    btn.dataset.setCode = set.code;
    btn.dataset.enabled = set.enabled ? '1' : '0';
    actionCell.appendChild(btn);
    tr.appendChild(actionCell);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

async function toggleSet(code, enable) {
  const res = await fetchJSON(\`\${BASE}/sets/toggle\`, {
    method: 'POST',
    body: JSON.stringify({ code, enabled: enable }),
  }, \`sets.toggle:\${code}\`);
  const payload = res && typeof res === 'object' ? res.set || res : null;
  appendLog('info', \`\${enable ? 'Enabled' : 'Disabled'} set \${code}\`);
  setToast(enable ? \`Enabled \${code}\` : \`Disabled \${code}\`, enable ? 'ok' : 'warn');
  await loadSets();
  return payload;
}

async function loadTasks() {
  try {
    const data = await fetchJSON(\`\${BASE}/scheduler/tasks\`, {}, 'tasks');
    const tasks = Array.isArray(data) ? data : [];
    state.tasks = tasks;
    renderSummary(els.tasksSummary, scheduleSummaryData(tasks));
    renderSummary(els.schedulerSummary, scheduleSummaryData(tasks));
    schedulerSnapshotRows(tasks);
    renderCronList(tasks);
    renderTasksTable(tasks);
  } catch (error) {
    renderSummary(els.tasksSummary, []);
    renderSummary(els.schedulerSummary, []);
    $('#scheduleTables')?.replaceChildren();
    $('#providers')?.replaceChildren();
    $('#rulesList')?.replaceChildren();
  }
}

function taskScope(task) {
  const scope = [];
  if (Array.isArray(task.payload?.sets) && task.payload.sets.length) scope.push(task.payload.sets.join(', '));
  if (task.payload?.set) scope.push(task.payload.set);
  if (task.payload?.scope && task.payload.scope !== 'all') scope.push(task.payload.scope);
  return scope.length ? scope.join(' | ') : '-';
}

function taskSchedule(task) {
  if (task.plan?.kind === 'cron') return task.plan?.cronExp || 'cron';
  if (task.plan?.kind === 'once') return 'one-off';
  return task.plan?.kind || 'adhoc';
}

function renderTasksTable(tasks) {
  const container = $('#scheduleTables');
  if (!container) return;
  container.innerHTML = '';
  if (!tasks.length) return;
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>#</th><th>Task</th><th>Scope</th><th>Schedule</th><th>Next run</th><th>Last run</th><th>Status</th><th>Actions</th></tr></thead>';
  const tbody = document.createElement('tbody');
  tasks.forEach((task, idx) => {
    const tr = document.createElement('tr');
    tr.appendChild(td(String(idx + 1)));
    tr.appendChild(td(titleize(task.name || task.id)));
    tr.appendChild(td(taskScope(task)));
    tr.appendChild(td(taskSchedule(task), 'muted'));
    const nextCell = td(task.nextRunAt ? fmtDate(task.nextRunAt) : '-', 'muted');
    nextCell.title = task.nextRunAt ? fmtDate(task.nextRunAt) : '';
    tr.appendChild(nextCell);
    const lastCell = td(task.lastRunAt ? timeAgo(task.lastRunAt) : '-', 'muted');
    lastCell.title = task.lastRunAt ? fmtDate(task.lastRunAt) : '';
    tr.appendChild(lastCell);
    const statusClass = task.status === 'error' ? 'err' : task.status === 'paused' ? 'warn' : 'ok';
    tr.appendChild(td(titleize(task.status || 'unknown'), statusClass));
    const actions = document.createElement('td');
    actions.className = 'row';
    const runBtn = document.createElement('button');
    runBtn.className = 'btn secondary';
    runBtn.textContent = 'Run';
    runBtn.dataset.action = 'run';
    runBtn.dataset.taskId = task.id;
    actions.appendChild(runBtn);
    if (task.plan?.kind === 'cron') {

      const editBtn = document.createElement('button');

      editBtn.className = 'btn secondary';

      editBtn.textContent = 'Edit';

      editBtn.dataset.action = 'edit';

      editBtn.dataset.taskId = task.id;

      actions.appendChild(editBtn);



      const toggleBtn = document.createElement('button');

      toggleBtn.className = 'btn secondary';

      toggleBtn.textContent = task.status === 'paused' ? 'Resume' : 'Pause';

      toggleBtn.dataset.action = task.status === 'paused' ? 'resume' : 'pause';

      toggleBtn.dataset.taskId = task.id;

      actions.appendChild(toggleBtn);

    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn secondary';
    deleteBtn.textContent = 'Delete';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.dataset.taskId = task.id;
    actions.appendChild(deleteBtn);
    tr.appendChild(actions);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

async function editTask(id) {

  const task = state.tasks.find((t) => t.id === id);

  if (!task) {

    setToast('Task not found', 'warn');

    return;

  }

  if (task.plan?.kind !== 'cron') {

    setToast('Only cron tasks can be edited here', 'warn');

    return;

  }

  const currentCron = task.plan?.cronExp || '';

  const cronInput = prompt('Cron expression (required)', currentCron);

  if (cronInput === null) return;

  const cronExp = cronInput.trim();

  if (!cronExp) {

    setToast('Cron expression is required', 'warn');

    return;

  }

  const timezoneInput = prompt('Timezone (optional, e.g. UTC)', task.plan?.timezone || '');

  if (timezoneInput === null) return;

  const descriptionInput = prompt('Description (optional)', task.plan?.description || '');

  if (descriptionInput === null) return;

  const enabledInput = prompt('Enable task? (yes/no)', task.status === 'paused' ? 'no' : 'yes');

  if (enabledInput === null) return;

  const timezone = timezoneInput.trim();

  const description = descriptionInput.trim();

  const enabled = enabledInput.trim().toLowerCase() !== 'no';

  try {

    await fetchJSON(BASE + '/scheduler/' + id, {

      method: 'PUT',

      body: JSON.stringify({

        cronExp,

        timezone: timezone ? timezone : null,

        description: description ? description : null,

        enabled,

      }),

    }, 'task.update');

    appendLog('ok', 'Updated task ' + id);

    setToast('Task updated', 'ok');

    await loadTasks();

  } catch (error) {

    appendLog('err', error.message || String(error));

    setToast('Failed to update task', 'err');

  }

}



async function taskAction(action, id) {
  if (action === 'edit') {

    await editTask(id);

    return;

  }

  let method = 'POST';
  let path = '';
  switch (action) {
    case 'run':
      path = \`/scheduler/run-now/\${id}\`;
      break;
    case 'pause':
      path = \`/scheduler/pause/\${id}\`;
      break;
    case 'resume':
      path = \`/scheduler/resume/\${id}\`;
      break;
    case 'delete':
      method = 'DELETE';
      path = \`/scheduler/\${id}\`;
      break;
    default:
      throw new Error(\`Unknown task action: \${action}\`);
  }
  await fetchJSON(\`\${BASE}\${path}\`, { method }, \`task.\${action}\`);
  appendLog('info', \`\${action} task \${id}\`);
  setToast(\`Task \${action}\`, 'ok');
  await loadTasks();
}

async function loadFx() {
  try {
    const data = await fetchJSON(\`\${BASE}/fx/rates\`, {}, 'fx');
    state.fx = data;
    const tbody = $('#fxTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!data || !data.rates) {
      return;
    }
    const entries = Object.entries(data.rates).sort(([a], [b]) => a.localeCompare(b));
    entries.forEach(([ccy, rate]) => {
      const tr = document.createElement('tr');
      tr.appendChild(td(ccy));
      tr.appendChild(td(typeof rate === 'number' ? rate.toFixed(6) : String(rate)));
      tbody.appendChild(tr);
    });
  } catch (error) {
    const tbody = $('#fxTable tbody');
    if (tbody) tbody.innerHTML = '';
  }
}

async function runJob(kind, payload = {}, label = kind) {
  const started = Date.now();
  try {
    appendLog('info', \`Job \${label} requested\`);
    const body = { kind, ...payload };
    appendLog('info', \`Job \${label} running...\`);
    const response = await fetchJSON(\`\${BASE}/run-job\`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, \`job:\${kind}\`);
    const elapsedMs = Date.now() - started;
    const human = elapsedMs >= 1000 ? \`\${(elapsedMs / 1000).toFixed(1)}s\` : \`\${elapsedMs}ms\`;
    appendLog('ok', \`Job \${label} completed in \${human}\`);
    const summary = summarizeJobResult(response?.result);
    if (summary) appendLog('info', summary);
    setToast(\`Completed \${label}\`, 'ok');
    return response;
  } catch (error) {
    setToast(\`Job \${label} failed\`, 'err');
    throw error;
  }
}

function summarizeJobResult(result) {
  if (!result || typeof result !== 'object') return '';
  if (result.error) return \`Error: \${result.error}\`;
  const counts = result.counts;
  if (counts && typeof counts === 'object') {
    const cards = counts.cards || {};
    const variants = counts.variants || {};
    const cardDeletes = cards.deleted || cards.removed || 0;
    const cardSummary = cardDeletes
      ? \`cards +\${cards.inserted || 0}/\${cards.updated || 0}/-\${cardDeletes}\`
      : \`cards +\${cards.inserted || 0}/\${cards.updated || 0}\`;
    const variantAdds = variants.upserted || 0;
    const variantDeletes = variants.deletedStale || variants.removed || 0;
    const variantSummary = variantDeletes
      ? \`variants +\${variantAdds}/-\${variantDeletes}\`
      : \`variants +\${variantAdds}\`;
    return \`\${cardSummary}, \${variantSummary}\`;
  }
  try {
    const json = JSON.stringify(result);
    if (!json || json === '{}' || json === '[]') return '';
    return json.length > 160 ? \`Result: \${json.slice(0, 160)}...\` : \`Result: \${json}\`;
  } catch {
    return '';
  }
}

function bindTokenHandlers() {
  if (els.tokenInput) els.tokenInput.value = state.token;
  els.saveToken?.addEventListener('click', () => {
    state.token = (els.tokenInput?.value || '').trim();
    localStorage.setItem(TOKEN_KEY, state.token);
    setToast('Token saved', 'ok');
    refreshAll(false);
  });
}

function bindQuickActions() {
  els.refreshAll?.addEventListener('click', () => refreshAll(true));
  els.fxDaily?.addEventListener('click', () => runJob('FX_DAILY', { backfillFxDays: 0 }, 'FX daily').catch((err) => appendLog('err', err.message)));
  els.rollups?.addEventListener('click', () => runJob('ROLLUP_ALL', { scope: 'all' }, 'Rollup all').catch((err) => appendLog('err', err.message)));

  $('#btnIngest')?.addEventListener('click', () => {
    const set = ($('#setCodeInput')?.value || '').trim();
    if (!set) return setToast('Enter a set code', 'warn');
    runJob('INGEST_SET', { set }, \`Ingest \${set}\`).catch((err) => appendLog('err', err.message));
  });

  $('#btnPrices')?.addEventListener('click', () => {
    const set = ($('#setCodeInput')?.value || '').trim();
    if (!set) return setToast('Enter a set code', 'warn');
    runJob('COLLECT_PRICES', { set }, \`Collect \${set}\`).catch((err) => appendLog('err', err.message));
  });

  $('#btnBoth')?.addEventListener('click', async () => {
    const set = ($('#setCodeInput')?.value || '').trim();
    if (!set) return setToast('Enter a set code', 'warn');
    try {
      await runJob('INGEST_SET', { set }, \`Ingest \${set}\`);
      await runJob('COLLECT_PRICES', { set, prewarmFx: true }, \`Collect \${set}\`);
    } catch (err) {
      appendLog('err', err.message || String(err));
    }
  });
}

function bindTableHandlers() {
  $('#setsTables')?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-set-code]');
    if (!btn || btn.disabled) return;
    const code = btn.dataset.setCode;
    const enable = btn.dataset.enabled !== '1';
    btn.disabled = true;
    toggleSet(code, enable)
      .then((payload) => {
        const row = btn.closest('tr');
        if (!row || !payload) return;
        const cells = row.querySelectorAll('td');
        const statusCell = cells[cells.length - 2];
        if (statusCell) {
          statusCell.textContent = payload.enabled ? 'Enabled' : 'Disabled';
          statusCell.className = payload.enabled ? 'ok' : 'warn';
        }
        btn.textContent = payload.enabled ? 'Disable' : 'Enable';
        btn.dataset.enabled = payload.enabled ? '1' : '0';
      })
      .catch((err) => appendLog('err', err.message))
      .finally(() => { btn.disabled = false; });
  });

  $('#scheduleTables')?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-task-id]');
    if (!btn) return;
    const id = btn.dataset.taskId;
    const action = btn.dataset.action;
    taskAction(action, id).catch((err) => appendLog('err', err.message));
  });
}

async function refreshAll(showToast) {
  await Promise.allSettled([loadTasks(), loadSets(), loadFx()]);
  if (els.lastRefresh) els.lastRefresh.textContent = new Date().toLocaleTimeString();
  if (showToast) setToast('Panels refreshed', 'ok');
}

function init() {
  state.token = (state.token || '').trim();
  bindTokenHandlers();
  bindQuickActions();
  bindTableHandlers();
  refreshAll(true).catch((err) => appendLog('err', err.message));
  setInterval(() => refreshAll(false), 60000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

`;
}

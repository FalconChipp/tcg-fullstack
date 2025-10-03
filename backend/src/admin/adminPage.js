// src/admin/adminPage.js
// Redesigned HTML shell for the Admin UI. The logic lives in adminScript.js.
export function adminPageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Cardsearch Admin Console</title>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    :root {
      color-scheme: dark;
      --bg:#05070c;
      --surface:#111827;
      --surface-soft:#0b1320;
      --surface-contrast:#0f172a;
      --border:#1e293b;
      --border-strong:#334155;
      --accent:#38bdf8;
      --accent-soft:rgba(56,189,248,0.18);
      --success:#22c55e;
      --warning:#fbbf24;
      --danger:#ef4444;
      --text:#f8fafc;
      --text-muted:#94a3b8;
      --shadow:0 24px 40px rgba(2,6,23,0.45);
      --radius:16px;
      --font:14px/1.45 "Inter","Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
    }
    *,*::before,*::after { box-sizing:border-box; }
    body {
      margin:0;
      font:var(--font);
      background:radial-gradient(120% 140% at 0% 0%,rgba(56,189,248,0.08) 0%,transparent 55%),
                 radial-gradient(120% 140% at 100% 0%,rgba(139,92,246,0.06) 0%,transparent 45%),
                 var(--bg);
      color:var(--text);
      min-height:100vh;
    }
    .app { min-height:100vh; display:flex; flex-direction:column; }
    a { text-decoration:none; color:inherit; }
    .topbar {
      position:sticky;
      top:0;
      z-index:50;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:24px 28px 18px;
      gap:24px;
      background:rgba(8,12,20,0.92);
      backdrop-filter:blur(14px) saturate(135%);
      border-bottom:1px solid rgba(148,163,184,0.12);
    }
    .brand { display:flex; align-items:center; gap:16px; }
    .brand-badge {
      width:40px;
      height:40px;
      border-radius:12px;
      background:var(--accent-soft);
      color:var(--accent);
      display:grid;
      place-items:center;
      font-weight:700;
      font-size:13px;
      letter-spacing:0.08em;
    }
    .brand-label { display:flex; flex-direction:column; gap:2px; }
    .brand-label strong { font-size:16px; letter-spacing:0.12em; text-transform:uppercase; }
    .brand-label span { font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.22em; }
    .meta { display:flex; align-items:center; gap:18px; flex-wrap:wrap; justify-content:flex-end; }
    .meta-item {
      display:flex;
      align-items:center;
      gap:8px;
      font-size:12px;
      color:var(--text-muted);
      background:rgba(15,23,42,0.75);
      border:1px solid rgba(148,163,184,0.14);
      padding:6px 12px;
      border-radius:999px;
    }
    .meta-item .meta-value { color:var(--text); font-weight:600; }
    .refresh-dot {
      width:8px;
      height:8px;
      border-radius:999px;
      background:var(--success);
      box-shadow:0 0 0 0 rgba(34,197,94,0.3);
      animation:pulse 2.8s infinite;
    }
    @keyframes pulse {
      0% { box-shadow:0 0 0 0 rgba(34,197,94,0.35); }
      70% { box-shadow:0 0 0 10px rgba(34,197,94,0); }
      100% { box-shadow:0 0 0 0 rgba(34,197,94,0); }
    }
    .btn {
      appearance:none;
      border:none;
      cursor:pointer;
      font:inherit;
      border-radius:12px;
      padding:9px 16px;
      font-weight:600;
      letter-spacing:0.01em;
      transition:transform 0.12s ease,box-shadow 0.12s ease,background 0.2s ease;
      color:#01131f;
    }
    .btn.primary {
      background:var(--accent);
      box-shadow:0 10px 24px rgba(56,189,248,0.32);
      border:1px solid rgba(56,189,248,0.45);
    }
    .btn.secondary {
      background:var(--surface-soft);
      color:var(--text);
      border:1px solid var(--border-strong);
      box-shadow:0 10px 25px rgba(2,6,23,0.32);
    }
    .btn.ghost {
      background:rgba(15,23,42,0.6);
      color:var(--text);
      border:1px solid rgba(148,163,184,0.18);
      box-shadow:none;
    }
    .btn:hover { transform:translateY(-1px); box-shadow:0 16px 30px rgba(2,6,23,0.45); }
    .btn:active { transform:translateY(0); box-shadow:0 8px 18px rgba(2,6,23,0.5); }
    .btn.icon { display:flex; align-items:center; gap:8px; }
    .toolbar {
      display:grid;
      gap:24px;
      padding:20px 28px 0;
      grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
    }
    .card {
      background:linear-gradient(140deg,rgba(15,23,42,0.92),rgba(17,24,39,0.88));
      border:1px solid rgba(148,163,184,0.14);
      border-radius:var(--radius);
      box-shadow:var(--shadow);
      overflow:hidden;
      display:flex;
      flex-direction:column;
    }
    .card header {
      padding:18px 22px 12px;
      border-bottom:1px solid rgba(148,163,184,0.12);
      display:flex;
      flex-direction:column;
      gap:6px;
    }
    .card header h2 { margin:0; font-size:15px; letter-spacing:0.08em; text-transform:uppercase; }
    .card header p { margin:0; font-size:12px; color:var(--text-muted); line-height:1.4; }
    .card-body { padding:18px 22px 22px; display:flex; flex-direction:column; gap:14px; }
    .field-label { font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.14em; }
    .field-row { display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
    input[type="password"], input[type="text"], input[type="search"] {
      flex:1 1 180px;
      background:var(--surface-contrast);
      color:var(--text);
      border:1px solid rgba(148,163,184,0.2);
      border-radius:12px;
      padding:10px 14px;
      min-width:0;
      transition:border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    }
    input:focus {
      outline:none;
      border-color:var(--accent);
      background:rgba(56,189,248,0.08);
      box-shadow:0 0 0 3px rgba(56,189,248,0.16);
    }
    .button-stack { display:flex; flex-wrap:wrap; gap:10px; }
    .layout {
      display:grid;
      grid-template-columns:minmax(0,2.1fr) minmax(0,1fr);
      gap:24px;
      padding:24px 28px 96px;
    }
    .layout-main, .layout-side { display:flex; flex-direction:column; gap:24px; }
    .panel-title { display:flex; align-items:center; justify-content:space-between; gap:14px; }
    .panel-title span { font-size:12px; color:var(--text-muted); }
    .summary { display:flex; flex-wrap:wrap; gap:12px; }
    .summary .chip {
      display:flex;
      flex-direction:column;
      gap:6px;
      min-width:120px;
      padding:12px 14px;
      border-radius:12px;
      background:rgba(15,23,42,0.72);
      border:1px solid rgba(148,163,184,0.18);
    }
    .summary .chip strong { font-size:18px; letter-spacing:0.04em; }
    .summary .chip span { font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.16em; }
    .summary .chip small { font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.14em; opacity:0.75; }
    .summary .chip.warn { border-color:rgba(251,191,36,0.35); background:rgba(251,191,36,0.12); }
    .summary .chip.warn strong { color:var(--warning); }
    .summary .chip.danger { border-color:rgba(239,68,68,0.4); background:rgba(239,68,68,0.12); }
    .summary .chip.danger strong { color:var(--danger); }
    .tab-bar { display:flex; flex-wrap:wrap; gap:8px; }
    .tab {
      border-radius:999px;
      padding:6px 12px;
      font-size:12px;
      letter-spacing:0.08em;
      text-transform:uppercase;
      background:rgba(148,163,184,0.12);
      color:var(--text-muted);
      border:1px solid rgba(148,163,184,0.16);
      cursor:pointer;
      transition:background 0.18s ease, color 0.18s ease, border-color 0.2s ease;
    }
    .tab.active { background:var(--accent); color:#02111d; border-color:rgba(56,189,248,0.55); }
    .table-container {
      border:1px solid rgba(148,163,184,0.14);
      border-radius:12px;
      background:rgba(10,16,28,0.78);
      overflow:auto;
      max-height:380px;
    }
    .table-container:empty::before {
      content:"Waiting for data...";
      display:block;
      padding:18px;
      color:var(--text-muted);
      font-size:12px;
      text-align:center;
    }
    table { width:100%; border-collapse:collapse; font-size:13px; min-width:100%; }
    th, td { text-align:left; padding:11px 16px; border-bottom:1px solid rgba(148,163,184,0.08); }
    th {
      font-size:12px;
      text-transform:uppercase;
      letter-spacing:0.16em;
      color:var(--text-muted);
      background:rgba(15,23,42,0.72);
      position:sticky;
      top:0;
      backdrop-filter:blur(8px);
    }
    tbody tr:hover { background:rgba(148,163,184,0.08); }
    .empty-state {
      padding:18px;
      border-radius:12px;
      background:rgba(15,23,42,0.7);
      color:var(--text-muted);
      font-size:13px;
    }
    .job-launcher { display:flex; flex-direction:column; gap:12px; }
    .job-controls { display:flex; flex-wrap:wrap; gap:12px; }
    .job-actions { display:flex; flex-wrap:wrap; gap:8px; }
    .log {
      font-family:"JetBrains Mono","SFMono-Regular",Menlo,Consolas,monospace;
      font-size:12px;
      line-height:1.35;
      background:rgba(8,13,24,0.94);
      border:1px solid rgba(148,163,184,0.18);
      border-radius:12px;
      padding:16px;
      min-height:260px;
      max-height:360px;
      overflow:auto;
      white-space:pre-wrap;
      word-break:break-word;
    }
    .muted { color:var(--text-muted); }
    .ok { color:var(--success); }
    .warn { color:var(--warning); }
    .err { color:var(--danger); }
    .hide { display:none !important; }
    .toast {
      position:fixed;
      bottom:24px;
      right:28px;
      background:rgba(15,23,42,0.94);
      border:1px solid rgba(56,189,248,0.35);
      color:var(--text);
      padding:14px 18px;
      border-radius:12px;
      font-size:13px;
      letter-spacing:0.08em;
      text-transform:uppercase;
      opacity:0;
      transform:translateY(12px);
      transition:opacity 0.24s ease, transform 0.24s ease;
      box-shadow:0 18px 36px rgba(3,7,18,0.55);
    }
    .toast.show { opacity:1; transform:translateY(0); }
    .rules-list {
      margin:0;
      padding-left:18px;
      font-size:13px;
      line-height:1.45;
      color:var(--text-muted);
      display:flex;
      flex-direction:column;
      gap:6px;
    }
    .rules-list li strong { color:var(--text); }
    .table-container::-webkit-scrollbar,
    .log::-webkit-scrollbar { width:10px; height:10px; }
    .table-container::-webkit-scrollbar-thumb,
    .log::-webkit-scrollbar-thumb {
      background:rgba(148,163,184,0.3);
      border-radius:999px;
    }
    .table-container::-webkit-scrollbar-track,
    .log::-webkit-scrollbar-track { background:rgba(15,23,42,0.4); }
    .badge {
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:4px 10px;
      border-radius:999px;
      background:rgba(56,189,248,0.1);
      border:1px solid rgba(56,189,248,0.22);
      font-size:11px;
      letter-spacing:0.1em;
      text-transform:uppercase;
      color:var(--accent);
    }
    .badge.warn {
      background:rgba(251,191,36,0.1);
      border-color:rgba(251,191,36,0.22);
      color:var(--warning);
    }
    .badge.danger {
      background:rgba(239,68,68,0.12);
      border-color:rgba(239,68,68,0.28);
      color:var(--danger);
    }
    .mini { font-size:12px; color:var(--text-muted); }
    @media (max-width:1280px) {
      .layout { grid-template-columns:1fr; padding-bottom:72px; }
    }
    @media (max-width:720px) {
      .topbar { flex-direction:column; align-items:flex-start; padding:20px 18px 16px; }
      .meta { justify-content:flex-start; }
      .toolbar { padding:16px 18px 0; }
      .layout { padding:20px 18px 80px; }
      .card header { padding:16px 18px 12px; }
      .card-body { padding:16px 18px 18px; }
    }
  </style>
  <script src="/socket.io/socket.io.js"></script>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <div class="brand-badge">MD</div>
        <div class="brand-label">
          <strong>Cardsearch</strong>
          <span>Admin Console</span>
        </div>
      </div>
      <div class="meta">
        <div class="meta-item">
          <span class="refresh-dot" aria-hidden="true"></span>
          <span>Auto refresh 15s</span>
        </div>
        <div class="meta-item">
          <span class="mini">Last sync</span>
          <span class="meta-value" id="lastRefreshValue">--</span>
        </div>
        <button id="refreshAll" class="btn primary icon">
          <span>Refresh panels</span>
        </button>
      </div>
    </header>
    <section class="toolbar">
      <div class="card">
        <header>
          <h2>Access</h2>
          <p>Provide the admin token once per browser; it stays in local storage only.</p>
        </header>
        <div class="card-body">
          <label class="field-label" for="admintoken">Admin token</label>
          <div class="field-row">
            <input id="admintoken" type="password" placeholder="x-admin-token"/>
            <button id="saveToken" class="btn secondary">Save</button>
          </div>
        </div>
      </div>
      <div class="card">
        <header>
          <h2>Job Shortcuts</h2>
          <p>Launch common cardsearch jobs.</p>
        </header>
        <div class="card-body">
          <div class="button-stack">
            <button id="fxRefresh" class="btn ghost">Run FX Daily</button>
            <button id="rollupRebuild" class="btn ghost">Rebuild Rollups</button>
          </div>
          <span class="mini">These actions run immediately using the stored admin token.</span>
        </div>
      </div>
    </section>
    <main class="layout">
      <section class="layout-main">
        <div class="card" id="setsCard">
          <header>
            <div class="panel-title">
              <h2>Sets</h2>
              <span class="mini">Managed set overview</span>
            </div>
            <div class="summary" id="setsSnapshot"></div>
          </header>
          <div class="card-body">
            <div class="tab-bar" id="eraTabs"></div>
            <div class="empty-state" id="setsEmpty">No sets yet.</div>
            <div class="table-container" id="setsTables"></div>
          </div>
        </div>
        <div class="card" id="scheduleCard">
          <header>
            <div class="panel-title">
              <h2>Schedule</h2>
              <span class="mini">Scheduler task queue</span>
            </div>
            <div class="summary" id="scheduleSnapshot"></div>
          </header>
          <div class="card-body">
            <div class="tab-bar" id="schEraTabs"></div>
            <div class="empty-state" id="scheduleEmpty">No schedule yet.</div>
            <div class="table-container" id="scheduleTables"></div>
          </div>
        </div>
        <div class="card" id="activityCard">
          <header>
            <div class="panel-title">
              <h2>Activity & Logs</h2>
              <span class="mini">Launch ad-hoc jobs and tail live output</span>
            </div>
          </header>
          <div class="card-body">
            <div class="job-launcher">
              <label class="field-label" for="setCodeInput">Run a set job</label>
              <div class="job-controls">
                <input id="setCodeInput" type="text" placeholder="set code (e.g. sv01)"/>
                <div class="job-actions">
                  <button id="btnIngest" class="btn secondary">Ingest Set</button>
                  <button id="btnPrices" class="btn secondary">Collect Prices</button>
                  <button id="btnBoth" class="btn secondary">Ingest + Prices</button>
                </div>
              </div>
            </div>
            <div class="log" id="liveLog"></div>
          </div>
        </div>
      </section>
      <aside class="layout-side">
        <div class="card">
          <header>
            <div class="panel-title">
              <h2>Scheduler Snapshot</h2>
              <span class="mini">At-a-glance task health</span>
            </div>
            <div class="summary" id="providersSnapshot"></div>
          </header>
          <div class="card-body">
            <div class="table-container" id="providers"></div>
          </div>
        </div>
        <div class="card">
          <header>
            <div class="panel-title">
              <h2>FX</h2>
              <span class="mini">Base currency GBP</span>
            </div>
          </header>
          <div class="card-body">
            <div class="table-container">
              <table id="fxTable">
                <thead>
                  <tr><th>Currency</th><th>Rate</th></tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
            <span class="mini">Rates cached from external providers.</span>
          </div>
        </div>
        <div class="card">
          <header>
            <div class="panel-title">
              <h2>Cron Plans</h2>
              <span class="mini">Derived from scheduler entries</span>
            </div>
          </header>
          <div class="card-body">
            <ul id="rulesList" class="rules-list"></ul>
            <div class="mini" style="margin-top:12px">
              Cron expressions follow <code>minute hour day-of-month month day-of-week</code>.
              <div style="margin-top:6px">Examples:</div>
              <ul class="rules-list" style="margin-top:6px">
                <li><strong>15 * * * *</strong> - every hour at :15</li>
                <li><strong>0 3 * * *</strong> - daily at 03:00</li>
                <li><strong>0 12 * * MON</strong> - every Monday at noon</li>
              </ul>
              Use <span class="mini" style="font-style:italic">UTC</span> unless a task specifies a different timezone.
            </div>
          </div>
        </div>
      </aside>
    </main>
  </div>
  <div id="toast" class="toast" role="status" aria-live="polite">Refreshed</div>
  <script src="/admin/admin.js" type="module"></script>
</body>
</html>`;
}




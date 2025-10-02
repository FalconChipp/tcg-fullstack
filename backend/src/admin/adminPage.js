// src/admin/adminPage.js
// Minimal HTML shell for the Admin UI. The logic lives in adminScript.js.

export function adminPageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Admin · Marketdata2</title>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    :root { color-scheme: light dark; --bg:#0b0d10; --card:#151a20; --muted:#98a2b3; --ok:#16a34a; --warn:#f59e0b; --err:#ef4444; --ink:#e5e7eb; --ink2:#cbd5e1; }
    body { margin:0; font:14px/1.45 system-ui, Segoe UI, Roboto, Helvetica, Arial; background:#0b0d10; color:#e5e7eb; }
    header { display:flex; gap:12px; align-items:center; padding:14px 16px; position:sticky; top:0; background:rgba(11,13,16,.9); backdrop-filter:saturate(120%) blur(6px); border-bottom:1px solid #1f2937; z-index:10; }
    header h1 { font-size:16px; margin:0 8px 0 0; }
    header input, header button, select { background:#151a20; color:var(--ink); border:1px solid #273142; border-radius:8px; padding:8px 10px; }
    header .pill { font-size:12px; color:var(--muted); }
    main { padding:14px 16px; display:grid; gap:14px; grid-template-columns: 1.2fr .8fr; }
    .col { display:flex; flex-direction:column; gap:14px; }
    .card { background:#11161c; border:1px solid #1f2937; border-radius:14px; }
    .card h3 { margin:0; padding:10px 12px; border-bottom:1px solid #1f2937; font-size:13px; color:var(--ink2); letter-spacing:.3px; }
    .card .content { padding:10px 12px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { text-align:left; padding:8px; border-bottom:1px solid #1f2937; }
    th { color:#9aa5b1; font-weight:600; }
    .grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:10px; }
    .muted { color:var(--muted); }
    .ok { color:var(--ok); } .warn { color:var(--warn); } .err { color:var(--err); }
    .row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .btn { cursor:pointer; user-select:none; }
    .tabs { display:flex; gap:6px; padding:8px 10px; border-bottom:1px solid #1f2937; }
    .tab { background:#0e1318; border:1px solid #1f2937; color:#cbd5e1; padding:6px 10px; border-radius:8px; cursor:pointer; }
    .tab.active { background:#17202b; border-color:#2b394d; }
    .hide { display:none !important; }
    .log { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; line-height:1.3; background:#0c0f13; border-top:1px dashed #213044; padding:8px; height:260px; overflow:auto; white-space:pre-wrap; }
    .toast { position:fixed; bottom:14px; right:16px; background:#0c1116; border:1px solid #253244; color:#cfe3ff; padding:10px 12px; border-radius:10px; opacity:0; transform:translateY(8px); transition:all .25s ease; }
    .toast.show { opacity:1; transform:translateY(0); }
    .kbd { font:12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background:#0c1116; border:1px solid #283445; padding:2px 6px; border-radius:6px; color:#cbd5e1; }
  </style>
  <script src="/socket.io/socket.io.js"></script>
</head>
<body>
  <header>
    <h1>MD2 Admin</h1>
    <div class="row">
      <span class="pill">Admin token</span>
      <input id="admintoken" type="password" placeholder="x-admin-token" style="width:260px"/>
      <button id="saveToken" class="btn">Save</button>
    </div>
    <div class="row">
      <button id="refreshAll" class="btn">Refresh panels</button>
      <button id="fxRefresh" class="btn">Refresh FX</button>
      <button id="rollupRebuild" class="btn">Rebuild rollups</button>
    </div>
  </header>

  <main>
    <section class="col">
      <div class="card" id="setsCard">
        <h3>Sets</h3>
        <div class="tabs" id="eraTabs"></div>
        <div class="content">
          <div id="setsEmpty" class="muted">No sets yet.</div>
          <div id="setsTables"></div>
        </div>
      </div>

      <div class="card" id="scheduleCard">
        <h3>Schedule</h3>
        <div class="tabs" id="schEraTabs"></div>
        <div class="content">
          <div id="scheduleEmpty" class="muted">No schedule yet.</div>
          <div id="scheduleTables"></div>
        </div>
      </div>

      <div class="card" id="activityCard">
        <h3>Activity & Logs</h3>
        <div class="content">
          <div class="row" style="gap:8px;margin-bottom:8px">
            <input id="setCodeInput" placeholder="set code (e.g. sv01)" style="width:140px"/>
            <button id="btnIngest" class="btn">Ingest Set</button>
            <button id="btnPrices" class="btn">Collect Prices</button>
            <button id="btnBoth"   class="btn">Ingest + Prices</button>
          </div>
          <div id="liveLog" class="log"></div>
        </div>
      </div>
    </section>

    <aside class="col">
      <div class="card">
        <h3>Providers</h3>
        <div class="content" id="providers"></div>
      </div>

      <div class="card">
        <h3>FX</h3>
        <div class="content">
          <table id="fxTable"><thead><tr><th>Currency</th><th>₍per GBP₎</th></tr></thead><tbody></tbody></table>
          <div class="muted" style="margin-top:6px">Rates are GBP-centric and cached.</div>
        </div>
      </div>

      <div class="card">
        <h3>Scheduling rules</h3>
        <div class="content">
          <ul id="rulesList" class="muted" style="margin:0 0 2px 18px"></ul>
          <div class="muted"><span class="kbd">Rules auto-update</span> when server config changes.</div>
        </div>
      </div>
    </aside>
  </main>

  <div id="toast" class="toast">Refreshed</div>
  <script src="/admin/admin.js" type="module"></script>
</body>
</html>`;
}

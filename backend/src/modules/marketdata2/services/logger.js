// Lightweight structured logger with levels + scopes.
// Env:
//   MD2_LOG_LEVEL=error|warn|info|debug|trace  (default: info)
//   MD2_LOG_JSON=1  -> JSON lines (good for ingestion to log tools)

const LEVELS = { silent: 0, error: 10, warn: 20, info: 30, debug: 40, trace: 50 };
const levelName = process.env.MD2_LOG_LEVEL || 'info';
const MIN = LEVELS[levelName] ?? LEVELS.info;
const AS_JSON = process.env.MD2_LOG_JSON === '1';

function ts() {
  return new Date().toISOString();
}
function print(lvl, scope, msg, extra) {
  if (AS_JSON) {
    const obj = { t: ts(), level: lvl, scope, msg, ...extra };
    console.log(JSON.stringify(obj));
  } else {
    const s = scope ? `[${scope}]` : '';
    const tail = extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
    console.log(`${ts()} ${lvl.toUpperCase()} ${s} ${msg}${tail}`);
  }
}

export function createLogger(scope) {
  const log = (lvl, msg, extra = {}) => {
    const n = LEVELS[lvl] ?? LEVELS.info;
    if (n <= MIN) print(lvl, scope, msg, extra);
  };
  return {
    error: (m, e) => log('error', m, e ? { err: String(e?.message || e) } : {}),
    warn: (m, o) => log('warn', m, o),
    info: (m, o) => log('info', m, o),
    debug: (m, o) => log('debug', m, o),
    trace: (m, o) => log('trace', m, o),
    child: (s) => createLogger(scope ? `${scope}:${s}` : s),
  };
}

export default createLogger;

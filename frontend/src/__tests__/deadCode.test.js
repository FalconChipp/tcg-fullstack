/**
 * Dead-file detection across all of src/.
 *
 * Every non-page source file must be imported (directly) by at least one
 * other file in src/. If this test fails, the listed files have no consumers
 * and are candidates for deletion.
 *
 * NOTE: This checks direct imports only. If file A is dead and file B is only
 * imported by A, B won't surface until A is deleted and the test re-run.
 *
 * Add a repo-relative path to EXEMPT_PATHS only when a file is legitimately
 * import-free (e.g. a side-effect-only module or a dynamic-import entry point).
 */

const fs   = require('fs');
const path = require('path');

const SRC_DIR  = path.resolve(__dirname, '..');
const APP_DIR  = path.resolve(SRC_DIR, '../app');   // Next.js App Router — also a consumer

const EXEMPT_PATHS = new Set([
  // 'styles/globals.css',  // imported via _app.js string import, not a JS import
]);

function isExempt(absPath) {
  const rel = path.relative(SRC_DIR, absPath).replace(/\\/g, '/');
  if (EXEMPT_PATHS.has(rel)) return true;
  // Next.js discovers pages by filesystem — they are never imported by other files
  if (rel.startsWith('pages/')) return true;
  // Test infrastructure
  if (rel.includes('__tests__/') || rel.endsWith('.test.js') || rel.endsWith('.spec.js')) return true;
  return false;
}

function collectFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
      collectFiles(full, out);
    } else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

test('no dead source files', () => {
  const allFiles = collectFiles(SRC_DIR);

  // Files that should be imported by something
  const candidates = allFiles.filter(f => !isExempt(f));

  // Consumer content: src/ files + app/ (App Router) files, excluding tests
  const appFiles = fs.existsSync(APP_DIR) ? collectFiles(APP_DIR) : [];
  const allContent = [...allFiles, ...appFiles]
    .filter(f => !f.endsWith('.test.js') && !f.endsWith('.spec.js') && !f.includes('__tests__'))
    .map(f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } })
    .join('\n');

  const dead = candidates.filter(f => {
    const base = path.basename(f, path.extname(f));
    // index.js files are imported by directory name: from '@/components/Cart' → Cart/index.js
    const importName = base === 'index' ? path.basename(path.dirname(f)) : base;
    // Match static imports, dynamic import(), and require()
    const re = new RegExp(
      `from\\s*['"][^'"]*/${importName}['"]` +
      `|import\\s*\\(['"][^'"]*/${importName}['"]` +
      `|require\\s*\\(['"][^'"]*/${importName}['"]`
    );
    return !re.test(allContent);
  });

  expect(dead.map(f => path.relative(SRC_DIR, f).replace(/\\/g, '/'))).toEqual([]);
});

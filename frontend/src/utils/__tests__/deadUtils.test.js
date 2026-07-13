/**
 * Dead-utility detection.
 *
 * Every file in utils/ must be imported by at least one non-test source file
 * that lives outside of utils/ itself. If this test fails, the listed files
 * have no consumers and are safe to delete.
 *
 * Add a name to EXEMPT only if the file is intentionally import-free
 * (e.g. a side-effect-only module or a dynamic-import-only entry point).
 */

const fs   = require('fs');
const path = require('path');

const UTILS_DIR = path.resolve(__dirname, '..');
const SRC_DIR   = path.resolve(__dirname, '../..');

const EXEMPT = new Set([
  // example: 'sw-register'  // loaded via next.config.js, not imported
]);

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

test('every util is imported by at least one non-test file outside utils/', () => {
  // 1. Util slugs to verify (excluding test files and exemptions)
  const utilNames = fs.readdirSync(UTILS_DIR, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.js') && !e.name.endsWith('.test.js'))
    .map(e => path.basename(e.name, '.js'))
    .filter(name => !EXEMPT.has(name));

  // 2. All source files that are NOT inside utils/ and NOT test files
  const consumerFiles = collectFiles(SRC_DIR).filter(f =>
    !f.startsWith(UTILS_DIR + path.sep) &&
    !f.endsWith('.test.js') &&
    !f.endsWith('.spec.js') &&
    !f.includes('__tests__')
  );

  // 3. Concatenate content once — cheaper than per-util grep
  const allContent = consumerFiles
    .map(f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } })
    .join('\n');

  // 4. A util is "dead" if no consumer file contains `from '…/name'`
  const dead = utilNames.filter(name => {
    const re = new RegExp(`from\\s*['"][^'"]*/${name}['"]`);
    return !re.test(allContent);
  });

  // Provides a readable failure message listing exactly which files to delete
  expect(dead).toEqual([]);
});

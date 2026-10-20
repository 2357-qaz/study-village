// Every import of a module must use the same ?v= cache-busting string: two different URLs load two
// copies of the module, and copies of ui/store.js would no longer share the game state.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, dirname, normalize, relative} from 'node:path';

const root = new URL('../dist/', import.meta.url).pathname;
const walk = dir =>
  readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'vendor' ? [] : walk(p);
    return /\.(js|html)$/.test(n) ? [p] : [];
  });

test('each module is imported with one version string everywhere', () => {
  const seen = new Map();
  for (const file of walk(root))
    for (const [, rel, v] of readFileSync(file, 'utf8').matchAll(
      /['"](\.{1,2}\/[\w./-]+?\.(?:js|css))\?v=(\d+)['"]/g
    )) {
      const target = relative(root, normalize(join(dirname(file), rel)));
      if (!seen.has(target)) seen.set(target, new Map());
      seen.get(target).set(v, relative(root, file));
    }
  const mixed = [...seen]
    .filter(([, vs]) => vs.size > 1)
    .map(([t, vs]) => `${t}: ${[...vs].map(([v, f]) => `v${v} in ${f}`).join(', ')}`);
  assert.deepEqual(mixed, []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const code = await fs.readFile(new URL('../dist/sw.js', import.meta.url), 'utf8');
async function request(path, {hit, cacheFails = false} = {}) {
  let listener,
    calls = 0,
    result;
  const pending = [];
  const context = {
    URL,
    Response,
    setTimeout,
    self: {
      location: {origin: 'https://example.test'},
      addEventListener(type, fn) {
        if (type === 'fetch') listener = fn;
      }
    },
    caches: {
      match: async () => {
        if (cacheFails) throw Error('Storage denied');
        return hit;
      },
      open: async () => ({put: async () => {}})
    },
    fetch: async () => {
      calls++;
      return new Response('network');
    }
  };
  vm.runInNewContext(code, context);
  listener({
    request: {url: 'https://example.test/study-village/assets/' + path, method: 'GET', mode: 'cors'},
    waitUntil(p) {
      pending.push(p);
    },
    respondWith(p) {
      result = p;
    }
  });
  const response = await result;
  await Promise.all(pending);
  return {body: await response.text(), calls};
}
test('immutable companion bytes are served from cache without starting a network request', async () => {
  assert.deepEqual(await request('companion-v10.76959ad6cfcb0f23.bin.gz', {hit: new Response('cached')}), {
    body: 'cached',
    calls: 0
  });
});
test('mutable manifests remain network-first', async () => {
  assert.deepEqual(await request('companion-v10.json?v=11', {hit: new Response('old')}), {
    body: 'network',
    calls: 1
  });
});
test('cold or unavailable storage never blocks the network asset', async () => {
  for (const options of [{}, {cacheFails: true}])
    assert.deepEqual(await request('companion-v10.76959ad6cfcb0f23.bin.gz', options), {
      body: 'network',
      calls: 1
    });
});

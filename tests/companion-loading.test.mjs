import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three.module.min.js';
import {companionModel} from '../dist/companion.js';
import {Builder} from '../dist/models.js';

const root = new URL('../dist/assets/', import.meta.url);
let sequence = 0;
async function fixture(t, intercept) {
  const requests = [];
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push(String(url));
    const file = String(url).split('/').at(-1).split('?')[0];
    const intercepted = await intercept?.(file, options);
    if (intercepted) return intercepted;
    return new Response(await fs.readFile(new URL(file, root)));
  });
  return {...(await import(`../dist/sculpt-loader.js?case=${sequence++}`)), requests};
}
const decoded = parts =>
  Object.values(Object.getOwnPropertyDescriptors(parts)).filter(d => d.value?.isBufferGeometry).length;
const assemble = (parts, pose) => companionModel(new Builder({add() {}}), {parts, pose});

test('compressed asset is byte-for-byte identical and its filename matches its content hash', async () => {
  const m = JSON.parse(await fs.readFile(new URL('companion-v10.json', root))),
    raw = await fs.readFile(new URL('companion-v10.bin', root)),
    packed = await fs.readFile(new URL(m.compressed.file, root));
  assert.deepEqual(gunzipSync(packed), raw);
  assert.equal(packed.length, m.compressed.bytes);
  assert.equal(raw.length, m.compressed.decodedBytes);
  assert.ok(m.compressed.file.includes(createHash('sha256').update(packed).digest('hex').slice(0, 16)));
});

test('poses decode only their parts and share the same geometry across repeated builds', async t => {
  const {loadSculpt, requests} = await fixture(t);
  const p = await loadSculpt('./assets/', 'v10');
  assert.equal(decoded(p), 0);
  assemble(p, 'read');
  assert.equal(decoded(p), 5);
  const head = p.head,
    hair = p.hair,
    lap = p.lapSeated;
  assemble(p, 'turn');
  assert.equal(decoded(p), 7);
  assert.equal(p.head, head);
  assert.equal(p.hair, hair);
  assert.equal(p.lapSeated, lap);
  assemble(p, 'look');
  assert.equal(decoded(p), 10);
  assemble(p, 'tea');
  assert.equal(decoded(p), 13);
  assert.equal(await loadSculpt('./assets/', 'v10'), p);
  assert.equal(requests.length, 2);
  assert.ok(requests[1].endsWith('.bin.gz'));
});

for (const variant of ['', 'v10'])
  test(`${variant || 'original'} preserves every decoded position, normal, paint value and triangle`, async t => {
    const {loadSculpt} = await fixture(t),
      p = await loadSculpt('./assets/', variant),
      bytes = await fs.readFile(new URL(variant ? 'companion-v10.bin' : 'companion.bin', root)),
      buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      palette = Object.values(p.manifest.palette).map(h => new THREE.Color(h).toArray()),
      srgb = Array.from(
        {length: 256},
        (_, i) => new THREE.Color().setRGB(i / 255, 0, 0, THREE.SRGBColorSpace).r
      );
    for (const part of p.manifest.parts) {
      const g = p[part.name],
        q = new Int16Array(buf, part.pos, part.verts * 3),
        n = new Int8Array(buf, part.nrm, part.verts * 3),
        idx = part.wide
          ? new Uint32Array(buf, part.idx, part.tris * 3)
          : new Uint16Array(buf, part.idx, part.tris * 3);
      assert.deepEqual(g.index.array, idx);
      assert.equal(g.attributes.normal.normalized, true);
      assert.deepEqual(g.attributes.normal.array, n);
      assert.ok(n.every(v => v >= -127)); // signed normalization equals the previous n/127
      for (let i = 0; i < q.length; i++) {
        const a = i % 3;
        assert.equal(
          g.attributes.position.array[i],
          Math.fround(part.lo[a] + ((q[i] + 32768) / 65535) * (part.hi[a] - part.lo[a]))
        );
        const color =
          part.col !== undefined
            ? srgb[bytes[part.col + i]]
            : palette[bytes[part.mat + Math.floor(i / 3)]][a];
        assert.equal(g.attributes.color.array[i], Math.fround(color));
      }
    }
  });

test('missing gzip falls back to the original V10 payload', async t => {
  const {loadSculpt, requests} = await fixture(
    t,
    file => file.endsWith('.gz') && new Response('', {status: 404})
  );
  assert.equal(
    (await loadSculpt('./assets/', 'v10')).manifest.generator,
    'blender-v10-curved-rear-hair-chin'
  );
  assert.ok(requests.at(-1).includes('companion-v10.bin?'));
});

test('corrupt gzip falls back; hosts that already decoded gzip are also supported', async t => {
  const {loadSculpt, requests} = await fixture(
    t,
    file => file.endsWith('.gz') && new Response(new Uint8Array([0x1f, 0x8b, 0]))
  );
  assert.ok(await loadSculpt('./assets/', 'v10'));
  assert.equal(requests.length, 3);
  const f = await fixture(
    t,
    async file => file.endsWith('.gz') && new Response(await fs.readFile(new URL('companion-v10.bin', root)))
  );
  assert.ok(await f.loadSculpt('./assets/', 'v10'));
  assert.equal(f.requests.length, 2);
});

test('browsers without DecompressionStream use the raw V10 asset', async t => {
  const saved = globalThis.DecompressionStream;
  globalThis.DecompressionStream = undefined;
  t.after(() => {
    globalThis.DecompressionStream = saved;
  });
  const {loadSculpt, requests} = await fixture(t);
  assert.ok(await loadSculpt('./assets/', 'v10'));
  assert.ok(requests.every(r => !r.endsWith('.gz')));
});

test('invalid V10 buffers fall back to the shipped model before procedural shapes', async t => {
  const {loadPreferredSculpt, requests} = await fixture(
    t,
    file => file.startsWith('companion-v10') && !file.endsWith('.json') && new Response(new Uint8Array(8))
  );
  const p = await loadPreferredSculpt('./assets/', 'v10');
  assert.equal(p.manifest.includesHeadDetails, undefined);
  assert.ok(requests.some(r => r.includes('/companion.bin?')));
  assemble(p, 'tea');
});

test('both missing models resolve to procedural fallback', async t => {
  const {loadPreferredSculpt} = await fixture(t, () => new Response('', {status: 503}));
  assert.equal(await loadPreferredSculpt('./assets/', 'v10'), null);
});

test('concurrent loads share a request and a failed load can be retried', async t => {
  let failing = true;
  const {loadSculpt, requests} = await fixture(t, () => failing && new Response('', {status: 503}));
  await assert.rejects(loadSculpt('./assets/', 'v10'), /HTTP 503/);
  failing = false;
  const [a, b] = await Promise.all([loadSculpt('./assets/', 'v10'), loadSculpt('./assets/', 'v10')]);
  assert.equal(a, b);
  assert.equal(requests.length, 3);
});

test('stalled downloads abort so fallback is reachable', async t => {
  const {loadSculpt} = await fixture(
    t,
    (_, {signal}) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {once: true});
      })
  );
  t.mock.timers.enable({apis: ['setTimeout']});
  const rejected = assert.rejects(loadSculpt('./assets/', 'v10'), {name: 'AbortError'});
  t.mock.timers.tick(30000);
  await rejected;
});

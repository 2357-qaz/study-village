import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from '../dist/vendor/three.module.min.js';
import {loadSculpt} from '../dist/sculpt-loader.js';
import {companionModel, teaPropSettings, teaSpoutLocal} from '../dist/companion.js';
import {Builder} from '../dist/models.js';
const root = new URL('../dist/', import.meta.url);
const fetch0 = globalThis.fetch;
globalThis.fetch = async path => {
  const data = await fs.readFile(new URL(String(path).split('?')[0], root));
  return {
    ok: true,
    json: async () => JSON.parse(data),
    arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  };
};
const build = (parts, pose) => {
  const calls = [];
  companionModel(
    new Builder({
      add(g, c, m, o) {
        calls.push({g, c, m, o});
      }
    }),
    {parts, pose}
  );
  return calls;
};
for (const variant of ['', 'v10'])
  test(`${variant || 'original'} loads and assembles four poses`, async () => {
    const parts = await loadSculpt('./assets/', variant);
    assert.equal(await loadSculpt('./assets/', variant), parts);
    assert.equal(Object.keys(parts).length, 13);
    for (const [name, g] of Object.entries(parts)) {
      for (const a of ['position', 'normal', 'color'])
        assert.ok(g.attributes[a].array.every(Number.isFinite), `${name} ${a}`);
      assert.ok(
        g.index.array.every(i => i < g.attributes.position.count),
        `${name} indices`
      );
      g.computeBoundingBox();
      assert.ok(!g.boundingBox.isEmpty());
    }
    for (const pose of ['read', 'turn', 'look', 'tea']) {
      const calls = build(parts, pose),
        sculpt = calls.filter(c => Object.values(parts).includes(c.g));
      assert.equal(sculpt.length, 5);
      assert.ok(calls.every(c => c.m.elements.every(Number.isFinite)));
      const upper = sculpt.find(c => c.g === parts[`upper_${pose}`]);
      assert.ok(
        Math.abs(
          upper.m.elements[13] -
            (pose === 'tea' ? 0.86 + (parts.manifest.torsoHeightOffsets?.tea || 0) : 0.44)
        ) < 1e-7
      );
      if (variant === 'v10') {
        const meshCountWithoutHeadDetails = build({...parts}, pose).length;
        assert.ok(calls.length < meshCountWithoutHeadDetails, 'authored accessories must not be duplicated');
      }
    }
  });
test('fallback procedural character works in all four poses', () => {
  for (const pose of ['read', 'turn', 'look', 'tea']) {
    const calls = build(null, pose);
    assert.ok(calls.length > 5);
    assert.ok(calls.every(c => c.m.elements.every(Number.isFinite)));
  }
});
test('V10 paint is converted from sRGB once instead of multiplied by palette', async () => {
  const p = await loadSculpt('./assets/', 'v10');
  const bytes = await fs.readFile(new URL('assets/companion-v10.bin', root));
  const part = p.manifest.parts.find(x => x.col !== undefined);
  assert.ok(part);
  const color = new THREE.Color().setRGB(
    bytes[part.col] / 255,
    bytes[part.col + 1] / 255,
    bytes[part.col + 2] / 255,
    THREE.SRGBColorSpace
  );
  const actual = p[part.name].attributes.color.array;
  for (const [i, key] of ['r', 'g', 'b'].entries()) assert.ok(Math.abs(actual[i] - color[key]) < 1e-6);
});
test('V10 nozzle points down and cup/stream fit the existing table', async () => {
  const parts = await loadSculpt('./assets/', 'v10'),
    p = teaPropSettings(parts.manifest);
  assert.equal(parts.manifest.generator, 'blender-v10-curved-rear-hair-chin');
  assert.equal(p.rz, 0.5);
  assert.equal(teaPropSettings(null).rz, -0.55);
  const rot = v => new THREE.Vector3(...v).applyAxisAngle(new THREE.Vector3(0, 0, 1), p.rz);
  assert.ok(rot([-0.11, p.spoutY, 0]).y < rot([-0.06, 0, 0]).y);
  const end = teaSpoutLocal(parts.manifest)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)
    .add(new THREE.Vector3(1.02, 0, 0.72));
  assert.ok(Math.abs(end.x - 0.5140712554) < 1e-8 && Math.abs(end.z - 0.6262745351) < 1e-8);
  assert.ok(end.y > 0.877);
  assert.ok(end.x - 0.075 > -1 && end.x + 0.075 < 0.7 && end.z - 0.075 > 0.125 && end.z + 0.075 < 0.975);
});
test.after(() => {
  globalThis.fetch = fetch0;
});

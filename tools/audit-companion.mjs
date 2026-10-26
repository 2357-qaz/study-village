// Reproducible source/buffer accounting, not a browser heap or device benchmark.
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const assets = new URL('../dist/assets/', import.meta.url),
  results = [];
for (const stem of ['companion', 'companion-v10']) {
  const manifest = JSON.parse(await fs.readFile(new URL(`${stem}.json`, assets))),
    raw = await fs.readFile(new URL(`${stem}.bin`, assets));
  const parts = manifest.parts.map(p => {
    const seen = new Set();
    for (let i = 0; i < p.verts; i++) {
      const paint =
        p.col === undefined ? raw[p.mat + i] : raw.subarray(p.col + i * 3, p.col + i * 3 + 3).toString('hex');
      seen.add(
        `${raw.subarray(p.pos + i * 6, p.pos + i * 6 + 6).toString('hex')}:${raw.subarray(p.nrm + i * 3, p.nrm + i * 3 + 3).toString('hex')}:${paint}`
      );
    }
    return {
      name: p.name,
      vertices: p.verts,
      triangles: p.tris,
      indexBytes: p.tris * 3 * (p.wide ? 4 : 2),
      exactDuplicateVertices: p.verts - seen.size
    };
  });
  const sum = (list, field) => list.reduce((n, p) => n + p[field], 0),
    vertices = sum(parts, 'vertices'),
    indices = sum(parts, 'indexBytes');
  const poses = Object.fromEntries(
    ['read', 'turn', 'look', 'tea'].map(pose => {
      const names = [
          pose === 'tea' ? 'lowerStand' : 'lapSeated',
          `upper_${pose}`,
          `hands_${pose}`,
          pose === 'look' ? 'headOpen' : 'head',
          'hair'
        ],
        used = parts.filter(p => names.includes(p.name)),
        v = sum(used, 'vertices'),
        i = sum(used, 'indexBytes');
      return [
        pose,
        {
          vertices: v,
          triangles: sum(used, 'triangles'),
          meshes: used.length,
          oldGPUAttributeBytes: v * 36 + i,
          optimizedGPUAttributeBytes: v * 27 + i,
          optimizedCPUBackingBytesWhenOnlyThisPoseDecoded: raw.length + v * 24
        }
      ];
    })
  );
  results.push({
    stem,
    sha256: createHash('sha256').update(raw).digest('hex'),
    rawBytes: raw.length,
    gzipBytes: gzipSync(raw, {level: 9}).length,
    vertices,
    triangles: sum(parts, 'triangles'),
    exactDuplicateVertices: sum(parts, 'exactDuplicateVertices'),
    oldCPUBackingBytesAllDecoded: raw.length + vertices * 36,
    optimizedCPUBackingBytesAllDecoded: raw.length + vertices * 24,
    oldGPUAttributeBytesAllUsed: vertices * 36 + indices,
    optimizedGPUAttributeBytesAllUsed: vertices * 27 + indices,
    poses,
    parts
  });
}
console.log(
  JSON.stringify(
    {
      scope:
        'Sculpted parts only; excludes procedural props, room, JS objects, images, framebuffers and transient buffers. GPU sizes are attributes if uploaded, not measured VRAM. Each pose is counted once, not shadow passes.',
      models: results
    },
    null,
    2
  )
);

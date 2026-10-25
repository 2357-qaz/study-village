// One shared set of geometries per asset, decoded only when a pose first uses each part.
import * as THREE from './vendor/three.module.min.js';

const loading = new Map();
const REQUIRED = [
  'head',
  'headOpen',
  'hair',
  'lapSeated',
  'lowerStand',
  ...['read', 'turn', 'look', 'tea'].flatMap(p => [`upper_${p}`, `hands_${p}`])
];
// The authored paint has only 256 possible values per channel. Keep the exact Float32 conversion
// while avoiding one Color allocation and three transfer-function evaluations per vertex.
const linear = Float32Array.from(
  {length: 256},
  (_, i) => new THREE.Color().setRGB(i / 255, 0, 0, THREE.SRGBColorSpace).r
);

async function fetchAsset(url, kind) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 30000);
  try {
    const r = await fetch(url, {signal: controller.signal});
    if (!r.ok) throw new Error(`Companion asset HTTP ${r.status}`);
    return await (kind === 'json' ? r.json() : r.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function meshBuffer(base, stem, manifest) {
  const packed = manifest.compressed;
  if (packed && typeof DecompressionStream === 'function') {
    try {
      const bytes = await fetchAsset(base + packed.file),
        header = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
      // Static hosts may send a .gz as application/gzip or decode it via Content-Encoding.
      const buf =
        header[0] === 0x1f && header[1] === 0x8b
          ? await new Response(
              new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
            ).arrayBuffer()
          : bytes;
      if (buf.byteLength !== packed.decodedBytes) throw new Error('Companion mesh length mismatch');
      return buf;
    } catch (error) {
      console.warn('Compressed companion unavailable; trying original bytes', error);
    }
  }
  return fetchAsset(`${base}${stem}.bin?v=${stem === 'companion' ? 1 : 10}`);
}

// Reject incomplete assets before exposing lazy getters, so the caller can select the old model.
function validate(manifest, buf) {
  if (!REQUIRED.every(name => manifest.parts?.some(p => p.name === name)))
    throw new Error('Companion parts missing');
  const paletteSize = Object.keys(manifest.palette).length;
  for (const p of manifest.parts) {
    if (
      !Number.isSafeInteger(p.verts) ||
      p.verts <= 0 ||
      !Number.isSafeInteger(p.tris) ||
      p.tris <= 0 ||
      ![p.lo, p.hi].every(a => a?.length === 3 && a.every(Number.isFinite))
    )
      throw new Error(`Invalid companion part: ${p.name}`);
    const ranges = [
      [p.pos, p.verts * 6, 2],
      [p.nrm, p.verts * 3, 1],
      [p.mat, p.verts, 1],
      [p.idx, p.tris * 3 * (p.wide ? 4 : 2), p.wide ? 4 : 2]
    ];
    if (p.col !== undefined) ranges.push([p.col, p.verts * 3, 1]);
    for (const [offset, bytes, alignment] of ranges)
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        offset % alignment ||
        offset + bytes > buf.byteLength
      )
        throw new Error(`Invalid companion buffer range: ${p.name}`);
    const idx = p.wide ? new Uint32Array(buf, p.idx, p.tris * 3) : new Uint16Array(buf, p.idx, p.tris * 3);
    if (idx.some(i => i >= p.verts)) throw new Error(`Invalid companion indices: ${p.name}`);
    if (p.col === undefined && new Uint8Array(buf, p.mat, p.verts).some(i => i >= paletteSize))
      throw new Error(`Invalid companion palette: ${p.name}`);
  }
}

function decodePart(p, buf, colors) {
  const q = new Int16Array(buf, p.pos, p.verts * 3),
    n = new Int8Array(buf, p.nrm, p.verts * 3),
    m = new Uint8Array(buf, p.mat, p.verts),
    painted = p.col !== undefined ? new Uint8Array(buf, p.col, p.verts * 3) : null,
    idx = p.wide ? new Uint32Array(buf, p.idx, p.tris * 3) : new Uint16Array(buf, p.idx, p.tris * 3),
    pos = new Float32Array(p.verts * 3),
    col = new Float32Array(p.verts * 3);
  for (let i = 0; i < pos.length; i++) {
    const a = i % 3;
    pos[i] = p.lo[a] + ((q[i] + 32768) / 65535) * (p.hi[a] - p.lo[a]);
    col[i] = painted ? linear[painted[i]] : colors[m[Math.floor(i / 3)]][a];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  // The source already stores signed 8-bit normals. GPU normalization preserves n/127 and saves
  // nine bytes per vertex on both the CPU and GPU versus expanding to Float32.
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

export function loadSculpt(base = './assets/', variant = '') {
  const stem = variant ? `companion-${variant}` : 'companion',
    key = `${base}${stem}`;
  if (!loading.has(key))
    loading.set(
      key,
      (async () => {
        const manifest = await fetchAsset(`${key}.json?v=${variant ? 11 : 1}`, 'json'),
          buf = await meshBuffer(base, stem, manifest);
        validate(manifest, buf);
        const colors = Object.values(manifest.palette).map(h => new THREE.Color(h).toArray()),
          parts = {};
        Object.defineProperty(parts, 'manifest', {value: manifest});
        for (const p of manifest.parts)
          Object.defineProperty(parts, p.name, {
            enumerable: true,
            configurable: true,
            get() {
              const g = decodePart(p, buf, colors);
              Object.defineProperty(parts, p.name, {enumerable: true, value: g});
              return g;
            }
          });
        return parts;
      })().catch(error => {
        loading.delete(key); // a failed attempt must not poison later retries
        throw error;
      })
    );
  return loading.get(key);
}

export async function loadPreferredSculpt(base = './assets/', variant = '') {
  for (const candidate of variant ? [variant, ''] : ['']) {
    try {
      return await loadSculpt(base, candidate);
    } catch (error) {
      console.warn(`Companion ${candidate || 'original'} unavailable`, error);
    }
  }
  return null; // only if both assets fail, use the existing procedural character
}

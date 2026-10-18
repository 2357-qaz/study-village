// Loads the companion's sculpted parts (tools/sculpt-companion.mjs) into vertex-coloured geometries.
import * as THREE from './vendor/three.module.min.js';

let loading = null;
export function loadSculpt(base = './assets/') {
  loading ??= (async () => {
    const [manifest, buf] = await Promise.all([
      fetch(base + 'companion.json?v=1').then(r => r.json()),
      fetch(base + 'companion.bin?v=1').then(r => r.arrayBuffer())
    ]);
    const colors = Object.values(manifest.palette).map(h => new THREE.Color(h)),
      parts = {};
    for (const p of manifest.parts) {
      const q = new Int16Array(buf, p.pos, p.verts * 3),
        n = new Int8Array(buf, p.nrm, p.verts * 3),
        m = new Uint8Array(buf, p.mat, p.verts),
        idx = p.wide ? new Uint32Array(buf, p.idx, p.tris * 3) : new Uint16Array(buf, p.idx, p.tris * 3),
        pos = new Float32Array(p.verts * 3),
        nrm = new Float32Array(p.verts * 3),
        col = new Float32Array(p.verts * 3);
      for (let i = 0; i < p.verts * 3; i++) {
        const a = i % 3;
        pos[i] = p.lo[a] + ((q[i] + 32768) / 65535) * (p.hi[a] - p.lo[a]);
        nrm[i] = n[i] / 127;
      }
      for (let v = 0; v < p.verts; v++) {
        const c = colors[m[v]];
        col[v * 3] = c.r;
        col[v * 3 + 1] = c.g;
        col[v * 3 + 2] = c.b;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      parts[p.name] = g;
    }
    return parts;
  })();
  return loading;
}

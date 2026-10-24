// Loads the companion's sculpted parts (tools/sculpt-companion.mjs) into vertex-coloured geometries.
import * as THREE from './vendor/three.module.min.js';

const loading = new Map();
export function loadSculpt(base = './assets/', variant = '') {
  const stem = variant ? `companion-${variant}` : 'companion';
  const key = `${base}${stem}`;
  if (!loading.has(key))
    loading.set(
      key,
      (async () => {
        const [manifest, buf] = await Promise.all([
          fetch(`${base}${stem}.json?v=10`).then(r => {
            if (!r.ok) throw new Error(`Companion manifest HTTP ${r.status}`);
            return r.json();
          }),
          fetch(`${base}${stem}.bin?v=10`).then(r => {
            if (!r.ok) throw new Error(`Companion mesh HTTP ${r.status}`);
            return r.arrayBuffer();
          })
        ]);
        const colors = Object.values(manifest.palette).map(h => new THREE.Color(h)),
          parts = {};
        Object.defineProperty(parts, 'manifest', {value: manifest});
        for (const p of manifest.parts) {
          const q = new Int16Array(buf, p.pos, p.verts * 3),
            n = new Int8Array(buf, p.nrm, p.verts * 3),
            m = new Uint8Array(buf, p.mat, p.verts),
            painted = p.col !== undefined ? new Uint8Array(buf, p.col, p.verts * 3) : null,
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
            const c = painted
              ? new THREE.Color().setRGB(
                  painted[v * 3] / 255,
                  painted[v * 3 + 1] / 255,
                  painted[v * 3 + 2] / 255,
                  THREE.SRGBColorSpace
                )
              : colors[m[v]];
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
      })().catch(error => {
        loading.delete(key);
        throw error;
      })
    );
  return loading.get(key);
}

// Tiny signed-distance sculpting kit used offline to build smooth, organic meshes (the reading
// room's companion). A part is a list of ops — add (smooth union), sub (smooth subtraction) and
// cut (smooth intersection) — over primitives; it is meshed with surface nets, vertices are
// projected onto the surface, and each vertex carries the material of its nearest primitive.

const {sqrt, abs, max, min, sin, cos, atan2, hypot} = Math;

/* ---------- primitives: each returns {d(x,y,z), box:[minx,miny,minz,maxx,maxy,maxz]} ---------- */

// iq's round cone between points a and b with radii r1, r2 (a capsule when r1 == r2)
export function roundCone(a, b, r1, r2 = r1) {
  const bx = b[0] - a[0],
    by = b[1] - a[1],
    bz = b[2] - a[2],
    l2 = bx * bx + by * by + bz * bz,
    rr = r1 - r2,
    a2 = l2 - rr * rr,
    il2 = 1 / l2;
  const d = (px, py, pz) => {
    const ax = px - a[0],
      ay = py - a[1],
      az = pz - a[2],
      y = ax * bx + ay * by + az * bz,
      z = y - l2,
      xx = ax * l2 - bx * y,
      xy = ay * l2 - by * y,
      xz = az * l2 - bz * y,
      x2 = xx * xx + xy * xy + xz * xz,
      y2 = y * y * l2,
      z2 = z * z * l2,
      k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
    return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
  };
  const r = max(r1, r2);
  return {
    d,
    box: [
      min(a[0], b[0]) - r,
      min(a[1], b[1]) - r,
      min(a[2], b[2]) - r,
      max(a[0], b[0]) + r,
      max(a[1], b[1]) + r,
      max(a[2], b[2]) + r
    ]
  };
}

// rotation helpers: R is a row-major 3x3 world->local matrix
export function rot(rx = 0, ry = 0, rz = 0) {
  const [cx, sx, cy, sy, cz, sz] = [cos(rx), sin(rx), cos(ry), sin(ry), cos(rz), sin(rz)];
  // local = Rz^T * Rx^T * Ry^T * world  (inverse of YXZ euler world = Ry*Rx*Rz*local)
  const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy],
    Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx],
    Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  const mul = (A, B) =>
    [0, 1, 2].flatMap(i =>
      [0, 1, 2].map(j => A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j])
    );
  const W = mul(mul(Ry, Rx), Rz); // local->world
  return [W[0], W[3], W[6], W[1], W[4], W[7], W[2], W[5], W[8]]; // transpose = world->local
}
function local(c, R, px, py, pz) {
  const x = px - c[0],
    y = py - c[1],
    z = pz - c[2];
  return R
    ? [R[0] * x + R[1] * y + R[2] * z, R[3] * x + R[4] * y + R[5] * z, R[6] * x + R[7] * y + R[8] * z]
    : [x, y, z];
}

// iq's ellipsoid bound at centre c with radii r, optionally rotated
export function ellipsoid(c, r, R = null) {
  const d = (px, py, pz) => {
    const [x, y, z] = local(c, R, px, py, pz),
      k0 = hypot(x / r[0], y / r[1], z / r[2]),
      k1 = hypot(x / (r[0] * r[0]), y / (r[1] * r[1]), z / (r[2] * r[2]));
    return k1 < 1e-9 ? -min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
  };
  const m = max(...r);
  return {d, box: [c[0] - m, c[1] - m, c[2] - m, c[0] + m, c[1] + m, c[2] + m]};
}
export const sphere = (c, r) => ellipsoid(c, [r, r, r]);

// rounded box with half sizes h and corner radius rad
export function box(c, h, rad = 0, R = null) {
  const d = (px, py, pz) => {
    const [x, y, z] = local(c, R, px, py, pz),
      qx = abs(x) - h[0] + rad,
      qy = abs(y) - h[1] + rad,
      qz = abs(z) - h[2] + rad;
    return hypot(max(qx, 0), max(qy, 0), max(qz, 0)) + min(max(qx, qy, qz), 0) - rad;
  };
  const m = hypot(...h);
  return {d, box: [c[0] - m, c[1] - m, c[2] - m, c[0] + m, c[1] + m, c[2] + m]};
}

// torus around the local Y axis (ring in the XZ plane)
export function torus(c, R0, r, Rm = null, arc = null) {
  const d = (px, py, pz) => {
    const [x, y, z] = local(c, Rm, px, py, pz);
    if (arc) {
      // a partial ring: angles in [arc[0], arc[1]] around Y, capped by the end points
      const a = atan2(z, x);
      if (a < arc[0] || a > arc[1]) {
        const e = [arc[0], arc[1]].map(t => hypot(x - R0 * cos(t), y, z - R0 * sin(t)) - r);
        return min(...e);
      }
    }
    return hypot(hypot(x, z) - R0, y) - r;
  };
  const m = R0 + r;
  return {d, box: [c[0] - m, c[1] - m, c[2] - m, c[0] + m, c[1] + m, c[2] + m]};
}

// a swept strand (hair lock, fold): round cones through sampled points with tapering radii
export function strand(points, radii, k = 0.004) {
  const segs = [];
  for (let i = 0; i < points.length - 1; i++)
    segs.push(roundCone(points[i], points[i + 1], radii[i], radii[i + 1]));
  const d = (x, y, z) => {
    let v = segs[0].d(x, y, z);
    for (let i = 1; i < segs.length; i++) v = smin(v, segs[i].d(x, y, z), k);
    return v;
  };
  const b = segs.reduce(
    (acc, s) => [0, 1, 2].map(i => min(acc[i], s.box[i])).concat([3, 4, 5].map(i => max(acc[i], s.box[i]))),
    [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]
  );
  return {d, box: b};
}
// sample a cubic bezier into n points
export function bezier(p0, p1, p2, p3, n = 8) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      u = 1 - t;
    out.push(
      [0, 1, 2].map(
        j => u * u * u * p0[j] + 3 * u * u * t * p1[j] + 3 * u * t * t * p2[j] + t * t * t * p3[j]
      )
    );
  }
  return out;
}

// a hanging cloth cone around the vertical axis through c: from y0 (radius r0) down to y1 (radius r1),
// squashed in z by sz, with `folds` soft pleats whose depth grows towards the hem
export function foldCone(c, y0, y1, r0, r1, {sz = 1, folds = 0, depth = 0, phase = 0, wall = 0} = {}) {
  const d = (px, py, pz) => {
    const x = px - c[0],
      z = (pz - c[2]) / sz,
      y = py;
    const t = Math.min(1, Math.max(0, (y0 - y) / (y0 - y1))),
      a = atan2(z, x),
      r = r0 + (r1 - r0) * t + depth * t * t * sin(folds * a + phase),
      side = (hypot(x, z) - r) * min(1, sz),
      caps = max(y - y0, y1 - y);
    return wall ? max(abs(side) - wall, caps) : max(side, caps);
  };
  const m = max(r0, r1) + depth;
  return {d, box: [c[0] - m, y1 - 0.01, c[2] - m, c[0] + m, y0 + 0.01, c[2] + m]};
}
// a half-space: keeps points with n·p > o (use as a 'cut')
export function plane(n, o) {
  const l = hypot(...n),
    nx = n[0] / l,
    ny = n[1] / l,
    nz = n[2] / l;
  return {d: (x, y, z) => o / l - (nx * x + ny * y + nz * z), box: null};
}
// an arbitrary field with a given bounding box
export const field = (d, box = null) => ({d, box});

/* ---------- blending ---------- */
export function smin(a, b, k) {
  if (k <= 0) return min(a, b);
  const h = max(k - abs(a - b), 0) / k;
  return min(a, b) - h * h * k * 0.25;
}
export const smax = (a, b, k) => -smin(-a, -b, k);

/* ---------- a part: ops evaluated through a bucket grid ---------- */
export class Part {
  constructor(name, {h = 0.004, pad = 0.02} = {}) {
    Object.assign(this, {name, h, pad, ops: []});
  }
  add(prim, mat, k = 0.01) {
    this.ops.push({op: 'add', prim, mat, k});
    return this;
  }
  sub(prim, k = 0.005) {
    this.ops.push({op: 'sub', prim, k});
    return this;
  }
  cut(prim, k = 0.005) {
    this.ops.push({op: 'cut', prim, k});
    return this;
  }
  // recolours the surface inside prim without changing the shape (blush, soles, fold shadows),
  // optionally only where it currently has material `only`
  paint(prim, mat, only = null) {
    (this.paints ??= []).push({prim, mat, only});
    return this;
  }
  prepare() {
    const boxes = this.ops.filter(o => o.op === 'add').map(o => o.prim.box);
    this.bounds = [0, 1, 2]
      .map(i => min(...boxes.map(b => b[i])) - this.pad)
      .concat([3, 4, 5].map(i => max(...boxes.map(b => b[i])) + this.pad));
    const B = this.bounds,
      cs = 0.03;
    this.cs = cs;
    this.bn = [0, 1, 2].map(i => Math.ceil((B[i + 3] - B[i]) / cs));
    this.buckets = new Array(this.bn[0] * this.bn[1] * this.bn[2]).fill(null).map(() => []);
    this.ops.forEach((o, idx) => {
      const b = o.prim.box;
      if (!b || o.op === 'cut') {
        this.buckets.forEach(l => l.push(idx));
        return;
      }
      const m = o.k + this.h * 2,
        lo = [0, 1, 2].map(i => Math.max(0, Math.floor((b[i] - m - B[i]) / cs))),
        hi = [0, 1, 2].map(i => Math.min(this.bn[i] - 1, Math.floor((b[i + 3] + m - B[i]) / cs)));
      for (let i = lo[0]; i <= hi[0]; i++)
        for (let j = lo[1]; j <= hi[1]; j++)
          for (let k = lo[2]; k <= hi[2]; k++) this.buckets[(i * this.bn[1] + j) * this.bn[2] + k].push(idx);
    });
  }
  // returns distance; sets this.lastMat to the material of the nearest added primitive
  eval(x, y, z) {
    const B = this.bounds,
      cs = this.cs,
      i = Math.min(this.bn[0] - 1, Math.max(0, Math.floor((x - B[0]) / cs))),
      j = Math.min(this.bn[1] - 1, Math.max(0, Math.floor((y - B[1]) / cs))),
      k = Math.min(this.bn[2] - 1, Math.max(0, Math.floor((z - B[2]) / cs))),
      list = this.buckets[(i * this.bn[1] + j) * this.bn[2] + k];
    let d = 1,
      best = 1e9,
      mat = 0;
    for (const idx of list) {
      const o = this.ops[idx],
        v = o.prim.d(x, y, z);
      if (o.op === 'add') {
        d = smin(d, v, o.k);
        if (v < best) (best = v), (mat = o.mat);
      } else if (o.op === 'sub') d = smax(d, -v, o.k);
      else d = smax(d, v, o.k);
    }
    this.lastMat = mat;
    return d;
  }
}

/* ---------- meshing: surface nets + projection onto the surface ---------- */
export function mesh(part) {
  part.prepare();
  const h = part.h,
    B = part.bounds,
    nx = Math.ceil((B[3] - B[0]) / h) + 1,
    ny = Math.ceil((B[4] - B[1]) / h) + 1,
    nz = Math.ceil((B[5] - B[2]) / h) + 1,
    V = new Float32Array(nx * ny * nz),
    at = (i, j, k) => (i * ny + j) * nz + k;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      for (let k = 0; k < nz; k++) V[at(i, j, k)] = part.eval(B[0] + i * h, B[1] + j * h, B[2] + k * h);
  const cell = new Int32Array((nx - 1) * (ny - 1) * nz).fill(-1),
    cat = (i, j, k) => (i * (ny - 1) + j) * (nz - 1) + k,
    pos = [],
    idx = [];
  const E = [
    [0, 0, 0, 1, 0, 0],
    [0, 1, 0, 1, 1, 0],
    [0, 0, 1, 1, 0, 1],
    [0, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1, 0],
    [1, 0, 0, 1, 1, 0],
    [0, 0, 1, 0, 1, 1],
    [1, 0, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 1],
    [1, 0, 0, 1, 0, 1],
    [0, 1, 0, 0, 1, 1],
    [1, 1, 0, 1, 1, 1]
  ];
  for (let i = 0; i < nx - 1; i++)
    for (let j = 0; j < ny - 1; j++)
      for (let k = 0; k < nz - 1; k++) {
        let sx = 0,
          sy = 0,
          sz = 0,
          n = 0;
        for (const [a, b, c, d, e, f] of E) {
          const v0 = V[at(i + a, j + b, k + c)],
            v1 = V[at(i + d, j + e, k + f)];
          if (v0 < 0 !== v1 < 0) {
            const t = v0 / (v0 - v1);
            sx += a + (d - a) * t;
            sy += b + (e - b) * t;
            sz += c + (f - c) * t;
            n++;
          }
        }
        if (!n) continue;
        cell[cat(i, j, k)] = pos.length / 3;
        pos.push(B[0] + (i + sx / n) * h, B[1] + (j + sy / n) * h, B[2] + (k + sz / n) * h);
      }
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c);
    else idx.push(a, b, c, a, c, d);
  };
  for (let i = 0; i < nx - 1; i++)
    for (let j = 1; j < ny - 1; j++)
      for (let k = 1; k < nz - 1; k++) {
        const v0 = V[at(i, j, k)],
          v1 = V[at(i + 1, j, k)];
        if (v0 < 0 !== v1 < 0)
          quad(
            cell[cat(i, j - 1, k - 1)],
            cell[cat(i, j, k - 1)],
            cell[cat(i, j, k)],
            cell[cat(i, j - 1, k)],
            v0 < 0
          );
      }
  for (let i = 1; i < nx - 1; i++)
    for (let j = 0; j < ny - 1; j++)
      for (let k = 1; k < nz - 1; k++) {
        const v0 = V[at(i, j, k)],
          v1 = V[at(i, j + 1, k)];
        if (v0 < 0 !== v1 < 0)
          quad(
            cell[cat(i - 1, j, k - 1)],
            cell[cat(i - 1, j, k)],
            cell[cat(i, j, k)],
            cell[cat(i, j, k - 1)],
            v0 < 0
          );
      }
  for (let i = 1; i < nx - 1; i++)
    for (let j = 1; j < ny - 1; j++)
      for (let k = 0; k < nz - 1; k++) {
        const v0 = V[at(i, j, k)],
          v1 = V[at(i, j, k + 1)];
        if (v0 < 0 !== v1 < 0)
          quad(
            cell[cat(i - 1, j - 1, k)],
            cell[cat(i, j - 1, k)],
            cell[cat(i, j, k)],
            cell[cat(i - 1, j, k)],
            v0 < 0
          );
      }
  // project vertices onto the surface, then take normals from the field gradient
  const nrm = new Float32Array(pos.length),
    mats = new Uint8Array(pos.length / 3),
    e = h * 0.5;
  const grad = (x, y, z) => {
    const gx = part.eval(x + e, y, z) - part.eval(x - e, y, z),
      gy = part.eval(x, y + e, z) - part.eval(x, y - e, z),
      gz = part.eval(x, y, z + e) - part.eval(x, y, z - e),
      l = hypot(gx, gy, gz) || 1;
    return [gx / l, gy / l, gz / l];
  };
  for (let v = 0; v < pos.length; v += 3) {
    let [x, y, z] = [pos[v], pos[v + 1], pos[v + 2]];
    for (let it = 0; it < 2; it++) {
      const dd = part.eval(x, y, z),
        g = grad(x, y, z),
        s = Math.max(-h, Math.min(h, dd));
      x -= g[0] * s;
      y -= g[1] * s;
      z -= g[2] * s;
    }
    pos[v] = x;
    pos[v + 1] = y;
    pos[v + 2] = z;
    const g = grad(x, y, z);
    nrm[v] = g[0];
    nrm[v + 1] = g[1];
    nrm[v + 2] = g[2];
    part.eval(x, y, z);
    mats[v / 3] = part.lastMat;
    for (const q of part.paints || [])
      if (q.prim.d(x, y, z) < 0 && (q.only === null || q.only === mats[v / 3])) mats[v / 3] = q.mat;
  }
  // make every triangle face outwards (agree with the field's gradient)
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3],
      ux = pos[b] - pos[a],
      uy = pos[b + 1] - pos[a + 1],
      uz = pos[b + 2] - pos[a + 2],
      vx = pos[c] - pos[a],
      vy = pos[c + 1] - pos[a + 1],
      vz = pos[c + 2] - pos[a + 2],
      fx = uy * vz - uz * vy,
      fy = uz * vx - ux * vz,
      fz = ux * vy - uy * vx;
    if (
      fx * (nrm[a] + nrm[b] + nrm[c]) +
        fy * (nrm[a + 1] + nrm[b + 1] + nrm[c + 1]) +
        fz * (nrm[a + 2] + nrm[b + 2] + nrm[c + 2]) <
      0
    ) {
      const tmp = idx[t + 1];
      idx[t + 1] = idx[t + 2];
      idx[t + 2] = tmp;
    }
  }
  return {
    name: part.name,
    pos: new Float32Array(pos),
    nrm,
    mats,
    idx: pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx)
  };
}

/* ---------- binary export ---------- */
// layout per part: Int16 positions (quantised to the part's box), Int8 normals, Uint8 materials,
// indices (Uint16 or Uint32); every block 4-byte aligned. The manifest describes the offsets.
export function pack(meshes, palette) {
  const chunks = [],
    parts = [];
  let off = 0;
  const push = arr => {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength),
      o = off;
    chunks.push(bytes);
    off += bytes.length;
    const padN = (4 - (off % 4)) % 4;
    if (padN) {
      chunks.push(new Uint8Array(padN));
      off += padN;
    }
    return o;
  };
  for (const m of meshes) {
    const n = m.pos.length / 3,
      lo = [1e9, 1e9, 1e9],
      hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < n; i++)
      for (let a = 0; a < 3; a++) {
        lo[a] = min(lo[a], m.pos[i * 3 + a]);
        hi[a] = max(hi[a], m.pos[i * 3 + a]);
      }
    const q = new Int16Array(n * 3),
      nq = new Int8Array(n * 3);
    for (let i = 0; i < n * 3; i++) {
      const a = i % 3,
        span = hi[a] - lo[a] || 1;
      q[i] = Math.round(((m.pos[i] - lo[a]) / span) * 65535 - 32768);
      nq[i] = Math.round(m.nrm[i] * 127);
    }
    parts.push({
      name: m.name,
      verts: n,
      tris: m.idx.length / 3,
      lo,
      hi,
      wide: m.idx instanceof Uint32Array,
      pos: push(q),
      nrm: push(nq),
      mat: push(m.mats),
      idx: push(m.idx)
    });
  }
  const buf = new Uint8Array(off);
  let o = 0;
  for (const c of chunks) {
    buf.set(c, o);
    o += c.length;
  }
  return {manifest: {palette, parts}, buf};
}

/* ---------- decimation (offline only: npm i --no-save meshoptimizer@0.22.0) ---------- */
// Keeps a subset of the original vertices (edge collapses onto existing vertices), so normals and
// materials stay valid; then drops unused vertices.
export async function simplify(m, ratio, error = 0.002) {
  const {MeshoptSimplifier: S} = await import('meshoptimizer');
  await S.ready;
  const target = Math.max(3, Math.floor((m.idx.length * ratio) / 3) * 3),
    [out] = S.simplify(new Uint32Array(m.idx), m.pos, 3, target, error, ['LockBorder']),
    remap = new Int32Array(m.pos.length / 3).fill(-1),
    pos = [],
    nrm = [],
    mats = [];
  for (const v of out)
    if (remap[v] < 0) {
      remap[v] = pos.length / 3;
      pos.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]);
      nrm.push(m.nrm[v * 3], m.nrm[v * 3 + 1], m.nrm[v * 3 + 2]);
      mats.push(m.mats[v]);
    }
  const idx = Array.from(out, v => remap[v]);
  return {
    name: m.name,
    pos: new Float32Array(pos),
    nrm: new Float32Array(nrm),
    mats: new Uint8Array(mats),
    idx: pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx)
  };
}

import * as THREE from './vendor/three.module.min.js';
// Procedural low-poly models. Every model is written against a Builder, so the same code can be
// baked into a few merged meshes (village), rendered as live meshes (ghost preview) or with rich
// materials (collectible viewer).
const PI = Math.PI,
  H = PI / 2;
export const P = {
  wall: 0xf1e5c3,
  wall2: 0xe9d6ad,
  wall3: 0xf4ead2,
  timber: 0x7b5b3f,
  dark: 0x56412f,
  plinth: 0xbab3a2,
  stone: 0xaaa597,
  stone2: 0x8d897d,
  stone3: 0xc9c2b0,
  glass: 0xc5ddd6,
  door: 0x8b6242,
  sill: 0xdcc9a2,
  brick: 0xb8714f,
  roofR: 0xc8744f,
  roofB: 0x5f81a6,
  roofG: 0x6c9070,
  roofP: 0x7a70b2,
  roofBr: 0xa86c45,
  roofT: 0x4f6e6a,
  gold: 0xe8bd52,
  leaf: 0x6e9c5b,
  leaf2: 0x88ae67,
  leaf3: 0x527f52,
  trunk: 0x8a6a4a,
  straw: 0xe6c977,
  red: 0xd0614e,
  white: 0xf7f2e6,
  metal: 0x8f9aa3,
  rope: 0xcab38b,
  soil: 0x8f6c49,
  water: 0x7ec6c0,
  cloth: 0xf0e3c8,
  pink: 0xf2b3c4,
  flowerbox: 0x8a6448
};
export function shade(c, l) {
  const col = new THREE.Color(c);
  col.offsetHSL(0, 0, l);
  return col.getHex();
}
const G = new Map();
function cached(key, make) {
  let g = G.get(key);
  if (!g) {
    g = make();
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    G.set(key, g);
  }
  return g;
}
const unitBox = () => cached('box', () => new THREE.BoxGeometry(1, 1, 1));
function unitCyl(rt, rb, n, open) {
  const m = Math.max(rt, rb) || 1;
  return cached(
    `cyl${(rt / m).toFixed(3)}:${(rb / m).toFixed(3)}:${n}:${open ? 1 : 0}`,
    () => new THREE.CylinderGeometry(rt / m, rb / m, 1, n, 1, !!open)
  );
}
const unitIco = d => cached('ico' + d, () => new THREE.IcosahedronGeometry(1, d));
const unitSph = (ws, hs, t0, tl) =>
  cached(`sph${ws}:${hs}:${t0}:${tl}`, () => new THREE.SphereGeometry(1, ws, hs, 0, PI * 2, t0, tl));
const unitPrism = () =>
  cached('prism', () => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.5, 0);
    sh.lineTo(0.5, 0);
    sh.lineTo(0, 1);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, {depth: 1, bevelEnabled: false});
    g.translate(0, 0, -0.5);
    return g;
  });
const unitTor = (R, n, m, arc) =>
  cached(`tor${R}:${n}:${m}:${arc}`, () => new THREE.TorusGeometry(1, R, n, m, arc));
const _e = new THREE.Euler(),
  _q = new THREE.Quaternion(),
  _p = new THREE.Vector3(),
  _s = new THREE.Vector3();
function local(x, y, z, o, sx = 1, sy = 1, sz = 1) {
  const s = o?.s ?? 1;
  _e.set(o?.rx || 0, o?.ry || 0, o?.rz || 0, 'YXZ');
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx * s * (o?.sx ?? 1), sy * s * (o?.sy ?? 1), sz * s * (o?.sz ?? 1));
  return new THREE.Matrix4().compose(_p, _q, _s);
}
export class Builder {
  constructor(sink) {
    this.sink = sink;
    this.m = new THREE.Matrix4();
    this.st = [];
  }
  push(x = 0, y = 0, z = 0, o) {
    this.st.push(this.m.clone());
    this.m.multiply(local(x, y, z, o));
    return this;
  }
  pop() {
    this.m = this.st.pop();
    return this;
  }
  at(x, y, z, o, fn) {
    if (typeof o === 'function') {
      fn = o;
      o = null;
    }
    this.push(x, y, z, o);
    fn();
    this.pop();
  }
  add(g, c, x, y, z, o, sx, sy, sz) {
    this.sink.add(g, c, new THREE.Matrix4().multiplyMatrices(this.m, local(x, y, z, o, sx, sy, sz)), o || {});
  }
  box(w, h, d, c, x = 0, y = 0, z = 0, o) {
    this.add(unitBox(), c, x, y, z, o, w, h, d);
  }
  cyl(rt, rb, h, c, x = 0, y = 0, z = 0, n = 8, o) {
    const m = Math.max(rt, rb);
    this.add(unitCyl(rt, rb, n, o?.open), c, x, y, z, o, m, h, m);
  }
  cone(r, h, c, x = 0, y = 0, z = 0, n = 7, o) {
    this.cyl(0, r, h, c, x, y, z, n, o);
  }
  ball(r, c, x = 0, y = 0, z = 0, o) {
    this.add(unitIco(o?.detail ?? 0), c, x, y, z, o, r, r, r);
  }
  sph(r, c, x = 0, y = 0, z = 0, o) {
    this.add(unitSph(o?.ws ?? 10, o?.hs ?? 7, o?.t0 ?? 0, o?.tl ?? PI), c, x, y, z, o, r, r, r);
  }
  prism(w, h, d, c, x = 0, y = 0, z = 0, o) {
    this.add(unitPrism(), c, x, y, z, o, w, h, d);
  }
  tor(R, r, c, x = 0, y = 0, z = 0, o) {
    this.add(unitTor(+(r / R).toFixed(3), o?.n ?? 6, o?.m ?? 16, o?.arc ?? PI * 2), c, x, y, z, o, R, R, R);
  }
  geo(g, c, x = 0, y = 0, z = 0, o) {
    this.add(g, c, x, y, z, o);
  }
  dyn(anim, fn, x = 0, y = 0, z = 0, o) {
    const grp = this.sink.dynamic(new THREE.Matrix4().multiplyMatrices(this.m, local(x, y, z, o)), anim);
    const sub = new Builder(new LiveSink(grp, this.sink.matFn));
    fn(sub, grp);
    return grp;
  }
}
export class LiveSink {
  constructor(root, matFn) {
    this.root = root;
    this.matFn = matFn;
  }
  add(g, c, m, o) {
    const mesh = new THREE.Mesh(g, this.matFn(c, o));
    mesh.applyMatrix4(m);
    mesh.castShadow = !o.noShadow;
    mesh.receiveShadow = true;
    this.root.add(mesh);
  }
  dynamic(m, anim) {
    const grp = new THREE.Group();
    grp.applyMatrix4(m);
    grp.userData.anim = anim;
    this.root.add(grp);
    return grp;
  }
}
const _v = new THREE.Vector3(),
  _c = new THREE.Color();
export class Acc {
  constructor() {
    this.p = [];
    this.c = [];
    this.o = [];
  }
  push(g, color, m, owner) {
    const pos = g.attributes.position;
    _c.setHex(color);
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(m);
      this.p.push(_v.x, _v.y, _v.z);
      this.c.push(_c.r, _c.g, _c.b);
    }
    for (let i = 0; i < pos.count / 3; i++) this.o.push(owner);
  }
  tri(a, b, c, color, owner) {
    _c.setHex(color);
    for (const v of [a, b, c]) {
      this.p.push(v[0], v[1], v[2]);
      this.c.push(_c.r, _c.g, _c.b);
    }
    this.o.push(owner);
  }
  // Quad with outward normal hint so winding is always correct.
  quad(a, b, c, d, color, owner, n) {
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2],
      vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    const cx = uy * vz - uz * vy,
      cy = uz * vx - ux * vz,
      cz = ux * vy - uy * vx;
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) {
      this.tri(a, c, b, color, owner);
      this.tri(a, d, c, color, owner);
    } else {
      this.tri(a, b, c, color, owner);
      this.tri(a, c, d, color, owner);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    g.userData.owners = Int32Array.from(this.o);
    return g;
  }
}
export class BakeSink {
  constructor(matFn) {
    this.solid = new Acc();
    this.glow = new Acc();
    this.owner = 0;
    this.dyn = [];
    this.matFn = matFn;
  }
  add(g, c, m, o) {
    (o.glow ? this.glow : this.solid).push(g, c, m, this.owner);
  }
  dynamic(m, anim) {
    const grp = new THREE.Group();
    grp.applyMatrix4(m);
    grp.userData.anim = anim;
    grp.userData.owner = this.owner;
    this.dyn.push(grp);
    return grp;
  }
}

/* ---------- architectural helpers ---------- */
function plinth(b, w, d, h = 0.12, c = P.plinth) {
  b.box(w, h, d, c, 0, h / 2, 0);
  b.box(w + 0.04, 0.03, d + 0.04, shade(c, -0.06), 0, 0.015, 0);
}
function frame(b, w, h, d, y) {
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) b.box(0.075, h, 0.075, P.timber, (sx * w) / 2, y + h / 2, (sz * d) / 2);
  b.box(w + 0.06, 0.07, d + 0.06, P.timber, 0, y + h - 0.035, 0);
  b.box(w + 0.05, 0.05, d + 0.05, P.timber, 0, y + 0.025, 0);
}
function braces(b, w, h, y, z) {
  for (const s of [-1, 1])
    b.box(0.05, Math.hypot(w * 0.22, h) * 0.9, 0.03, P.timber, s * w * 0.39, y + h / 2, z, {
      rz: s * Math.atan2(w * 0.22, h)
    });
}
function win(b, x, y, z, ry = 0, w = 0.22, h = 0.26, flowers = false) {
  b.at(x, y, z, {ry}, () => {
    b.box(w + 0.07, h + 0.07, 0.04, P.timber, 0, 0, 0);
    b.box(w, h, 0.05, P.glass, 0, 0, 0.008, {glow: 1});
    b.box(0.024, h, 0.065, P.timber, 0, 0, 0.012);
    b.box(w, 0.024, 0.065, P.timber, 0, 0, 0.012);
    b.box(w + 0.1, 0.035, 0.08, P.sill, 0, -h / 2 - 0.045, 0.03);
    if (flowers) {
      b.box(w + 0.04, 0.07, 0.08, P.flowerbox, 0, -h / 2 - 0.1, 0.07);
      for (let i = 0; i < 4; i++)
        b.ball(
          0.033,
          [0xf08aa0, 0xf5d36a, 0xffffff, 0xc8a6e8][i],
          -w * 0.42 + i * w * 0.28,
          -h / 2 - 0.05,
          0.08
        );
      b.ball(0.04, P.leaf, 0, -h / 2 - 0.06, 0.06, {sx: 3.2, sy: 0.6});
    }
  });
}
function arched(b, x, y, z, ry = 0, w = 0.2, h = 0.36) {
  b.at(x, y, z, {ry}, () => {
    b.box(w + 0.06, h, 0.04, P.stone3, 0, 0, 0);
    b.box(w, h - 0.04, 0.05, P.glass, 0, -0.02, 0.008, {glow: 1});
    b.cyl(w / 2, w / 2, 0.05, P.glass, 0, h / 2 - 0.02, 0.008, 10, {rx: H, glow: 1});
    b.cyl(w / 2 + 0.03, w / 2 + 0.03, 0.04, P.stone3, 0, h / 2 - 0.02, -0.004, 10, {rx: H});
    b.box(0.02, h, 0.06, P.dark, 0, 0, 0.012);
  });
}
function door(b, x, y, z, ry = 0, w = 0.24, h = 0.4, c = P.door) {
  b.at(x, y, z, {ry}, () => {
    b.box(w + 0.07, h + 0.05, 0.04, P.timber, 0, h / 2, 0);
    b.box(w, h, 0.05, c, 0, h / 2 - 0.012, 0.008);
    for (let i = 1; i < 4; i++)
      b.box(0.012, h - 0.04, 0.056, shade(c, -0.08), -w / 2 + (i * w) / 4, h / 2 - 0.012, 0.01);
    b.ball(0.02, P.gold, w * 0.3, h * 0.45, 0.045);
    b.box(w + 0.18, 0.05, 0.17, P.plinth, 0, -0.02, 0.08);
  });
}
function gable(b, w, d, h, c, y, o = {}) {
  const oh = o.oh ?? 0.1,
    a = Math.atan2(h, d / 2),
    hz = d / 2 + oh,
    L = hz / Math.cos(a);
  b.prism(d - 0.02, h, w - 0.02, o.wall ?? P.wall, 0, y, 0, {ry: H});
  for (const s of [-1, 1])
    b.at(0, y + h - (hz / 2) * Math.tan(a) + 0.02, (s * hz) / 2, {rx: s * a}, () => {
      b.box(w + oh * 2, 0.07, L, c, 0, 0, 0);
      for (let k = 1; k < 5; k++)
        b.box(w + oh * 2 + 0.012, 0.024, 0.035, shade(c, -0.09), 0, 0.045, -L / 2 + (L * k) / 5);
      b.box(w + oh * 2 + 0.02, 0.09, 0.06, shade(c, -0.14), 0, -0.005, L / 2 - 0.02);
    });
  b.box(w + oh * 2 + 0.05, 0.085, 0.11, shade(c, -0.16), 0, y + h + 0.02, 0);
}
function hip(b, w, d, h, c, y) {
  b.cyl(0, 0.7072, h, c, 0, y + h / 2, 0, 4, {ry: PI / 4, sx: w + 0.24, sz: d + 0.24});
  b.box(0.07, 0.07, 0.07, shade(c, -0.15), 0, y + h, 0);
}
function chimney(b, x, y, z, h = 0.5, smoke = true) {
  b.box(0.2, h, 0.2, P.brick, x, y + h / 2, z);
  b.box(0.24, 0.06, 0.24, P.stone2, x, y + h, z);
  if (smoke)
    b.dyn(
      {type: 'smoke'},
      s => {
        for (let i = 0; i < 3; i++)
          s.ball(0.07, 0xf4f2ee, 0, 0, 0, {mat: {opacity: 0.75}, noShadow: 1, detail: 1});
      },
      x,
      y + h + 0.05,
      z
    );
}
function lantern(b, x, y, z, post = true) {
  if (post) {
    b.box(0.05, 0.5, 0.05, P.dark, x, y + 0.25, z);
    b.box(0.18, 0.03, 0.03, P.dark, x + 0.06, y + 0.5, z);
  }
  b.at(post ? x + 0.13 : x, post ? y + 0.42 : y, z, () => {
    b.box(0.09, 0.11, 0.09, 0xffe7a8, 0, 0, 0, {glow: 1});
    b.cone(0.08, 0.07, P.dark, 0, 0.09, 0, 4, {ry: PI / 4});
    b.box(0.1, 0.02, 0.1, P.dark, 0, -0.06, 0);
  });
}
function crate(b, x, y, z, s = 0.22, ry = 0) {
  b.at(x, y, z, {ry}, () => {
    b.box(s, s, s, 0xc29a65, 0, s / 2, 0);
    b.box(s + 0.01, 0.03, s + 0.01, 0x9c7448, 0, s * 0.8, 0);
    b.box(s + 0.01, 0.03, s + 0.01, 0x9c7448, 0, s * 0.2, 0);
  });
}
function barrel(b, x, y, z, s = 1) {
  b.at(x, y, z, {s}, () => {
    b.cyl(0.1, 0.1, 0.26, 0xa57a4c, 0, 0.13, 0, 10);
    b.cyl(0.105, 0.105, 0.025, P.dark, 0, 0.05, 0, 10);
    b.cyl(0.105, 0.105, 0.025, P.dark, 0, 0.21, 0, 10);
  });
}
function sack(b, x, y, z) {
  b.ball(0.1, 0xe2cfa1, x, y + 0.08, z, {sy: 0.9, detail: 1});
  b.cyl(0.03, 0.05, 0.06, 0xd1bb88, x, y + 0.18, z, 6);
}
function logs(b, x, y, z, n = 5, len = 0.8, ry = 0) {
  b.at(x, y, z, {ry}, () => {
    let i = 0;
    for (let row = 0; i < n; row++)
      for (let k = 0; k < 3 - row && i < n; k++, i++) {
        const px = -0.12 * (2 - row) + k * 0.24;
        b.cyl(0.11, 0.11, len, 0x9f7a50, px, 0.11 + row * 0.19, 0, 8, {rz: H});
        b.cyl(0.085, 0.085, len + 0.012, 0xd9b98a, px, 0.11 + row * 0.19, 0, 8, {rz: H});
      }
  });
}
function smallTree(b, x, y, z, s = 1, kind = 0) {
  b.at(x, y, z, {s}, () => {
    b.cyl(0.04, 0.06, 0.3, P.trunk, 0, 0.15, 0, 5);
    if (kind % 2) {
      b.cone(0.24, 0.42, P.leaf3, 0, 0.45, 0, 6);
      b.cone(0.18, 0.32, P.leaf, 0, 0.66, 0, 6);
    } else {
      b.ball(0.22, P.leaf, 0, 0.45, 0, {detail: 0});
      b.ball(0.15, P.leaf2, 0.08, 0.6, 0.04);
    }
  });
}
function flag(b, x, y, z, c, h = 0.5) {
  b.cyl(0.015, 0.015, h, P.dark, x, y + h / 2, z, 5);
  b.ball(0.025, P.gold, x, y + h + 0.01, z);
  b.dyn(
    {type: 'flag'},
    s => {
      s.box(0.24, 0.14, 0.015, c, 0.12, 0, 0);
      s.prism(0.14, 0.06, 0.015, c, 0.27, 0, 0, {rz: -H});
    },
    x,
    y + h - 0.09,
    z
  );
}
function bench(b, x, y, z, ry = 0) {
  b.at(x, y, z, {ry}, () => {
    for (const s of [-1, 1]) {
      b.box(0.04, 0.18, 0.2, P.dark, s * 0.22, 0.09, 0);
    }
    for (let i = 0; i < 3; i++) b.box(0.55, 0.025, 0.055, 0xb98a5a, 0, 0.19, -0.06 + i * 0.06);
    for (let i = 0; i < 2; i++) b.box(0.55, 0.05, 0.025, 0xb98a5a, 0, 0.3 + i * 0.07, -0.1, {rx: -0.15});
  });
}
function fenceRun(b, x, z, len, ry = 0, y = 0) {
  b.at(x, y, z, {ry}, () => {
    const n = Math.max(1, Math.round(len / 0.3));
    for (let i = 0; i <= n; i++) b.box(0.05, 0.28, 0.05, 0xe2d6b2, -len / 2 + (i * len) / n, 0.14, 0);
    b.box(len, 0.035, 0.03, 0xd6c69f, 0, 0.12, 0);
    b.box(len, 0.035, 0.03, 0xd6c69f, 0, 0.22, 0);
  });
}
function stars(b, lv, y, z = 0.8) {
  if (lv > 1) for (let i = 0; i < lv - 1; i++) b.ball(0.045, P.gold, -0.18 + i * 0.12, y, z, {glow: 1});
}

/* ---------- buildings (footprint centred at origin, front facing +z) ---------- */
const BUILD = {
  cottage(b, lv) {
    b.at(-0.24, 0, 0.2, () => {
      plinth(b, 1.24, 0.94);
      b.box(1.12, 0.72, 0.84, P.wall, 0, 0.48, 0);
      frame(b, 1.12, 0.72, 0.84, 0.12);
      braces(b, 1.12, 0.62, 0.15, 0.425);
      win(b, -0.32, 0.52, 0.43, 0, 0.22, 0.26, lv >= 2);
      win(b, 0.32, 0.52, 0.43, 0, 0.22, 0.26, lv >= 2);
      door(b, 0, 0.12, 0.43);
      win(b, -0.57, 0.5, 0, -H);
      win(b, 0.57, 0.5, 0, H);
      gable(b, 1.12, 0.84, 0.56, P.roofR, 0.84);
      chimney(b, 0.3, 0.98, -0.18, 0.46, lv >= 2);
      if (lv >= 4) {
        b.at(-0.28, 1.08, 0.27, () => {
          b.box(0.3, 0.26, 0.3, P.wall, 0, 0.13, 0);
          win(b, 0, 0.13, 0.155, 0, 0.15, 0.15);
          gable(b, 0.3, 0.3, 0.18, P.roofR, 0.26, {oh: 0.05});
        });
      }
      b.box(0.5, 0.03, 0.18, 0xe4d6b0, 0, 0.135, 0.6);
    });
    b.at(0.52, 0, -0.46, () => {
      const th = 1.32 + (lv >= 3 ? 0.3 : 0);
      b.cyl(0.38, 0.42, 0.14, P.plinth, 0, 0.07, 0, 12);
      b.cyl(0.31, 0.34, th, P.wall2, 0, 0.14 + th / 2, 0, 12);
      for (const f of [0.33, 0.66]) b.cyl(0.335, 0.335, 0.05, P.timber, 0, 0.14 + th * f, 0, 12);
      b.at(0, 0.14 + th * 0.82, 0.3, () => {
        b.cyl(0.14, 0.14, 0.04, P.white, 0, 0, 0, 18, {rx: H});
        b.cyl(0.155, 0.155, 0.03, P.timber, 0, 0, -0.012, 18, {rx: H});
        b.dyn({type: 'clock', hand: 'h'}, s => s.box(0.022, 0.08, 0.012, P.dark, 0, 0.035, 0), 0, 0, 0.03);
        b.dyn({type: 'clock', hand: 'm'}, s => s.box(0.016, 0.11, 0.012, P.dark, 0, 0.05, 0), 0, 0, 0.04);
      });
      arched(b, 0, 0.14 + th * 0.48, 0.31, 0, 0.13, 0.24);
      if (lv >= 4) {
        b.cyl(0.43, 0.43, 0.04, P.timber, 0, 0.14 + th, 0, 12);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * PI * 2;
          b.box(0.03, 0.14, 0.03, P.timber, Math.cos(a) * 0.41, 0.14 + th + 0.08, Math.sin(a) * 0.41);
        }
        b.tor(0.41, 0.012, P.timber, 0, 0.14 + th + 0.15, 0, {rx: H, m: 20});
      }
      b.cyl(0, 0.45, 0.62, P.roofP, 0, 0.14 + th + 0.31, 0, 12);
      b.cyl(0.47, 0.47, 0.03, shade(P.roofP, -0.12), 0, 0.14 + th + 0.01, 0, 12);
      flag(b, 0, 0.14 + th + 0.58, 0, lv >= 5 ? P.gold : 0xe7a34d, 0.42);
    });
    // reading corner: book piles and bench
    b.at(0.42, 0, 0.55, () => {
      const cs = [0xb5544a, 0x4f7aa3, 0xd8b04f, 0x6c9a63, 0x8c6bb0];
      for (let i = 0; i < 5; i++)
        b.box(0.2 - 0.012 * i, 0.045, 0.15, cs[i], 0, 0.025 + i * 0.047, 0, {ry: i * 0.25});
    });
    if (lv >= 3) {
      b.at(-0.68, 0, -0.48, () => {
        plinth(b, 0.6, 0.5);
        b.box(0.52, 0.46, 0.42, P.wall3, 0, 0.35, 0);
        frame(b, 0.52, 0.46, 0.42, 0.12);
        win(b, 0, 0.38, 0.215, 0, 0.18, 0.18);
        gable(b, 0.52, 0.42, 0.3, P.roofR, 0.58, {oh: 0.07});
      });
    }
    if (lv >= 2) lantern(b, 0.05, 0, 0.82);
    if (lv >= 5) {
      bench(b, -0.6, 0, 0.82);
      b.ball(0.07, P.gold, 0.52, 2.62, -0.46, {glow: 1});
    }
    stars(b, lv, 0.06, 0.9);
  },
  sawmill(b, lv) {
    b.at(-0.3, 0, -0.28, () => {
      plinth(b, 1.1, 0.9);
      b.box(1.0, 0.66, 0.8, 0xe5d3ad, 0, 0.45, 0);
      frame(b, 1.0, 0.66, 0.8, 0.12);
      for (let i = 0; i < 6; i++) b.box(0.012, 0.6, 0.81, 0xcdb68b, -0.42 + i * 0.17, 0.45, 0);
      win(b, -0.25, 0.5, 0.41, 0, 0.22, 0.24, lv >= 3);
      door(b, 0.22, 0.12, 0.41, 0, 0.28, 0.42, 0x7d6a52);
      win(b, -0.51, 0.5, 0, -H);
      gable(b, 1.0, 0.8, 0.52, P.roofG, 0.78);
      chimney(b, -0.28, 0.95, -0.2, 0.38, lv >= 2);
      if (lv >= 4) {
        b.at(0.6, 0, -0.05, () => {
          b.box(0.3, 0.5, 0.6, 0xe5d3ad, 0, 0.37, 0);
          b.box(0.36, 0.05, 0.66, shade(P.roofG, -0.05), 0, 0.66, 0, {rz: -0.25});
        });
      }
    });
    // open saw shed
    b.at(0.42, 0, 0.42, () => {
      for (const [x, z] of [
        [-0.38, -0.3],
        [0.38, -0.3],
        [-0.38, 0.32],
        [0.38, 0.32]
      ])
        b.box(0.07, 0.68, 0.07, P.timber, x, 0.34, z);
      b.box(0.95, 0.05, 0.82, shade(P.roofG, 0.04), 0, 0.72, 0, {rx: -0.12});
      for (let k = 0; k < 4; k++)
        b.box(0.97, 0.02, 0.03, shade(P.roofG, -0.08), 0, 0.75, -0.3 + k * 0.2, {rx: -0.12});
      b.box(0.6, 0.2, 0.3, 0xa98457, 0, 0.1, 0);
      b.box(0.64, 0.03, 0.34, 0x8b6a44, 0, 0.21, 0);
      b.cyl(0.06, 0.06, 0.5, 0xd4b07c, -0.05, 0.27, 0, 8, {rz: H});
      b.dyn(
        {type: 'spin', axis: 'z', speed: 6},
        s => {
          s.cyl(0.17, 0.17, 0.02, 0xc8d0d5, 0, 0, 0, 14, {rx: H, mat: {metal: 0.6, rough: 0.35}});
          s.cyl(0.04, 0.04, 0.03, P.dark, 0, 0, 0, 8, {rx: H});
          for (let i = 0; i < 8; i++) {
            const a = (i * PI) / 4;
            s.box(0.035, 0.035, 0.021, 0xa9b2b8, Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0, {rz: a + PI / 4});
          }
        },
        0.12,
        0.28,
        0.17
      );
    });
    logs(b, -0.55, 0, 0.5, lv >= 3 ? 6 : 5, 0.62, H);
    if (lv >= 2) logs(b, 0.62, 0, -0.62, 3, 0.5, 0);
    crate(b, 0.05, 0, 0.82, 0.18);
    if (lv >= 5) {
      flag(b, -0.85, 0, -0.8, 0x79a977, 0.9);
      lantern(b, 0.85, 0, 0.85, true);
    }
    if (lv >= 3)
      b.at(-0.05, 0, -0.85, () => {
        b.cyl(0.09, 0.11, 0.12, 0x9f7a50, 0, 0.06, 0, 8);
        b.box(0.03, 0.2, 0.03, P.timber, 0.02, 0.18, 0, {rz: 0.4});
        b.box(0.08, 0.05, 0.02, 0xc8d0d5, 0.07, 0.26, 0, {rz: 0.4});
      });
    stars(b, lv, 0.06, 0.95);
  },
  quarry(b, lv) {
    const rock = [0xa5aea7, 0x96a09a, 0xb6bdb3, 0x8b948f];
    b.at(-0.2, 0, -0.3, () => {
      b.ball(0.6, rock[0], 0, 0.38, 0, {sy: 0.85, sx: 1.25, detail: 0});
      b.ball(0.42, rock[1], 0.45, 0.32, 0.2, {sy: 1.1});
      b.ball(0.38, rock[2], -0.55, 0.3, 0.25, {sy: 0.9});
      b.ball(0.3, rock[3], 0.2, 0.82, -0.1);
      b.box(0.42, 0.22, 0.3, 0xc9cdc5, 0.05, 0.55, 0.42);
      b.box(0.3, 0.2, 0.28, 0xbfc4bc, -0.32, 0.25, 0.55);
      b.ball(0.08, P.leaf, -0.4, 0.72, 0.1);
      b.ball(0.07, P.leaf2, 0.5, 0.66, 0.05);
      if (lv >= 3) b.ball(0.32, rock[1], -0.15, 1.05, -0.15, {sy: 1.2});
    });
    // gantry crane with hanging block
    b.at(0.55, 0, -0.05, () => {
      for (const z of [-0.32, 0.32]) b.box(0.07, 1.25, 0.07, P.timber, 0, 0.62, z);
      b.box(0.07, 0.07, 0.72, P.timber, 0, 1.24, 0);
      b.box(0.6, 0.07, 0.07, P.timber, -0.24, 1.2, 0);
      b.box(0.05, 0.5, 0.05, P.timber, 0, 1.0, 0.2, {rx: 0.7});
      b.cyl(0.012, 0.012, 0.42, P.rope, -0.45, 0.98, 0, 4);
      b.box(0.2, 0.16, 0.2, 0xd5d8d1, -0.45, 0.7, 0);
      b.cyl(0.06, 0.06, 0.1, P.dark, -0.45, 1.2, 0, 8, {rx: H});
    });
    // stacked cut blocks
    const blocks = lv >= 4 ? 7 : lv >= 2 ? 5 : 3;
    for (let i = 0; i < blocks; i++) {
      const row = i < 3 ? 0 : i < 5 ? 1 : 2,
        col = i < 3 ? i : i < 5 ? i - 3 : 0;
      b.box(
        0.22,
        0.16,
        0.2,
        i % 2 ? 0xd7dad2 : 0xc8ccc3,
        -0.35 + col * 0.24 + row * 0.12,
        0.08 + row * 0.16,
        0.62
      );
    }
    // mine cart on rails
    b.at(0.35, 0, 0.6, () => {
      for (const x of [-0.06, 0.06]) b.box(0.02, 0.02, 0.6, P.metal, x, 0.02, 0);
      for (let i = 0; i < 4; i++) b.box(0.2, 0.015, 0.04, P.timber, 0, 0.008, -0.24 + i * 0.16);
      b.box(0.2, 0.12, 0.24, 0x7f6f5d, 0, 0.13, 0);
      b.box(0.17, 0.04, 0.21, 0xb7bcb3, 0, 0.2, 0);
      for (const x of [-0.1, 0.1])
        for (const z of [-0.08, 0.08]) b.cyl(0.04, 0.04, 0.02, P.dark, x, 0.05, z, 8, {rz: H});
    });
    if (lv >= 3)
      b.at(-0.75, 0, 0.55, () => {
        b.box(0.32, 0.32, 0.3, 0xe2d2ae, 0, 0.16, 0);
        b.box(0.38, 0.04, 0.36, P.roofBr, 0, 0.34, 0, {rx: 0.15});
        door(b, 0, 0, 0.152, 0, 0.12, 0.22);
      });
    if (lv >= 5) {
      lantern(b, 0.85, 0, 0.8);
      flag(b, -0.85, 0, -0.85, 0x9cabb9, 0.8);
    }
    stars(b, lv, 0.06, 0.95);
  },
  farm(b, lv) {
    // crop field with soil ridges
    b.at(-0.38, 0, 0.18, () => {
      b.box(1.05, 0.07, 1.35, P.soil, 0, 0.035, 0);
      const rows = lv >= 3 ? 5 : 4;
      for (let r = 0; r < rows; r++) {
        const z = -0.55 + r * (1.1 / (rows - 1));
        b.box(0.95, 0.06, 0.1, 0x7d5b3c, 0, 0.09, z);
        for (let c = 0; c < 6; c++) {
          const x = -0.4 + c * 0.16;
          if (lv >= 4 && r === 0) {
            b.ball(0.065, 0xe9973f, x, 0.15, z, {sy: 0.8, detail: 1});
            b.box(0.012, 0.04, 0.012, P.leaf3, x, 0.21, z);
          } else {
            b.cyl(0.012, 0.012, 0.18, 0x9aa651, x, 0.2, z, 4);
            b.cone(0.04, 0.12, r % 2 ? 0xe8c96a : 0xdcbf62, x, 0.33, z, 5);
          }
        }
      }
    });
    // windmill
    b.at(0.5, 0, -0.42, () => {
      plinth(b, 0.62, 0.62, 0.1);
      const th = 1.3 + (lv >= 4 ? 0.25 : 0);
      b.cyl(0.24, 0.34, th, 0xf0e3c4, 0, 0.1 + th / 2, 0, 8);
      for (const f of [0.3, 0.62])
        b.cyl(0.3 - 0.08 * f, 0.3 - 0.08 * f, 0.04, P.timber, 0, 0.1 + th * f, 0, 8);
      door(b, 0, 0.1, 0.31, 0, 0.18, 0.3);
      win(b, 0, 0.1 + th * 0.6, 0.25, 0, 0.12, 0.14);
      b.cyl(0.06, 0.32, 0.32, 0x9aa278, 0, 0.1 + th + 0.16, 0, 8);
      b.cone(0.09, 0.18, 0x9aa278, 0, 0.1 + th + 0.36, 0, 8);
      b.dyn(
        {type: 'spin', axis: 'z', speed: 0.9},
        s => {
          s.ball(0.07, P.timber, 0, 0, 0);
          for (let i = 0; i < 4; i++)
            s.at(0, 0, 0, {rz: i * H}, () => {
              s.box(0.04, 0.82, 0.04, P.timber, 0, 0.42, 0);
              s.box(0.2, 0.6, 0.015, 0xf3ead2, 0.12, 0.52, 0);
              for (let k = 0; k < 4; k++) s.box(0.21, 0.012, 0.02, P.timber, 0.12, 0.26 + k * 0.16, 0);
            });
        },
        0,
        0.1 + th * 0.88,
        0.34
      );
    });
    // haystack & barn
    b.at(0.7, 0, 0.55, () => {
      b.cyl(0.2, 0.22, 0.24, P.straw, 0, 0.12, 0, 10);
      b.cone(0.21, 0.2, P.straw, 0, 0.34, 0, 10);
      b.cyl(0.205, 0.205, 0.02, 0xd0b05a, 0, 0.18, 0, 10);
    });
    if (lv >= 3)
      b.at(0.3, 0, 0.68, () => {
        sack(b, 0, 0, 0);
        sack(b, 0.15, 0, 0.05);
      });
    if (lv >= 2) fenceRun(b, -0.38, 0.92, 1.05);
    if (lv >= 5) {
      b.at(-0.85, 0, -0.75, () => {
        b.cyl(0.015, 0.015, 0.6, P.timber, 0, 0.3, 0);
        b.box(0.32, 0.03, 0.03, P.timber, 0, 0.45, 0);
        b.ball(0.08, P.straw, 0, 0.48, 0, {sy: 1.3});
        b.cone(0.1, 0.1, 0xc9a95a, 0, 0.62, 0, 6);
      });
      flag(b, 0.85, 0, -0.85, 0xe4b750, 0.6);
    }
    stars(b, lv, 0.06, 0.98);
  },
  observatory(b, lv) {
    b.at(0, 0, -0.08, () => {
      b.cyl(0.8, 0.86, 0.16, P.plinth, 0, 0.08, 0, 12);
      b.cyl(0.68, 0.72, 0.9, 0xe7e1cb, 0, 0.61, 0, 12);
      for (const y of [0.3, 0.95]) b.cyl(0.7, 0.7, 0.05, P.stone2, 0, y + 0.08, 0, 12);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2 + 0.26;
        arched(b, Math.sin(a) * 0.7, 0.55, Math.cos(a) * 0.7, a, 0.13, 0.26);
      }
      door(b, 0, 0.16, 0.72, 0, 0.24, 0.38, 0x5f6f8a);
      b.sph(0.7, 0x7f97a5, 0, 1.06, 0, {ws: 16, hs: 8, tl: PI / 2, mat: {metal: 0.3, rough: 0.5}});

      for (let i = 0; i < 4; i++)
        b.tor(0.705, 0.012, shade(0x7f97a5, -0.12), 0, 1.06, 0, {ry: (i * PI) / 4, arc: PI, m: 16});
      b.box(0.18, 0.6, 0.02, 0x3b4a5c, 0, 1.36, 0.47, {rx: -0.6});
      b.at(0, 1.5, 0.32, {rx: -0.75}, () => {
        b.cyl(0.09, 0.13, 0.85, 0xc9b27c, 0, 0.25, 0, 10, {mat: {metal: 0.5, rough: 0.4}});
        b.cyl(0.1, 0.1, 0.06, P.gold, 0, 0.66, 0, 10);
        b.cyl(0.075, 0.075, 0.02, 0x334455, 0, 0.69, 0, 10, {glow: 1});
      });
      b.cyl(0.012, 0.012, 0.3, P.dark, 0, 1.85, 0, 4);
      b.dyn(
        {type: 'spin', axis: 'y', speed: 0.6},
        s => {
          s.ball(0.06, P.gold, 0, 0, 0, {glow: 1, detail: 0});
          s.box(0.2, 0.02, 0.02, P.gold, 0, 0, 0);
          s.box(0.02, 0.02, 0.2, P.gold, 0, 0, 0);
        },
        0,
        2.02,
        0
      );
    });
    if (lv >= 2) lantern(b, -0.75, 0, 0.72);
    if (lv >= 3)
      b.at(-0.72, 0, -0.6, () => {
        b.box(0.4, 0.36, 0.36, 0xe7e1cb, 0, 0.18, 0);
        b.sph(0.2, 0x7f97a5, 0, 0.36, 0, {tl: PI / 2});
      });
    if (lv >= 4)
      b.at(0.75, 0, 0.6, () => {
        b.cyl(0.03, 0.03, 0.5, P.dark, 0, 0.25, 0, 5);
        b.ball(0.12, 0x9bb4d8, 0, 0.58, 0, {glow: 1, detail: 1});
        b.tor(0.18, 0.012, P.gold, 0, 0.58, 0, {rx: 1.1, m: 20});
      });
    if (lv >= 5) flag(b, 0.8, 0, -0.8, 0x9b8fd8, 0.8);
    stars(b, lv, 0.06, 0.95);
  },
  dock(b, lv) {
    // boathouse on land, pier reaching over the water (+z)
    b.at(-0.35, 0, -0.35, () => {
      plinth(b, 0.95, 0.8, 0.1, 0x9c8f7a);
      b.box(0.86, 0.58, 0.72, 0x9ec3d4, 0, 0.39, 0);
      for (let i = 0; i < 7; i++) b.box(0.012, 0.56, 0.73, 0x86adc0, -0.36 + i * 0.12, 0.39, 0);
      frame(b, 0.86, 0.58, 0.72, 0.1);
      door(b, 0.15, 0.1, 0.37, 0, 0.26, 0.38, 0x6c5a46);
      win(b, -0.22, 0.44, 0.37, 0, 0.18, 0.18);
      gable(b, 0.86, 0.72, 0.42, P.roofB, 0.68, {wall: 0x9ec3d4});
      b.box(0.05, 0.05, 0.3, P.timber, 0.0, 0.9, 0.55);
      b.tor(0.12, 0.02, 0xe95f4a, -0.32, 0.5, 0.39, {});
    });
    // pier
    b.at(0.38, 0, 0.35, () => {
      for (let i = 0; i < 9; i++)
        b.box(0.5, 0.04, 0.13, i % 2 ? 0xb98f5f : 0xc7a06c, 0, 0.12, -0.55 + i * 0.15);
      for (const x of [-0.22, 0.22])
        for (let k = 0; k < 4; k++) b.cyl(0.04, 0.045, 1.2, 0x7b5b3f, x, -0.45, -0.5 + k * 0.36, 6);
      for (const x of [-0.25, 0.25]) b.box(0.03, 0.03, 1.2, P.timber, x, 0.3, 0.05);
      for (const x of [-0.25, 0.25])
        for (let k = 0; k < 4; k++) b.box(0.03, 0.2, 0.03, P.timber, x, 0.22, -0.5 + k * 0.36);
      b.tor(0.07, 0.012, P.rope, 0.25, 0.16, 0.4, {rx: H});
    });
    // nets, barrels, fish rack
    b.at(-0.6, 0, 0.45, () => {
      for (const x of [-0.2, 0.2]) b.box(0.03, 0.42, 0.03, P.timber, x, 0.21, 0);
      b.box(0.44, 0.025, 0.025, P.timber, 0, 0.4, 0);
      b.box(0.38, 0.3, 0.01, 0xd8cfb4, 0, 0.25, 0, {mat: {opacity: 0.85}});
      for (let i = 0; i < 3; i++) b.box(0.03, 0.1, 0.04, 0x8fb6c9, -0.12 + i * 0.12, 0.33, 0.02);
    });
    barrel(b, 0.0, 0, 0.62);
    barrel(b, -0.15, 0, 0.75, 0.8);
    b.dyn(
      {type: 'bob'},
      s => {
        s.box(0.26, 0.08, 0.6, 0xc87d55, 0, 0, 0);
        s.box(0.22, 0.04, 0.52, 0xe0b388, 0, 0.05, 0);
        s.prism(0.26, 0.15, 0.08, 0xc87d55, 0, -0.04, 0.32, {rx: H, s: 1});
        s.cyl(0.012, 0.012, 0.5, P.timber, 0, 0.28, 0, 4);
        s.prism(0.28, 0.38, 0.01, P.white, 0.0, 0.08, 0, {ry: H});
      },
      0.85,
      0.02,
      0.78
    );
    if (lv >= 3) lantern(b, 0.62, 0.12, 0.0, true);
    if (lv >= 4)
      b.at(-0.82, 0, -0.82, () => {
        crate(b, 0, 0, 0, 0.2);
        crate(b, 0.04, 0.2, 0.02, 0.16, 0.3);
      });
    if (lv >= 5) flag(b, -0.75, 0.95, -0.35, 0x5f9ec2, 0.5);
    stars(b, lv, 0.06, -0.95);
  },
  bakery(b, lv) {
    b.at(-0.15, 0, -0.12, () => {
      plinth(b, 1.2, 0.98, 0.12, 0xb39e86);
      b.box(1.1, 0.7, 0.88, 0xf3dcbc, 0, 0.47, 0);
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 5; c++)
          b.box(0.16, 0.06, 0.01, 0xd9a77f, -0.4 + c * 0.2 + (r % 2) * 0.1, 0.24 + r * 0.12, 0.445);
      frame(b, 1.1, 0.7, 0.88, 0.12);
      win(b, -0.3, 0.52, 0.45, 0, 0.26, 0.26, lv >= 2);
      door(b, 0.22, 0.12, 0.45, 0, 0.26, 0.42, 0x9a5f3d);
      win(b, 0.56, 0.52, 0, H);
      // striped awning
      for (let i = 0; i < 6; i++)
        b.box(0.12, 0.03, 0.32, i % 2 ? 0xf6efe0 : 0xd2614e, -0.45 + i * 0.12, 0.86, 0.6, {rx: 0.35});
      b.box(0.74, 0.06, 0.04, P.timber, -0.15, 0.81, 0.75);
      gable(b, 1.1, 0.88, 0.5, 0xb85c42, 0.82, {wall: 0xf3dcbc});
      chimney(b, -0.32, 0.95, -0.2, 0.62, true);
      b.at(0.25, 0.98, 0.5, () => {
        b.box(0.32, 0.2, 0.03, P.timber, 0, 0, 0);
        b.ball(0.07, 0xd99a52, -0.06, 0, 0.03, {sx: 1.5, sy: 0.8});
        b.ball(0.06, 0xc8843f, 0.08, 0, 0.03, {sx: 1.2, sy: 0.8});
      });
    });
    // brick oven
    b.at(0.62, 0, 0.5, () => {
      b.box(0.42, 0.18, 0.42, 0xb39e86, 0, 0.09, 0);
      b.sph(0.2, 0xc7714c, 0, 0.18, 0, {tl: PI / 2, ws: 10, hs: 5});
      b.box(0.1, 0.1, 0.06, 0xffb067, 0, 0.24, 0.18, {glow: 1});
      b.cyl(0.04, 0.04, 0.24, P.brick, 0.08, 0.42, -0.08, 6);
    });
    b.at(-0.65, 0, 0.62, () => {
      b.box(0.36, 0.24, 0.22, 0xc49a6b, 0, 0.12, 0);
      for (let i = 0; i < 3; i++) b.ball(0.06, 0xd9a052, -0.11 + i * 0.11, 0.27, 0, {sx: 1.4, sy: 0.7});
    });
    if (lv >= 3)
      b.at(0.68, 0, -0.65, () => {
        sack(b, 0, 0, 0);
        sack(b, -0.18, 0, 0.05);
        sack(b, -0.08, 0, -0.14);
      });
    if (lv >= 4) bench(b, -0.15, 0, 0.82);
    if (lv >= 5) {
      lantern(b, 0.85, 0, 0.05);
      flag(b, -0.85, 0, -0.85, 0xd69a5b, 0.8);
    }
    stars(b, lv, 0.06, 0.98);
  },
  kiln(b, lv) {
    b.at(-0.3, 0, -0.25, () => {
      b.cyl(0.48, 0.52, 0.12, 0xa58c76, 0, 0.06, 0, 12);
      b.sph(0.46, 0xc27a5a, 0, 0.12, 0, {ws: 12, hs: 6, tl: PI / 2});
      for (let i = 0; i < 4; i++)
        b.tor(0.4 - i * 0.08, 0.02, shade(0xc27a5a, -0.08), 0, 0.24 + i * 0.09, 0, {rx: H, m: 16, s: 1});
      b.at(0, 0.12, 0.42, () => {
        b.box(0.26, 0.22, 0.12, 0x8a5b43, 0, 0.11, 0);
        b.box(0.17, 0.15, 0.06, 0xff9a4d, 0, 0.1, 0.04, {glow: 1});
      });
      b.cyl(0.09, 0.12, 0.95, 0xb26a4c, 0.12, 0.85, -0.15, 8);
      b.cyl(0.13, 0.13, 0.05, 0x8a5b43, 0.12, 1.32, -0.15, 8);
      b.dyn(
        {type: 'smoke'},
        s => {
          for (let i = 0; i < 3; i++)
            s.ball(0.08, 0xe9e5e0, 0, 0, 0, {mat: {opacity: 0.75}, noShadow: 1, detail: 1});
        },
        0.12,
        1.38,
        -0.15
      );
    });
    if (lv >= 3)
      b.at(0.5, 0, -0.55, () => {
        b.cyl(0.28, 0.3, 0.08, 0xa58c76, 0, 0.04, 0, 10);
        b.sph(0.27, 0xc98466, 0, 0.08, 0, {tl: PI / 2, ws: 10, hs: 5});
        b.box(0.12, 0.1, 0.06, 0xff9a4d, 0, 0.14, 0.25, {glow: 1});
      });
    // pottery shelf & pots
    b.at(0.45, 0, 0.35, () => {
      for (const x of [-0.3, 0.3]) b.box(0.04, 0.5, 0.2, P.timber, x, 0.25, 0);
      for (const y of [0.18, 0.38]) b.box(0.64, 0.03, 0.22, 0xb38a5d, 0, y, 0);
      const pots = [0xc27a5a, 0x6f9cb3, 0xe0c9a0, 0x9c6b4f, 0xc27a5a, 0x8aa877];
      pots.forEach((c, i) => {
        const x = -0.2 + (i % 3) * 0.2,
          y = i < 3 ? 0.2 : 0.4;
        b.cyl(0.045, 0.06, 0.1, c, x, y + 0.05, 0, 8);
        b.cyl(0.035, 0.045, 0.03, c, x, y + 0.11, 0, 8);
      });
    });
    // clay pit
    b.at(-0.55, 0, 0.5, () => {
      b.cyl(0.28, 0.24, 0.06, 0x9e6447, 0, 0.03, 0, 10);
      b.cyl(0.22, 0.22, 0.012, 0xb27454, 0, 0.065, 0, 10);
      b.box(0.04, 0.25, 0.04, P.timber, 0.18, 0.15, 0.1, {rz: 0.6});
    });
    if (lv >= 2)
      for (let i = 0; i < (lv >= 4 ? 6 : 3); i++)
        b.box(0.18, 0.06, 0.1, 0xb8714f, -0.1 + (i % 3) * 0.19, 0.03 + Math.floor(i / 3) * 0.06, 0.82);
    if (lv >= 5) {
      lantern(b, 0.85, 0, -0.85);
      flag(b, -0.85, 0, 0.85, 0xc27a5a, 0.7);
    }
    stars(b, lv, 0.06, -0.95);
  },
  lumber(b, lv) {
    b.at(-0.2, 0, -0.2, () => {
      b.box(1.1, 0.08, 0.86, P.stone2, 0, 0.04, 0);
      for (let r = 0; r < 6; r++) {
        b.cyl(0.06, 0.06, 1.08, r % 2 ? 0xa77d52 : 0x9a714a, 0, 0.14 + r * 0.11, 0.4, 7, {rz: H});
        b.cyl(0.06, 0.06, 1.08, r % 2 ? 0xa77d52 : 0x9a714a, 0, 0.14 + r * 0.11, -0.4, 7, {rz: H});
        b.cyl(0.06, 0.06, 0.84, r % 2 ? 0x9a714a : 0xa77d52, -0.52, 0.14 + r * 0.11, 0, 7, {rx: H});
        b.cyl(0.06, 0.06, 0.84, r % 2 ? 0x9a714a : 0xa77d52, 0.52, 0.14 + r * 0.11, 0, 7, {rx: H});
      }
      b.box(1.0, 0.64, 0.76, 0x8e6b47, 0, 0.44, 0);
      door(b, 0.2, 0.08, 0.44, 0, 0.24, 0.4, 0x6a4d33);
      win(b, -0.25, 0.45, 0.45, 0, 0.2, 0.2, lv >= 2);
      gable(b, 1.1, 0.86, 0.5, 0x5f7b4f, 0.78, {wall: 0x9a714a});
      chimney(b, -0.3, 0.95, -0.15, 0.4, true);
      b.box(0.36, 0.04, 0.1, 0xe7d3a8, 0.2, 0.6, 0.46);
    });
    for (const [x, z, s, k] of [
      [0.75, -0.7, 1, 1],
      [0.55, 0.05, 0.85, 0],
      [0.78, 0.55, 0.95, 1],
      [-0.8, 0.65, 0.8, 1]
    ])
      smallTree(b, x, 0, z, s, k + (lv >= 3 ? 0 : 0));
    b.at(0.2, 0, 0.65, () => {
      b.cyl(0.13, 0.15, 0.18, 0x9f7a50, 0, 0.09, 0, 9);
      b.cyl(0.12, 0.12, 0.012, 0xd9b98a, 0, 0.185, 0, 9);
      b.box(0.03, 0.24, 0.03, P.timber, 0.04, 0.27, 0, {rz: -0.5});
      b.box(0.1, 0.06, 0.02, 0xc8d0d5, 0.1, 0.36, 0, {rz: -0.5});
    });
    logs(b, -0.45, 0, 0.65, lv >= 4 ? 6 : 3, 0.5, 0.2);
    if (lv >= 3)
      b.at(0.5, 0, -0.1, () => {
        b.box(0.04, 0.04, 0.6, P.timber, 0, 0.3, 0);
        for (const z of [-0.28, 0.28]) b.box(0.04, 0.3, 0.04, P.timber, 0, 0.15, z);
      });
    if (lv >= 5) flag(b, -0.85, 0, -0.85, 0x6f8f5a, 0.9);
    stars(b, lv, 0.06, 0.98);
  },
  teahouse(b, lv) {
    // raised platform + double-eave roof + lanterns
    b.at(0, 0, -0.05, () => {
      b.box(1.4, 0.16, 1.2, 0x9b8a72, 0, 0.08, 0);
      b.box(1.5, 0.05, 1.3, 0xb59a76, 0, 0.18, 0);
      for (const x of [-0.6, 0.6]) for (const z of [-0.5, 0.5]) b.box(0.08, 0.62, 0.08, 0x6b3f2e, x, 0.5, z);
      b.box(1.0, 0.5, 0.75, 0xf3ead5, 0, 0.45, 0);
      for (let i = 0; i < 5; i++) b.box(0.012, 0.48, 0.76, 0xc9b28d, -0.4 + i * 0.2, 0.45, 0);
      b.box(1.01, 0.012, 0.76, 0xc9b28d, 0, 0.45, 0);
      b.box(0.3, 0.42, 0.02, 0xe8c49a, 0, 0.42, 0.38, {glow: 1});
      b.cyl(0, 0.707, 0.32, 0x4f6e6a, 0, 0.92, 0, 4, {ry: PI / 4, sx: 1.9, sz: 1.7});
      b.box(1.55, 0.04, 1.35, 0x3f5b58, 0, 0.77, 0);
      for (const [x, z] of [
        [-0.78, -0.68],
        [0.78, -0.68],
        [-0.78, 0.68],
        [0.78, 0.68]
      ])
        b.cone(0.05, 0.14, 0x3f5b58, x, 0.82, z, 4, {rx: z > 0 ? -0.9 : 0.9, rz: x > 0 ? 0.9 : -0.9});
      b.box(0.6, 0.25, 0.5, 0xf3ead5, 0, 1.12, 0);
      b.cyl(0, 0.707, 0.32, 0x4f6e6a, 0, 1.38, 0, 4, {ry: PI / 4, sx: 1.1, sz: 0.95});
      b.ball(0.06, P.gold, 0, 1.56, 0);
      for (const x of [-0.55, 0.55])
        b.at(x, 0.68, 0.62, () => {
          b.cyl(0.004, 0.004, 0.08, P.dark, 0, 0.04, 0, 3);
          b.ball(0.07, 0xd94f3d, 0, -0.04, 0, {sy: 1.3, glow: 1, detail: 1});
        });
      for (let i = 0; i < 3; i++) b.box(0.4, 0.05, 0.12, 0xb59a76, 0, 0.04 + i * 0.05, 0.65 - i * 0.07);
    });
    // tea table & bushes
    b.at(0.62, 0, 0.6, () => {
      b.cyl(0.16, 0.16, 0.03, 0x8a5a3c, 0, 0.2, 0, 10);
      b.cyl(0.03, 0.03, 0.2, 0x6b3f2e, 0, 0.1, 0, 6);
      b.cyl(0.035, 0.03, 0.04, P.white, 0, 0.24, 0, 8);
      b.cyl(0.025, 0.02, 0.03, P.white, 0.08, 0.23, 0.03, 8);
    });
    for (const [x, z] of [
      [-0.8, 0.75],
      [-0.6, 0.85],
      [0.85, -0.7]
    ])
      b.ball(0.13, 0x5f8f62, x, 0.1, z, {sy: 0.8});
    if (lv >= 3)
      b.at(-0.75, 0, -0.75, () => {
        b.cyl(0.2, 0.2, 0.04, 0x7fb7b0, 0, 0.03, 0, 10);
        b.ball(0.06, P.stone, 0.15, 0.05, 0.1);
        b.ball(0.04, 0xe68a4f, 0, 0.06, 0, {sx: 1.6, sy: 0.5});
      });
    if (lv >= 4) flag(b, 0.85, 0, 0.15, 0x8fb39a, 0.7);
    if (lv >= 5) {
      b.dyn(
        {type: 'spin', axis: 'y', speed: 0.3},
        s => {
          for (let i = 0; i < 3; i++)
            s.ball(0.03, 0xfff2b0, Math.cos(i * 2.1) * 0.25, i * 0.05, Math.sin(i * 2.1) * 0.25, {glow: 1});
        },
        0,
        1.7,
        0
      );
    }
    stars(b, lv, 0.24, 0.9);
  },
  lighthouse(b, lv) {
    b.ball(0.34, 0x9c9a92, -0.12, 0.06, 0.1, {sy: 0.5});
    b.ball(0.26, 0x8f8d86, 0.18, 0.05, -0.15, {sy: 0.5});
    b.cyl(0.36, 0.4, 0.16, P.stone2, 0, 0.08, 0, 10);
    const segs = 5,
      th = 1.9 + (lv >= 4 ? 0.25 : 0);
    for (let i = 0; i < segs; i++) {
      const y0 = 0.16 + (i * th) / segs,
        r0 = 0.3 - i * 0.032,
        r1 = 0.3 - (i + 1) * 0.032;
      b.cyl(r1, r0, th / segs, i % 2 ? 0xd45a46 : 0xf6f0e3, 0, y0 + th / segs / 2, 0, 10);
    }
    const top = 0.16 + th;
    door(b, 0, 0.16, 0.29, 0, 0.14, 0.26, 0x5f6f8a);
    win(b, 0, 0.16 + th * 0.55, 0.24, 0, 0.08, 0.12);
    b.cyl(0.27, 0.27, 0.05, P.dark, 0, top + 0.02, 0, 10);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * PI * 2;
      b.box(0.02, 0.14, 0.02, P.dark, Math.cos(a) * 0.26, top + 0.1, Math.sin(a) * 0.26);
    }
    b.tor(0.26, 0.01, P.dark, 0, top + 0.17, 0, {rx: H, m: 20});
    b.cyl(0.16, 0.16, 0.26, 0xfff0b8, 0, top + 0.18, 0, 8, {glow: 1});
    for (let i = 0; i < 4; i++) {
      const a = i * H;
      b.box(0.02, 0.26, 0.02, P.dark, Math.cos(a) * 0.16, top + 0.18, Math.sin(a) * 0.16);
    }
    b.cyl(0.02, 0.2, 0.18, 0xd45a46, 0, top + 0.4, 0, 8);
    b.ball(0.04, P.gold, 0, top + 0.52, 0);
    b.dyn(
      {type: 'spin', axis: 'y', speed: 1.1},
      s => {
        s.box(0.5, 0.05, 0.06, 0xfff3b0, 0.25, 0, 0, {glow: 1, noShadow: 1, mat: {opacity: 0.7}});
        s.box(0.5, 0.05, 0.06, 0xfff3b0, -0.25, 0, 0, {glow: 1, noShadow: 1, mat: {opacity: 0.7}});
      },
      0,
      top + 0.18,
      0
    );
    if (lv >= 3)
      b.at(0.34, 0, 0.3, () => {
        b.cyl(0.012, 0.012, 0.36, P.dark, 0, 0.18, 0, 4);
        b.ball(0.05, 0xfff0b8, 0, 0.38, 0, {glow: 1});
      });
    if (lv >= 5) flag(b, 0, top + 0.5, 0, 0xe07a5f, 0.3);
  },
  library(b, lv) {
    b.at(0, 0, -0.15, () => {
      b.box(2.6, 0.18, 2.0, P.stone3, 0, 0.09, 0);
      b.box(2.7, 0.05, 2.1, P.stone, 0, 0.02, 0);
      b.box(1.5, 1.0, 1.4, 0xeae2cf, 0, 0.68, 0);
      b.box(1.56, 0.08, 1.46, P.stone, 0, 1.2, 0);
      for (const x of [-0.98, 0.98])
        b.at(x, 0, 0.1, () => {
          b.box(0.5, 0.75, 1.1, 0xe4dac4, 0, 0.55, 0);
          b.box(0.56, 0.06, 1.16, P.stone, 0, 0.94, 0);
          b.at(0, 0, 0, {ry: H}, () => gable(b, 1.1, 0.5, 0.26, P.roofP, 0.96, {oh: 0.05, wall: 0xe4dac4}));
          arched(b, 0, 0.55, 0.56, 0, 0.18, 0.38);
        });
      for (let i = 0; i < 4; i++) arched(b, -0.54 + i * 0.36, 0.78, 0.705, 0, 0.16, 0.42);
      for (let i = 0; i < 2; i++) arched(b, 0.76, 0.78, -0.35 + i * 0.7, H, 0.16, 0.42);
      b.sph(0.55, 0x6f78b8, 0, 1.24, 0, {ws: 16, hs: 8, tl: PI / 2, mat: {metal: 0.25, rough: 0.5}});
      b.cyl(0.57, 0.57, 0.08, P.stone, 0, 1.25, 0, 16);
      for (let i = 0; i < 6; i++)
        b.tor(0.555, 0.012, shade(0x6f78b8, -0.12), 0, 1.24, 0, {ry: (i * PI) / 6, arc: PI, m: 16});
      b.cyl(0.1, 0.12, 0.18, 0xeae2cf, 0, 1.85, 0, 8);
      b.cone(0.1, 0.25, P.gold, 0, 2.05, 0, 8);
      b.ball(0.05, P.gold, 0, 2.2, 0, {glow: 1});
      // portico
      b.at(0, 0, 0.88, () => {
        for (let i = 0; i < 4; i++) {
          const x = -0.48 + i * 0.32;
          b.cyl(0.065, 0.07, 0.95, P.white, x, 0.65, 0, 10);
          b.box(0.16, 0.06, 0.16, P.stone3, x, 1.14, 0);
          b.box(0.16, 0.06, 0.16, P.stone3, x, 0.2, 0);
        }
        b.box(1.2, 0.1, 0.36, P.stone3, 0, 1.2, 0);
        b.prism(1.24, 0.3, 0.36, P.stone3, 0, 1.25, 0);
        b.prism(1.0, 0.2, 0.37, 0xe7dcc6, 0, 1.29, 0.0);
        b.cyl(0.06, 0.06, 0.02, P.gold, 0, 1.36, 0.19, 10, {rx: H, glow: 1});
        door(b, 0, 0.18, -0.16, 0, 0.3, 0.55, 0x5d4d82);
        for (let i = 0; i < 3; i++)
          b.box(1.2 - i * 0.1, 0.06, 0.16, P.stone3, 0, 0.15 - i * 0.05, 0.3 + i * 0.12);
      });
    });
    for (const x of [-1.15, 1.15])
      b.at(x, 0, 1.2, () => {
        b.cyl(0.04, 0.05, 0.6, P.dark, 0, 0.3, 0, 6);
        b.ball(0.08, 0xfff0c0, 0, 0.65, 0, {glow: 1, detail: 1});
      });
    if (lv >= 3)
      for (const x of [-0.7, 0.7])
        b.at(x, 0, 1.25, () => {
          b.box(0.3, 0.12, 0.3, 0x8a6448, 0, 0.06, 0);
          b.ball(0.14, 0x5f8f62, 0, 0.2, 0, {detail: 1});
        });
    if (lv >= 4)
      b.at(-1.25, 0, -1.25, () => {
        b.cyl(0.2, 0.24, 0.1, P.stone3, 0, 0.05, 0, 10);
        b.cyl(0.04, 0.04, 0.4, P.stone3, 0, 0.3, 0, 8);
        b.cyl(0.18, 0.12, 0.08, P.stone3, 0, 0.5, 0, 10);
        b.cyl(0.15, 0.15, 0.02, 0x8bc9c3, 0, 0.54, 0, 10);
      });
    if (lv >= 5) {
      flag(b, 1.25, 0, -1.25, 0x7d86c9, 1.2);
      flag(b, -1.25, 0, 1.0, 0x7d86c9, 0.8);
    }
    stars(b, lv, 0.24, 1.4);
  },
  clocktower(b, lv) {
    b.box(1.8, 0.12, 1.8, P.stone3, 0, 0.06, 0);
    for (let i = 0; i < 4; i++)
      b.at(0, 0, 0, {ry: i * H}, () => {
        b.box(0.5, 0.05, 0.25, P.stone, 0, 0.03, 0.88);
      });
    b.box(0.9, 1.1, 0.9, 0xd8cfb8, 0, 0.67, 0);
    for (let r = 0; r < 5; r++)
      for (const s of [-1, 1]) b.box(0.92, 0.04, 0.02, shade(0xd8cfb8, -0.06), 0, 0.3 + r * 0.22, s * 0.455);
    door(b, 0, 0.12, 0.455, 0, 0.3, 0.5, 0x6a4f3a);
    arched(b, 0.455, 0.75, 0, H, 0.16, 0.32);
    arched(b, -0.455, 0.75, 0, -H, 0.16, 0.32);
    b.box(0.98, 0.08, 0.98, P.stone, 0, 1.25, 0);
    const t2 = 1.3 + (lv >= 3 ? 0.25 : 0);
    b.box(0.8, t2, 0.8, 0xefe4c8, 0, 1.29 + t2 / 2, 0);
    frame(b, 0.8, t2, 0.8, 1.29);
    for (let i = 0; i < 4; i++)
      b.at(0, 1.29 + t2 * 0.62, 0, {ry: i * H}, () => {
        b.cyl(0.27, 0.27, 0.04, P.white, 0, 0, 0.41, 20, {rx: H});
        b.tor(0.28, 0.025, P.gold, 0, 0, 0.42, {m: 24});
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * PI * 2;
          b.box(0.018, 0.05, 0.01, P.dark, Math.sin(a) * 0.22, Math.cos(a) * 0.22, 0.435, {rz: -a});
        }
        b.dyn({type: 'clock', hand: 'h'}, s => s.box(0.035, 0.14, 0.012, P.dark, 0, 0.06, 0), 0, 0, 0.44);
        b.dyn({type: 'clock', hand: 'm'}, s => s.box(0.025, 0.2, 0.012, P.dark, 0, 0.09, 0), 0, 0, 0.45);
      });
    const yb = 1.29 + t2;
    b.box(0.94, 0.07, 0.94, P.stone, 0, yb + 0.03, 0);
    // open belfry
    for (const x of [-0.36, 0.36])
      for (const z of [-0.36, 0.36]) b.box(0.09, 0.5, 0.09, 0xd8cfb8, x, yb + 0.32, z);
    b.cyl(0.13, 0.17, 0.22, P.gold, 0, yb + 0.42, 0, 10, {mat: {metal: 0.6, rough: 0.35}});
    b.box(0.86, 0.06, 0.86, P.stone, 0, yb + 0.6, 0);
    b.cyl(0, 0.707, 0.85, 0x4c5d86, 0, yb + 1.06, 0, 4, {ry: PI / 4, sx: 0.95, sz: 0.95});
    b.cyl(0.015, 0.015, 0.4, P.gold, 0, yb + 1.6, 0, 4);
    b.ball(0.06, P.gold, 0, yb + 1.75, 0, {glow: 1});
    if (lv >= 2)
      for (const [x, z] of [
        [-0.7, 0.7],
        [0.7, 0.7]
      ])
        lantern(b, x, 0.12, z, true);
    if (lv >= 3) {
      bench(b, -0.65, 0.12, -0.55, H);
      bench(b, 0.65, 0.12, -0.55, -H);
    }
    if (lv >= 4)
      for (const [x, z] of [
        [-0.75, -0.75],
        [0.75, -0.75]
      ])
        b.at(x, 0.12, z, () => {
          b.box(0.2, 0.12, 0.2, 0x8a6448, 0, 0.06, 0);
          b.ball(0.12, 0x5f8f62, 0, 0.2, 0, {detail: 1});
          b.ball(0.03, P.pink, 0.05, 0.28, 0.05);
        });
    if (lv >= 5) flag(b, 0, yb + 1.85, 0, P.gold, 0.35);
    stars(b, lv, 0.18, 0.92);
  }
};
export function buildingModel(b, id, level = 1) {
  (BUILD[id] || BUILD.cottage)(b, Math.max(1, level));
}

/* ---------- decorations (1×1, centred) ---------- */
const DEC = {
  pine(b, v) {
    const s = 0.85 + (v % 3) * 0.12;
    b.at(0, 0, 0, {s, ry: v}, () => {
      b.cyl(0.05, 0.08, 0.4, P.trunk, 0, 0.2, 0, 6);
      const cs = [
        [0x4f7d55, 0x5f8f5e],
        [0x47704f, 0x598a5a],
        [0x5a8a5c, 0x6c9d66]
      ][v % 3];
      b.cone(0.4, 0.55, cs[0], 0, 0.55, 0, 7);
      b.cone(0.32, 0.48, cs[1], 0, 0.85, 0, 7);
      b.cone(0.22, 0.4, cs[0], 0, 1.12, 0, 7);
    });
  },
  oak(b, v) {
    const s = 0.85 + (v % 3) * 0.12;
    b.at(0, 0, 0, {s, ry: v}, () => {
      b.cyl(0.06, 0.09, 0.5, P.trunk, 0, 0.25, 0, 6);
      b.box(0.04, 0.22, 0.04, P.trunk, 0.08, 0.48, 0, {rz: -0.6});
      const c = [0x76a35f, 0x6b9a58, 0x83ad69][v % 3];
      b.ball(0.36, c, 0, 0.78, 0);
      b.ball(0.26, shade(c, 0.05), 0.22, 0.92, 0.05);
      b.ball(0.24, shade(c, -0.04), -0.2, 0.88, -0.08);
      b.ball(0.2, shade(c, 0.08), 0.02, 1.06, 0.1);
      if (v % 2) b.ball(0.04, 0xe25b4a, 0.25, 0.72, 0.22);
    });
  },
  blossom(b, v) {
    b.at(0, 0, 0, {ry: v}, () => {
      b.cyl(0.05, 0.08, 0.45, 0x7c5a4a, 0, 0.22, 0, 6);
      b.box(0.035, 0.3, 0.035, 0x7c5a4a, 0.1, 0.5, 0, {rz: -0.7});
      b.box(0.035, 0.26, 0.035, 0x7c5a4a, -0.08, 0.52, 0.04, {rz: 0.6});
      const cs = [0xf4bfcf, 0xf7d2dd, 0xeaa7bd];
      b.ball(0.3, cs[0], 0, 0.78, 0);
      b.ball(0.22, cs[1], 0.22, 0.82, 0.05);
      b.ball(0.22, cs[2], -0.2, 0.74, -0.05);
      b.ball(0.18, cs[1], 0, 0.98, 0.06);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1;
        b.box(
          0.05,
          0.01,
          0.04,
          cs[i % 3],
          Math.cos(a) * (0.25 + i * 0.03),
          0.012,
          Math.sin(a) * (0.25 + i * 0.03),
          {ry: a}
        );
      }
    });
  },
  palm(b, v) {
    b.at(0, 0, 0, {ry: v}, () => {
      let x = 0,
        y = 0;
      for (let i = 0; i < 5; i++) {
        b.cyl(0.055 - i * 0.004, 0.065 - i * 0.004, 0.24, i % 2 ? 0xa98a62 : 0x9a7b55, x, y + 0.12, 0, 6, {
          rz: -0.12 - i * 0.04
        });
        x += 0.03 + i * 0.012;
        y += 0.235;
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2;
        b.at(x, y + 0.04, 0, {ry: a}, () => {
          b.box(0.12, 0.02, 0.5, i % 2 ? 0x5f9a55 : 0x6fac5f, 0, -0.08, 0.22, {rx: 0.45});
        });
      }
      for (let i = 0; i < 3; i++)
        b.ball(0.045, 0x7a5a3a, x + Math.cos(i * 2) * 0.07, y - 0.04, Math.sin(i * 2) * 0.07);
    });
  },
  bush(b, v) {
    b.ball(0.24, 0x5f8f55, -0.06, 0.18, 0, {sy: 0.8});
    b.ball(0.2, 0x6e9d5f, 0.14, 0.16, 0.08, {sy: 0.85});
    b.ball(0.17, 0x557f4e, 0.02, 0.15, -0.15, {sy: 0.8});
    for (let i = 0; i < 5; i++)
      b.ball(
        0.03,
        v % 2 ? 0xd84f5a : 0x7d6bc4,
        Math.cos(i * 1.3) * 0.2,
        0.24 + (i % 2) * 0.06,
        Math.sin(i * 1.3) * 0.16
      );
  },
  flowerbed(b, v) {
    b.box(0.78, 0.1, 0.78, 0x8a6448, 0, 0.05, 0);
    b.box(0.68, 0.11, 0.68, 0x6b4d34, 0, 0.06, 0);
    const cs = [0xf08aa0, 0xf5d36a, 0xf7f2e6, 0xc8a6e8, 0xef8c5a];
    for (let i = 0; i < 16; i++) {
      const x = -0.24 + (i % 4) * 0.16,
        z = -0.24 + Math.floor(i / 4) * 0.16;
      b.cyl(0.008, 0.008, 0.12, 0x5f8f55, x, 0.16, z, 3);
      b.ball(0.045, cs[(i + v) % 5], x, 0.23, z);
    }
    b.ball(0.06, 0x6e9d5f, 0, 0.14, 0, {sx: 4, sy: 0.5, sz: 4});
  },
  rock(b, v) {
    b.at(0, 0, 0, {ry: v}, () => {
      b.ball(0.28, 0xa3a59c, -0.05, 0.16, 0, {sy: 0.75, sx: 1.1});
      b.ball(0.18, 0x94968e, 0.2, 0.1, 0.12, {sy: 0.8});
      b.ball(0.12, 0xb2b4ab, -0.22, 0.08, 0.2);
      b.ball(0.1, 0x7fa463, -0.02, 0.32, 0.02, {sy: 0.4, sx: 1.4});
    });
  },
  fence(b, v) {
    fenceRun(b, 0, 0, 0.98, 0);
  },
  lamp(b, v) {
    b.cyl(0.08, 0.1, 0.08, P.stone2, 0, 0.04, 0, 8);
    b.cyl(0.025, 0.03, 0.8, 0x3f4a4f, 0, 0.44, 0, 6);
    b.box(0.12, 0.02, 0.02, 0x3f4a4f, 0, 0.82, 0);
    b.at(0, 0.92, 0, () => {
      b.box(0.13, 0.16, 0.13, 0xffe7a8, 0, 0, 0, {glow: 1});
      for (const x of [-0.065, 0.065])
        for (const z of [-0.065, 0.065]) b.box(0.015, 0.16, 0.015, 0x3f4a4f, x, 0, z);
      b.cone(0.12, 0.1, 0x3f4a4f, 0, 0.13, 0, 4, {ry: PI / 4});
      b.ball(0.025, 0x3f4a4f, 0, 0.19, 0);
    });
  },
  bench(b, v) {
    bench(b, 0, 0, 0, 0);
    b.ball(0.08, 0x6e9d5f, 0.36, 0.08, -0.1);
  },
  well(b, v) {
    b.cyl(0.32, 0.34, 0.32, P.stone, 0, 0.16, 0, 10);
    b.cyl(0.34, 0.34, 0.04, P.stone3, 0, 0.33, 0, 10);
    b.cyl(0.25, 0.25, 0.02, 0x4f8fa0, 0, 0.3, 0, 10);
    for (const x of [-0.3, 0.3]) b.box(0.05, 0.6, 0.05, P.timber, x, 0.6, 0);
    b.cyl(0.04, 0.04, 0.62, P.timber, 0, 0.75, 0, 6, {rz: H});
    gable(b, 0.4, 0.75, 0.22, P.roofR, 0.88, {oh: 0.03, wall: P.timber});
    b.cyl(0.01, 0.01, 0.3, P.rope, 0, 0.58, 0, 3);
    b.cyl(0.06, 0.05, 0.09, 0x9a7a52, 0, 0.42, 0, 8);
  },
  scarecrow(b, v) {
    b.cyl(0.02, 0.02, 0.9, P.timber, 0, 0.45, 0, 4);
    b.box(0.6, 0.03, 0.03, P.timber, 0, 0.62, 0);
    b.box(0.2, 0.3, 0.12, 0x7c95b0, 0, 0.58, 0);
    for (const s of [-1, 1]) b.box(0.2, 0.08, 0.08, 0x7c95b0, s * 0.18, 0.62, 0);
    for (const s of [-1, 1]) b.cone(0.04, 0.08, P.straw, s * 0.31, 0.62, 0, 5, {rz: s * H});
    b.ball(0.1, 0xe9d6a4, 0, 0.82, 0);
    b.cyl(0.04, 0.16, 0.1, 0xa8854d, 0, 0.95, 0, 8);
    b.cyl(0.04, 0.04, 0.1, 0xa8854d, 0, 1.0, 0, 8);
    b.ball(0.04, 0xd84f5a, 0, 0.65, 0.07);
  },
  banner(b, v) {
    const c = [0xd0614e, 0x5f81a6, 0xe8bd52, 0x6c9070][v % 4];
    b.cyl(0.06, 0.08, 0.06, P.stone2, 0, 0.03, 0, 8);
    b.cyl(0.018, 0.018, 1.1, 0x6b5640, 0, 0.55, 0, 5);
    b.ball(0.035, P.gold, 0, 1.12, 0);
    b.dyn(
      {type: 'flag'},
      s => {
        s.box(0.36, 0.24, 0.015, c, 0.18, 0, 0);
        s.box(0.36, 0.04, 0.016, P.white, 0.18, -0.07, 0);
        s.prism(0.24, 0.1, 0.015, c, 0.41, 0, 0, {rz: -H});
      },
      0,
      0.96,
      0
    );
  },
  stonelantern(b, v) {
    b.box(0.36, 0.08, 0.36, P.stone2, 0, 0.04, 0);
    b.cyl(0.08, 0.1, 0.32, P.stone, 0, 0.24, 0, 6);
    b.box(0.3, 0.06, 0.3, P.stone, 0, 0.43, 0);
    b.box(0.2, 0.17, 0.2, 0xffe2a0, 0, 0.545, 0, {glow: 1});
    for (const x of [-0.09, 0.09])
      for (const z of [-0.09, 0.09]) b.box(0.03, 0.17, 0.03, P.stone, x, 0.545, z);
    b.cyl(0, 0.707, 0.16, P.stone, 0, 0.71, 0, 4, {ry: PI / 4, sx: 0.5, sz: 0.5});
    b.ball(0.04, P.stone, 0, 0.8, 0);
    b.ball(0.07, 0x7fa463, 0.12, 0.47, 0.1, {sy: 0.3});
  },
  campfire(b, v) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      b.ball(0.06, i % 2 ? 0x9a9c94 : 0x8a8c84, Math.cos(a) * 0.24, 0.04, Math.sin(a) * 0.24, {sy: 0.7});
    }
    for (let i = 0; i < 4; i++)
      b.cyl(0.03, 0.03, 0.36, 0x7b5b3f, 0, 0.1, 0, 5, {ry: (i * PI) / 4, rz: H * 0.7});
    b.dyn(
      {type: 'flicker'},
      s => {
        s.cone(0.12, 0.3, 0xffa94d, 0, 0.15, 0, 6, {glow: 1, noShadow: 1});
        s.cone(0.07, 0.22, 0xffe08a, 0, 0.13, 0, 5, {glow: 1, noShadow: 1});
      },
      0,
      0.08,
      0
    );
    for (const s of [-1, 1]) b.box(0.25, 0.06, 0.08, 0x9a7a52, s * 0.38, 0.04, 0.15, {ry: s * 0.3});
  },
  tent(b, v) {
    const c = [0xe9a25b, 0x8fb6c9, 0xd77d6d][v % 3];
    b.prism(0.7, 0.55, 0.75, c, 0, 0, 0, {ry: 0});
    b.prism(0.3, 0.4, 0.02, shade(c, -0.15), 0, 0, 0.38);
    b.box(0.02, 0.02, 0.85, shade(c, -0.2), 0, 0.55, 0);
    b.cyl(0.012, 0.012, 0.25, P.timber, 0, 0.68, 0.35, 3);
    b.box(0.1, 0.06, 0.01, P.red, 0.05, 0.76, 0.35);
    b.cyl(0.012, 0.012, 0.25, P.timber, -0.45, 0.02, 0.3, 3, {rz: -0.8});
  },
  bridge(b, v) {
    for (let i = 0; i < 7; i++) {
      const x = -0.45 + i * 0.15,
        y = 0.06 + Math.sin((i / 6) * PI) * 0.14;
      b.box(0.14, 0.04, 0.5, i % 2 ? 0xb98f5f : 0xc7a06c, x, y, 0, {rz: -Math.cos((i / 6) * PI) * 0.35});
    }
    for (const z of [-0.24, 0.24]) {
      for (let i = 0; i < 4; i++) {
        const x = -0.42 + i * 0.28;
        b.box(0.03, 0.25, 0.03, P.timber, x, 0.12 + Math.sin((i / 3) * PI) * 0.13 + 0.08, z);
      }
      b.box(0.9, 0.03, 0.03, P.timber, 0, 0.38, z);
    }
  },
  boat(b, v) {
    b.dyn(
      {type: 'bob'},
      s => {
        const c = [0xc87d55, 0x5f81a6, 0xd0614e][v % 3];
        s.box(0.32, 0.1, 0.68, c, 0, 0.0, 0);
        s.box(0.26, 0.04, 0.58, 0xe7c896, 0, 0.05, 0);
        s.prism(0.32, 0.2, 0.1, c, 0, -0.05, 0.38, {rx: H});
        s.cyl(0.015, 0.015, 0.8, P.timber, 0, 0.42, -0.02, 4);
        s.prism(0.34, 0.62, 0.01, P.white, 0, 0.12, 0.12, {ry: H, sz: 1});
        s.box(0.12, 0.06, 0.01, c, 0, 0.82, -0.02);
      },
      0,
      0,
      0
    );
  },
  statue(b, v) {
    b.box(0.5, 0.12, 0.5, P.stone2, 0, 0.06, 0);
    b.box(0.38, 0.42, 0.38, P.stone3, 0, 0.33, 0);
    b.box(0.44, 0.06, 0.44, P.stone, 0, 0.57, 0);
    b.cyl(0.09, 0.12, 0.3, 0xe7e3d6, 0, 0.75, 0, 8);
    b.ball(0.08, 0xe7e3d6, 0, 0.97, 0);
    b.box(0.16, 0.11, 0.03, 0xe7e3d6, 0, 0.82, 0.1, {rx: -0.4});
    b.dyn(
      {type: 'spin', axis: 'y', speed: 0.8},
      s => {
        s.ball(0.08, P.gold, 0, 0, 0, {glow: 1, detail: 0, s: 1});
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * PI * 2;
          s.cone(0.04, 0.12, P.gold, Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0, 4, {rz: a - H, glow: 1});
        }
      },
      0,
      1.2,
      0
    );
  },
  display(b, v, item) {
    b.box(0.42, 0.08, 0.42, P.stone2, 0, 0.04, 0);
    b.cyl(0.12, 0.15, 0.36, 0xe7e3d6, 0, 0.26, 0, 8);
    b.cyl(0.2, 0.17, 0.06, P.stone3, 0, 0.47, 0, 10);
    b.tor(0.19, 0.012, P.gold, 0, 0.5, 0, {rx: H, m: 20});
    if (item) b.dyn({type: 'spin', axis: 'y', speed: 0.5, item}, s => itemModel(s, item, 0.36), 0, 0.52, 0);
  }
};
export function decorModel(b, type, v = 0, item) {
  (DEC[type] || DEC.rock)(b, v, item);
}

/* ---------- villager ---------- */
export function villagerModel(b, i) {
  const shirt = [0xe6a369, 0x8799b7, 0xe0cb83, 0x91a771, 0xd88a9a, 0x9f8bc9][i % 6],
    skin = [0xebc7a0, 0xd9ad86, 0xf1d3b5, 0xc79a74][i % 4],
    hair = [0x5a4330, 0x2f2a26, 0xa36b3f, 0xe0c78f][(i >> 1) % 4];
  const legs = [];
  for (const s of [-1, 1])
    legs.push(
      b.dyn({type: 'leg', side: s}, q => q.box(0.05, 0.13, 0.05, 0x5f5648, 0, -0.065, 0), s * 0.04, 0.15, 0)
    );
  b.cyl(0.09, 0.11, 0.2, shirt, 0, 0.25, 0, 7);
  for (const s of [-1, 1]) b.cyl(0.025, 0.025, 0.16, shirt, s * 0.12, 0.27, 0, 4, {rz: s * 0.15});
  b.ball(0.1, skin, 0, 0.44, 0, {detail: 1});
  const style = i % 4;
  if (style === 0) {
    b.cyl(0.06, 0.17, 0.04, P.straw, 0, 0.53, 0, 10);
    b.cyl(0.07, 0.08, 0.07, P.straw, 0, 0.57, 0, 8);
  } else if (style === 1) b.sph(0.105, hair, 0, 0.45, -0.01, {tl: PI / 2.1});
  else if (style === 2) {
    b.sph(0.105, 0xd0614e, 0, 0.46, 0, {tl: PI / 2});
    b.ball(0.03, P.white, 0, 0.57, 0);
  } else {
    b.sph(0.105, hair, 0, 0.45, -0.01, {tl: PI / 2});
    b.ball(0.05, hair, 0, 0.42, -0.09);
  }
  if (i % 3 === 0) b.box(0.09, 0.12, 0.03, [0xb5544a, 0x4f7aa3, 0xd8b04f][i % 3], 0.0, 0.26, 0.11);
  return legs;
}

/* ---------- collectibles (unit-ish size, standing on y=0) ---------- */
const M = {
  gold: {metal: 0.85, rough: 0.28},
  silver: {metal: 0.9, rough: 0.25},
  brass: {metal: 0.75, rough: 0.35},
  glass: {opacity: 0.35, rough: 0.08, smooth: 1},
  gem: {rough: 0.15, smooth: 0},
  glow: {emissive: 1},
  paper: {rough: 0.95}
};
function leafShape(len = 1, w = 0.45) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(w, len * 0.25, w * 0.9, len * 0.75, 0, len);
  s.bezierCurveTo(-w * 0.9, len * 0.75, -w, len * 0.25, 0, 0);
  return s;
}
const leafGeo = (len, w, depth = 0.03) =>
  cached(`leaf${len}:${w}:${depth}`, () => {
    const g = new THREE.ExtrudeGeometry(leafShape(len, w), {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 1,
      curveSegments: 10
    });
    g.translate(0, 0, -depth / 2);
    return g;
  });
const latheGeo = (key, pts, n = 18) =>
  cached(
    'lathe' + key,
    () =>
      new THREE.LatheGeometry(
        pts.map(([x, y]) => new THREE.Vector2(x, y)),
        n
      )
  );
const ITEMS = {
  leaf(b) {
    b.at(0, 0.08, 0, {rz: -0.25, rx: -0.35}, () => {
      b.geo(leafGeo(1, 0.42, 0.04), 0xe39a3b, 0, 0, 0, {mat: {rough: 0.4, emissive: 0.18, smooth: 0}});
      for (const z of [-0.032, 0.032]) {
        b.box(0.022, 0.9, 0.012, 0xa85a1e, 0, 0.47, z);
        for (let i = 0; i < 4; i++)
          for (const s of [-1, 1])
            b.box(0.014, 0.24 - i * 0.03, 0.012, 0xb8682a, s * 0.085, 0.24 + i * 0.17, z, {rz: -s * 0.95});
      }
      b.cyl(0.018, 0.025, 0.22, 0x8a5a2a, 0, -0.1, 0, 5);
    });
  },
  bottle(b) {
    b.geo(
      latheGeo('bottle', [
        [0, 0],
        [0.2, 0],
        [0.24, 0.06],
        [0.25, 0.42],
        [0.2, 0.56],
        [0.09, 0.64],
        [0.08, 0.82],
        [0.1, 0.86],
        [0, 0.86]
      ]),
      0xbfe4ee,
      0,
      0,
      0,
      {mat: M.glass}
    );
    b.cyl(0.205, 0.215, 0.16, 0x3f8fb8, 0, 0.1, 0, 18, {mat: {rough: 0.2, opacity: 0.85}});
    b.cyl(0.2, 0.2, 0.02, 0x8fd6e8, 0, 0.19, 0, 18, {mat: {emissive: 0.3}});
    b.cyl(0.07, 0.06, 0.12, 0xb98a5a, 0, 0.88, 0, 10);
    b.tor(0.09, 0.012, 0xd9c79a, 0, 0.78, 0, {rx: H, m: 16});
    b.at(0, 0.26, 0, () => {
      b.box(0.12, 0.03, 0.05, 0xf6efe0, 0, 0, 0);
      b.prism(0.06, 0.1, 0.005, P.white, 0, 0.01, 0);
    });
    b.box(0.15, 0.1, 0.005, 0xf3e7c8, 0.18, 0.62, 0.12, {ry: 0.6, rz: 0.3, mat: M.paper});
  },
  feather(b) {
    b.at(0, 0.0, 0, {rz: -0.35}, () => {
      b.cyl(0.012, 0.018, 1.1, 0xf2ead6, 0, 0.55, 0, 6);
      b.geo(leafGeo(0.95, 0.2, 0.012), 0x5b8fc4, 0, 0.18, 0, {mat: {rough: 0.6, smooth: 1}});
      b.geo(leafGeo(0.55, 0.12, 0.016), 0x7cc2c9, 0, 0.55, 0.01, {mat: {rough: 0.6, smooth: 1}});
      b.geo(leafGeo(0.25, 0.07, 0.02), 0xe9e2cf, 0, 0.88, 0.015, {mat: {rough: 0.6}});
      for (let i = 0; i < 5; i++)
        b.box(0.08, 0.006, 0.02, 0x3f6f9e, i % 2 ? 0.12 : -0.12, 0.3 + i * 0.12, 0.015, {
          rz: i % 2 ? -0.5 : 0.5
        });
    });
  },
  compass(b) {
    b.at(0, 0.06, 0, () => {
      b.cyl(0.42, 0.44, 0.12, 0xc9a24f, 0, 0, 0, 32, {mat: M.brass});
      b.cyl(0.37, 0.37, 0.02, 0xf3ead2, 0, 0.065, 0, 32, {mat: M.paper});
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2;
        b.box(
          i % 2 ? 0.012 : 0.02,
          0.005,
          i % 2 ? 0.06 : 0.1,
          0x6b5a40,
          Math.sin(a) * 0.3,
          0.08,
          Math.cos(a) * 0.3,
          {ry: a}
        );
      }
      b.at(0, 0.09, 0, {ry: 0.5}, () => {
        b.cone(0.04, 0.28, 0xd0503e, 0, 0, 0.14, 4, {rx: H});
        b.cone(0.04, 0.28, 0xe9e5dc, 0, 0, -0.14, 4, {rx: -H});
        b.ball(0.03, P.gold, 0, 0.01, 0, {mat: M.gold});
      });
      b.cyl(0.38, 0.38, 0.012, 0xd8eef0, 0, 0.12, 0, 32, {mat: M.glass});
      b.tor(0.4, 0.03, 0xd9b562, 0, 0.1, 0, {rx: H, m: 32, mat: M.brass});
      b.cyl(0.05, 0.05, 0.1, 0xd9b562, 0, 0.02, -0.47, 10, {rx: H, mat: M.brass});
      b.tor(0.07, 0.018, 0xd9b562, 0, 0.02, -0.56, {mat: M.brass});
    });
  },
  moon(b) {
    b.at(0, 0.5, 0, {rx: -0.25}, () => {
      b.cyl(0.36, 0.36, 0.1, 0xd7dbe2, 0, 0, 0, 32, {rx: H, mat: M.silver});
      b.cyl(0.31, 0.31, 0.02, 0x1f2d52, 0, 0, 0.052, 32, {rx: H, mat: {emissive: 0.15}});
      b.cyl(0.16, 0.16, 0.02, 0xf3e7b5, -0.04, 0.04, 0.064, 24, {rx: H, mat: {emissive: 0.6}});
      b.cyl(0.15, 0.15, 0.025, 0x1f2d52, 0.04, 0.08, 0.066, 24, {rx: H});
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI * 2;
        b.ball(0.012, 0xf3e7b5, Math.sin(a) * 0.26, Math.cos(a) * 0.26, 0.07, {mat: {emissive: 0.8}});
      }
      b.box(0.016, 0.18, 0.01, 0xd7dbe2, 0, 0.07, 0.08, {rz: -0.4, mat: M.silver});
      b.box(0.016, 0.12, 0.01, 0xd7dbe2, 0, 0.05, 0.085, {rz: 1.3, mat: M.silver});
      b.tor(0.37, 0.02, 0xc4c9d2, 0, 0, 0, {m: 32, mat: M.silver});
      b.cyl(0.04, 0.05, 0.08, 0xc4c9d2, 0, 0.4, 0, 10, {mat: M.silver});
      b.tor(0.07, 0.018, 0xc4c9d2, 0, 0.49, 0, {mat: M.silver});
      for (let i = 0; i < 4; i++)
        b.tor(0.04, 0.012, 0xc4c9d2, 0.06 + i * 0.06, 0.58 + i * 0.04, 0, {ry: i % 2 ? H : 0, mat: M.silver});
    });
  },
  crystal(b) {
    b.ball(0.32, 0x6c6a78, 0, 0.05, 0, {sy: 0.45, sx: 1.3, detail: 0, mat: {rough: 0.9}});
    const cs = [0x7ee0c3, 0x9b8cf0, 0x6fc2f0, 0xc59af0, 0x8ff0d0];
    [
      [0, 0.42, 0, 0.13, 0.65, 0],
      [0.18, 0.3, 0.08, 0.09, 0.42, -0.4],
      [-0.17, 0.3, 0.05, 0.1, 0.5, 0.45],
      [0.05, 0.26, -0.17, 0.08, 0.38, 0.4],
      [-0.06, 0.22, 0.19, 0.07, 0.3, -0.3]
    ].forEach(([x, y, z, r, h, rz], i) =>
      b.at(x, y, z, {rz, rx: i % 2 ? 0.2 : -0.15}, () => {
        b.cyl(r, r * 0.9, h, cs[i], 0, 0, 0, 6, {mat: {rough: 0.12, emissive: 0.45, opacity: 0.88}});
        b.cone(r, r * 1.6, shade(cs[i], 0.1), 0, h / 2 + r * 0.8, 0, 6, {
          mat: {rough: 0.12, emissive: 0.55, opacity: 0.9}
        });
      })
    );
  },
  whale(b) {
    b.at(0, 0.42, 0, () => {
      b.ball(0.38, 0x2f4f8f, 0, 0, 0, {sx: 1.5, sy: 0.85, sz: 0.9, detail: 2, mat: {rough: 0.4, smooth: 1}});
      b.ball(0.3, 0xd7e3ef, 0.05, -0.12, 0, {sx: 1.45, sy: 0.5, sz: 0.85, detail: 2, mat: {smooth: 1}});
      b.at(-0.62, 0.08, 0, {rz: 0.35}, () => {
        b.cone(0.1, 0.32, 0x2f4f8f, -0.12, 0, 0, 8, {rz: H, mat: {smooth: 1}});
        b.geo(leafGeo(0.32, 0.14, 0.04), 0x2f4f8f, -0.25, 0, 0, {rz: H * 0.6, mat: {smooth: 1}});
        b.geo(leafGeo(0.32, 0.14, 0.04), 0x2f4f8f, -0.25, 0, 0, {rz: H * 1.4, mat: {smooth: 1}});
      });
      for (const s of [-1, 1])
        b.geo(leafGeo(0.26, 0.1, 0.03), 0x2a477f, 0.1, -0.15, s * 0.3, {rx: s * 1.2, rz: 2.4});
      b.ball(0.035, 0x10182c, 0.42, 0.04, 0.22);
      b.ball(0.035, 0x10182c, 0.42, 0.04, -0.22);
      const st = [
        [0.1, 0.25, 0.2],
        [-0.2, 0.2, -0.25],
        [0.3, 0.15, -0.15],
        [-0.35, 0.18, 0.12],
        [0, 0.3, 0],
        [0.2, 0.28, -0.05]
      ];
      for (const [x, y, z] of st) b.ball(0.03, 0xfff1a8, x, y, z, {mat: {emissive: 1}});
    });
    b.dyn(
      {type: 'spin', axis: 'y', speed: 0.6},
      s => {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * PI * 2;
          s.ball(0.035, 0xfff1a8, Math.cos(a) * 0.75, 0.1 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.75, {
            mat: {emissive: 1}
          });
        }
      },
      0,
      0.45,
      0
    );
  },
  crown(b) {
    b.at(0, 0.0, 0, () => {
      b.cyl(0.4, 0.38, 0.22, 0xe8bd52, 0, 0.11, 0, 24, {open: 1, mat: M.gold});
      b.tor(0.4, 0.03, 0xd9a93e, 0, 0.02, 0, {rx: H, m: 32, mat: M.gold});
      b.tor(0.4, 0.025, 0xd9a93e, 0, 0.22, 0, {rx: H, m: 32, mat: M.gold});
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2,
          big = i % 2 === 0;
        b.cone(
          0.07,
          big ? 0.32 : 0.2,
          0xe8bd52,
          Math.cos(a) * 0.39,
          0.22 + (big ? 0.16 : 0.1),
          Math.sin(a) * 0.39,
          4,
          {mat: M.gold}
        );
        b.ball(
          big ? 0.045 : 0.03,
          big ? 0xff8a5c : 0xfff1c4,
          Math.cos(a) * 0.39,
          0.22 + (big ? 0.34 : 0.22),
          Math.sin(a) * 0.39,
          {mat: {emissive: 0.6, rough: 0.15}}
        );
        b.ball(0.035, [0xd0503e, 0x4f7ad0, 0x4fae7a][i % 3], Math.cos(a) * 0.41, 0.11, Math.sin(a) * 0.41, {
          mat: {rough: 0.1, emissive: 0.25}
        });
      }
      b.ball(0.1, 0xffcf5c, 0, 0.42, 0.38, {detail: 1, mat: {emissive: 0.9}});
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2;
        b.box(0.02, 0.1, 0.01, 0xffe08a, Math.cos(a) * 0.16, 0.42 + Math.sin(a) * 0.16, 0.38, {
          rz: a - H,
          mat: {emissive: 0.8}
        });
      }
    });
  },
  acorn(b) {
    b.box(0.7, 0.05, 0.05, 0x8a5a2a, 0, 0.95, 0);
    b.cyl(0.004, 0.004, 0.32, P.rope, 0, 0.78, 0, 3);
    b.at(0, 0.5, 0, () => {
      b.ball(0.17, 0xc98b4a, 0, 0, 0, {sy: 1.25, detail: 2, mat: {rough: 0.45, smooth: 1}});
      b.sph(0.185, 0x7a5232, 0, 0.1, 0, {tl: PI / 2.2, mat: {rough: 0.95}});
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2;
        b.ball(0.03, 0x8d6440, Math.cos(a) * 0.15, 0.14, Math.sin(a) * 0.15);
      }
      b.cyl(0.015, 0.02, 0.08, 0x5f3d22, 0, 0.31, 0, 5);
      b.cone(0.03, 0.06, 0xf1d58a, 0, -0.24, 0, 5, {rx: PI});
    });
    for (const s of [-1, 1])
      b.at(s * 0.26, 0.65, 0, () => {
        b.cyl(0.003, 0.003, 0.26, P.rope, 0, 0.15, 0, 3);
        b.sph(0.07, 0xd9b562, 0, -0.02, 0, {tl: PI / 1.6, mat: M.brass});
        b.ball(0.02, 0xd9b562, 0, -0.07, 0, {mat: M.brass});
      });
  },
  shell(b) {
    b.at(0, 0.02, 0, {rz: -0.42, rx: 0.15}, () => {
      const c1 = 0xf3dcc8,
        c2 = 0xe8c4ae;
      b.ball(0.24, c1, 0, 0.3, 0, {sy: 1.35, detail: 2, mat: {rough: 0.35, smooth: 1}});
      for (let i = 0; i < 5; i++) {
        const y = 0.5 + i * 0.1,
          r = 0.2 * Math.pow(0.74, i);
        b.tor(r, r * 0.38, i % 2 ? c2 : c1, 0, y, 0, {rx: H, n: 8, m: 18, mat: {rough: 0.35, smooth: 1}});
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * PI * 2 + i;
          b.cone(r * 0.22, r * 0.5, c2, Math.cos(a) * r, y + 0.02, Math.sin(a) * r, 4, {
            rz: -Math.cos(a) * 0.9,
            rx: Math.sin(a) * 0.9
          });
        }
      }
      b.cone(0.05, 0.16, c1, 0, 1.04, 0, 8, {mat: {rough: 0.35}});
      b.at(0.06, 0.28, 0.12, {ry: 0.5, rz: 0.2}, () => {
        b.sph(0.25, 0xf6b4a6, 0, 0, 0, {tl: PI * 0.55, sx: 0.7, sz: 0.5, mat: {rough: 0.3, smooth: 1}});
        b.ball(0.13, 0xe0857c, 0, -0.02, 0.03, {
          sx: 0.8,
          sy: 1.4,
          sz: 0.3,
          mat: {rough: 0.25, emissive: 0.12, smooth: 1}
        });
      });
      b.cone(0.07, 0.22, c2, 0.02, 0.0, 0, 6, {rx: PI});
    });
  },
  teacup(b) {
    b.geo(
      latheGeo(
        'saucer',
        [
          [0, 0],
          [0.42, 0],
          [0.46, 0.04],
          [0.44, 0.05],
          [0, 0.03]
        ],
        24
      ),
      0xf6f0e4,
      0,
      0,
      0,
      {mat: {rough: 0.25, smooth: 1}}
    );
    b.tor(0.38, 0.015, 0x6f9cc9, 0, 0.045, 0, {rx: H, m: 32});
    b.geo(
      latheGeo(
        'cup',
        [
          [0, 0.04],
          [0.13, 0.04],
          [0.2, 0.1],
          [0.27, 0.3],
          [0.28, 0.42],
          [0.265, 0.42],
          [0.255, 0.32],
          [0.19, 0.13],
          [0, 0.13]
        ],
        24
      ),
      0xf6f0e4,
      0,
      0,
      0,
      {mat: {rough: 0.25, smooth: 1}}
    );
    b.tor(0.272, 0.012, 0x6f9cc9, 0, 0.36, 0, {rx: H, m: 32});
    b.cyl(0.255, 0.255, 0.01, 0xc77f3c, 0, 0.38, 0, 24, {mat: {rough: 0.1}});
    b.tor(0.09, 0.025, 0xf6f0e4, 0.3, 0.27, 0, {arc: PI * 1.3, rz: -0.6, mat: {rough: 0.25}});
    for (let i = 0; i < 3; i++)
      b.tor(0.06, 0.008, 0xffffff, -0.05 + i * 0.05, 0.55 + i * 0.12, 0, {
        arc: PI,
        rz: i % 2 ? 0 : PI,
        mat: {opacity: 0.45, emissive: 0.4}
      });
  },
  lantern(b) {
    b.at(0, 0.0, 0, () => {
      b.cyl(0.2, 0.24, 0.06, 0xa07a42, 0, 0.03, 0, 6, {mat: M.brass});
      b.cyl(0.18, 0.18, 0.5, 0xfff1c0, 0, 0.31, 0, 6, {mat: {opacity: 0.45, rough: 0.05, emissive: 0.55}});
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2;
        b.box(0.025, 0.52, 0.025, 0xa07a42, Math.cos(a) * 0.18, 0.31, Math.sin(a) * 0.18, {mat: M.brass});
      }
      b.cyl(0.06, 0.24, 0.16, 0xa07a42, 0, 0.64, 0, 6, {mat: M.brass});
      b.tor(0.1, 0.018, 0xa07a42, 0, 0.82, 0, {mat: M.brass});
      for (let i = 0; i < 9; i++)
        b.ball(0.025, 0xd8ff8a, Math.cos(i * 2.4) * 0.1, 0.15 + i * 0.04, Math.sin(i * 2.4) * 0.1, {
          mat: {emissive: 1}
        });
      b.ball(0.06, 0xfff0a0, 0, 0.3, 0, {mat: {emissive: 1}});
    });
  },
  hourglass(b) {
    for (const y of [0, 0.92]) {
      b.cyl(0.28, 0.28, 0.06, 0x8a5a3a, 0, y + 0.03, 0, 16, {mat: {rough: 0.5}});
      b.tor(0.28, 0.015, 0xd9b562, 0, y + (y ? 0.0 : 0.06), 0, {rx: H, m: 24, mat: M.brass});
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      b.cyl(0.025, 0.025, 0.86, 0x8a5a3a, Math.cos(a) * 0.24, 0.49, Math.sin(a) * 0.24, 8);
    }
    b.geo(
      latheGeo(
        'hg',
        [
          [0, 0.06],
          [0.18, 0.08],
          [0.2, 0.22],
          [0.12, 0.38],
          [0.035, 0.49],
          [0.12, 0.6],
          [0.2, 0.76],
          [0.18, 0.9],
          [0, 0.92]
        ],
        18
      ),
      0xe5f3f6,
      0,
      0,
      0,
      {mat: M.glass}
    );
    b.cone(0.15, 0.16, 0xf5c96a, 0, 0.15, 0, 14, {mat: {emissive: 0.55, rough: 0.3}});
    b.cyl(0.13, 0.04, 0.12, 0xf5c96a, 0, 0.68, 0, 14, {mat: {emissive: 0.55}});
    b.cyl(0.006, 0.006, 0.3, 0xffe39a, 0, 0.33, 0, 3, {mat: {emissive: 1}});
    for (let i = 0; i < 5; i++)
      b.ball(0.012, 0xfff3b0, Math.cos(i) * 0.08, 0.25 + i * 0.05, Math.sin(i) * 0.08, {mat: {emissive: 1}});
  },
  scroll(b) {
    b.at(0, 0.06, 0, () => {
      b.box(0.8, 0.006, 0.56, 0xeedfb8, 0, 0, 0, {mat: M.paper});
      b.ball(0.12, 0x8fbf88, -0.05, 0.006, 0.02, {sx: 1.6, sy: 0.02, sz: 1.1});
      b.ball(0.06, 0x5f8fb8, 0.2, 0.008, -0.12, {sx: 1.5, sy: 0.02});
      b.box(0.3, 0.004, 0.02, 0xc0533e, 0.02, 0.01, 0.05, {ry: 0.6});
      b.ball(0.025, 0xc0533e, 0.18, 0.012, 0.15);
      for (let i = 0; i < 4; i++) b.box(0.08, 0.004, 0.008, 0x8a7a5a, -0.3 + i * 0.05, 0.01, -0.22);
      b.cyl(0.06, 0.06, 0.6, 0xeedfb8, 0.4, 0.05, 0, 14, {rx: H, mat: M.paper});
      b.cyl(0.065, 0.065, 0.012, 0xc0533e, 0.4, 0.05, 0.12, 14, {rx: H});
      for (const z of [-0.32, 0.32]) b.cyl(0.035, 0.035, 0.06, 0x8a5a3a, 0.4, 0.05, z, 8, {rx: H});
      b.cyl(0.04, 0.04, 0.6, 0xe6d4a8, -0.4, 0.03, 0, 12, {rx: H, mat: M.paper});
    });
  },
  globe(b) {
    b.cyl(0.22, 0.28, 0.08, 0x6b4a35, 0, 0.04, 0, 16, {mat: {rough: 0.4}});
    b.cyl(0.03, 0.05, 0.3, 0xd9b562, 0, 0.22, 0, 8, {mat: M.gold});
    b.at(0, 0.68, 0, () => {
      b.ball(0.17, 0x2d4f8f, 0, 0, 0, {detail: 3, mat: {rough: 0.3, smooth: 1, emissive: 0.2}});
      for (let i = 0; i < 8; i++)
        b.ball(
          0.015,
          0xfff1a8,
          Math.cos(i * 2.3) * 0.16,
          Math.sin(i * 1.7) * 0.12,
          Math.sin(i * 2.3) * 0.12,
          {mat: {emissive: 1}}
        );
      b.tor(0.38, 0.012, 0xd9b562, 0, 0, 0, {m: 40, mat: M.gold});
      b.tor(0.38, 0.012, 0xd9b562, 0, 0, 0, {rx: H, m: 40, mat: M.gold});
      b.tor(0.32, 0.014, 0xe8bd52, 0, 0, 0, {rx: H, ry: 0.41, rz: 0.4, m: 40, mat: M.gold});
      b.tor(0.3, 0.01, 0xe8bd52, 0, 0, 0, {ry: H, m: 40, mat: M.gold});
      b.cyl(0.008, 0.008, 0.9, 0xd9b562, 0, 0, 0, 4, {rz: 0.4, mat: M.gold});
      b.ball(0.05, 0xffcf5c, 0.2, 0.42, 0, {mat: {emissive: 1}});
    });
    b.tor(0.26, 0.02, 0xd9b562, 0, 0.38, 0, {rx: H, m: 24, arc: PI, mat: M.gold, rz: 0});
  },
  koi(b) {
    b.cyl(0.015, 0.015, 1.0, 0x6b3f2e, -0.3, 0.5, 0, 5, {rz: -0.5});
    b.cyl(0.003, 0.003, 0.18, P.rope, 0.0, 0.82, 0, 3);
    b.at(0.05, 0.55, 0, {rz: 0.2}, () => {
      b.ball(0.22, 0xfff6ec, 0, 0, 0, {
        sx: 1.6,
        sy: 0.85,
        sz: 0.8,
        detail: 2,
        mat: {emissive: 0.55, rough: 0.5, smooth: 1}
      });
      for (const [x, y, z, r] of [
        [0.12, 0.1, 0.08, 0.1],
        [-0.12, 0.06, -0.1, 0.12],
        [-0.02, 0.15, 0, 0.09],
        [0.22, 0, 0.1, 0.06]
      ])
        b.ball(r, 0xe8553c, x, y, z, {sy: 0.5, detail: 1, mat: {emissive: 0.45, smooth: 1}});
      b.geo(leafGeo(0.3, 0.16, 0.02), 0xf08a5a, -0.38, 0, 0, {rz: H, mat: {emissive: 0.4, opacity: 0.85}});
      b.geo(leafGeo(0.3, 0.16, 0.02), 0xf08a5a, -0.38, 0, 0, {
        rz: H * 1.6,
        mat: {emissive: 0.4, opacity: 0.85}
      });
      b.geo(leafGeo(0.16, 0.08, 0.02), 0xf3b07a, 0.05, 0.17, 0, {rz: 0.3, mat: {emissive: 0.4}});
      for (const s of [-1, 1])
        b.geo(leafGeo(0.14, 0.07, 0.02), 0xf3b07a, 0.12, -0.12, s * 0.14, {
          rx: s * 1.1,
          rz: 2.6,
          mat: {emissive: 0.4}
        });
      for (const s of [-1, 1]) b.ball(0.025, 0x1f2229, 0.3, 0.04, s * 0.1);
      b.tor(0.06, 0.008, 0xd9b562, 0.36, -0.02, 0, {ry: H, mat: M.gold});
      b.cyl(0.06, 0.08, 0.03, 0xd9b562, 0, -0.19, 0, 10, {mat: M.gold});
      b.cyl(0.004, 0.004, 0.14, 0xd0503e, 0, -0.28, 0, 3);
      b.ball(0.025, 0xd0503e, 0, -0.36, 0);
    });
  },
  bonsai(b) {
    b.box(0.8, 0.18, 0.5, 0x3f6f9e, 0, 0.09, 0, {mat: {rough: 0.2}});
    b.box(0.86, 0.04, 0.56, 0x2f5a86, 0, 0.19, 0, {mat: {rough: 0.2}});
    b.box(0.74, 0.02, 0.44, 0x5a4632, 0, 0.2, 0);
    b.ball(0.05, 0x9a9c94, 0.25, 0.22, 0.1);
    b.ball(0.04, 0x7fa463, -0.2, 0.22, 0.12, {sy: 0.4});
    const tr = 0x6b4a35;
    b.at(0, 0.2, 0, () => {
      b.cyl(0.06, 0.1, 0.38, tr, -0.05, 0.18, 0, 7, {rz: 0.35});
      b.cyl(0.05, 0.065, 0.34, tr, -0.07, 0.48, 0, 7, {rz: -0.5});
      b.cyl(0.035, 0.05, 0.32, tr, 0.12, 0.66, 0, 6, {rz: 0.9});
      b.cyl(0.03, 0.04, 0.3, tr, -0.2, 0.62, 0.05, 6, {rz: -1.0});
      for (const [x, y, z, r] of [
        [0.32, 0.82, 0, 0.22],
        [-0.36, 0.78, 0.05, 0.2],
        [-0.02, 0.9, -0.05, 0.24],
        [0.1, 1.02, 0.08, 0.15]
      ]) {
        b.ball(r, 0x5f9a5a, x, y, z, {sy: 0.45, detail: 1, mat: {smooth: 1}});
        b.ball(r * 0.7, 0x7fb86a, x + 0.03, y + 0.05, z, {sy: 0.4, detail: 1});
      }
    });
    for (let i = 0; i < 10; i++)
      b.ball(
        0.025,
        0xffd46a,
        Math.cos(i * 2.4) * 0.35,
        0.95 + Math.sin(i * 1.3) * 0.15,
        Math.sin(i * 2.4) * 0.2,
        {mat: {emissive: 1}}
      );
    b.dyn(
      {type: 'spin', axis: 'y', speed: 0.4},
      s => {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * PI * 2;
          s.ball(0.02, 0xfff1a8, Math.cos(a) * 0.6, Math.sin(a * 3) * 0.08, Math.sin(a) * 0.6, {
            mat: {emissive: 1}
          });
        }
      },
      0,
      0.9,
      0
    );
  },
  phoenix(b) {
    b.at(0, 0.0, 0, {rz: -0.2}, () => {
      b.cyl(0.014, 0.02, 1.15, 0xffe2a0, 0, 0.57, 0, 6, {mat: {emissive: 0.6}});
      b.geo(leafGeo(1.0, 0.26, 0.014), 0xd8402e, 0, 0.15, 0, {mat: {emissive: 0.55, smooth: 1}});
      b.geo(leafGeo(0.8, 0.2, 0.02), 0xf07a2e, 0, 0.25, 0.006, {mat: {emissive: 0.7, smooth: 1}});
      b.geo(leafGeo(0.55, 0.13, 0.026), 0xffbe3d, 0, 0.38, 0.012, {mat: {emissive: 0.85, smooth: 1}});
      b.geo(leafGeo(0.3, 0.07, 0.032), 0xfff1a8, 0, 0.5, 0.016, {mat: {emissive: 1}});
    });
    b.dyn(
      {type: 'spin', axis: 'y', speed: 0.9},
      s => {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * PI * 2;
          s.ball(
            0.02 + (i % 3) * 0.008,
            [0xffbe3d, 0xf07a2e, 0xfff1a8][i % 3],
            Math.cos(a) * (0.3 + (i % 2) * 0.1),
            0.3 + i * 0.08,
            Math.sin(a) * (0.3 + (i % 2) * 0.1),
            {mat: {emissive: 1}}
          );
        }
      },
      0,
      0,
      0
    );
    b.cyl(0.2, 0.24, 0.05, 0x3a2c2a, 0, 0.025, 0, 12, {mat: {rough: 0.4}});
  }
};
export function itemModel(b, id, scale = 1) {
  b.at(0, 0, 0, {s: scale}, () => (ITEMS[id] || ITEMS.leaf)(b));
}
export const ITEM_IDS = Object.keys(ITEMS);

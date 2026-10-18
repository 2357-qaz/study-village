// Sculpts the reading room's companion (书屋守灯人) as smooth signed-distance volumes and writes
// dist/assets/companion.bin + companion.json. Run: node tools/sculpt-companion.mjs [part ...]
// Parts are rigid pieces placed at runtime (dist/companion.js) from the shared poses
// (dist/companion-poses.js), each in its own frame:
//   head, headOpen, hair — origin at the top of the neck, face towards +z
//   upper_<pose>, hands_<pose> — torso, sleeves, hands and the long hair down her back, in the
//     torso frame (origin at the hips); sculpted per pose so shoulders and hair flow without seams
//   lapSeated, lowerStand — origin on the floor under her
import {writeFileSync, mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {
  Part,
  mesh,
  simplify,
  pack,
  roundCone,
  ellipsoid,
  sphere,
  box,
  torus,
  strand,
  bezier,
  foldCone,
  field,
  rot
} from './sdf.mjs';
import {POSES, NECK} from '../dist/companion-poses.js';

export const PALETTE = {
  skin: 0xf3dac6,
  lip: 0xd99a8e,
  hair: 0xc9ccd4,
  hair2: 0xb8bcc6,
  hair3: 0xd8dbe1,
  cardigan: 0xb3acc4,
  cardEdge: 0xa39cb6,
  blouse: 0xf6f3ec,
  skirt: 0x4a4a58,
  skirtDeep: 0x3c3c49,
  stock: 0xe2dccf,
  shoe: 0x4a3a30,
  sole: 0x2e241e,
  button: 0xe8e2d6,
  eye: 0xf3f0ea,
  blush: 0xefb9ab,
  ink: 0x3a2c28
};
const M = Object.fromEntries(Object.keys(PALETTE).map((k, i) => [k, i]));
const HAIRS = [M.hair, M.hair2, M.hair3];
const {abs, sin, cos, sign, hypot} = Math;
const add = (a, b) => a.map((v, i) => v + b[i]),
  sub = (a, b) => a.map((v, i) => v - b[i]),
  mul = (a, k) => a.map(v => v * k),
  cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm = a => mul(a, 1 / hypot(...a)),
  axes = (x, y, z) => [...x, ...y, ...z]; // world->local rotation whose rows are the local axes
// a frame whose local Y runs along d (for rings around a limb)
function alongY(d) {
  d = norm(d);
  const x = norm(cross(abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], d));
  return axes(x, d, cross(x, d));
}
// where the surface of f is met walking from (x, y, z0) along z in direction dir
function surfZ(f, x, y, dir = 1, z0 = 0) {
  let a = z0,
    b = z0;
  while (f(x, y, b) < 0 && abs(b - z0) < 0.4) b += dir * 0.004;
  for (let i = 0; i < 24; i++) {
    const m = (a + b) / 2;
    if (f(x, y, m) < 0) a = m;
    else b = m;
  }
  return (a + b) / 2;
}
// a point in the head's frame, in the torso frame for the given head pose (YXZ euler, as at runtime)
function headToTorso([x, y, z], {tilt, turn}) {
  const y1 = y * cos(tilt) - z * sin(tilt),
    z1 = y * sin(tilt) + z * cos(tilt);
  return add([x * cos(turn) + z1 * sin(turn), y1, -x * sin(turn) + z1 * cos(turn)], NECK);
}

function head(open = false) {
  const p = new Part(open ? 'headOpen' : 'head', {h: 0.0022});
  p.add(ellipsoid([0, 0.13, -0.008], [0.096, 0.108, 0.104]), M.skin, 0);
  p.add(ellipsoid([0, 0.095, 0.03], [0.083, 0.088, 0.078]), M.skin, 0.03);
  for (const s of [-1, 1]) {
    p.add(roundCone([s * 0.064, 0.078, 0.02], [s * 0.012, 0.018, 0.056], 0.03, 0.02), M.skin, 0.03);
    p.add(sphere([s * 0.05, 0.07, 0.066], 0.032), M.skin, 0.03);
    p.add(ellipsoid([s * 0.097, 0.1, -0.006], [0.011, 0.024, 0.017], rot(0, s * 0.3, 0)), M.skin, 0.008);
  }
  p.add(sphere([0, 0.016, 0.058], 0.023), M.skin, 0.02);
  // nose: bridge to tip, soft wings
  p.add(roundCone([0, 0.102, 0.097], [0, 0.079, 0.112], 0.0065, 0.0102), M.skin, 0.012);
  for (const s of [-1, 1]) p.add(sphere([s * 0.009, 0.077, 0.105], 0.0058), M.skin, 0.006);
  // brow ridge, eye sockets and closed eyelids
  p.add(roundCone([-0.055, 0.128, 0.086], [0.055, 0.128, 0.086], 0.009), M.skin, 0.02);
  for (const s of [-1, 1]) {
    p.sub(ellipsoid([s * 0.041, 0.106, 0.105], [0.024, 0.014, 0.012]), 0.012);
    if (open) {
      // the eye under a soft upper lid, a lash line along the lid's edge
      p.add(sphere([s * 0.041, 0.103, 0.086], 0.0158), M.eye, 0);
      p.add(
        ellipsoid([s * 0.041, 0.1125, 0.093], [0.021, 0.0068, 0.0125], rot(0, 0, s * 0.08)),
        M.skin,
        0.004
      );
      p.add(
        strand(
          bezier(
            [s * 0.022, 0.108, 0.1],
            [s * 0.032, 0.111, 0.106],
            [s * 0.05, 0.111, 0.105],
            [s * 0.062, 0.106, 0.096],
            6
          ),
          [0.0012, 0.0017, 0.0019, 0.0019, 0.0017, 0.0015, 0.0012],
          0.001
        ),
        M.ink,
        0.001
      );
    } else {
      // lowered lids, the lashes a dark line along their lower edge
      p.add(ellipsoid([s * 0.041, 0.104, 0.092], [0.02, 0.013, 0.012]), M.skin, 0.008);
      p.add(
        strand(
          bezier(
            [s * 0.023, 0.1, 0.1],
            [s * 0.032, 0.0935, 0.105],
            [s * 0.05, 0.0935, 0.104],
            [s * 0.06, 0.099, 0.096],
            6
          ),
          [0.0012, 0.0016, 0.0018, 0.0018, 0.0016, 0.0014, 0.0011],
          0.001
        ),
        M.ink,
        0.001
      );
    }
    p.paint(ellipsoid([s * 0.054, 0.066, 0.09], [0.014, 0.008, 0.03]), M.blush);
  }
  // lips
  p.add(roundCone([-0.011, 0.051, 0.092], [0.011, 0.051, 0.092], 0.0036), M.lip, 0.006);
  p.add(ellipsoid([0, 0.044, 0.09], [0.009, 0.0045, 0.0045]), M.lip, 0.006);
  p.sub(roundCone([-0.01, 0.0475, 0.097], [0.01, 0.0475, 0.097], 0.0014), 0.002);
  // neck
  p.add(roundCone([0, -0.07, -0.008], [0, 0.05, 0.004], 0.042, 0.038), M.skin, 0.025);
  return p;
}

function hair() {
  const p = new Part('hair', {h: 0.0026});
  // the cap, trimmed at a hairline that dips at the temples and runs down to the nape
  const thr = (x, z) =>
      z > 0.02
        ? 0.2 - 0.07 * Math.min(1, abs(x) / 0.1)
        : 0.2 + (z - 0.02) * 1.2 - 0.04 * Math.min(1, abs(x) / 0.1),
    shell = ellipsoid([0, 0.132, -0.01], [0.112, 0.125, 0.119]),
    crown = ellipsoid([0, 0.172, -0.022], [0.104, 0.09, 0.104]);
  p.add(
    field((x, y, z) => Math.max(Math.min(shell.d(x, y, z), crown.d(x, y, z)), thr(x, z) - y), shell.box),
    M.hair,
    0
  );
  // fringe: one sheet hugging the forehead (an offset of the head's own surface), ridged into
  // strands, with a scalloped hem whose points fall at different lengths
  const hd = head();
  hd.prepare();
  const W = 0.021,
    hem = x => {
      const u = x / W + 0.5,
        i = Math.floor(u),
        t = abs(u - i - 0.5) * 2,
        len = [0.012, 0.022, 0.016, 0.026, 0.014, 0.024, 0.018, 0.02, 0.013][((i % 9) + 9) % 9];
      return 0.15 + abs(x) * 0.45 - len * 1.2 * (1 - t) ** 1.3;
    };
  p.add(
    field(
      (x, y, z) => {
        if (z < -0.01) return 1;
        const sh = abs(hd.eval(x, y, z) - 0.011) - (0.0058 + 0.0022 * Math.cos((2 * Math.PI * x) / W));
        return Math.max(sh, hem(x) - y, abs(x) - 0.094, 0.01 - z);
      },
      [-0.11, 0.09, -0.02, 0.11, 0.26, 0.13]
    ),
    M.hair,
    0.006
  );
  // locks framing the face: a curtain of thin strands each side that blend into a ridged ribbon,
  // falling from the temples past the jaw, tips turning in a little
  for (const s of [-1, 1])
    for (let k = 0; k < 8; k++) {
      const z = 0.07 - k * 0.012,
        out = 0.004 * Math.sin(k * 1.7),
        len = 0.13 + 0.03 * Math.sin(k * 2.3 + (s > 0 ? 1 : 0)) + k * 0.006,
        pts = bezier(
          [s * 0.088, 0.2, z * 0.8],
          [s * (0.118 + out), 0.13, z],
          [s * (0.116 + out), 0.0, z - 0.004],
          [s * (0.098 + out), -len, z - 0.012 + k * 0.002],
          10
        ),
        radii = pts.map((_, j) => 0.0085 * (1 - (j / 10) * 0.55));
      p.add(strand(pts, radii, 0.004), HAIRS[(k + (s > 0 ? 1 : 0)) % 3], 0.009);
    }
  // the back of the head down to the nape, close over the skull (the long hair continues in the
  // torso frame, see upper())
  for (let i = 0; i < 12; i++) {
    const u = i / 11 - 0.5,
      pts = bezier(
        [u * 0.07, 0.24, -0.04],
        [u * 0.15, 0.2, -0.128],
        [u * 0.14, 0.09, -0.126],
        [u * 0.12, 0.02, -0.098],
        9
      ),
      radii = pts.map((_, k) => 0.017 * (1 - (k / 9) * 0.3));
    p.add(strand(pts, radii, 0.005), HAIRS[i % 3], 0.009);
  }
  // the half-up knot the ribbon is tied around
  p.add(torus([0, 0.155, -0.142], 0.02, 0.01, rot(Math.PI / 2 + 0.3, 0, 0)), M.hair2, 0.008);
  p.add(sphere([0, 0.155, -0.14], 0.017), M.hair, 0.008);
  return p;
}

/* ---------- body ---------- */
// the torso under the clothes: hips, waist, chest and shoulders as one soft mass (torso frame)
function torsoBase() {
  const p = new Part('base', {h: 0.003});
  p.add(ellipsoid([0, 0.07, -0.005], [0.148, 0.1, 0.102]), 0, 0);
  p.add(ellipsoid([0, 0.2, 0], [0.122, 0.11, 0.086]), 0, 0.06);
  p.add(ellipsoid([0, 0.345, 0], [0.146, 0.115, 0.097]), 0, 0.07);
  for (const s of [-1, 1]) p.add(sphere([s * 0.05, 0.352, 0.05], 0.046), 0, 0.04);
  p.add(roundCone([-0.122, 0.432, -0.012], [0.122, 0.432, -0.012], 0.05), 0, 0.06);
  p.prepare();
  return p;
}

// torso in the open cardigan over the blouse, both sleeves, and the long hair down her back
function upper(pose) {
  const P = POSES[pose],
    p = new Part('upper_' + pose, {h: 0.0032}),
    base = torsoBase(),
    B = base.bounds,
    bd = (x, y, z) => base.eval(x, y, z),
    w = y => 0.024 + Math.max(0, y - 0.2) * 0.17, // half-width of the opening down the front
    card = (x, y, z) => Math.max(bd(x, y, z) - 0.007, -Math.max(abs(x) - w(y), 0.2 - y, -z)),
    front = (x, y) => surfZ((a, b, c) => bd(a, b, c) - 0.007, x, y),
    back = (x, y) => surfZ((a, b, c) => bd(a, b, c) - 0.007, x, y, -1);
  p.add(field(bd, B), M.blouse, 0);
  p.add(field(card, B), M.cardigan, 0);
  p.add(roundCone([0, 0.43, -0.004], [0, 0.56, 0.01], 0.041, 0.037), M.skin, 0.012);
  // rounded blouse collar either side of the neck
  for (const s of [-1, 1])
    p.add(
      ellipsoid([s * 0.036, 0.49, 0.047], [0.04, 0.011, 0.03], rot(0.55, s * -0.25, s * -0.3)),
      M.blouse,
      0.006
    );
  // the cardigan's front edges, buttoned below the chest; buttons on the cardigan and the blouse
  for (const s of [-1, 1]) {
    const pts = [];
    for (let y = 0.03; y <= 0.49; y += 0.046) pts.push([s * w(y), y, front(s * w(y), y) + 0.001]);
    p.add(
      strand(
        pts,
        pts.map(() => 0.0075),
        0.004
      ),
      M.cardEdge,
      0.005
    );
  }
  for (const y of [0.06, 0.12, 0.18]) p.add(sphere([0, y, front(0, y) + 0.004], 0.0072), M.button, 0.002);
  for (const y of [0.27, 0.34, 0.41]) p.add(sphere([0, y, surfZ(bd, 0, y) + 0.002], 0.0045), M.button, 0.002);
  // patch pockets and a ribbed hem
  for (const s of [-1, 1])
    p.add(
      box(
        [s * 0.086, 0.075, front(s * 0.086, 0.075) - 0.001],
        [0.032, 0.027, 0.006],
        0.004,
        rot(0, s * 0.55, 0)
      ),
      M.cardEdge,
      0.004
    );
  p.add(
    field((x, y, z) => Math.max(bd(x, y, z) - 0.013, abs(y - 0.024) - 0.02), B),
    M.cardEdge,
    0.003
  );
  // sleeves: shoulder, upper arm, forearm bunching above the ribbed cuff
  for (const A of P.arms) {
    const d = norm(sub(A.wr, A.el));
    p.add(ellipsoid(A.sh, [0.054, 0.05, 0.054]), M.cardigan, 0.03);
    p.add(roundCone(A.sh, A.el, 0.046, 0.041), M.cardigan, 0.02);
    p.add(roundCone(A.el, A.wr, 0.041, 0.034), M.cardigan, 0.014);
    for (const t of [0.05, 0.085])
      p.add(torus(sub(A.wr, mul(d, t)), 0.034, 0.0055, alongY(d)), M.cardigan, 0.008);
    p.add(torus(sub(A.wr, mul(d, 0.008)), 0.031, 0.009, alongY(d)), M.cardEdge, 0.004);
  }
  // the long hair: a layer lying on the cardigan's back with a ragged hem, and strands over it
  // from the back of the head, over the nape
  const hem = x => 0.21 + 0.07 * (x / 0.13) ** 2 + 0.018 * sin(x * 90) + 0.01 * sin(x * 37);
  p.add(
    field(
      (x, y, z) => {
        if (z > 0.02) return 1;
        const o = bd(x, y, z) - 0.007;
        return Math.max(
          abs(o - 0.012) - 0.007,
          hem(x) - y,
          y - 0.5,
          abs(x) - 0.13 + Math.max(0, y - 0.4) * 0.3,
          z + 0.03
        );
      },
      [-0.16, 0.15, -0.2, 0.16, 0.52, 0.03]
    ),
    M.hair,
    0.008
  );
  const n = 21;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5,
      a = u * 2.4,
      h0 = headToTorso([0.092 * sin(a), 0.14, -0.012 - 0.112 * cos(a)], P.head),
      h1 = headToTorso([0.086 * sin(a), 0.045, -0.014 - 0.09 * cos(a)], P.head),
      x2 = u * 0.21,
      x3 = u * 0.25 + 0.005 * sin(i * 2.7),
      y3 = hem(x3) + 0.006 + 0.012 * sin(i * 1.3),
      pts = bezier(h0, h1, [x2, 0.42, back(x2, 0.42) - 0.028], [x3, y3, back(x3, y3) - 0.018], 12),
      radii = pts.map((_, k) => 0.0145 * (1 - (k / 12) * 0.5));
    p.add(strand(pts, radii, 0.005), HAIRS[i % 3], 0.008);
  }
  p.cut(
    field((x, y) => -0.004 - y),
    0.004
  );
  return p;
}

// both hands for a pose (torso frame), finer than the rest: palm, four jointed fingers, thumb
function hands(pose) {
  const p = new Part('hands_' + pose, {h: 0.0013});
  for (const A of POSES[pose].arms) {
    const d = norm(sub(A.wr, A.el)),
      side = norm(cross(d, norm(A.palm))),
      nn = cross(side, d),
      ts = A.sh[0] < 0 ? 1 : -1, // the thumb's side of the hand
      c = A.curl,
      w = add(A.wr, mul(d, 0.012)),
      pc = add(w, mul(d, 0.03)),
      at = (o, ...steps) => steps.reduce((q, [v, k]) => add(q, mul(v, k)), o);
    p.add(roundCone(sub(A.wr, mul(d, 0.025)), add(w, mul(d, 0.008)), 0.02, 0.021), M.skin, 0);
    p.add(ellipsoid(pc, [0.027, 0.0118, 0.034], axes(side, nn, d)), M.skin, 0.014);
    [0.036, 0.04, 0.038, 0.03].forEach((len, i) => {
      const b0 = at(pc, [d, 0.024 - i * i * 0.0012], [side, (1.5 - i) * 0.0128 * ts]),
        k1 = at(b0, [d, len * 0.45], [nn, -len * 0.25 * c]),
        k2 = at(k1, [d, len * 0.33 * (1 - c * 0.5)], [nn, -len * 0.35 * c]),
        tip = at(k2, [d, len * 0.25 * (1 - c * 0.8)], [nn, -len * 0.3 * c]);
      p.add(strand([b0, k1, k2, tip], [0.007, 0.0064, 0.0057, 0.005], 0.002), M.skin, 0.005);
    });
    const tb = at(pc, [side, 0.02 * ts], [d, -0.014]),
      tm = at(tb, [d, 0.018], [side, 0.012 * ts], [nn, -0.008]),
      tt = at(tm, [d, 0.015], [side, 0.004 * ts], [nn, -0.004 - 0.01 * c]);
    p.add(strand([tb, tm, tt], [0.0105, 0.008, 0.0062], 0.002), M.skin, 0.01);
  }
  return p;
}

// a Mary Jane shoe on the floor at (x, z), toe towards +z
function maryJane(p, x, z) {
  p.add(ellipsoid([x, 0.03, z + 0.015], [0.039, 0.03, 0.076]), M.shoe, 0.012);
  p.add(torus([x, 0.042, z - 0.01], 0.033, 0.0048, alongY([0, 0.25, 1])), M.shoe, 0.003);
  p.paint(
    field((a, y) => y - 0.011),
    M.sole,
    M.shoe
  );
}

// seated: thighs under the skirt, the skirt's pleated drape over the knees, stockinged legs, shoes
function lapSeated() {
  const p = new Part('lapSeated', {h: 0.0032});
  for (const s of [-1, 1]) {
    p.add(roundCone([s * 0.078, 0.455, -0.02], [s * 0.08, 0.452, 0.365], 0.088, 0.071), M.skirt, 0.03);
    p.add(roundCone([s * 0.079, 0.43, 0.39], [s * 0.079, 0.075, 0.425], 0.036, 0.024), M.stock, 0.004);
    p.add(ellipsoid([s * 0.079, 0.31, 0.385], [0.033, 0.075, 0.035]), M.stock, 0.03);
    p.add(roundCone([s * 0.079, 0.09, 0.425], [s * 0.079, 0.035, 0.43], 0.025, 0.027), M.stock, 0.01);
    maryJane(p, s * 0.079, 0.43);
  }
  // the skirt bridging the thighs, then a pleated sheet falling from the knees
  p.add(box([0, 0.49, 0.2], [0.085, 0.045, 0.2], 0.03), M.skirt, 0.05);
  p.add(roundCone([-0.08, 0.457, 0.37], [0.08, 0.457, 0.37], 0.07), M.skirt, 0.04);
  const pleat = x => 0.006 * sin(x * 58);
  p.add(
    field(
      (x, y, z) => {
        const half = 0.16 + (0.47 - y) * 0.09,
          u = Math.min(1, abs(x) / half),
          zc = 0.445 + pleat(x) * (0.4 + (0.47 - y) * 3) + (0.47 - y) * 0.07 - 0.11 * u ** 3;
        return Math.max(
          abs(z - zc) - 0.009,
          abs(x) - half,
          y - 0.5,
          0.272 + pleat(x) * 1.5 + 0.02 * u * u - y
        );
      },
      [-0.22, 0.25, 0.25, 0.22, 0.48, 0.5]
    ),
    M.skirt,
    0.03
  );
  p.paint(
    field((x, y, z) => (z > 0.42 && y < 0.46 ? sin(x * 58) + 0.5 : 1)),
    M.skirtDeep,
    M.skirt
  );
  return p;
}

// standing: legs inside a pleated skirt that flares to just below the knees, shoes
function lowerStand() {
  const p = new Part('lowerStand', {h: 0.0034});
  for (const s of [-1, 1]) {
    p.add(roundCone([s * 0.062, 0.6, 0], [s * 0.063, 0.08, 0.005], 0.05, 0.024), M.stock, 0.01);
    p.add(ellipsoid([s * 0.063, 0.33, -0.006], [0.034, 0.075, 0.036]), M.stock, 0.03);
    maryJane(p, s * 0.062, 0.0);
  }
  p.add(foldCone([0, 0, 0], 1.0, 0.23, 0.158, 0.25, {sz: 0.78, folds: 12, depth: 0.013}), M.skirt, 0.01);
  p.paint(
    field((x, y, z) =>
      y > 0.2 && y < 0.9 ? sin(12 * Math.atan2(z / 0.78, x)) + 0.35 + (y - 0.23) * 0.8 : 1
    ),
    M.skirtDeep,
    M.skirt
  );
  return p;
}

// part -> [builder, kept fraction of triangles after decimation]
export const BUILD = {
  head: [() => head(false), 0.08],
  headOpen: [() => head(true), 0.08],
  hair: [hair, 0.06],
  lapSeated: [lapSeated, 0.04],
  lowerStand: [lowerStand, 0.035],
  ...Object.fromEntries(
    Object.keys(POSES).flatMap(k => [
      [`upper_${k}`, [() => upper(k), 0.04]],
      [`hands_${k}`, [() => hands(k), 0.06]]
    ])
  )
};

async function main() {
  const want = process.argv.slice(2);
  const parts = Object.entries(BUILD).filter(([k]) => !want.length || want.includes(k));
  const meshes = [];
  for (const [name, [make, keep]] of parts) {
    const t = Date.now(),
      full = mesh(make()),
      m = await simplify(full, keep);
    console.log(
      `${name}: ${full.idx.length / 3} -> ${m.idx.length / 3} tris, ${m.pos.length / 3} verts, ${Date.now() - t} ms`
    );
    meshes.push(m);
  }
  const {manifest, buf} = pack(meshes, PALETTE);
  mkdirSync(new URL('../dist/assets/', import.meta.url), {recursive: true});
  writeFileSync(new URL('../dist/assets/companion.bin', import.meta.url), buf);
  writeFileSync(new URL('../dist/assets/companion.json', import.meta.url), JSON.stringify(manifest));
  console.log(`wrote ${buf.length} bytes`);
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();

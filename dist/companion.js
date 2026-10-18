// 书屋守灯人: the quiet companion who reads with you. Unlike the low-poly villagers she is built
// from smooth, higher-resolution shapes (own geometry with smooth normals, marked {smooth}).
// companionModel(b, {look, pose}) — look: 'a' | 'b' | 'c'; pose: 'stand' | 'read'.
import * as THREE from './vendor/three.module.min.js';

const PI = Math.PI,
  H = PI / 2;
const G = new Map(),
  geo = (k, make) => G.get(k) || (G.set(k, make()), G.get(k));
const SPH = () => geo('sph', () => new THREE.SphereGeometry(1, 40, 28));
const partial = (ps, pl, ts, tl) =>
  geo(`ps${ps}:${pl}:${ts}:${tl}`, () => new THREE.SphereGeometry(1, 40, 28, ps, pl, ts, tl));
const capsule = (r, len) =>
  geo(
    `cap${r.toFixed(3)}:${len.toFixed(3)}`,
    () => new THREE.CapsuleGeometry(r, Math.max(0.001, len), 8, 20)
  );
const lathe = (key, pts, seg = 40) =>
  geo(
    key,
    () =>
      new THREE.LatheGeometry(
        pts.map(([r, y]) => new THREE.Vector2(r, y)),
        seg
      )
  );
const torus = (R, r, arc = PI * 2) =>
  geo(`tor${R}:${r}:${arc}`, () => new THREE.TorusGeometry(R, r, 12, 40, arc));

const SMOOTH = {smooth: 1, rough: 0.7},
  CLOTH = {smooth: 1, rough: 0.85, double: 1};
const _q = new THREE.Quaternion(),
  _e = new THREE.Euler(),
  _up = new THREE.Vector3(0, 1, 0);

// ellipsoid
function E(b, c, x, y, z, rx, ry = rx, rz = rx, o = {}) {
  b.geo(SPH(), c, x, y, z, {...o, sx: rx, sy: ry, sz: rz, mat: {...SMOOTH, ...o.mat}});
}
// capsule limb between two points
function limb(b, c, p, q, r, o = {}) {
  const a = new THREE.Vector3(...p),
    d = new THREE.Vector3(...q).sub(a),
    len = d.length(),
    m = a.clone().addScaledVector(d, 0.5);
  _q.setFromUnitVectors(_up, d.normalize());
  _e.setFromQuaternion(_q, 'YXZ');
  b.geo(capsule(r, len), c, m.x, m.y, m.z, {...o, rx: _e.x, ry: _e.y, rz: _e.z, mat: {...SMOOTH, ...o.mat}});
}

const LOOKS = {
  // a: 守灯人 — dark brown hair in a low braid, cream knit, forest-green skirt, mustard scarf
  a: {hair: 0x4a3428, top: 0xe9dcc4, skirt: 0x3f5a4a, scarf: 0xc99a3a, shoe: 0x5a4030, sock: 0x6b5a4a},
  // b: short black bob with bangs, navy dress with a white collar, rust scarf
  b: {
    hair: 0x24262d,
    top: 0x2f3e5a,
    skirt: 0x2f3e5a,
    scarf: 0x9a4a3a,
    collar: 0xf4f1ea,
    shoe: 0x3a2e28,
    sock: 0x2a2a30
  },
  // c: pale ash hair half up with a blue ribbon, lavender-grey cardigan, charcoal skirt, round glasses
  c: {
    hair: 0xdcd8d0,
    top: 0xb7b0c6,
    skirt: 0x4a4a58,
    ribbon: 0x6f8ab0,
    collar: 0xf6f3ec,
    shoe: 0x4a3a30,
    sock: 0xe8e2d6
  }
};
const SKIN = 0xf3dac6,
  CHEEK = 0xefb9ab,
  INK = 0x3a2c28;

function head(b, L, look, tilt) {
  // head pivot sits at the top of the neck
  b.at(0, 0, 0, {rx: tilt}, () => {
    const hy = 0.115;
    // one egg-shaped head: full at the cheeks, narrowing to a soft chin
    b.geo(
      lathe(
        'head',
        [
          [0, -0.112],
          [0.03, -0.11],
          [0.06, -0.094],
          [0.084, -0.066],
          [0.1, -0.03],
          [0.106, 0.01],
          [0.104, 0.05],
          [0.092, 0.088],
          [0.066, 0.114],
          [0.034, 0.125],
          [0, 0.128]
        ],
        48
      ),
      SKIN,
      0,
      hy,
      0.006,
      {sz: 1.04, mat: SMOOTH}
    );
    // face: lowered eyelids (reading), brows, nose, mouth, cheeks
    for (const s of [-1, 1]) {
      b.at(s * 0.042, hy - 0.006, 0.101, {ry: s * 0.32}, () => {
        // a lowered eyelid: a soft dark crescent curving down, lashes falling from it
        b.geo(torus(0.017, 0.0034, PI), INK, 0, 0.004, 0, {rz: PI, sy: 0.75, mat: SMOOTH});
        for (let k = 0; k < 3; k++) {
          const a = PI * (1.15 + k * 0.18 + (s > 0 ? 0.0 : 0.0)),
            x = Math.cos(a) * 0.017 * s * -1,
            y = 0.004 + Math.sin(a) * 0.017 * 0.75;
          limb(b, INK, [x, y, 0.001], [x * 1.25, y - 0.008, 0.004], 0.0014);
        }
      });
      limb(b, L.hair, [s * 0.02, hy + 0.035, 0.103], [s * 0.06, hy + 0.04, 0.094], 0.0035);
      E(b, CHEEK, s * 0.058, hy - 0.035, 0.083, 0.02, 0.012, 0.008, {mat: {rough: 0.9}});
    }
    E(b, 0xecc4ae, 0, hy - 0.024, 0.11, 0.0075, 0.01, 0.008);
    b.geo(torus(0.011, 0.0022, PI * 0.7), 0xb0685e, 0, hy - 0.056, 0.097, {rz: PI * 1.15, mat: SMOOTH});
    if (look === 'c')
      for (const s of [-1, 1]) {
        b.geo(torus(0.026, 0.0028), 0x8a6a3a, s * 0.042, hy - 0.004, 0.112, {mat: {metal: 0.6, rough: 0.35}});
        limb(b, 0x8a6a3a, [s * 0.068, hy, 0.108], [s * 0.1, hy + 0.004, 0.02], 0.0025, {mat: {metal: 0.6}});
      }
    hair(b, L, look, hy);
  });
}

function hair(b, L, look, hy) {
  const c = L.hair,
    o = {mat: SMOOTH},
    R = [0.124, 0.139, 0.13];
  // crown down to the hairline, and the back/sides down to the jaw (the face stays open)
  b.geo(partial(0, PI * 2, 0, PI * 0.4), c, 0, hy + 0.003, -0.004, {sx: R[0], sy: R[1], sz: R[2], ...o});
  b.geo(partial(PI * 0.78, PI * 1.44, 0, PI * 0.78), c, 0, hy + 0.003, -0.004, {
    sx: R[0],
    sy: R[1],
    sz: R[2],
    ...o
  });
  // fringe: a band over the forehead with a few soft tips breaking its edge
  const fr = look === 'b' ? 0.47 : 0.44;
  b.geo(partial(PI * 0.12, PI * 0.76, PI * 0.18, PI * (fr - 0.18)), c, 0, hy + 0.002, 0.0, {
    sx: 0.128,
    sy: 0.141,
    sz: 0.134,
    ...o
  });
  if (look === 'a') E(b, c, -0.045, hy + 0.045, 0.106, 0.05, 0.022, 0.012, {rz: 0.35, rx: -0.3}); // swept lock
  if (look === 'a') {
    // locks framing the face, and a low braid over the right shoulder
    for (const s of [-1, 1]) E(b, c, s * 0.1, hy - 0.06, 0.035, 0.024, 0.08, 0.026, {rz: s * 0.12});
    E(b, c, 0, hy - 0.1, -0.07, 0.085, 0.07, 0.05);
    const braid = [
      [0.07, hy - 0.14, -0.035],
      [0.1, hy - 0.2, 0.005],
      [0.118, hy - 0.26, 0.045],
      [0.126, hy - 0.32, 0.072],
      [0.127, hy - 0.375, 0.086],
      [0.124, hy - 0.425, 0.09],
      [0.12, hy - 0.47, 0.09]
    ];
    braid.forEach(([x, y, z], i) =>
      E(b, c, x, y, z, 0.027 - i * 0.0018, 0.034, 0.024, {rz: (i % 2 ? 1 : -1) * 0.45})
    );
    E(b, L.scarf, 0.12, hy - 0.505, 0.09, 0.019, 0.012, 0.019);
    E(b, c, 0.12, hy - 0.545, 0.09, 0.017, 0.035, 0.014);
  } else if (look === 'b') {
    // bob: fuller sides that curl in at the jaw
    b.geo(partial(PI * 0.8, PI * 1.4, PI * 0.3, PI * 0.42), c, 0, hy - 0.004, -0.004, {
      sx: 0.136,
      sy: 0.142,
      sz: 0.132,
      ...o
    });
  } else {
    // long hair down the back, half tied up with a ribbon
    for (const s of [-1, 1]) E(b, c, s * 0.1, hy - 0.11, 0.015, 0.02, 0.13, 0.034, {rz: s * 0.05});
    E(b, c, 0, hy - 0.22, -0.08, 0.12, 0.25, 0.05, {rx: 0.1});
    E(b, c, 0, hy + 0.03, -0.115, 0.042, 0.038, 0.032);
    for (const s of [-1, 1]) E(b, L.ribbon, s * 0.04, hy + 0.035, -0.135, 0.034, 0.02, 0.01, {rz: s * 0.4});
    E(b, L.ribbon, 0, hy + 0.035, -0.14, 0.013, 0.013, 0.011);
    for (const s of [-1, 1]) E(b, L.ribbon, s * 0.022, hy - 0.02, -0.15, 0.008, 0.05, 0.004, {rz: s * 0.3});
  }
}

// torso from the hips (origin) up; returns nothing, builds sweater/dress, neck and collar
function torso(b, L, look) {
  b.geo(
    lathe('torso', [
      [0.0, 0],
      [0.14, 0],
      [0.15, 0.06],
      [0.128, 0.2],
      [0.15, 0.32],
      [0.158, 0.4],
      [0.15, 0.45],
      [0.11, 0.5],
      [0.05, 0.52],
      [0, 0.52]
    ]),
    L.top,
    0,
    0,
    0,
    {sz: 0.7, mat: SMOOTH}
  );
  // knit ribbing / buttons
  if (look === 'a') {
    for (const x of [-0.05, 0, 0.05]) limb(b, 0xddcfb5, [x, 0.08, 0.1], [x, 0.4, 0.1], 0.008);
  } else if (look === 'c') {
    limb(b, L.collar, [0, 0.12, 0.085], [0, 0.48, 0.07], 0.035); // blouse showing under the cardigan
    for (let k = 0; k < 4; k++) E(b, 0xe8e2d6, 0.035, 0.14 + k * 0.08, 0.1, 0.008, 0.008, 0.005);
  } else {
    for (let k = 0; k < 4; k++) E(b, 0xd9d4c8, 0, 0.12 + k * 0.08, 0.105, 0.007, 0.007, 0.005);
  }
  limb(b, SKIN, [0, 0.49, 0], [0, 0.56, 0.006], 0.04); // neck
  if (look === 'a') {
    b.geo(torus(0.062, 0.024), L.scarf, 0, 0.52, 0.01, {rx: H - 0.1, mat: SMOOTH});
    E(b, L.scarf, 0.05, 0.42, 0.105, 0.035, 0.11, 0.014, {rz: -0.12, rx: -0.15});
    E(b, L.scarf, 0.0, 0.44, 0.112, 0.03, 0.09, 0.013, {rz: 0.06, rx: -0.15});
  } else {
    // round collar
    for (const s of [-1, 1])
      E(b, L.collar || L.top, s * 0.045, 0.505, 0.06, 0.055, 0.016, 0.04, {rz: s * -0.25});
    if (look === 'b') {
      b.geo(torus(0.058, 0.018), L.scarf, 0, 0.515, 0.0, {rx: H - 0.15, mat: SMOOTH});
      limb(b, L.scarf, [-0.03, 0.51, 0.06], [-0.05, 0.36, 0.1], 0.02);
    }
  }
}

function arm(b, L, s, sh, el, wr) {
  limb(b, L.top, sh, el, 0.048);
  limb(b, L.top, el, wr, 0.042);
  const w = new THREE.Vector3(...wr),
    d = w
      .clone()
      .sub(new THREE.Vector3(...el))
      .normalize();
  b.geo(torus(0.04, 0.012), L.top, w.x, w.y, w.z, {mat: SMOOTH, ...cuffRot(d)}); // cuff
  const h = w.clone().addScaledVector(d, 0.05);
  E(b, SKIN, h.x, h.y, h.z, 0.026, 0.018, 0.045, cuffRot(d));
}
function cuffRot(d) {
  _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  _e.setFromQuaternion(_q, 'YXZ');
  return {rx: _e.x, ry: _e.y, rz: _e.z};
}

function book(b, x, y, z, rx) {
  b.at(x, y, z, {rx}, () => {
    for (const s of [-1, 1]) {
      b.box(0.13, 0.008, 0.18, 0xf3eddc, s * 0.068, 0.006, 0, {rz: s * -0.12});
      b.box(0.135, 0.006, 0.185, 0x7a4a46, s * 0.068, 0, 0, {rz: s * -0.12});
    }
  });
}

export function companionModel(b, {look = 'a', pose = 'read'} = {}) {
  const L = LOOKS[look];
  if (pose === 'stand') {
    // legs and skirt
    for (const s of [-1, 1]) {
      limb(b, L.sock, [s * 0.06, 0.06, 0], [s * 0.065, 0.5, 0], 0.035);
      E(b, L.shoe, s * 0.06, 0.03, 0.03, 0.04, 0.03, 0.075);
    }
    b.geo(
      lathe(`skirt-${look}`, [
        [0.255, 0.16],
        [0.25, 0.2],
        [0.21, 0.55],
        [0.165, 0.85],
        [0.15, 0.95]
      ]),
      L.skirt,
      0,
      0,
      0,
      {sz: 0.8, mat: CLOTH}
    );
    b.at(0, 0.86, 0, () => {
      torso(b, L, look);
      for (const s of [-1, 1])
        arm(b, L, s, [s * 0.16, 0.44, 0], [s * 0.2, 0.18, 0.03], [s * 0.21, -0.04, 0.07]);
      b.at(0, 0.555, 0.006, () => head(b, L, look, 0.05));
    });
    return;
  }
  // reading in the armchair: hips on the seat (seat top ≈ 0.42), knees forward, book in both hands
  const hip = 0.46;
  for (const s of [-1, 1]) {
    limb(b, L.sock, [s * 0.07, hip - 0.02, 0.36], [s * 0.075, 0.09, 0.42], 0.034);
    E(b, L.shoe, s * 0.075, 0.035, 0.46, 0.04, 0.03, 0.075);
  }
  // lap and the skirt draped over the knees
  // the skirt lies over both thighs as one soft mass, then falls from the knees
  E(b, L.skirt, 0, hip + 0.005, 0.17, 0.175, 0.075, 0.24);
  E(b, L.skirt, 0, hip + 0.01, 0.36, 0.17, 0.06, 0.07);
  b.geo(
    lathe(`drape-${look}`, [
      [0.165, -0.27],
      [0.16, -0.24],
      [0.15, -0.12],
      [0.14, 0.0]
    ]),
    L.skirt,
    0,
    hip + 0.02,
    0.38,
    {sz: 0.5, mat: CLOTH}
  );
  b.at(0, hip - 0.02, -0.02, {rx: -0.12}, () => {
    torso(b, L, look);
    // both hands hold the open book in front of her
    for (const s of [-1, 1]) arm(b, L, s, [s * 0.16, 0.44, 0], [s * 0.2, 0.22, 0.12], [s * 0.1, 0.27, 0.3]);
    book(b, 0, 0.29, 0.36, -0.75);
    b.at(0, 0.555, 0.01, () => head(b, L, look, 0.42));
  });
}

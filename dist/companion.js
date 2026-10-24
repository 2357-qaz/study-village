// 书屋守灯人: the quiet companion who reads with you. Her body, clothes and hair are sculpted as
// smooth volumes offline (tools/sculpt-companion.mjs, loaded by sculpt-loader.js); small details —
// glasses, irises, the ribbon, the book and the teapot — are added here. If the sculpted parts
// can't be loaded she is assembled from simple smooth shapes instead.
// companionModel(b, {pose, parts}) — pose: 'read' | 'turn' | 'look' (seated in the armchair, origin
// on the floor under the seat, facing +z) or 'tea' (standing, pouring tea towards +z).
import * as THREE from './vendor/three.module.min.js';
import {POSES, NECK} from './companion-poses.js?v=1';

const PI = Math.PI,
  H = PI / 2;
const G = new Map(),
  geo = (k, make) => G.get(k) || (G.set(k, make()), G.get(k));
const SPH = () => geo('sph', () => new THREE.SphereGeometry(1, 40, 28));
const partial = (ps, pl, ts, tl) =>
  geo(`ps${ps}:${pl}:${ts}:${tl}`, () => new THREE.SphereGeometry(1, 48, 32, ps, pl, ts, tl));
const capsule = (r, len) =>
  geo(
    `cap${r.toFixed(4)}:${len.toFixed(4)}`,
    () => new THREE.CapsuleGeometry(r, Math.max(0.001, len), 8, 20)
  );
const lathe = (key, pts, seg = 48) =>
  geo(
    key,
    () =>
      new THREE.LatheGeometry(
        pts.map(([r, y]) => new THREE.Vector2(r, y)),
        seg
      )
  );
const torus = (R, r, arc = PI * 2) =>
  geo(`tor${R}:${r}:${arc}`, () => new THREE.TorusGeometry(R, r, 14, 48, arc));

const SMOOTH = {smooth: 1, rough: 0.7},
  CLOTH = {smooth: 1, rough: 0.88, double: 1},
  HAIRM = {smooth: 1, rough: 0.55};
const C = {
  skin: 0xf3dac6,
  cheek: 0xefb9ab,
  ink: 0x3a2c28,
  hair: 0xc9ccd4, // cool ash: stays silver-grey under the warm lamp
  hair2: 0xbcc0c9,
  hair3: 0xd6d9df,
  cardigan: 0xb3acc4,
  cardEdge: 0xa39cb6,
  blouse: 0xf6f3ec,
  skirt: 0x4a4a58,
  stock: 0xe2dccf,
  shoe: 0x4a3a30,
  ribbon: 0x6f8ab0,
  frame: 0x8a6a3a,
  pot: 0xeae4d6
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(),
  _e = new THREE.Euler();

// ellipsoid
function E(b, c, x, y, z, rx, ry = rx, rz = rx, o = {}) {
  b.geo(SPH(), c, x, y, z, {...o, sx: rx, sy: ry, sz: rz, mat: {...SMOOTH, ...o.mat}});
}
// rotation (as YXZ euler options) that turns +Y (or `from`) onto direction d
function aim(d, from = V(0, 1, 0)) {
  _q.setFromUnitVectors(from, d.clone().normalize());
  _e.setFromQuaternion(_q, 'YXZ');
  return {rx: _e.x, ry: _e.y, rz: _e.z};
}
// capsule between two points
function limb(b, c, p, q, r, o = {}) {
  const a = Array.isArray(p) ? V(...p) : p,
    e = Array.isArray(q) ? V(...q) : q,
    d = e.clone().sub(a),
    m = a.clone().addScaledVector(d, 0.5);
  b.geo(capsule(r, d.length()), c, m.x, m.y, m.z, {...o, ...aim(d), mat: {...SMOOTH, ...o.mat}});
}

/* ---------- head ---------- */
function eyes(b, hy, open) {
  for (const s of [-1, 1]) {
    b.at(s * 0.042, hy - 0.006, 0.101, {ry: s * 0.32}, () => {
      if (open) {
        // open, soft eyes looking up at you: iris, a glint, the upper lash line
        E(b, 0x4a5568, 0, -0.002, 0, 0.0105, 0.014, 0.005);
        E(b, 0x22252c, 0, -0.003, 0.003, 0.006, 0.008, 0.003);
        E(b, 0xffffff, s * -0.003, 0.004, 0.006, 0.0025, 0.0025, 0.001);
        b.geo(torus(0.0135, 0.0026, PI), C.ink, 0, 0.0, 0.002, {sy: 0.85, mat: SMOOTH});
        limb(b, C.ink, [s * 0.013, 0.002, 0.002], [s * 0.019, 0.007, 0.003], 0.0016);
      } else {
        // lowered eyelids, lashes falling from them
        b.geo(torus(0.017, 0.0034, PI), C.ink, 0, 0.004, 0, {rz: PI, sy: 0.75, mat: SMOOTH});
        for (let k = 0; k < 3; k++) {
          const a = PI * (1.15 + k * 0.18),
            x = Math.cos(a) * 0.017 * -s,
            y = 0.004 + Math.sin(a) * 0.017 * 0.75;
          limb(b, C.ink, [x, y, 0.001], [x * 1.25, y - 0.008, 0.004], 0.0014);
        }
      }
    });
    limb(
      b,
      C.hair2,
      [s * 0.02, hy + (open ? 0.04 : 0.035), 0.103],
      [s * 0.06, hy + (open ? 0.046 : 0.04), 0.094],
      0.0032
    );
    E(b, C.cheek, s * 0.058, hy - 0.035, 0.083, 0.02, 0.012, 0.008, {mat: {rough: 0.9}});
  }
}
function head(b, {tilt = 0, turn = 0, open = false}) {
  b.at(0, 0, 0, {rx: tilt, ry: turn}, () => {
    const hy = 0.115;
    // one egg-shaped head: full at the cheeks, narrowing to a soft chin
    b.geo(
      lathe('head', [
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
      ]),
      C.skin,
      0,
      hy,
      0.006,
      {sz: 1.04, mat: SMOOTH}
    );
    eyes(b, hy, open);
    E(b, 0xecc4ae, 0, hy - 0.024, 0.11, 0.0075, 0.01, 0.008);
    b.geo(torus(0.011, 0.0022, PI * 0.7), 0xb0685e, 0, hy - 0.056, 0.097, {rz: PI * 1.15, mat: SMOOTH});
    // round glasses
    for (const s of [-1, 1]) {
      b.geo(torus(0.026, 0.0026), C.frame, s * 0.042, hy - 0.004, 0.113, {mat: {metal: 0.6, rough: 0.35}});
      limb(b, C.frame, [s * 0.068, hy, 0.108], [s * 0.103, hy + 0.004, 0.02], 0.0024, {mat: {metal: 0.6}});
    }
    limb(b, C.frame, [-0.016, hy + 0.002, 0.116], [0.016, hy + 0.002, 0.116], 0.0022, {mat: {metal: 0.6}});
    hair(b, hy);
  });
}

function hair(b, hy) {
  const o = {mat: HAIRM},
    R = [0.124, 0.139, 0.13];
  // crown down to the hairline, and the back/sides down to the jaw (the face stays open)
  b.geo(partial(0, PI * 2, 0, PI * 0.4), C.hair, 0, hy + 0.003, -0.004, {sx: R[0], sy: R[1], sz: R[2], ...o});
  b.geo(partial(PI * 0.78, PI * 1.44, 0, PI * 0.78), C.hair, 0, hy + 0.003, -0.004, {
    sx: R[0],
    sy: R[1],
    sz: R[2],
    ...o
  });
  // a clean fringe band
  b.geo(partial(PI * 0.12, PI * 0.76, PI * 0.18, PI * 0.26), C.hair, 0, hy + 0.002, 0.0, {
    sx: 0.128,
    sy: 0.141,
    sz: 0.134,
    ...o
  });
  // locks framing the face: three strands each side
  for (const s of [-1, 1])
    for (let k = 0; k < 3; k++)
      E(
        b,
        [C.hair, C.hair2, C.hair3][k],
        s * (0.096 + k * 0.006),
        hy - 0.1 - k * 0.012,
        0.03 - k * 0.022,
        0.014,
        0.13 - k * 0.012,
        0.022,
        {rz: s * (0.04 + k * 0.03), mat: HAIRM}
      );
  // long hair falling down the back: a fan of strands over a base layer
  E(b, C.hair, 0, hy - 0.2, -0.085, 0.12, 0.25, 0.058, {rx: 0.1, mat: HAIRM});
  for (let i = 0; i < 9; i++) {
    const u = i / 8 - 0.5;
    E(
      b,
      i % 3 === 0 ? C.hair2 : i % 3 === 1 ? C.hair3 : C.hair,
      u * 0.2,
      hy - 0.22 - Math.abs(u) * 0.04,
      -0.105 + Math.abs(u) * 0.04,
      0.034,
      0.25,
      0.02,
      {rz: u * 0.22, rx: 0.1, mat: HAIRM}
    );
  }
  // half tied up with a blue ribbon
  E(b, C.hair, 0, hy + 0.03, -0.115, 0.042, 0.038, 0.032, {mat: HAIRM});
  for (const s of [-1, 1]) E(b, C.ribbon, s * 0.04, hy + 0.035, -0.135, 0.034, 0.02, 0.01, {rz: s * 0.4});
  E(b, C.ribbon, 0, hy + 0.035, -0.14, 0.013, 0.013, 0.011);
  for (const s of [-1, 1]) E(b, C.ribbon, s * 0.022, hy - 0.02, -0.15, 0.008, 0.05, 0.004, {rz: s * 0.3});
}

/* ---------- body ---------- */
// torso from the hips (origin) up: lavender-grey cardigan open over a white blouse
function torso(b) {
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
    C.cardigan,
    0,
    0,
    0,
    {sz: 0.7, mat: {...SMOOTH, rough: 0.92}}
  );
  // blouse showing down the front, the cardigan's edges either side, buttons on the right edge
  // a narrow blouse placket down the front, the cardigan's edges beside it
  limb(b, C.blouse, [0, 0.16, 0.098], [0, 0.47, 0.084], 0.026, {sz: 0.5});
  for (const s of [-1, 1]) limb(b, C.cardEdge, [s * 0.034, 0.05, 0.103], [s * 0.03, 0.47, 0.088], 0.011);
  for (let k = 0; k < 4; k++) E(b, 0xe8e2d6, 0.05, 0.11 + k * 0.085, 0.108, 0.007, 0.007, 0.004);
  for (let k = 0; k < 3; k++) E(b, 0xd9d2c6, 0, 0.26 + k * 0.065, 0.11, 0.0045, 0.0045, 0.003);
  // patch pockets
  for (const s of [-1, 1]) b.box(0.06, 0.05, 0.008, C.cardEdge, s * 0.085, 0.07, 0.096, {ry: s * 0.3});
  // ribbed hem
  b.geo(torus(0.142, 0.01), C.cardEdge, 0, 0.012, 0, {rx: H, sz: 0.7, mat: SMOOTH});
  limb(b, C.skin, [0, 0.49, 0], [0, 0.56, 0.006], 0.04); // neck
  // rounded blouse collar
  for (const s of [-1, 1]) E(b, C.blouse, s * 0.045, 0.505, 0.06, 0.055, 0.016, 0.04, {rz: s * -0.25});
}

// arm from shoulder to wrist (sleeve tapers), cuff, and a hand pointing along the forearm with the
// palm facing `palm`; curl 0 = flat fingers, 1 = curled
function arm(b, sh, el, wr, {palm, curl = 0.5, spread = 1} = {}) {
  const [S, Eb, W] = [V(...sh), V(...el), V(...wr)];
  E(b, C.cardigan, S.x, S.y, S.z, 0.055, 0.05, 0.055, {mat: {rough: 0.92}});
  limb(b, C.cardigan, S, Eb, 0.047, {mat: {rough: 0.92}});
  limb(b, C.cardigan, Eb, W, 0.04, {mat: {rough: 0.92}});
  const d = W.clone().sub(Eb).normalize();
  b.geo(torus(0.037, 0.011), C.cardEdge, W.x, W.y, W.z, {mat: SMOOTH, ...aim(d, V(0, 0, 1))});
  hand(b, W.clone().addScaledVector(d, 0.012), d, palm ? V(...palm).normalize() : V(0, -1, 0), curl, spread);
}
function hand(b, w, d, n, curl, spread) {
  // frame: d forward along the hand, nn out of the palm, side across the knuckles
  const side = d.clone().cross(n).normalize(),
    nn = side.clone().cross(d).normalize(),
    pc = w.clone().addScaledVector(d, 0.03);
  b.geo(SPH(), C.skin, pc.x, pc.y, pc.z, {
    ...frameRot(side, nn, d),
    sx: 0.025,
    sy: 0.011,
    sz: 0.032,
    mat: SMOOTH
  });
  for (let i = 0; i < 4; i++) {
    const off = (i - 1.5) * 0.0125 * spread,
      len = [0.03, 0.035, 0.033, 0.026][i],
      base = pc.clone().addScaledVector(d, 0.026).addScaledVector(side, off),
      mid = base
        .clone()
        .addScaledVector(d, len * 0.55)
        .addScaledVector(nn, -len * 0.3 * curl),
      tip = mid
        .clone()
        .addScaledVector(d, len * 0.45 * (1 - curl * 0.6))
        .addScaledVector(nn, -len * 0.55 * curl);
    limb(b, C.skin, base, mid, 0.0062);
    limb(b, C.skin, mid, tip, 0.0058);
  }
  const tb = pc.clone().addScaledVector(side, 0.022).addScaledVector(d, -0.008),
    tt = tb.clone().addScaledVector(d, 0.03).addScaledVector(side, 0.012).addScaledVector(nn, -0.012);
  limb(b, C.skin, tb, tt, 0.0072);
}
function frameRot(x, y, z) {
  _e.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z), 'YXZ');
  return {rx: _e.x, ry: _e.y, rz: _e.z};
}

function maryJane(b, x, y, z, ry = 0) {
  b.at(x, y, z, {ry}, () => {
    E(b, C.shoe, 0, 0.028, 0.035, 0.038, 0.028, 0.075, {mat: {smooth: 1, rough: 0.45}});
    E(b, 0x2e241e, 0, 0.006, 0.035, 0.04, 0.008, 0.077);
    b.geo(torus(0.034, 0.005, PI), C.shoe, 0, 0.045, 0.03, {ry: H, sx: 1.1, mat: SMOOTH});
  });
}

function book(b, x, y, z, o = {}, turning = false) {
  b.at(x, y, z, o, () => {
    for (const s of [-1, 1]) {
      // pages (a little thickness) and the hardcover, slightly opened
      b.box(0.125, 0.014, 0.17, 0xf3eddc, s * 0.066, 0.008, 0, {rz: s * -0.1});
      b.box(0.132, 0.006, 0.178, 0x5a6f8c, s * 0.068, 0, 0, {rz: s * -0.1});
    }
    E(b, 0x4a5d78, 0, -0.002, 0, 0.012, 0.01, 0.089);
    if (turning) b.box(0.12, 0.003, 0.165, 0xfbf6e8, 0.0, 0.06, 0, {rz: -1.2}); // a page mid-turn
  });
}

/* ---------- poses ---------- */
const HIP = 0.46;
function seatedLegs(b) {
  for (const s of [-1, 1]) {
    limb(b, C.stock, [s * 0.07, HIP - 0.04, 0.36], [s * 0.074, 0.1, 0.42], 0.033);
    maryJane(b, s * 0.075, 0.0, 0.43);
  }
  // the skirt over both thighs as one soft mass, folds over the knees, then a short drape
  E(b, C.skirt, 0, HIP + 0.005, 0.17, 0.172, 0.074, 0.24, {mat: CLOTH});
  E(b, C.skirt, 0, HIP + 0.008, 0.36, 0.168, 0.058, 0.07, {mat: CLOTH});
  b.geo(
    lathe('drape', [
      [0.158, -0.2],
      [0.155, -0.18],
      [0.147, -0.1],
      [0.14, 0.0]
    ]),
    C.skirt,
    0,
    HIP + 0.02,
    0.385,
    {sz: 0.42, mat: CLOTH}
  );
  for (const x of [-0.08, -0.01, 0.07])
    limb(b, 0x40404e, [x, HIP - 0.01, 0.445], [x * 1.1, HIP - 0.17, 0.452], 0.009, {mat: CLOTH});
}

/* ---------- sculpted ---------- */
const SCULPT = {mat: {smooth: 1, vc: 1, rough: 0.82}};
// details on the sculpted head (its frame: origin at the neck top, face towards +z)
function sculptedHeadDetails(b, open) {
  for (const s of [-1, 1]) {
    if (open)
      b.at(s * 0.041, 0.102, 0.0995, {ry: s * 0.25}, () => {
        E(b, 0x4a5568, 0, 0, 0, 0.0088, 0.0108, 0.0028);
        E(b, 0x22252c, 0, -0.0006, 0.0018, 0.0048, 0.006, 0.0016);
        E(b, 0xffffff, s * -0.0028, 0.0038, 0.0034, 0.0022, 0.0022, 0.0008);
      });
    b.geo(torus(0.025, 0.0022), C.frame, s * 0.041, 0.104, 0.117, {
      mat: {smooth: 1, metal: 0.6, rough: 0.35}
    });
    limb(b, C.frame, [s * 0.066, 0.106, 0.113], [s * 0.106, 0.11, 0.0], 0.0022, {mat: {metal: 0.6}});
  }
  limb(b, C.frame, [-0.016, 0.106, 0.117], [0.016, 0.106, 0.117], 0.002, {mat: {metal: 0.6}});
  // the blue ribbon around the half-up knot
  for (const s of [-1, 1]) E(b, C.ribbon, s * 0.036, 0.158, -0.158, 0.03, 0.018, 0.009, {rz: s * 0.4});
  E(b, C.ribbon, 0, 0.157, -0.161, 0.012, 0.012, 0.01);
  for (const s of [-1, 1])
    E(b, C.ribbon, s * 0.02, 0.11, -0.163, 0.007, 0.045, 0.0035, {rx: -0.15, rz: s * 0.3});
}
function sculpted(b, pose, parts) {
  const P = POSES[pose],
    g = name => b.geo(parts[name], 0xffffff, 0, 0, 0, SCULPT);
  g(P.legs === 'seated' ? 'lapSeated' : 'lowerStand');
  b.at(0, P.torso.y + (parts.manifest?.torsoHeightOffsets?.[pose] || 0), P.torso.z, {rx: P.torso.rx}, () => {
    g(`upper_${pose}`);
    g(`hands_${pose}`);
    props(b, pose, parts.manifest);
    b.at(...NECK, {rx: P.head.tilt, ry: P.head.turn}, () => {
      g(P.head.open ? 'headOpen' : 'head');
      g('hair');
      if (!parts.manifest?.includesHeadDetails) sculptedHeadDetails(b, P.head.open);
    });
  });
}
// Camera-authored pour contact. The shipped original retains its exact props.
export function teaPropSettings(manifest) {
  const painted = manifest?.teaPropStyle === 'camera-v7';
  return painted
    ? {position: [0.01, 0.285, 0.48], rz: 0.5, handleY: -0.05, spoutY: 0.015, alignedCup: true}
    : {position: [0.05, 0.29, 0.53], rz: -0.55, handleY: 0, spoutY: 0.05, alignedCup: false};
}
// Nozzle endpoint in the actor frame, including the authored standing torso transform.
export function teaSpoutLocal(manifest) {
  const p = teaPropSettings(manifest);
  return V(-0.11, p.spoutY, 0)
    .applyAxisAngle(V(0, 0, 1), p.rz)
    .add(V(...p.position))
    .applyAxisAngle(V(1, 0, 0), POSES.tea.torso.rx)
    .add(V(0, POSES.tea.torso.y + (manifest?.torsoHeightOffsets?.tea || 0), POSES.tea.torso.z));
}
// what she holds, in the torso frame
function props(b, pose, manifest = null) {
  const pour = teaPropSettings(manifest);
  if (pose === 'tea')
    b.at(...pour.position, {rz: pour.rz}, () => {
      E(b, C.pot, 0, 0, 0, 0.07, 0.06, 0.07, {mat: {smooth: 1, rough: 0.3}});
      E(b, C.pot, 0, 0.055, 0, 0.03, 0.012, 0.03, {mat: {smooth: 1, rough: 0.3}});
      limb(b, C.pot, [-0.06, 0.0, 0], [-0.11, pour.spoutY, 0], 0.012, {mat: {rough: 0.3}});
      b.geo(torus(0.035, 0.008, PI), C.pot, 0.07, pour.handleY, 0, {rz: -H, mat: SMOOTH});
      b.geo(torus(0.04, 0.004), C.ribbon, 0, 0.0, 0, {rx: H, mat: SMOOTH}); // a blue band
    });
  else if (pose === 'look')
    book(b, -0.02, manifest?.includesHeadDetails ? 0.175 : 0.115, 0.27, {rx: -0.12, ry: 0.15}); // resting on the sculpted lap
  else book(b, 0, 0.29, 0.36, {rx: -0.75}, pose === 'turn');
}

export function companionModel(b, {pose = 'read', parts = null} = {}) {
  if (parts) return sculpted(b, pose, parts);

  if (pose === 'tea') {
    // standing by the desk, pouring tea into the reader's cup in front of her (+z)
    for (const s of [-1, 1]) {
      limb(b, C.stock, [s * 0.06, 0.06, 0], [s * 0.065, 0.5, 0], 0.034);
      maryJane(b, s * 0.06, 0, 0.0);
    }
    b.geo(
      lathe('skirt', [
        [0.25, 0.22],
        [0.245, 0.26],
        [0.21, 0.55],
        [0.165, 0.85],
        [0.15, 0.95]
      ]),
      C.skirt,
      0,
      0,
      0,
      {sz: 0.8, mat: CLOTH}
    );
    b.at(0, 0.86, 0, {rx: 0.12}, () => {
      torso(b);
      // right hand holds the teapot out over the cup, left hand steadies its lid
      arm(b, [0.16, 0.44, 0], [0.21, 0.27, 0.2], [0.12, 0.26, 0.42], {palm: [-1, 0, 0], curl: 0.8});
      arm(b, [-0.16, 0.44, 0], [-0.18, 0.27, 0.19], [-0.03, 0.33, 0.43], {palm: [0, -1, 0], curl: 0.3});
      b.at(0.05, 0.29, 0.53, {rz: -0.55}, () => {
        E(b, C.pot, 0, 0, 0, 0.07, 0.06, 0.07, {mat: {smooth: 1, rough: 0.3}});
        E(b, C.pot, 0, 0.055, 0, 0.03, 0.012, 0.03, {mat: {smooth: 1, rough: 0.3}});
        limb(b, C.pot, [-0.06, 0.0, 0], [-0.11, 0.05, 0], 0.012, {mat: {rough: 0.3}});
        b.geo(torus(0.035, 0.008, PI), C.pot, 0.07, 0.0, 0, {rz: -H, mat: SMOOTH});
        b.geo(torus(0.04, 0.004), C.ribbon, 0, 0.0, 0, {rx: H, mat: SMOOTH}); // a blue band
      });
      b.at(0, 0.555, 0.008, () => head(b, {tilt: 0.38}));
    });
    return;
  }
  seatedLegs(b);
  b.at(0, HIP - 0.02, -0.02, {rx: pose === 'look' ? -0.05 : -0.12}, () => {
    torso(b);
    if (pose === 'look') {
      // book resting on her lap under the left hand, right hand on the armrest
      book(b, -0.02, 0.06, 0.26, {rx: -0.05, ry: 0.15});
      arm(b, [-0.16, 0.44, 0], [-0.19, 0.22, 0.08], [-0.1, 0.1, 0.24], {palm: [0, -1, 0], curl: 0.2});
      arm(b, [0.16, 0.44, 0], [0.24, 0.22, 0.02], [0.27, 0.07, 0.17], {palm: [0, -1, 0], curl: 0.4});
      b.at(0, 0.555, 0.01, () => head(b, {tilt: -0.08, turn: -0.32, open: true}));
      return;
    }
    // reading: both hands hold the open book up in front of her; 'turn' lifts a page
    book(b, 0, 0.29, 0.36, {rx: -0.75}, pose === 'turn');
    arm(b, [-0.16, 0.44, 0], [-0.2, 0.22, 0.12], [-0.12, 0.26, 0.29], {palm: [0.6, 0.3, 0.4], curl: 0.55});
    if (pose === 'turn')
      arm(b, [0.16, 0.44, 0], [0.2, 0.25, 0.14], [0.02, 0.36, 0.33], {palm: [-0.3, -0.6, 0.4], curl: 0.2});
    else arm(b, [0.16, 0.44, 0], [0.2, 0.22, 0.12], [0.12, 0.26, 0.29], {palm: [-0.6, 0.3, 0.4], curl: 0.55});
    b.at(0, 0.555, 0.01, () => head(b, {tilt: 0.42}));
  });
}

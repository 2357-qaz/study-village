// The reading room inside 旧梦书屋: a low-poly interior rendered once to a still image (no live
// GPU work during long focus sessions). The page animates light, the clock and the dream shell on
// top of it, using the projected positions this module returns.
import * as THREE from './vendor/three.module.min.js';
import {Builder, LiveSink, P, shade} from './models.js?v=5';
import {companionModel} from './companion.js?v=2';
import {loadSculpt} from './sculpt-loader.js?v=1';

const PI = Math.PI,
  H = PI / 2;
const C_STONE = 0xd8d4c9,
  C_STONE2 = 0xc8c3b6,
  C_WOOD = 0x8a6a4c,
  C_WOOD2 = 0x6f5440,
  C_DARK = 0x4a3a2e,
  C_SHELL = 0xe8e6f1;

const mats = new Map();
function mat(color, o = {}) {
  const m = o.mat || {},
    key = [
      color,
      o.glow ? 1 : 0,
      m.emissive,
      m.rough,
      m.metal,
      m.basic ? 1 : 0,
      m.smooth ? 1 : 0,
      m.double ? 1 : 0,
      m.vc ? 1 : 0
    ].join('|');
  let x = mats.get(key);
  if (!x) {
    x = m.basic
      ? new THREE.MeshBasicMaterial({color})
      : new THREE.MeshStandardMaterial({
          color,
          roughness: m.rough ?? 0.82,
          metalness: m.metal ?? 0,
          flatShading: !m.smooth,
          vertexColors: !!m.vc,
          side: m.double ? THREE.DoubleSide : THREE.FrontSide
        });
    if (m.emissive || o.glow) {
      x.emissive.set(o.glow ? 0xffc46b : color);
      x.emissiveIntensity = m.emissive || 0.9;
    }
    mats.set(key, x);
  }
  return x;
}

// The view through the window: sky for the time of day, the town's snowy roofs with lit windows
// (more of them as the town warms), a band of mist and, when it snows, flakes.
function outsideTexture({daypart, snow, warmth, cover}) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const g = c.getContext('2d'),
    sky = {
      day: ['#a9c4d6', '#e6ecea'],
      dawn: ['#9fb2cf', '#f2d6bd'],
      dusk: ['#8b8fbf', '#f1b98f'],
      night: ['#1c2541', '#3d4b72']
    }[daypart],
    grd = g.createLinearGradient(0, 0, 0, 320);
  grd.addColorStop(0, sky[0]);
  grd.addColorStop(0.8, sky[1]);
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 320);
  const night = daypart === 'night';
  if (night)
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(255,255,240,${0.3 + (i % 5) * 0.12})`;
      g.fillRect((i * 97) % 256, (i * 53) % 150, 1.5, 1.5);
    }
  // mist low over the sea
  g.fillStyle = night ? 'rgba(120,135,170,0.35)' : 'rgba(255,255,255,0.45)';
  g.fillRect(0, 196, 256, 30);
  // distant roofs: cold stone and slate, capped with snow, a few warm windows
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lit = 0.18 + warmth * 0.7;
  for (let row = 0; row < 2; row++)
    for (let x = -10; x < 260; ) {
      const w = 26 + rnd() * 26,
        h = 26 + rnd() * 30 + row * 14,
        base = 236 + row * 50,
        top = base - h;
      g.fillStyle = row ? (night ? '#4b556a' : '#c7c3ba') : night ? '#3b4558' : '#b7b4ad';
      g.fillRect(x, top, w - 3, h + 40);
      g.fillStyle = row ? (night ? '#36405a' : '#7d8a9c') : night ? '#2c3550' : '#6e7b8e';
      g.beginPath();
      g.moveTo(x - 4, top);
      g.lineTo(x + (w - 3) / 2, top - 16 - rnd() * 8);
      g.lineTo(x + w + 1, top);
      g.fill();
      if (cover > 0.05) {
        g.fillStyle = night ? 'rgba(220,228,245,0.85)' : 'rgba(250,252,255,0.95)';
        g.beginPath();
        g.moveTo(x - 4, top);
        g.lineTo(x + (w - 3) / 2, top - 16 - 0);
        g.lineTo(x + w + 1, top);
        g.lineTo(x + w - 4, top + 4 * cover);
        g.lineTo(x + 2, top + 4 * cover);
        g.fill();
      }
      for (let k = 0; k < 2; k++)
        if (rnd() < lit) {
          g.fillStyle = night ? '#ffcf7a' : '#e9c98a';
          g.fillRect(x + 6 + k * 12, top + 12 + row * 4, 6, 8);
        }
      x += w;
    }
  if (snow > 0)
    for (let i = 0; i < 90 * snow; i++) {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.arc(rnd() * 256, rnd() * 320, 0.8 + rnd() * 1.4, 0, PI * 2);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shell(b, x, y, z, s = 1, glow = 0.35) {
  b.at(x, y, z, {s}, () => {
    b.ball(0.13, C_SHELL, 0, 0.09, 0, {
      sx: 1.15,
      sy: 0.75,
      sz: 0.95,
      detail: 1,
      mat: {emissive: glow, rough: 0.4}
    });
    for (let i = 0; i < 4; i++)
      b.tor(0.11 - i * 0.022, 0.008, shade(C_SHELL, -0.06), 0, 0.12 + i * 0.012, 0, {rx: H, m: 14});
  });
}

// Builds the room. Returns the world positions the page needs to animate.
// Dreams read, as points of light along the bookshelf: every finished study session lights one, from
// eye level outwards; longer sessions glow a little larger and the newest brightest. Unread places
// keep only a faint cool glint. `dreams` holds the recent sessions' lengths in minutes, oldest first
// (only as many as there are places).
const LIGHT_SLOTS = 12; // ui/reading.js sends at most this many
function dreamLight(dreams, rank) {
  if (rank >= Math.min(dreams.length, LIGHT_SLOTS)) return null;
  const min = dreams[rank],
    newest = rank === dreams.length - 1;
  return newest ? 1.35 : min >= 45 ? 1.1 : min >= 25 ? 0.95 : 0.8;
}
// a soft round glow, drawn once and shared by every point of light
let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'),
    grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.22)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
function room(b, {snowTex, skyTop, dreams = []}) {
  // floor planks and rug
  for (let i = 0; i < 12; i++)
    b.box(0.5, 0.06, 6, i % 2 ? C_WOOD : shade(C_WOOD, -0.05), -3 + i * 0.5 + 0.25, -0.03, 0.4);
  b.box(2.3, 0.02, 1.5, 0x5a6a80, 0.1, 0.01, 0.75);
  b.box(2.0, 0.025, 1.2, 0x6c7d93, 0.1, 0.015, 0.75);
  // back and left walls of cold stone, with a few uneven blocks
  b.box(6, 3.6, 0.2, C_STONE, 0, 1.8, -2.3);
  b.box(0.2, 3.6, 6, shade(C_STONE, -0.04), -2.9, 1.8, 0.4);
  for (let i = 0; i < 22; i++) {
    const x = -2.6 + ((i * 1.37) % 5.2),
      y = 0.3 + ((i * 0.83) % 3.1);
    if (x > -1.6 && x < -0.2 && y > 0.8) continue; // keep the window clear
    b.box(0.42, 0.2, 0.04, i % 3 ? C_STONE2 : shade(C_STONE, 0.03), x, y, -2.19);
  }
  b.box(6, 0.24, 0.26, C_WOOD2, 0, 3.45, -2.2); // beam along the wall
  b.box(6, 0.12, 0.08, C_WOOD2, 0, 0.06, -2.17); // skirting
  // tall arched window: the town outside
  const wx = -0.9,
    wy = 1.85,
    ww = 1.05,
    wh = 1.6;
  b.box(ww, wh, 1, 0xffffff, wx, wy, -2.185, {tex: snowTex});
  b.cyl(ww / 2, ww / 2, 0.02, skyTop, wx, wy + wh / 2, -2.195, 18, {rx: H, mat: {basic: 1}});
  b.box(ww + 0.16, 0.1, 0.2, C_WOOD2, wx, wy - wh / 2 - 0.05, -2.12);
  for (const sx of [-1, 1]) b.box(0.08, wh, 0.12, C_WOOD2, wx + sx * (ww / 2 + 0.03), wy, -2.15);
  b.tor(ww / 2 + 0.03, 0.04, C_WOOD2, wx, wy + wh / 2, -2.15, {arc: PI, m: 16});
  b.box(0.04, wh + ww / 2, 0.06, C_WOOD2, wx, wy + ww / 4, -2.16);
  for (const f of [0.15, 0.55]) b.box(ww, 0.035, 0.06, C_WOOD2, wx, wy - wh / 2 + wh * f + 0.3, -2.16);
  // a little pot on the sill
  b.cyl(0.08, 0.06, 0.12, 0xa86c45, wx + 0.32, wy - wh / 2 + 0.06, -2.08, 8);
  b.ball(0.1, 0x6e9c5b, wx + 0.32, wy - wh / 2 + 0.18, -2.08, {detail: 1});
  // wall clock (hands are drawn by the page)
  const clock = new THREE.Vector3(0.36, 2.05, -2.17);
  b.cyl(0.24, 0.24, 0.05, C_DARK, clock.x, clock.y, clock.z, 24, {rx: H});
  b.cyl(0.2, 0.2, 0.03, 0xf4f0e4, clock.x, clock.y, clock.z + 0.03, 24, {rx: H});
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * PI * 2;
    b.box(
      0.014,
      k % 3 ? 0.025 : 0.045,
      0.01,
      C_DARK,
      clock.x + Math.sin(a) * 0.165,
      clock.y + Math.cos(a) * 0.165,
      clock.z + 0.05,
      {rz: -a}
    );
  }
  // tall bookshelf on the right; points of light hang in front of the books
  const slots = [];
  b.at(1.75, 0, -2.0, () => {
    b.box(1.5, 2.9, 0.42, C_WOOD2, 0, 1.45, 0);
    b.box(1.38, 2.75, 0.04, shade(C_WOOD2, -0.12), 0, 1.45, -0.17);
    const cs = [0x7a4a46, 0x4b6584, 0xb59a5a, 0x587a5c, 0x6f5d8c, 0x9a5a3e, 0x3f5a6e, 0xc9b184];
    // where each shelf has a point of light (2 + 2 + 3 + 3 + 2 = LIGHT_SLOTS)
    const spots = [
      [-0.55, 0.1],
      [-0.2, 0.3],
      [-0.62, -0.08, 0.3],
      [-0.45, 0.02, 0.32],
      [-0.6, 0]
    ];
    let n = 0;
    for (let r = 0; r < 5; r++) {
      const y = 0.18 + r * 0.56;
      b.box(1.38, 0.04, 0.38, C_WOOD, 0, y, 0.04);
      for (const x of spots[r]) slots.push({x: x + 0.11, y, r});
      let x = -0.64;
      while (x < 0.6) {
        n++;
        const w = 0.06 + ((n * 37) % 5) * 0.012,
          h = 0.3 + ((n * 53) % 7) * 0.03,
          lean = n % 9 === 0 ? 0.25 : 0;
        b.box(w, h, 0.26, cs[n % cs.length], x + w / 2, y + 0.02 + h / 2, 0.08, {rz: lean});
        x += w + 0.008 + lean * 0.12;
      }
    }
    // read ones fill from eye level (the middle shelf) outwards, right to left so tall phone views,
    // which only see the shelf's right end, see them too
    const order = [2, 3, 1, 4, 0];
    slots.sort((p, q) => order.indexOf(p.r) - order.indexOf(q.r) || q.x - p.x);
  });
  // placed in the world (the shelf stands at 1.75, -2.0), a little in front of the book spines
  const lights = slots.map((p, i) => ({
    at: new THREE.Vector3(1.75 + p.x, p.y + 0.2, -2.0 + 0.25),
    glow: dreamLight(dreams, i)
  }));
  // ladder leaning on the shelf
  b.at(2.25, 0, -1.55, {rx: -0.22}, () => {
    for (const s of [-1, 1]) b.box(0.05, 2.6, 0.05, C_WOOD, s * 0.2, 1.3, 0);
    for (let k = 0; k < 7; k++) b.box(0.4, 0.035, 0.04, C_WOOD, 0, 0.3 + k * 0.34, 0);
  });
  // the companion's corner (an empty armchair and side table for now)
  b.at(CHAIR.x, 0, CHAIR.z, {ry: CHAIR.ry}, () => {
    b.box(0.62, 0.32, 0.58, 0x6a5a7a, 0, 0.26, 0);
    b.box(0.62, 0.55, 0.14, 0x6a5a7a, 0, 0.6, -0.24);
    for (const s of [-1, 1]) b.box(0.12, 0.2, 0.58, shade(0x6a5a7a, -0.06), s * 0.3, 0.52, 0);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) b.box(0.05, 0.1, 0.05, C_DARK, sx * 0.26, 0.05, sz * 0.24);
  });
  b.at(CHAIR.x + 0.62, 0, CHAIR.z + 0.32, () => {
    b.cyl(0.2, 0.2, 0.04, C_WOOD, 0, 0.55, 0, 14);
    b.cyl(0.03, 0.05, 0.55, C_DARK, 0, 0.27, 0, 6);
    b.cyl(0.05, 0.04, 0.09, 0xf1eadb, 0.05, 0.62, 0.02, 10); // a cup of tea
  });
  // the desk, the lamp, an open book and the dream shell
  const desk = new THREE.Vector3(-0.15, 0.78, 0.55);
  b.at(desk.x, 0, desk.z, () => {
    b.box(1.7, 0.07, 0.85, C_WOOD, 0, 0.78, 0);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) b.box(0.07, 0.75, 0.07, C_WOOD2, sx * 0.76, 0.375, sz * 0.35);
    b.box(1.5, 0.12, 0.04, C_WOOD2, 0, 0.68, -0.37);
    // open book
    b.at(-0.15, 0.82, 0.12, {ry: 0.12}, () => {
      for (const s of [-1, 1]) b.box(0.26, 0.02, 0.34, 0xf3eddc, s * 0.135, 0.01, 0, {rz: s * -0.08});
      b.box(0.56, 0.015, 0.37, 0x7a4a46, 0, -0.005, 0);
    });
    // inkwell and quill
    b.cyl(0.05, 0.05, 0.07, 0x2e3440, 0.62, 0.85, 0.16, 8);
    b.box(0.012, 0.3, 0.012, 0xf4efe4, 0.64, 0.98, 0.15, {rz: -0.35});
    // the lamp
    b.at(-0.6, 0.82, -0.18, () => {
      b.cyl(0.1, 0.12, 0.03, C_DARK, 0, 0.015, 0, 12);
      b.box(0.025, 0.42, 0.025, C_DARK, 0, 0.22, 0);
      b.cyl(0.07, 0.17, 0.16, 0x7b8f6a, 0, 0.47, 0.03, 12, {open: 1, mat: {emissive: 0.25}});
      b.ball(0.05, 0xfff1c9, 0, 0.42, 0.03, {mat: {emissive: 1.4}});
    });
  });
  const shellAt = new THREE.Vector3(desk.x + 0.32, desk.y + 0.06, desk.z + 0.05);
  b.cyl(0.11, 0.13, 0.04, C_DARK, shellAt.x, shellAt.y - 0.02, shellAt.z, 12); // little stand
  shell(b, shellAt.x, shellAt.y, shellAt.z, 1.15, 0.5);
  // the reader's chair, seen from behind
  b.at(-0.05, 0, 1.55, () => {
    b.box(0.55, 0.06, 0.5, C_WOOD, 0, 0.48, 0);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) b.box(0.05, 0.48, 0.05, C_WOOD2, sx * 0.24, 0.24, sz * 0.22);
    for (const sx of [-1, 1]) b.box(0.05, 0.6, 0.05, C_WOOD2, sx * 0.24, 0.8, 0.23);
    b.box(0.52, 0.18, 0.04, C_WOOD, 0, 1.0, 0.23);
  });
  return {
    lights,
    shell: shellAt.clone().add(new THREE.Vector3(0, 0.12, 0)),
    clock,
    lamp: new THREE.Vector3(desk.x - 0.6, desk.y + 0.47, desk.z - 0.15),
    window: new THREE.Vector3(wx, wy, -2.19)
  };
}

// LiveSink with texture support for the window pane. Shared model geometry carries no UVs, so
// textured parts get their own plane and material, listed in `own` to be freed with the build.
class TexSink extends LiveSink {
  constructor(root, matFn, own) {
    super(root, matFn);
    this.own = own;
  }
  add(g, c, m, o) {
    if (!o.tex) return super.add(g, c, m, o);
    const geo = new THREE.PlaneGeometry(1, 1),
      mt = new THREE.MeshBasicMaterial({map: o.tex, toneMapped: false}),
      mesh = new THREE.Mesh(geo, mt);
    this.own.push(geo, mt);
    mesh.applyMatrix4(m);
    this.root.add(mesh);
  }
}

const SKY_TOP = {day: 0xa9c4d6, dawn: 0x9fb2cf, dusk: 0x8b8fbf, night: 0x1c2541};
function daypartOf(hour) {
  if (hour < 5.5 || hour >= 20.5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour >= 17.5) return 'dusk';
  return 'day';
}

// Where she sits (the armchair) and where she stands to pour tea (beside the desk, facing the cup).
const CHAIR = {x: 1.0, z: -0.85, ry: -0.5},
  TEA = {x: 1.02, z: 0.72, ry: -PI / 2},
  CUP = new THREE.Vector3(0.47, 0.815, 0.77);

let renderer = null,
  built = null;
// Rendered images (data URLs), least recently used first. One screen shape needs the room and up to
// four poses; a little headroom covers rotating the phone back and forth.
const CACHE_MAX = 7,
  cache = new Map();
function cached(key) {
  const v = cache.get(key);
  if (v !== undefined) {
    cache.delete(key);
    cache.set(key, v);
  }
  return v;
}
function remember(key, v) {
  cache.set(key, v);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

function sceneKey(opts, w, h) {
  return [
    w,
    h,
    daypartOf(opts.hour),
    opts.snow > 0 ? 1 : 0,
    Math.round(opts.warmth * 4),
    Math.round(opts.cover * 4),
    (opts.dreams || []).join(',')
  ].join('|');
}
// Frees what one build owns. Geometries from the shared builders and the companion's parts are
// cached for the whole page and are not touched.
function disposeActor(B) {
  if (!B?.actor) return;
  B.scene.remove(B.actor);
  for (const r of B.actor.userData.own || []) r.dispose();
  B.actor = null;
}
function disposeBuilt(B) {
  if (!B) return;
  disposeActor(B);
  B.snowTex.dispose();
  for (const r of B.own) r.dispose();
  B.scene.traverse(o => o.isLight && o.dispose?.()); // shadow maps
}
function setup(w, h) {
  // a lost context (GPU reset, memory pressure) cannot be drawn with again: start over
  if (renderer?.getContext().isContextLost()) {
    renderer.dispose();
    renderer = null;
    disposeBuilt(built);
    built = null;
  }
  renderer ??= new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true, alpha: true});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

// Builds (or reuses) the room scene, lights and camera for one screen shape and weather.
function build(opts) {
  const w = Math.max(200, Math.round(opts.width)),
    h = Math.max(200, Math.round(opts.height)),
    key = sceneKey(opts, w, h);
  if (built?.key === key) return built;
  disposeBuilt(built);
  built = null;
  const daypart = daypartOf(opts.hour),
    night = daypart === 'night',
    scene = new THREE.Scene(),
    snowTex = outsideTexture({daypart, snow: opts.snow, warmth: opts.warmth, cover: opts.cover}),
    grp = new THREE.Group(),
    own = [],
    pts = room(new Builder(new TexSink(grp, mat, own)), {
      snowTex,
      skyTop: SKY_TOP[daypart],
      dreams: opts.dreams || []
    });
  grp.traverse(o => {
    if (o.isMesh) {
      o.castShadow = !(o.material instanceof THREE.MeshBasicMaterial);
      o.receiveShadow = true;
    }
  });
  scene.add(grp);
  // ceiling seen only from inside (single-sided, facing down), so a high camera looks past it
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshStandardMaterial({color: shade(C_STONE, -0.12), roughness: 0.9})
  );
  own.push(ceil.geometry, ceil.material);
  ceil.rotation.x = PI / 2;
  ceil.position.set(0, 3.6, 0.4);
  grp.add(ceil);
  // the dreams read: warm points of light along the shelf (unread places only a faint cool glint)
  for (const {at, glow} of pts.lights) {
    const lit = glow !== null,
      m = new THREE.SpriteMaterial({
        map: glowTexture(),
        color: lit ? 0xffd28a : 0xc8d2ff,
        opacity: lit ? Math.min(1, 0.55 + glow * 0.35) : 0.16,
        transparent: true,
        depthWrite: false,
        toneMapped: false
      }),
      sprite = new THREE.Sprite(m);
    sprite.position.copy(at);
    sprite.scale.setScalar(lit ? 0.12 + glow * 0.08 : 0.06);
    own.push(m);
    grp.add(sprite);
  }
  const coolSky = {day: 0xcdd9e4, dawn: 0xd9d2d6, dusk: 0xd6c6c4, night: 0x56607a}[daypart];
  scene.add(new THREE.HemisphereLight(coolSky, 0x4d4038, night ? 1.1 : 1.35));
  scene.add(new THREE.AmbientLight(night ? 0x4a4560 : 0x8a8478, night ? 1.4 : 0.6));
  const win = new THREE.DirectionalLight(night ? 0x8fa2d0 : 0xe8eef5, night ? 0.6 : 2.2);
  win.position.set(-1.6, 4.5, -5);
  win.target.position.set(0.2, 0, 0.8);
  win.castShadow = true;
  win.shadow.mapSize.set(1024, 1024);
  Object.assign(win.shadow.camera, {left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 14});
  scene.add(win, win.target);
  const lamp = new THREE.PointLight(0xffc27a, night ? 7 : 3.2, 6, 1.6);
  lamp.position.copy(pts.lamp).add(new THREE.Vector3(0, -0.06, 0.05));
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(512, 512);
  scene.add(lamp);
  // a soft reading light over her armchair
  const nook = new THREE.PointLight(0xffd29a, night ? 2.2 : 0.8, 2.6, 1.6);
  nook.position.set(CHAIR.x - 0.25, 1.45, CHAIR.z + 0.55);
  scene.add(nook);
  // camera: from behind the reader's chair; pull back on narrow (portrait) screens
  const aspect = w / h,
    vfov = 44,
    cam = new THREE.PerspectiveCamera(vfov, aspect, 0.1, 40),
    look = new THREE.Vector3(pts.shell.x - 0.35, 1.32, pts.shell.z - 1.05),
    vhalf = ((vfov / 2) * PI) / 180,
    hhalf = Math.atan(Math.tan(vhalf) * aspect),
    dist = Math.max(1.75 / Math.tan(hhalf), 1.75 / Math.tan(vhalf));
  cam.position.copy(look).add(new THREE.Vector3(0.28, 0.5, 1).normalize().multiplyScalar(dist));
  cam.lookAt(look);
  cam.updateMatrixWorld();
  // shift the view so the dream shell sits centred, a little below the middle, on every screen shape
  const sp = pts.shell.clone().project(cam),
    ty = aspect > 1 ? 0.6 : aspect < 0.62 ? 0.25 : 0.38; // tall views keep the lower half for the time and controls
  cam.setViewOffset(w, h, ((sp.x + 1) / 2 - 0.5) * w, ((1 - sp.y) / 2 - ty) * h, w, h);
  built = {
    key,
    w,
    h,
    aspect,
    daypart,
    night,
    scene,
    grp,
    cam,
    pts,
    snowTex,
    own,
    occluding: false,
    actor: null
  };
  return built;
}

// opts: {width, height, hour, snow (0..1), warmth (0..1), cover (0..1)}
// Returns {url, daypart, points: {shell, clock, lamp, window: [x, y]} in 0..1 of the image, clockR}.
export function renderRoom(opts) {
  const w = Math.max(200, Math.round(opts.width)),
    h = Math.max(200, Math.round(opts.height)),
    hit = cached(sceneKey(opts, w, h));
  if (hit) return hit;
  setup(w, h);
  const B = build(opts);
  occlude(B, false);
  disposeActor(B);
  B.scene.background = new THREE.Color(B.night ? 0x1a1d22 : 0xcfd2cc);
  renderer.toneMappingExposure = B.night ? 0.95 : 1.05;
  renderer.render(B.scene, B.cam);
  const url = renderer.domElement.toDataURL('image/jpeg', 0.9),
    proj = v => {
      const p = v.clone().project(B.cam);
      return [(p.x + 1) / 2, (1 - p.y) / 2];
    },
    edge = proj(B.pts.clock.clone().add(new THREE.Vector3(0.2, 0, 0))),
    c = proj(B.pts.clock),
    result = {
      url,
      daypart: B.daypart,
      points: {shell: proj(B.pts.shell), clock: c, lamp: proj(B.pts.lamp), window: proj(B.pts.window)},
      clockR: Math.hypot(edge[0] - c[0], (edge[1] - c[1]) / B.aspect)
    };
  remember(B.key, result);
  return result;
}

const occluder = new THREE.MeshBasicMaterial({colorWrite: false});
// The companion's sculpted parts; resolves to null (simple shapes are used) if they can't load.
let sculpt = null;
export async function loadCompanion() {
  sculpt = await loadSculpt().catch(() => null);
  return !!sculpt;
}
function teaThings(b) {
  // the reader's cup and saucer on the desk, and a soft shadow at her feet
  b.at(CUP.x, CUP.y, CUP.z, () => {
    b.cyl(0.075, 0.07, 0.012, 0xeae4d6, 0, 0.006, 0, 20, {mat: {smooth: 1, rough: 0.35}});
    b.cyl(0.045, 0.035, 0.06, 0xeae4d6, 0, 0.042, 0, 20, {mat: {smooth: 1, rough: 0.35}});
    b.cyl(0.041, 0.041, 0.004, 0xb07a3c, 0, 0.066, 0, 20, {mat: {smooth: 1, rough: 0.2}});
  });
}
// A transparent layer with her in the given pose, drawn over renderRoom's image for the same opts.
// The room is still in the scene but only writes depth, so the armchair and desk hide her properly.
// The room only writes depth while her layers are drawn; its own materials come back for the room image.
function occlude(B, on) {
  if (B.occluding === on) return;
  B.grp.traverse(o => {
    if (o.isSprite) o.visible = !on; // the lights belong to the room image, not her layer
    if (!o.isMesh) return;
    if (on) {
      o.userData.mat = o.material;
      o.material = occluder;
    } else o.material = o.userData.mat;
  });
  B.occluding = on;
}
export function renderCompanion(opts, pose) {
  const w = Math.max(200, Math.round(opts.width)),
    h = Math.max(200, Math.round(opts.height)),
    key = `${sceneKey(opts, w, h)}|${pose}|${sculpt ? 's' : 'p'}`,
    hit = cached(key);
  if (hit) return hit;
  setup(w, h);
  const B = build(opts);
  occlude(B, true);
  disposeActor(B);
  const actor = new THREE.Group(),
    b = new Builder(new LiveSink(actor, mat)),
    at = pose === 'tea' ? TEA : CHAIR;
  b.at(at.x, 0, at.z, {ry: at.ry}, () => companionModel(b, {pose, parts: sculpt}));
  if (pose === 'tea') teaThings(b);
  actor.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  if (pose === 'tea') {
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 32).rotateX(-H),
      new THREE.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false})
    );
    blob.position.set(TEA.x, 0.012, TEA.z);
    actor.add(blob);
    actor.userData.own = [blob.geometry, blob.material];
  }
  B.scene.add(actor);
  B.actor = actor;
  B.scene.background = null;
  renderer.setClearColor(0x000000, 0);
  renderer.render(B.scene, B.cam);
  const result = {url: renderer.domElement.toDataURL('image/png')};
  remember(key, result);
  return result;
}
// for tests: how many images are kept and what the renderer holds on the GPU
export const debug = () => ({cache: cache.size, memory: renderer && {...renderer.info.memory}});

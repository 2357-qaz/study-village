import * as THREE from './vendor/three.module.min.js';
import * as C from './core.js?v=8';
import {
  Builder,
  LiveSink,
  BakeSink,
  Acc,
  buildingModel,
  decorModel,
  villagerModel,
  beastModel,
  shade
} from './models.js?v=5';
import {audioContext, loadPrefs} from './alerts.js?v=6';
const PI = Math.PI,
  H = PI / 2,
  N = C.GRID,
  HALF = N / 2,
  SEABED = -0.7;
const TOP = h => 0.18 + h * 0.42,
  BED = h => TOP(h) - 0.28;
const TOPC = {g: 0x95b96f, s: 0xe6d5a2, f: 0xa0bf72, r: 0xb4ab98, p: 0xd6c49a, w: 0x86ad9c};
const hash = (x, z, k = 0) => {
  let n = (x * 374761393 + z * 668265263 + k * 2147483647) | 0;
  n = ((n ^ (n >>> 13)) * 1274126177) | 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const strHash = s => {
  let n = 7;
  for (const ch of String(s)) n = (n * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(n);
};
// Real-time lighting keyframes (local hour): night → dawn → day → dusk → evening → night.
const SKY = {
  night: {
    top: 0x1d2847,
    bottom: 0x40507a,
    hs: 0x9fb3e8,
    hg: 0x2c3445,
    hi: 1.4,
    sun: 0xb8ccff,
    si: 1.1,
    el: 0.9,
    glow: 1,
    tag: '夜 · 雾里只剩书屋的灯'
  },
  dawn: {
    top: 0x9fb7d9,
    bottom: 0xf7cba4,
    hs: 0xffe4cc,
    hg: 0x6d7f5e,
    hi: 1.7,
    sun: 0xffc29c,
    si: 2.2,
    el: 0.38,
    glow: 0.45,
    tag: '清晨 · 雾正慢慢散开'
  },
  day: {
    top: 0xa7d5ea,
    bottom: 0xf2f3df,
    hs: 0xfff6d8,
    hg: 0x718e64,
    hi: 2.05,
    sun: 0xffeccc,
    si: 2.9,
    el: 1,
    glow: 0,
    tag: '晴 · 适合读梦的一天'
  },
  dusk: {
    top: 0x8c90c9,
    bottom: 0xf4b48c,
    hs: 0xffd9a6,
    hg: 0x6a6f5e,
    hi: 1.7,
    sun: 0xffb258,
    si: 2.5,
    el: 0.22,
    glow: 0.45,
    tag: '黄昏 · 钟声快要停了'
  },
  evening: {
    top: 0x39426f,
    bottom: 0xb27c88,
    hs: 0xc4b4dc,
    hg: 0x3a3e4e,
    hi: 1.45,
    sun: 0xe0a6a0,
    si: 1.4,
    el: 0.25,
    glow: 0.85,
    tag: '入夜 · 把今天的梦收好'
  }
};
const KEYS = [
  [0, 'night'],
  [5, 'night'],
  [6.5, 'dawn'],
  [8.5, 'day'],
  [16.5, 'day'],
  [18.3, 'dusk'],
  [19.6, 'evening'],
  [21.3, 'night'],
  [24, 'night']
];
function skyAt(hour) {
  for (let i = 1; i < KEYS.length; i++)
    if (hour <= KEYS[i][0]) {
      const [h0, a] = KEYS[i - 1],
        [h1, b] = KEYS[i],
        t = (hour - h0) / (h1 - h0 || 1),
        A = SKY[a],
        B = SKY[b],
        o = {};
      for (const k of Object.keys(A)) {
        if (k === 'tag') o.tag = t < 0.5 ? A.tag : B.tag;
        else if (['hi', 'si', 'el', 'glow'].includes(k)) o[k] = A[k] + (B[k] - A[k]) * t;
        else o[k] = new THREE.Color(A[k]).lerp(new THREE.Color(B[k]), t);
      }
      return o;
    }
  return skyAt(12);
}

export function createVillage(container, onSelect) {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 140),
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '3D 村庄：拖动旋转，滚轮或双指缩放，点击建筑查看');
  renderer.domElement.setAttribute('role', 'img');
  const hemi = new THREE.HemisphereLight(0xfff6d8, 0x718e64, 2.8),
    sun = new THREE.DirectionalLight(0xffe8bf, 3.9);
  scene.add(hemi, sun, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.02;
  scene.fog = new THREE.Fog(0xf2f3df, 60, 120);
  // ---------- materials ----------
  const solidMat = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.88, flatShading: true});
  // Winter shader, shared by terrain, sea and the baked buildings/trees:
  // uCold desaturates towards a misty blue-grey (terrain and sea only, while the town is young);
  // uSnow lays patchy snow on upward faces (terrain, roofs, tree tops), melting as the town warms.
  const coldU = {value: 0},
    snowU = {value: 0},
    noneU = {value: 0},
    winterShader = (cold, snow) => sh => {
      sh.uniforms.uCold = cold;
      sh.uniforms.uSnow = snow;
      sh.vertexShader =
        'varying vec3 vWN;\nvarying vec3 vWP;\n' +
        sh.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n  vWN = normalize(mat3(modelMatrix) * objectNormal);\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;'
        );
      sh.fragmentShader =
        'uniform float uCold;\nuniform float uSnow;\nvarying vec3 vWN;\nvarying vec3 vWP;\n' +
        'float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
        'float wNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);' +
        ' return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y); }\n' +
        sh.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))) * vec3(0.92, 0.98, 1.07), uCold);
  float wN = wNoise(vWP.xz * 1.3) * 0.65 + wNoise(vWP.xz * 4.1) * 0.35;
  float wCover = smoothstep(1.0 - uSnow - 0.12, 1.0 - uSnow + 0.12, wN) * smoothstep(0.5, 0.85, vWN.y) * step(0.001, uSnow);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), wCover);`
        );
    },
    terrainMat = solidMat.clone();
  terrainMat.onBeforeCompile = winterShader(coldU, snowU);
  solidMat.onBeforeCompile = winterShader(noneU, snowU);
  const glowMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.5,
    flatShading: true,
    emissive: 0xffc46b,
    emissiveIntensity: 0.1
  });
  const pondMat = new THREE.MeshStandardMaterial({
    color: 0x8fd0c8,
    roughness: 0.2,
    transparent: true,
    opacity: 0.78,
    flatShading: true,
    depthWrite: false
  });
  const seaMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.28,
    metalness: 0.05,
    transparent: true,
    opacity: 0.86,
    flatShading: true
  });
  seaMat.onBeforeCompile = winterShader(coldU, noneU);
  const live = new Map(),
    liveGlow = new Set();
  let glowLevel = 0;
  let dreamH = null,
    dreamM = 0; // 旧梦书屋's clock: frozen unless someone is reading (a study timer is running)
  function liveMat(color, o = {}) {
    const m = o.mat || {},
      key = [color, o.glow ? 1 : 0, m.metal, m.rough, m.emissive, m.opacity, m.smooth].join('|');
    let mat = live.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color,
        roughness: m.rough ?? 0.85,
        metalness: m.metal ?? 0,
        flatShading: !m.smooth,
        transparent: (m.opacity ?? 1) < 1,
        opacity: m.opacity ?? 1,
        depthWrite: (m.opacity ?? 1) >= 1
      });
      if (m.emissive) {
        mat.emissive.set(color);
        mat.emissiveIntensity = m.emissive;
      }
      if (o.glow) {
        mat.emissive.set(0xffc46b);
        mat.userData.glow = 1;
        mat.emissiveIntensity = 0.2 + glowLevel;
        liveGlow.add(mat);
      }
      live.set(key, mat);
    }
    return mat;
  }
  const ghostMats = new Map();
  function ghostMat(valid) {
    return (color, o = {}) => {
      const key = color + '|' + valid;
      let mat = ghostMats.get(key);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: 0.62,
          depthWrite: false,
          flatShading: true,
          emissive: valid ? 0x2f7a3a : 0x9a2a20,
          emissiveIntensity: 0.35
        });
        ghostMats.set(key, mat);
      }
      return mat;
    };
  }
  // ---------- diorama: sea floor, ocean, base ----------
  const world = new THREE.Group();
  scene.add(world);
  const base = new THREE.Group();
  world.add(base);
  const sea = new THREE.Mesh(new THREE.BufferGeometry(), seaMat);
  sea.receiveShadow = true;
  world.add(sea);
  let oceanR = 0,
    seaBaseY = null;
  function buildBase(R) {
    while (base.children.length) {
      const c = base.children.pop();
      c.geometry.dispose();
    }
    const mk = (geo, color, y) => {
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({color, roughness: 0.95, flatShading: true})
      );
      m.position.y = y;
      m.receiveShadow = true;
      base.add(m);
      return m;
    };
    mk(new THREE.CircleGeometry(R, 48).rotateX(-H), 0xcdbf92, SEABED);
    const rim = mk(new THREE.CylinderGeometry(R, R, 0.75, 48, 1, true), 0x5c9ebd, (SEABED + 0.05) / 2);
    rim.material.transparent = true;
    rim.material.opacity = 0.9;
    mk(new THREE.CylinderGeometry(R, R * 0.97, 0.55, 48), 0x9c7b55, SEABED - 0.27);
    mk(new THREE.CylinderGeometry(R * 0.97, R * 0.88, 0.8, 40), 0x7f6449, SEABED - 0.95);
    mk(new THREE.CylinderGeometry(R * 0.88, R * 0.45, 1.8, 32), 0x655244, SEABED - 2.25);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4,
        r = R * (0.35 + (i % 4) * 0.12);
      const rock = mk(
        new THREE.ConeGeometry(0.6 + (i % 3) * 0.35, 1.4 + (i % 4) * 0.5, 6).rotateX(PI),
        i % 2 ? 0x5d4c40 : 0x6c5848,
        SEABED - 3.1 - (i % 3) * 0.3
      );
      rock.position.x = Math.cos(a) * r;
      rock.position.z = Math.sin(a) * r;
    }
    // sea surface: polar grid
    const rings = Math.ceil(R / 0.55),
      segs = 96,
      pos = [],
      idx = [];
    pos.push(0, 0, 0);
    for (let r = 1; r <= rings; r++) {
      const rr = (r / rings) * R;
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * PI * 2;
        pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr);
      }
    }
    for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
    for (let r = 1; r < rings; r++)
      for (let s = 0; s < segs; s++) {
        const a = 1 + (r - 1) * segs + s,
          b = 1 + (r - 1) * segs + ((s + 1) % segs),
          c = 1 + r * segs + s,
          d = 1 + r * segs + ((s + 1) % segs);
        idx.push(a, b, d, a, d, c);
      }
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g = g.toNonIndexed();
    g.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3)
    );
    sea.geometry.dispose();
    sea.geometry = g;
    seaBaseY = null;
  }
  function colorSea(island) {
    const shore = [];
    for (let z = 0; z < N; z++)
      for (let x = 0; x < N; x++) {
        if (island.terrain[z * N + x] === '.') continue;
        shore.push([x - HALF + 0.5, z - HALF + 0.5]);
      }
    const pos = sea.geometry.attributes.position,
      col = sea.geometry.attributes.color,
      deep = new THREE.Color(0x3f86ab),
      mid = new THREE.Color(0x63b3c4),
      shallow = new THREE.Color(0x8fd8c9),
      foam = new THREE.Color(0xe4f6ee),
      c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      let d = 99;
      for (const [sx, sz] of shore) {
        const dx = Math.max(Math.abs(x - sx) - 0.5, 0),
          dz = Math.max(Math.abs(z - sz) - 0.5, 0),
          v = dx * dx + dz * dz;
        if (v < d) d = v;
      }
      d = Math.sqrt(d);
      if (d < 0.3) c.copy(foam).lerp(shallow, d / 0.3);
      else if (d < 2.2) c.copy(shallow).lerp(mid, (d - 0.3) / 1.9);
      else c.copy(mid).lerp(deep, Math.min(1, (d - 2.2) / 4));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }
  // ---------- baked layers ----------
  const terrainMesh = new THREE.Mesh(new THREE.BufferGeometry(), terrainMat),
    objMesh = new THREE.Mesh(new THREE.BufferGeometry(), solidMat),
    glowMesh = new THREE.Mesh(new THREE.BufferGeometry(), glowMat),
    pondMesh = new THREE.Mesh(new THREE.BufferGeometry(), pondMat);
  for (const m of [terrainMesh, objMesh, glowMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    world.add(m);
  }
  pondMesh.receiveShadow = true;
  world.add(pondMesh);
  const dynRoot = new THREE.Group(),
    villagersGroup = new THREE.Group(),
    clouds = new THREE.Group(),
    overlay = new THREE.Group();
  world.add(dynRoot, villagersGroup, clouds, overlay);
  let owners = [null],
    anims = [],
    villagers = [],
    walk = new Set(),
    state = null,
    lastSig = '',
    lastIsland = '';
  const ownerOf = key => {
    const i = owners.indexOf(key);
    if (i >= 0) return i;
    owners.push(key);
    return owners.length - 1;
  };
  function disposeGroup(g) {
    while (g.children.length) g.remove(g.children[g.children.length - 1]);
  }
  function tile(s, x, z) {
    return C.tileAt(s, x, z);
  }
  function topOf(t, h) {
    return t === 'w' ? BED(h) : TOP(h);
  }
  function buildTerrain(s, occ) {
    const acc = new Acc(),
      pond = new Acc(),
      b = new Builder({
        add: (g, c, m) => acc.push(g, c, m, 0),
        dynamic: () => new THREE.Group(),
        matFn: liveMat
      });
    const T = s.island.terrain,
      Hs = s.island.height;
    for (let z = 0; z < N; z++)
      for (let x = 0; x < N; x++) {
        const i = z * N + x,
          t = T[i];
        if (t === '.') continue;
        const h = +Hs[i],
          y = topOf(t, h),
          x0 = x - HALF,
          x1 = x0 + 1,
          z0 = z - HALF,
          z1 = z0 + 1,
          top = shade(TOPC[t], (hash(x, z) - 0.5) * 0.05);
        acc.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], top, 0, [0, 1, 0]);
        if (t === 'w') {
          const wy = TOP(h) - 0.08;
          pond.quad([x0, wy, z0], [x1, wy, z0], [x1, wy, z1], [x0, wy, z1], 0, 0, [0, 1, 0]);
        }
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ]) {
          const n = tile(s, x + dx, z + dz),
            ny = !n || n.t === '.' ? SEABED : topOf(n.t, n.h);
          if (ny >= y - 1e-3) continue;
          const ex =
            dx === 1
              ? [x1, z0, x1, z1]
              : dx === -1
                ? [x0, z1, x0, z0]
                : dz === 1
                  ? [x1, z1, x0, z1]
                  : [x0, z0, x1, z0];
          const wall = (ya, yb, c) =>
            acc.quad([ex[0], yb, ex[1]], [ex[2], yb, ex[3]], [ex[2], ya, ex[3]], [ex[0], ya, ex[1]], c, 0, [
              dx,
              0,
              dz
            ]);
          const lip = Math.max(ny, y - (t === 'w' ? 0.05 : 0.09));
          wall(lip, y, shade(top, -0.07));
          let cur = lip,
            band = 0;
          const earth = t === 's' ? [0xd8c28c, 0xcbb47e] : [0xa38058, 0x8f704d];
          while (cur > ny + 1e-4) {
            const nxt = Math.max(ny, Math.floor((cur - 0.001 - 0.18) / 0.42) * 0.42 + 0.18 - 0.0);
            const lo = nxt >= cur ? ny : nxt;
            wall(
              lo,
              cur,
              lo < 0 ? shade(earth[band % 2], -0.12) : shade(earth[band % 2], (hash(x, z, band) - 0.5) * 0.03)
            );
            cur = lo;
            band++;
          }
        }
        if (occ.has(i)) continue;
        const r = k => hash(x, z, k),
          cx = x0 + 0.5,
          cz = z0 + 0.5;
        if (t === 'g') {
          const n = Math.floor(r(1) * 4);
          for (let k = 0; k < n; k++)
            b.cone(
              0.045,
              0.13 + r(k + 9) * 0.06,
              r(k + 4) > 0.5 ? 0x86ad62 : 0x76a056,
              cx - 0.38 + r(k + 2) * 0.76,
              y + 0.06,
              cz - 0.38 + r(k + 3) * 0.76,
              4
            );
          if (r(7) > 0.82)
            b.ball(
              0.035,
              r(8) > 0.5 ? 0xf6efe0 : 0xf3d36e,
              cx - 0.3 + r(5) * 0.6,
              y + 0.04,
              cz - 0.3 + r(6) * 0.6
            );
        } else if (t === 'f') {
          const cs = [0xf2a7b8, 0xf5d76e, 0xf7f2e2, 0xc3a6e0, 0xef9a6a];
          for (let k = 0; k < 7; k++) {
            const fx = cx - 0.4 + r(k + 2) * 0.8,
              fz = cz - 0.4 + r(k + 12) * 0.8;
            b.cyl(0.008, 0.008, 0.12, 0x6f9a55, fx, y + 0.06, fz, 3);
            b.ball(0.04, cs[Math.floor(r(k + 20) * 5)], fx, y + 0.13, fz);
          }
          b.cone(0.05, 0.1, 0x76a056, cx, y + 0.05, cz, 4);
        } else if (t === 'r') {
          for (let k = 0; k < 3; k++)
            b.ball(
              0.06 + r(k) * 0.07,
              shade(0xa2a094, (r(k + 5) - 0.5) * 0.1),
              cx - 0.3 + r(k + 1) * 0.6,
              y + 0.03,
              cz - 0.3 + r(k + 2) * 0.6,
              {sy: 0.6}
            );
        } else if (t === 'p') {
          for (let k = 0; k < 4; k++) {
            const px = cx - 0.22 + (k % 2) * 0.44,
              pz = cz - 0.22 + (k >> 1) * 0.44;
            b.box(
              0.36 + r(k) * 0.04,
              0.035,
              0.36 + r(k + 4) * 0.04,
              shade(0xe7dcbc, (r(k + 8) - 0.5) * 0.08),
              px,
              y + 0.015,
              pz,
              {ry: (r(k + 3) - 0.5) * 0.2}
            );
          }
        } else if (t === 's') {
          if (r(3) > 0.8)
            b.ball(
              0.04,
              r(4) > 0.5 ? 0xf4d6c6 : 0xe8e2d2,
              cx - 0.3 + r(5) * 0.6,
              y + 0.02,
              cz - 0.3 + r(6) * 0.6,
              {sy: 0.5}
            );
        } else if (t === 'w') {
          const wy = TOP(h) - 0.07;
          if (r(2) > 0.55)
            b.cyl(0.11, 0.11, 0.012, 0x6e9d5f, cx - 0.25 + r(3) * 0.5, wy, cz - 0.25 + r(4) * 0.5, 8);
          if (r(5) > 0.7) b.ball(0.03, 0xf6c3d0, cx - 0.2 + r(6) * 0.4, wy + 0.03, cz - 0.2 + r(7) * 0.4);
        }
      }
    const tg = acc.build(),
      pg = pond.build();
    terrainMesh.geometry.dispose();
    terrainMesh.geometry = tg;
    pondMesh.geometry.dispose();
    pondMesh.geometry = pg;
  }
  function objectWorld(s, kind, x, z, size) {
    const t = tile(s, x, z);
    const y = kind === 'sea' ? 0.02 : t ? TOP(t.h) : 0;
    return [x - HALF + size / 2, y, z - HALF + size / 2];
  }
  function buildObjects(s) {
    const bake = new BakeSink(liveMat),
      b = new Builder(bake);
    owners = [null];
    for (const def of C.BUILDINGS) {
      const lv = s.buildings[def.id],
        L = s.layout?.[def.id];
      if (!lv || !L) continue;
      const size = C.buildingSize(def.id),
        [wx, wy, wz] = objectWorld(s, 'land', L.x, L.z, size);
      bake.owner = ownerOf('b:' + def.id);
      b.at(wx, wy, wz, {ry: -L.r * H}, () => buildingModel(b, def.id, lv));
    }
    for (const d of s.decor || []) {
      const def = C.DECOR.find(x => x.id === d.type);
      if (!def) continue;
      const [wx, wy, wz] = objectWorld(s, def.place, d.x, d.z, 1);
      bake.owner = ownerOf('d:' + d.id);
      b.at(wx, wy, wz, {ry: -d.r * H}, () => decorModel(b, d.type, strHash(d.id) % 7, d.item));
    }
    objMesh.geometry.dispose();
    objMesh.geometry = bake.solid.build();
    glowMesh.geometry.dispose();
    glowMesh.geometry = bake.glow.build();
    disposeGroup(dynRoot);
    for (const g of bake.dyn) dynRoot.add(g);
    anims = [];
    dynRoot.traverse(o => {
      if (o.userData.anim) anims.push({o, a: o.userData.anim, ph: (strHash(o.uuid) % 100) / 16});
    });
  }
  // ---------- villagers ----------
  function buildVillagers(s, occ) {
    walk = new Set();
    for (let z = 0; z < N; z++)
      for (let x = 0; x < N; x++) {
        const t = s.island.terrain[z * N + x];
        if (t !== '.' && t !== 'w' && !occ.has(z * N + x)) walk.add(z * N + x);
      }
    const want = Math.min(16, Math.max(3, C.population(s)));
    while (villagers.length > want) {
      const v = villagers.pop();
      villagersGroup.remove(v.g);
    }
    const list = [...walk],
      paths = list.filter(i => s.island.terrain[i] === 'p');
    for (const v of villagers)
      if (!walk.has(v.cur) || !walk.has(v.next)) {
        v.cur = v.next = (paths.length ? paths : list)[v.i % ((paths.length ? paths : list).length || 1)];
        v.p = 1;
      }
    while (villagers.length < want && list.length) {
      const i = villagers.length,
        g = new THREE.Group(),
        legs = villagerModel(new Builder(new LiveSink(g, liveMat)), i);
      g.scale.setScalar(1.05);
      villagersGroup.add(g);
      const pool = paths.length ? paths : list,
        start = pool[Math.floor(hash(i, 3) * pool.length)];
      villagers.push({g, legs, i, cur: start, next: start, prev: -1, p: 1, wait: hash(i, 9) * 2});
    }
  }
  function stepVillager(v, dt) {
    if (v.wait > 0) {
      v.wait -= dt;
      v.legs.forEach(l => (l.rotation.x = 0));
      return;
    }
    v.p += dt * (state.island.terrain[v.next] === 'p' ? 0.75 : 0.55);
    if (v.p >= 1) {
      v.prev = v.cur;
      v.cur = v.next;
      v.p = 0;
      const x = v.cur % N,
        z = Math.floor(v.cur / N),
        h = +state.island.height[v.cur],
        opts = [];
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        const nx = x + dx,
          nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
        const j = nz * N + nx;
        if (!walk.has(j) || Math.abs(+state.island.height[j] - h) > 1) continue;
        const w = (state.island.terrain[j] === 'p' ? 4 : 1) * (j === v.prev ? 0.15 : 1);
        opts.push([j, w]);
      }
      if (!opts.length) {
        v.next = v.cur;
        v.wait = 1;
        return;
      }
      let r = Math.random() * opts.reduce((a, o) => a + o[1], 0);
      v.next = opts.find(o => (r -= o[1]) <= 0)?.[0] ?? opts[0][0];
      if (Math.random() < 0.08) v.wait = 1 + Math.random() * 2.5;
    }
    const ax = v.cur % N,
      az = Math.floor(v.cur / N),
      bx = v.next % N,
      bz = Math.floor(v.next / N),
      ha = TOP(+state.island.height[v.cur]),
      hb = TOP(+state.island.height[v.next]),
      p = v.p,
      e = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
    v.g.position.set(ax + (bx - ax) * p - HALF + 0.5, ha + (hb - ha) * e, az + (bz - az) * p - HALF + 0.5);
    if (bx !== ax || bz !== az) v.g.rotation.y = Math.atan2(bx - ax, bz - az);
  }
  // ---------- clouds ----------
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(),
      mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1,
        flatShading: true,
        transparent: true,
        opacity: 0.92
      });
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + hash(i, k) * 0.5, 0), mat);
      m.position.set(k * 0.65 - 1, hash(k, i) * 0.3, (hash(i, k, 3) - 0.5) * 0.6);
      m.scale.y = 0.65;
      g.add(m);
    }
    g.userData = {
      a: (i / 6) * PI * 2,
      r: 2.5 + hash(i, 1) * 4,
      y: 4.2 + hash(i, 2) * 1.6,
      s: 0.012 + hash(i, 4) * 0.01
    };
    g.scale.setScalar(0.7);
    clouds.add(g);
  }
  // ---------- overlays: grid, ghost, selection, hover ----------
  const gridLines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false})
  );
  gridLines.visible = false;
  overlay.add(gridLines);
  const ghost = new THREE.Group(),
    sel = new THREE.Group(),
    hover = new THREE.Group();
  overlay.add(ghost, sel, hover);
  function buildGrid(s) {
    const p = [];
    for (let z = 0; z < N; z++)
      for (let x = 0; x < N; x++) {
        const t = tile(s, x, z),
          wx = x - HALF,
          wz = z - HALF;
        if (Math.hypot(wx + 0.5, wz + 0.5) > oceanR - 0.8 && t.t === '.') continue;
        const y = t.t === '.' ? 0.08 : topOf(t.t, t.h) + 0.015;
        p.push(wx, y, wz, wx + 1, y, wz, wx, y, wz, wx, y, wz + 1);
      }
    gridLines.geometry.dispose();
    gridLines.geometry = new THREE.BufferGeometry();
    gridLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  }
  const padMat = {
    ok: new THREE.MeshBasicMaterial({color: 0x8fe388, transparent: true, opacity: 0.55, depthWrite: false}),
    bad: new THREE.MeshBasicMaterial({color: 0xf08a7a, transparent: true, opacity: 0.6, depthWrite: false}),
    sel: new THREE.MeshBasicMaterial({color: 0xe7ff9a, transparent: true, opacity: 0.9, depthWrite: false}),
    hov: new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false})
  };
  const padGeo = new THREE.BoxGeometry(0.92, 0.04, 0.92);
  function pad(group, x, z, mat) {
    const t = tile(state, x, z);
    if (!t) return;
    const m = new THREE.Mesh(padGeo, mat);
    m.position.set(x - HALF + 0.5, (t.t === '.' ? 0.06 : topOf(t.t, t.h)) + 0.03, z - HALF + 0.5);
    group.add(m);
  }
  function frameMesh(group, x, z, size, mat) {
    let top = 0;
    for (let dz = 0; dz < size; dz++)
      for (let dx = 0; dx < size; dx++) {
        const t = tile(state, x + dx, z + dz);
        if (t) top = Math.max(top, t.t === '.' ? 0.06 : TOP(t.h));
      }
    const cx = x - HALF + size / 2,
      cz = z - HALF + size / 2,
      w = size + 0.08;
    for (const [ox, oz, sx, sz] of [
      [0, -w / 2, w, 0.07],
      [0, w / 2, w, 0.07],
      [-w / 2, 0, 0.07, w],
      [w / 2, 0, 0.07, w]
    ]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.06, sz), mat);
      m.position.set(cx + ox, top + 0.05, cz + oz);
      group.add(m);
    }
  }
  let tool = null,
    ghostSpec = null,
    selection = null,
    buildMode = false;
  function objInfo(key) {
    if (!state || !key) return null;
    if (key.startsWith('b:')) {
      const id = key.slice(2),
        L = state.layout?.[id];
      return L
        ? {kind: 'building', id, x: L.x, z: L.z, r: L.r, size: C.buildingSize(id), level: state.buildings[id]}
        : null;
    }
    const d = (state.decor || []).find(d => 'd:' + d.id === key);
    return d ? {kind: 'decor', type: d.type, x: d.x, z: d.z, r: d.r, size: 1, item: d.item, uid: d.id} : null;
  }
  function renderGhost() {
    disposeGroup(ghost);
    if (!ghostSpec || !tool || !state) return;
    const {x, z, valid} = ghostSpec;
    let size = 1,
      draw = null,
      place = 'land',
      r = tool.r || 0;
    if (tool.kind === 'building') {
      size = C.buildingSize(tool.id);
      draw = b => buildingModel(b, tool.id, 1);
    } else if (tool.kind === 'decor') {
      const def = C.DECOR.find(d => d.id === tool.type);
      place = def?.place || 'land';
      draw = b => decorModel(b, tool.type, 0, tool.item);
    } else if (tool.kind === 'move') {
      const o = objInfo(tool.key);
      if (!o) return;
      size = o.size;
      if (o.kind === 'building') draw = b => buildingModel(b, o.id, o.level);
      else {
        place = C.DECOR.find(d => d.id === o.type)?.place || 'land';
        draw = b => decorModel(b, o.type, strHash(o.uid) % 7, o.item);
      }
    }
    for (let dz = 0; dz < size; dz++)
      for (let dx = 0; dx < size; dx++) pad(ghost, x + dx, z + dz, valid ? padMat.ok : padMat.bad);
    if (draw) {
      const g = new THREE.Group(),
        [wx, wy, wz] = objectWorld(state, place, x, z, size);
      g.position.set(wx, wy + 0.02, wz);
      g.rotation.y = -r * H;
      draw(new Builder(new LiveSink(g, ghostMat(valid))));
      g.traverse(o => {
        o.castShadow = false;
      });
      ghost.add(g);
    }
  }
  function renderSelection() {
    disposeGroup(sel);
    const o = objInfo(selection);
    if (o) frameMesh(sel, o.x, o.z, o.size, padMat.sel);
  }
  // ---------- state sync ----------
  function update(s) {
    state = s;
    const w = C.warmth(s);
    if (Math.abs(w - warmth) > 0.005) {
      warmth = w;
      applySky();
    }
    const islandSig = s.island.terrain + s.island.height,
      sig = islandSig + JSON.stringify([s.buildings, s.layout, s.decor]) + C.population(s);
    if (sig === lastSig) return;
    lastSig = sig;
    const occ = C.occupancy(s);
    if (islandSig !== lastIsland) {
      lastIsland = islandSig;
      let far = 0;
      for (let z = 0; z < N; z++)
        for (let x = 0; x < N; x++)
          if (s.island.terrain[z * N + x] !== '.')
            far = Math.max(far, Math.hypot(x - HALF + 0.5, z - HALF + 0.5) + 0.71);
      const R = Math.min(21, Math.max(9, Math.ceil(far + 2.4)));
      if (R !== oceanR) {
        const first = !oceanR;
        oceanR = R;
        buildBase(R);
        Object.assign(sun.shadow.camera, {left: -R, right: R, top: R, bottom: -R, near: 0.5, far: 80});
        sun.shadow.camera.updateProjectionMatrix();
        if (first) reset();
      }
      colorSea(s.island);
      buildGrid(s);
    }
    buildTerrain(s, occ);
    buildObjects(s);
    buildVillagers(s, occ);
    renderGhost();
    renderSelection();
    const pop = C.population(s);
    if (lastPop !== null && pop > lastPop) startParade(s, Math.min(5, pop - lastPop));
    lastPop = pop;
  }
  // ---------- golden beasts: a short parade whenever new residents arrive ----------
  const beastsGroup = new THREE.Group();
  world.add(beastsGroup);
  let parade = null,
    lastPop = null;
  const tileXZ = i => [(i % N) - HALF + 0.5, Math.floor(i / N) - HALF + 0.5];
  // A loop of free land tiles around the island (no buildings, decor or ponds), via BFS between
  // waypoints picked at even angles; starts by the gatekeeper's lodge when there is one.
  function paradeRoute(s) {
    if (walk.size < 12) return null;
    let far = 0;
    for (const i of walk) far = Math.max(far, Math.hypot(...tileXZ(i)));
    const r = Math.max(2.2, far * 0.58),
      way = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * PI * 2;
      let best = -1,
        score = 1e9;
      for (const i of walk) {
        const [x, z] = tileXZ(i),
          d = Math.hypot(x, z),
          da = Math.abs(((Math.atan2(z, x) - a + PI * 3) % (PI * 2)) - PI),
          sc = Math.abs(d - r) + da * 3.5;
        if (sc < score) (score = sc), (best = i);
      }
      if (best >= 0 && way[way.length - 1] !== best) way.push(best);
    }
    const bfs = (from, to) => {
      const prev = new Map([[from, -1]]),
        q = [from];
      while (q.length) {
        const c = q.shift();
        if (c === to) break;
        const x = c % N;
        for (const n of [c + 1, c - 1, c + N, c - N]) {
          if ((n === c + 1 && x === N - 1) || (n === c - 1 && x === 0)) continue;
          if (walk.has(n) && !prev.has(n)) prev.set(n, c), q.push(n);
        }
      }
      if (!prev.has(to)) return null;
      const out = [];
      for (let c = to; c !== -1; c = prev.get(c)) out.push(c);
      return out.reverse();
    };
    const tiles = [];
    for (let k = 0; k < way.length; k++) {
      const seg = bfs(way[k], way[(k + 1) % way.length]);
      if (seg) tiles.push(...seg.slice(tiles.length ? 1 : 0));
    }
    if (tiles.length < 10) return null;
    const gk = s.layout?.gatekeeper;
    if (gk) {
      let bi = 0,
        bd = 1e9;
      tiles.forEach((i, k) => {
        const d = Math.hypot((i % N) - gk.x - 1, Math.floor(i / N) - gk.z - 1);
        if (d < bd) (bd = d), (bi = k);
      });
      tiles.push(...tiles.splice(0, bi));
    }
    const pts = tiles.map(i => {
      const [x, z] = tileXZ(i);
      return new THREE.Vector3(x, TOP(+s.island.height[i]), z);
    });
    // drop consecutive duplicates so the spline stays well-formed
    const clean = pts.filter((p, k) => !k || p.distanceToSquared(pts[k - 1]) > 0.01);
    const curve = new THREE.CatmullRomCurve3(clean, false, 'centripetal', 0.3);
    return {curve, len: curve.getLength()};
  }
  function horn() {
    const a = audioContext();
    if (!a || !loadPrefs().sound) return;
    const t0 = a.currentTime + 0.05,
      gain = a.createGain(),
      lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 760;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.05, t0 + 0.35);
    gain.gain.setValueAtTime(0.05, t0 + 1.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
    lp.connect(gain);
    gain.connect(a.destination);
    for (const f of [196, 294]) {
      const o = a.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.96, t0);
      o.frequency.linearRampToValueAtTime(f, t0 + 0.3);
      o.connect(lp);
      o.start(t0);
      o.stop(t0 + 2.5);
    }
  }
  function startParade(s, n) {
    if (motion.matches || parade) return;
    const route = paradeRoute(s);
    if (!route) return;
    const beasts = [];
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group(),
        legs = beastModel(new Builder(new LiveSink(g, liveMat)));
      g.scale.setScalar(0.001);
      beastsGroup.add(g);
      beasts.push({g, legs});
    }
    parade = {...route, beasts, u: 0, gap: 0.9};
    horn();
  }
  function stepParade(dt, t) {
    if (!parade) return;
    const P = parade,
      speed = 0.95;
    P.u += dt * speed;
    let alive = false;
    P.beasts.forEach((b, i) => {
      const u = P.u - i * P.gap;
      if (u < 0 || u > P.len) {
        b.g.visible = false;
        if (u <= P.len) alive = true;
        return;
      }
      alive = true;
      b.g.visible = true;
      const f = u / P.len,
        p = P.curve.getPointAt(f),
        d = P.curve.getTangentAt(f);
      b.g.position.set(p.x, p.y + Math.abs(Math.sin(t * 7 + i)) * 0.015, p.z);
      b.g.rotation.y = Math.atan2(d.x, d.z);
      // fade in out of the mist at the start, back into it at the end
      const edge = Math.min(1, u / 1.2, (P.len - u) / 1.2);
      b.g.scale.setScalar(Math.max(0.001, edge) * 1.45);
      const sw = Math.sin(t * 8 + i) * 0.5;
      b.legs[0].rotation.x = b.legs[3].rotation.x = sw;
      b.legs[1].rotation.x = b.legs[2].rotation.x = -sw;
    });
    if (!alive) {
      disposeGroup(beastsGroup);
      parade = null;
    }
  }
  // ---------- camera & input ----------
  let angle = 0.52,
    elevation = 0.69,
    radius = 20.8,
    target = new THREE.Vector3(0, 0.45, 0);
  function reset() {
    angle = 0.52;
    elevation = 0.69;
    radius = 17.5 * Math.sqrt(Math.max(1, (oceanR || 9) / 9));
    target.set(0, 0.45, 0);
  }
  const ray = new THREE.Raycaster(),
    ndc = new THREE.Vector2(),
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05),
    pt = new THREE.Vector3();
  function pick(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, (-(cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([objMesh, glowMesh, terrainMesh, dynRoot], true);
    for (const h of hits) {
      if (h.point.y < 0.04) break; // below the water line: the sea surface is what the player tapped
      let key = null;
      if (h.object === objMesh || h.object === glowMesh)
        key = owners[h.object.geometry.userData.owners[h.faceIndex]] ?? null;
      else if (h.object !== terrainMesh) {
        let o = h.object;
        while (o && o.userData.owner === undefined) o = o.parent;
        key = o ? (owners[o.userData.owner] ?? null) : null;
      }
      const n = h.face?.normal || new THREE.Vector3(0, 1, 0),
        px = h.point.x - n.x * 0.02,
        pz = h.point.z - n.z * 0.02;
      let x = Math.floor(px + HALF),
        z = Math.floor(pz + HALF);
      if (key) {
        const o = objInfo(key);
        if (o) {
          x = Math.min(o.x + o.size - 1, Math.max(o.x, x));
          z = Math.min(o.z + o.size - 1, Math.max(o.z, z));
        }
      }
      return {x, z, tile: tile(state, x, z), key};
    }
    if (ray.ray.intersectPlane(plane, pt)) {
      const x = Math.floor(pt.x + HALF),
        z = Math.floor(pt.z + HALF);
      if (Math.hypot(pt.x, pt.z) < oceanR) return {x, z, tile: tile(state, x, z), key: null};
    }
    return null;
  }
  const el = renderer.domElement,
    pointers = new Map();
  let drag = null,
    pinch = null,
    paintMode = false;
  // Painting is a one-pointer gesture; mouse right-drag / Shift+drag still rotates the camera.
  const endPaint = () => {
    if (drag?.painting) village.onPaint?.(null, 'end');
    if (drag) drag.paint = drag.painting = false;
  };
  const clampAll = () => {
    radius = THREE.MathUtils.clamp(radius, 6, 46);
    elevation = THREE.MathUtils.clamp(elevation, 0.28, 1.3);
    const lim = Math.max(6, oceanR - 2);
    target.x = THREE.MathUtils.clamp(target.x, -lim, lim);
    target.z = THREE.MathUtils.clamp(target.z, -lim, lim);
  };
  function panBy(dx, dy) {
    const s = radius * 0.0016,
      ca = Math.cos(angle),
      sa = Math.sin(angle);
    target.x += -ca * dx * s - sa * dy * s;
    target.z += sa * dx * s - ca * dy * s;
    clampAll();
  }
  el.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
    if (pointers.size === 1)
      drag = {
        x: e.clientX,
        y: e.clientY,
        sx: e.clientX,
        sy: e.clientY,
        moved: false,
        pan: e.button === 2 || e.shiftKey,
        touch: e.pointerType === 'touch',
        paint: paintMode && buildMode && e.button !== 2 && !e.shiftKey,
        painting: false
      };
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2};
      if (drag) {
        endPaint();
        drag.moved = true;
      }
    }
  });
  el.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p) {
      if (buildMode && e.pointerType === 'mouse') {
        const hit = pick(e.clientX, e.clientY);
        disposeGroup(hover);
        if (hit && hit.tile) pad(hover, hit.x, hit.z, padMat.hov);
      }
      return;
    }
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size >= 2 && pinch) {
      const [a, b] = [...pointers.values()],
        d = Math.hypot(a.x - b.x, a.y - b.y),
        mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2;
      if (d > 10 && pinch.d > 10) radius *= pinch.d / d;
      if (buildMode) panBy(mx - pinch.mx, my - pinch.my);
      pinch = {d, mx, my};
      clampAll();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y,
      tx = e.clientX - drag.sx,
      ty = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(tx, ty) > 6) {
      drag.moved = true;
      drag.vertical = Math.abs(ty) > Math.abs(tx) * 1.2;
      if (drag.paint) {
        drag.painting = true;
        const h0 = pick(drag.sx, drag.sy);
        if (h0) village.onPaint?.(h0, 'start');
      }
    }
    if (!drag.moved) return;
    if (drag.paint) {
      // sample along the segment so fast drags don't leave gaps between tiles
      const fx = drag.px ?? drag.sx,
        fy = drag.py ?? drag.sy,
        n = Math.min(24, Math.ceil(Math.hypot(e.clientX - fx, e.clientY - fy) / 8));
      for (let k = 1; k <= n; k++) {
        const h = pick(fx + ((e.clientX - fx) * k) / n, fy + ((e.clientY - fy) * k) / n);
        if (h) village.onPaint?.(h, 'move');
      }
      drag.px = e.clientX;
      drag.py = e.clientY;
      return;
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (drag.pan) {
      panBy(dx, dy);
      return;
    }
    if (!buildMode && drag.touch && drag.vertical) return; // vertical swipes switch pages outside build mode
    angle -= dx * 0.007;
    if (buildMode || !drag.touch) elevation += dy * 0.005;
    clampAll();
  });
  const end = e => {
    endPaint();
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (e.type === 'pointerup' && drag && !drag.moved && pointers.size === 0) {
      const hit = pick(e.clientX, e.clientY);
      if (buildMode) {
        if (hit) village.onTile?.(hit);
      } else if (hit?.key?.startsWith('b:')) onSelect(hit.key.slice(2));
    }
    if (pointers.size === 0) drag = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('contextmenu', e => {
    if (buildMode) e.preventDefault();
  });
  el.addEventListener(
    'wheel',
    e => {
      if (e.ctrlKey && !buildMode) return;
      if (Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        radius *= Math.exp(e.deltaY * 0.0011);
        clampAll();
      }
    },
    {passive: false}
  );
  el.addEventListener('pointerleave', () => disposeGroup(hover));
  // ---------- sky & time ----------
  const tag = document.querySelector('.scene-tag'),
    forced = Number(new URLSearchParams(location.search).get('hour'));
  // ---------- winter: falling snow ----------
  const SNOW_N = 700,
    snowPos = new Float32Array(SNOW_N * 3),
    snowSeed = new Float32Array(SNOW_N);
  for (let i = 0; i < SNOW_N; i++) {
    snowPos.set([(hash(i, 1) - 0.5) * 32, hash(i, 2) * 12, (hash(i, 3) - 0.5) * 32], i * 3);
    snowSeed[i] = hash(i, 4);
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const flakeCanvas = document.createElement('canvas');
  flakeCanvas.width = flakeCanvas.height = 32;
  {
    const g = flakeCanvas.getContext('2d'),
      grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.75)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
  }
  const snowMat = new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(flakeCanvas),
      size: 0.17,
      transparent: true,
      depthWrite: false,
      opacity: 0,
      fog: false
    }),
    snowfall = new THREE.Points(snowGeo, snowMat);
  snowfall.frustumCulled = false;
  snowfall.visible = false;
  scene.add(snowfall);
  let snowLevel = 0,
    snowTarget = 0;
  // ---------- winter: the wall of mist around the sea (only its far side is drawn) ----------
  const mistU = {uColor: {value: new THREE.Color(0xdfe5e8)}, uOpacity: {value: 0.4}, uTime: {value: 0}},
    mistWall = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 72, 1, true),
      new THREE.ShaderMaterial({
        uniforms: mistU,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        vertexShader:
          'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uTime; varying vec2 vUv;
          float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n(vec2 p, float per) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            vec2 a = vec2(mod(i.x, per), i.y), b = vec2(mod(i.x + 1.0, per), i.y);
            return mix(mix(h(a), h(b), f.x), mix(h(a + vec2(0.0, 1.0)), h(b + vec2(0.0, 1.0)), f.x), f.y); }
          void main() {
            float v = vUv.y;
            vec2 q = vec2(vUv.x * 36.0 + uTime * 0.06, v * 3.0 - uTime * 0.03);
            float m = 0.45 + 0.55 * (n(q, 36.0) * 0.6 + n(q * vec2(2.0, 2.3), 72.0) * 0.4);
            float a = smoothstep(0.0, 0.18, v) * (1.0 - smoothstep(0.3 + m * 0.35, 1.0, v));
            gl_FragColor = vec4(uColor, a * m * uOpacity);
          }`
      })
    );
  mistWall.renderOrder = -1;
  scene.add(mistWall);
  let skyKey = '';
  // Warmth: a newcomer's town is cold and misty; building and new residents bring the colour back.
  // Only sky, light, sea and mist are chilled; buildings and lamplight keep their warm colours.
  let warmth = 1;
  const _hsl = {h: 0, s: 0, l: 0},
    chill = (col, c) => {
      col.getHSL(_hsl);
      return col.setHSL(_hsl.h + (0.58 - _hsl.h) * 0.5 * c, _hsl.s * (1 - 0.7 * c), _hsl.l);
    };
  function applySky() {
    const d = new Date(),
      hour =
        Number.isFinite(forced) && new URLSearchParams(location.search).has('hour')
          ? forced
          : d.getHours() + d.getMinutes() / 60,
      k = skyAt(hour),
      cold = 0.55 * (1 - warmth);
    for (const key of ['top', 'bottom', 'hs', 'hg']) chill(k[key], cold);
    chill(k.sun, cold * 0.7);
    coldU.value = cold * 1.15;
    // Snow lies thick on a young town and melts away as it grows; it still snows now and then.
    snowU.value = C.snowCover(warmth);
    snowTarget = C.snowfall(warmth);
    mistU.uColor.value.copy(k.bottom).lerp(new THREE.Color(0xffffff), 0.25);
    mistU.uOpacity.value = 0.3 + 0.9 * cold;
    chill(pondMat.color.set(0x8fd0c8), cold);
    scene.fog.near = 60 - 80 * cold;
    scene.fog.far = 120 - 85 * cold;
    hemi.color.copy(k.hs);
    hemi.groundColor.copy(k.hg);
    hemi.intensity = k.hi;
    sun.color.copy(k.sun);
    sun.intensity = k.si;
    const night = hour < 5.5 || hour > 21,
      az = night ? 2.4 : ((hour - 6) / 12) * PI;
    sun.position.set(-Math.cos(az) * 13, 5 + 11 * k.el, 8 + Math.sin(az) * 3);
    glowLevel = k.glow;
    glowMat.emissiveIntensity = 0.08 + k.glow * 1.1;
    for (const m of liveGlow) m.emissiveIntensity = 0.2 + k.glow;
    scene.fog.color.copy(k.bottom);
    const css = `linear-gradient(180deg,#${k.top.getHexString()} 0%,#${k.bottom.getHexString()} 78%)`;
    if (css !== skyKey) {
      skyKey = css;
      container.style.background = css;
      // the floating text over the scene fades into this sky and reads light on a dark one
      const root = document.documentElement.style;
      root.setProperty('--sky-top', `#${k.top.getHexString()}`);
      root.setProperty('--sky-bottom', `#${k.bottom.getHexString()}`);
      document.body.dataset.sky =
        0.2126 * k.top.r + 0.7152 * k.top.g + 0.0722 * k.top.b < 0.12 ? 'night' : 'day';
    }
    if (tag && tag.lastChild?.nodeType === 3) tag.lastChild.textContent = k.tag;
  }
  applySky();
  setInterval(applySky, 60000);
  // ---------- loop ----------
  const resize = () => {
    const w = container.clientWidth,
      h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    if (buildMode) camera.setViewOffset(w, h, 0, h * (w < 700 ? 0.17 : 0.1), w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();
  let active = true,
    covered = false;
  document.addEventListener('visibilitychange', () => {
    active = !document.hidden;
  });
  // while a sheet or dialog covers the town it stays still: the frosted glass would otherwise
  // re-blur a moving picture every frame
  new MutationObserver(() => (covered = !!document.querySelector('dialog[open]'))).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['open']
  });
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let lastFrame = 0,
    prevT = 0;
  function frame(ms) {
    requestAnimationFrame(frame);
    if (!active || covered || !container.clientWidth || ms - lastFrame < 32) return;
    const dt = Math.min(0.1, (ms - (prevT || ms)) / 1000);
    prevT = ms;
    lastFrame = ms;
    const t = ms / 1000;
    const viewRadius = radius * Math.max(1, 1.3 / camera.aspect);
    camera.position.set(
      target.x + Math.sin(angle) * Math.cos(elevation) * viewRadius,
      target.y + Math.sin(elevation) * viewRadius,
      target.z + Math.cos(angle) * Math.cos(elevation) * viewRadius
    );
    camera.lookAt(target);
    sun.target.position.copy(target);
    const now = new Date(),
      hh = (now.getHours() % 12) + now.getMinutes() / 60,
      mm = now.getMinutes() + now.getSeconds() / 60;
    mistU.uTime.value = t;
    mistWall.scale.set(oceanR + 2.4, 7, oceanR + 2.4);
    mistWall.position.y = 2.6;
    snowLevel += (snowTarget - snowLevel) * Math.min(1, dt * 0.3);
    snowfall.visible = snowLevel > 0.02 && !motion.matches;
    if (snowfall.visible) {
      snowMat.opacity = Math.min(1, snowLevel) * 0.9;
      snowfall.position.set(target.x, 0, target.z);
      for (let i = 0; i < SNOW_N; i++) {
        const k = i * 3,
          sd = snowSeed[i];
        snowPos[k + 1] -= dt * (0.5 + sd * 0.45);
        snowPos[k] += Math.sin(t * 0.6 + sd * 40) * dt * 0.14;
        if (snowPos[k + 1] < -0.2) snowPos[k + 1] += 12;
      }
      snowGeo.attributes.position.needsUpdate = true;
    }
    stepParade(dt, t);
    if ((state?.timer?.kind === 'study' && state.timer.runningSince != null) || dreamH === null) {
      dreamH = hh;
      dreamM = mm;
    }
    for (const {o, a, ph} of anims) {
      if (a.type === 'clock' || a.type === 'dreamclock') {
        const [h, m] = a.type === 'clock' ? [hh, mm] : [dreamH, dreamM];
        o.rotation.z = -(a.hand === 'h' ? h / 12 : m / 60) * PI * 2;
        continue;
      }
      if (motion.matches) continue;
      if (a.type === 'spin') o.rotation[a.axis] = t * a.speed + ph;
      else if (a.type === 'flag') o.rotation.y = Math.sin(t * 2.6 + ph) * 0.35;
      else if (a.type === 'bob') {
        o.position.y = Math.sin(t * 1.4 + ph) * 0.035;
        o.rotation.z = Math.sin(t * 1.1 + ph) * 0.05;
      } else if (a.type === 'flicker') {
        const f = 1 + Math.sin(t * 13 + ph) * 0.12 + Math.sin(t * 7.3) * 0.08;
        o.scale.set(2 - f, f, 2 - f);
      } else if (a.type === 'smoke')
        o.children.forEach((c, i) => {
          const p = (t * 0.3 + i / 3 + ph) % 1;
          c.position.set(Math.sin(p * 4 + i) * 0.07, p * 0.95, Math.cos(p * 3 + i) * 0.05);
          const s0 = c.userData.s0 ?? (c.userData.s0 = c.scale.x);
          c.scale.setScalar(s0 * (p < 0.8 ? 0.5 + p * 1.5 : ((1 - p) / 0.2) * 1.7));
        });
    }
    if (!motion.matches) {
      for (const v of villagers) {
        stepVillager(v, dt);
        const sw = v.wait > 0 ? 0 : Math.sin(t * 9 + v.i) * 0.55;
        v.legs[0].rotation.x = sw;
        v.legs[1].rotation.x = -sw;
      }
      const pa = sea.geometry.attributes.position;
      if (pa) {
        for (let i = 0; i < pa.count; i++) {
          const x = pa.getX(i),
            z = pa.getZ(i);
          pa.setY(i, 0.03 + Math.sin(x * 0.8 + t * 1.2) * 0.035 + Math.sin(z * 0.9 - t * 0.9) * 0.025);
        }
        pa.needsUpdate = true;
      }
      for (const c of clouds.children) {
        const u = c.userData;
        u.a += u.s * dt;
        c.position.set(Math.cos(u.a) * (oceanR + u.r), u.y, Math.sin(u.a) * (oceanR + u.r));
        c.rotation.y = -u.a;
      }
      if (selection) sel.position.y = Math.sin(t * 4) * 0.03;
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  el.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    const l = document.getElementById('scene-loading');
    if (l) {
      l.textContent = '3D 画面暂时中断，刷新页面可恢复；打卡与建造仍可使用。';
      l.hidden = false;
    }
  });
  const loading = document.getElementById('scene-loading');
  if (loading) loading.hidden = true;
  const village = {
    update,
    reset,
    onTile: null,
    onPaint: null,
    setPaint(on) {
      paintMode = !!on;
      if (!paintMode) endPaint();
    },
    setBuildMode(on) {
      buildMode = !!on;
      if (!buildMode) {
        paintMode = false;
        endPaint();
      }
      gridLines.visible = buildMode;
      el.style.touchAction = buildMode ? 'none' : '';
      if (!buildMode) {
        tool = null;
        ghostSpec = null;
        selection = null;
        disposeGroup(hover);
        renderGhost();
        renderSelection();
      }
      requestAnimationFrame(resize);
    },
    setTool(t) {
      tool = t ? {...t} : null;
      renderGhost();
    },
    setGhost(g) {
      ghostSpec = g ? {...g} : null;
      renderGhost();
    },
    setSelection(key) {
      selection = key || null;
      sel.position.y = 0;
      renderSelection();
    },
    debug: {
      pick: (x, y) => {
        const r = el.getBoundingClientRect();
        ndc.set(((x - r.left) / r.width) * 2 - 1, (-(y - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        return ray
          .intersectObjects([objMesh, glowMesh, terrainMesh, dynRoot], true)
          .slice(0, 3)
          .map(h => [
            h.object === terrainMesh ? 'T' : h.object === objMesh ? 'O' : 'D',
            +h.point.x.toFixed(2),
            +h.point.y.toFixed(2),
            +h.point.z.toFixed(2),
            h.face && [h.face.normal.x, h.face.normal.y, h.face.normal.z].map(v => +v.toFixed(2))
          ]);
      },
      project: (x, z) => {
        const t = tile(state, x, z),
          v = new THREE.Vector3(
            x - HALF + 0.5,
            t && t.t !== '.' ? topOf(t.t, t.h) : 0.05,
            z - HALF + 0.5
          ).project(camera),
          r = el.getBoundingClientRect();
        return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
      },
      camera: (a, e, r, tx = 0, tz = 0) => {
        angle = a;
        elevation = e;
        radius = r;
        target.set(tx, 0.45, tz);
      },
      renderer
    }
  };
  if (new URLSearchParams(location.search).has('hour')) window.__village = village; // screenshot/debug hook
  return village;
}

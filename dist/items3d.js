import * as THREE from './vendor/three.module.min.js';
import {Builder, LiveSink, itemModel} from './models.js?v=4';
// Rich-material renderer for collectibles: one shared offscreen renderer for thumbnails, one live viewer at a time.
const mats = new Map();
function richMat(color, o = {}) {
  const m = o.mat || {},
    key = [color, o.glow ? 1 : 0, m.metal, m.rough, m.emissive, m.opacity, m.smooth].join('|');
  let mat = mats.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color,
      roughness: m.rough ?? 0.6,
      metalness: m.metal ?? 0,
      flatShading: !m.smooth && !(m.metal > 0),
      transparent: (m.opacity ?? 1) < 1,
      opacity: m.opacity ?? 1,
      depthWrite: (m.opacity ?? 1) >= 1,
      side: (m.opacity ?? 1) < 1 ? THREE.DoubleSide : THREE.FrontSide
    });
    if (m.emissive || o.glow) {
      mat.emissive.set(o.glow ? 0xffc46b : color);
      mat.emissiveIntensity = m.emissive || 0.8;
    }
    mats.set(key, mat);
  }
  return mat;
}
export function createItemModel(id) {
  const g = new THREE.Group();
  itemModel(new Builder(new LiveSink(g, richMat)), id);
  return g;
}
function stage(id) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff8ea, 0x8a7f9a, 2.2));
  const key = new THREE.DirectionalLight(0xfff0d8, 3.2);
  key.position.set(2.5, 4, 3.5);
  const rim = new THREE.DirectionalLight(0xbcd8ff, 1.6);
  rim.position.set(-3, 2, -3);
  scene.add(key, rim);
  const model = createItemModel(id),
    box = new THREE.Box3();
  model.updateMatrixWorld(true);
  model.traverse(o => {
    if (!o.isMesh) return;
    for (let p = o; p && p !== model; p = p.parent) if (p.userData.anim) return;
    box.expandByObject(o);
  });
  const size = box.getSize(new THREE.Vector3()),
    center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const pivot = new THREE.Group();
  pivot.add(model);
  scene.add(pivot);
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.66, 0.05, 40),
    new THREE.MeshStandardMaterial({color: 0xf3ecdc, roughness: 0.7})
  );
  disc.position.y = -size.y / 2 - 0.03;
  disc.scale.setScalar(Math.max(size.x, size.z, 0.5) * 0.85);
  pivot.add(disc);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50),
    dist = Math.max(size.x, size.y, size.z) * 2.25 + 0.5;
  camera.position.set(0, dist * 0.42, dist);
  camera.lookAt(0, -size.y * 0.05, 0);
  return {scene, camera, pivot, model};
}
let shared = null;
const cache = new Map();
function sharedRenderer() {
  if (!shared) {
    shared = new THREE.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
    shared.setPixelRatio(1);
    shared.setSize(256, 256);
    shared.outputColorSpace = THREE.SRGBColorSpace;
    shared.toneMapping = THREE.ACESFilmicToneMapping;
    shared.toneMappingExposure = 1.05;
  }
  return shared;
}
export function itemThumbnail(id) {
  if (!cache.has(id))
    cache.set(
      id,
      new Promise((resolve, reject) => {
        try {
          const r = sharedRenderer(),
            {scene, camera, pivot} = stage(id);
          pivot.rotation.y = -0.55;
          r.setClearColor(0, 0);
          r.render(scene, camera);
          resolve(r.domElement.toDataURL('image/png'));
        } catch (e) {
          cache.delete(id);
          reject(e);
        }
      })
    );
  return cache.get(id);
}
export function mountItemViewer(el, id) {
  const r = new THREE.WebGLRenderer({antialias: true, alpha: true});
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.setClearColor(0, 0);
  el.appendChild(r.domElement);
  Object.assign(r.domElement.style, {
    width: '100%',
    height: '100%',
    display: 'block',
    touchAction: 'none',
    cursor: 'grab'
  });
  const {scene, camera, pivot, model} = stage(id);
  let rot = -0.55,
    tilt = 0,
    vel = 0.35,
    drag = null,
    raf = 0,
    last = 0,
    alive = true;
  const anims = [];
  model.traverse(o => {
    if (o.userData.anim) anims.push(o);
  });
  const resize = () => {
    const w = el.clientWidth || 280,
      h = el.clientHeight || 280;
    r.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();
  r.domElement.addEventListener('pointerdown', e => {
    drag = {x: e.clientX, y: e.clientY};
    vel = 0;
    r.domElement.setPointerCapture(e.pointerId);
  });
  r.domElement.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    rot += dx * 0.012;
    tilt = THREE.MathUtils.clamp(tilt + (e.clientY - drag.y) * 0.006, -0.6, 0.6);
    vel = dx * 0.6;
    drag = {x: e.clientX, y: e.clientY};
  });
  const up = () => {
    drag = null;
    vel = THREE.MathUtils.clamp(vel, -3, 3) || 0.35;
  };
  r.domElement.addEventListener('pointerup', up);
  r.domElement.addEventListener('pointercancel', up);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loop(ms) {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ms - (last || ms)) / 1000);
    last = ms;
    if (!drag && !reduce) {
      rot += vel * dt;
      vel += (0.35 * Math.sign(vel || 1) - vel) * dt * 1.5;
    }
    pivot.rotation.set(tilt, rot, 0);
    if (!reduce)
      for (const o of anims)
        if (o.userData.anim.type === 'spin')
          o.rotation[o.userData.anim.axis] = (ms / 1000) * o.userData.anim.speed;
    model.position.y = reduce ? model.position.y : model.position.y + Math.sin(ms / 700) * 0.0006;
    r.render(scene, camera);
  }
  raf = requestAnimationFrame(loop);
  return {
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      r.dispose();
      r.forceContextLoss?.();
      r.domElement.remove();
    }
  };
}

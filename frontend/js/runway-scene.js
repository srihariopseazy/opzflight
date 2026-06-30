/* ════════════════════════════════════════════════════════════
   OPSEAZY — Runway Scene (results page)
   Small strip showing the parked airplane after "landing".
   ES module. Fails silently if WebGL unavailable.
   ════════════════════════════════════════════════════════════ */
import * as THREE from '/js/three.module.js';
import { buildAirplane, buildRunway, makeCloud } from '/js/airplane-geometry.js';

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) throw new Error('reduced-motion');
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); }
  catch (e) { return false; }
}
if (!hasWebGL()) { document.getElementById('runway-scene-strip')?.classList.add('hidden'); throw new Error('no-webgl'); }

const strip  = document.getElementById('runway-scene-strip');
const canvas = document.getElementById('runway-canvas');
if (!strip || !canvas) throw new Error('elements missing');

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setClearColor(0x000000, 0);

const scene  = new THREE.Scene();
/* Wide FOV to see the runway stretch from the strip's short height */
const camera = new THREE.PerspectiveCamera(38, 16 / 3, 0.1, 150);
camera.position.set(0, 2.2, 13);
camera.lookAt(0, -1, 0);

/* Lights */
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
sun.position.set(6, 8, 5);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x93c5fd, 0.4);
fill.position.set(-5, -3, 5);
scene.add(fill);

/* Runway */
const runway = buildRunway(THREE);
runway.position.set(0, -2.2, -1);
scene.add(runway);

/* Airplane — parked, slight offset to one side for asymmetry */
const plane = buildAirplane(THREE);
plane.position.set(-1.2, -1.95, 0);
plane.rotation.y = 0.22; /* slight angle so we see depth */
plane.scale.setScalar(0.82);
scene.add(plane);

/* A few distant clouds for atmosphere */
[makeCloud(THREE, -9, 2.5, -5, 0.7), makeCloud(THREE, 8, 3, -4, 0.6)]
  .forEach(c => scene.add(c));

/* Gentle idle bob */
let t = 0;
const clock = new THREE.Clock();

/* ResizeObserver */
const ro = new ResizeObserver(entries => {
  const { width: nW, height: nH } = entries[0].contentRect;
  if (!nW || !nH) return;
  camera.aspect = nW / nH;
  camera.updateProjectionMatrix();
  renderer.setSize(nW, nH);
});
ro.observe(strip);

/* IntersectionObserver */
let visible = true;
new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.1 }).observe(strip);

(function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!visible) return;

  t += dt * 0.4;
  /* Very subtle idle: tiny vertical bob, slight wing rock */
  plane.position.y = -1.95 + Math.sin(t) * 0.03;
  plane.rotation.z = Math.sin(t * 1.1) * 0.015;

  renderer.render(scene, camera);
})();

window.addEventListener('unload', () => { ro.disconnect(); renderer.dispose(); }, { once: true });

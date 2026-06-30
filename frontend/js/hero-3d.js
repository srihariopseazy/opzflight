/* ════════════════════════════════════════════════════════════
   OPSEAZY — Hero 3D  (ES module, event-driven state machine)

   States
   ──────
   idle    : plane gently cruises in the hero background
   landing : triggered by opseazy:search event — plane descends
             to the runway; on completion navigates to results
   ════════════════════════════════════════════════════════════ */
import * as THREE from '/js/three.module.js';
import { buildAirplane, makeCloud, buildRunway } from '/js/airplane-geometry.js';

/* ── Guards ─────────────────────────────────────────────────── */
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) throw new Error('prefers-reduced-motion');
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); }
  catch (e) { return false; }
}
if (!hasWebGL()) { document.getElementById('hero-canvas-wrap')?.classList.add('hidden'); throw new Error('no-webgl'); }

/* ── Renderer + scene ───────────────────────────────────────── */
const wrap   = document.getElementById('hero-canvas-wrap');
const canvas = document.getElementById('hero-canvas');

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 200);
camera.position.set(0, 2, 14);
camera.lookAt(0, 0, 0);

/* ── Lighting ───────────────────────────────────────────────── */
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
sun.position.set(5, 10, 5);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x93c5fd, 0.5);
fill.position.set(-6, -4, 6);
scene.add(fill);

/* ── Airplane ───────────────────────────────────────────────── */
const planeGroup = buildAirplane(THREE);
scene.add(planeGroup);

/* ── Runway (at y = -2.5, visible once plane descends) ─────── */
const runway = buildRunway(THREE);
runway.position.set(0, -2.5, -2);
scene.add(runway);

/* ── Clouds ─────────────────────────────────────────────────── */
const clouds = [
  makeCloud(THREE, -8,  1.5, -4, 0.9),
  makeCloud(THREE,  6,  2.0,  2, 0.7),
  makeCloud(THREE, -4, -1.0, -6, 0.6),
  makeCloud(THREE, 10,  0.5, -3, 0.8),
];
clouds.forEach(c => scene.add(c));

/* ── State machine ──────────────────────────────────────────── */
let state     = 'idle';   // 'idle' | 'landing'
let idleT     = 0;
let landingT  = 0;
const LANDING_DUR = 2.6;
let pendingUrl = null;
const clock = new THREE.Clock();

const easeOut3   = t => 1 - Math.pow(1 - t, 3);
const easeInOut3 = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
const lerp       = (a, b, t) => a + (b - a) * t;

/* Initial idle position */
planeGroup.position.set(2.2, 1.6, 0);
planeGroup.rotation.y = -0.1;
planeGroup.scale.setScalar(0.88);

/* ── Listen for search-submit ───────────────────────────────── */
document.addEventListener('opseazy:search', e => {
  if (state !== 'idle') return;
  /* Signal home.js that the animation handled this — prevents the 150ms fallback */
  document.dispatchEvent(new Event('opseazy:search:handled'));
  pendingUrl = e.detail.url;
  state = 'landing';
  landingT = 0;
  clock.getDelta(); /* flush any accumulated delta */

  /* Visually cue the search form that the journey has begun */
  document.getElementById('search-card')?.classList.add('search-launching');
});

/* ── ResizeObserver ─────────────────────────────────────────── */
const ro = new ResizeObserver(entries => {
  const { width: nW, height: nH } = entries[0].contentRect;
  if (!nW || !nH) return;
  camera.aspect = nW / nH;
  camera.updateProjectionMatrix();
  renderer.setSize(nW, nH);
});
ro.observe(wrap);

/* ── IntersectionObserver (pause off-screen) ────────────────── */
let visible = true;
new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(wrap);

/* ── Render loop ────────────────────────────────────────────── */
(function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05); /* cap to 50ms to survive tab-switch lag */
  if (!visible) return;

  if (state === 'idle') {
    idleT += dt * 0.10;

    /* Gentle cruise: slow sinusoidal drift + bob */
    planeGroup.position.x = Math.sin(idleT) * 2.2;
    planeGroup.position.y = 1.6 + Math.sin(idleT * 2.3) * 0.2;
    planeGroup.rotation.z = Math.sin(idleT * 2.3) * 0.055;
    planeGroup.rotation.y = -0.10 + Math.sin(idleT * 0.6) * 0.04;

    /* Drift clouds */
    clouds.forEach((c, i) => {
      c.position.x -= 0.002 * (0.5 + i * 0.1);
      if (c.position.x < -20) c.position.x = 20;
    });

  } else if (state === 'landing') {
    landingT = Math.min(landingT + dt / LANDING_DUR, 1);
    const et = easeOut3(landingT);

    /* ── Position: approach from upper-right, touch down center ── */
    planeGroup.position.x = lerp(3.5, 0.3, et);
    planeGroup.position.y = lerp(4.2, -1.95, et);

    /* ── Nose pitch: nose-down during approach, level at rollout ── */
    planeGroup.rotation.z = landingT < 0.72
      ? lerp(0.08, -0.22, easeInOut3(landingT / 0.72))
      : lerp(-0.22, 0.02, easeInOut3((landingT - 0.72) / 0.28));

    /* ── Bank: slight approach bank, straightens on centerline ──── */
    planeGroup.rotation.y = lerp(-0.18, 0, easeInOut3(Math.min(landingT * 1.5, 1)));

    /* ── Scale: grows as the plane comes toward the camera ───────── */
    planeGroup.scale.setScalar(lerp(0.68, 1.05, et));

    /* ── Clouds slow as we're near the ground ───────────────────── */
    clouds.forEach((c, i) => {
      c.position.x -= (1 - landingT) * 0.002 * (0.5 + i * 0.1);
      if (c.position.x < -20) c.position.x = 20;
    });

    /* ── Navigate when touchdown is complete ────────────────────── */
    if (landingT >= 1 && pendingUrl) {
      const url = pendingUrl;
      pendingUrl = null;
      window.location.href = url;
    }
  }

  renderer.render(scene, camera);
})();

window.addEventListener('unload', () => { ro.disconnect(); renderer.dispose(); }, { once: true });

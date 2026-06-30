/* ════════════════════════════════════════════════════════════
   OPSEAZY — Takeoff Scene (confirmation page)

   Sequence (total ~4 s)
   ──────────────────────
   0.0 – 0.6 s  warm-up   : plane sits on runway, tiny vibration
   0.6 – 1.8 s  roll       : accelerates along runway (x increases)
   1.8 – 3.2 s  climb      : nose pitches up, plane lifts off and climbs
   3.2 – 4.0 s  exit       : plane shrinks into horizon, sky brightens
   4.0 s        reveal     : overlay fades out, confirmation card slides in

   Confetti burst fires at the liftoff moment (t = 1.8 s).
   ════════════════════════════════════════════════════════════ */
import * as THREE from '/js/three.module.js';
import { buildAirplane, buildRunway, makeCloud } from '/js/airplane-geometry.js';

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  /* Skip animation immediately — just show the confirmation */
  revealConfirmation();
  throw new Error('reduced-motion');
}
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); }
  catch (e) { return false; }
}
if (!hasWebGL()) { revealConfirmation(); throw new Error('no-webgl'); }

/* ── DOM refs ────────────────────────────────────────────────── */
const overlay  = document.getElementById('takeoff-overlay');
const canvas3d = document.getElementById('takeoff-canvas');
const confetti = document.getElementById('confetti-canvas');
if (!overlay || !canvas3d || !confetti) { revealConfirmation(); throw new Error('elements missing'); }

/* ── Three.js setup ─────────────────────────────────────────── */
const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 200);
camera.position.set(0, 2, 14);
camera.lookAt(0, 0, 0);

/* Lights */
scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
sun.position.set(5, 10, 5);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x93c5fd, 0.5);
fill.position.set(-6, -4, 6);
scene.add(fill);

/* Runway */
const runwayGroup = buildRunway(THREE);
runwayGroup.position.set(0, -2.5, -2);
scene.add(runwayGroup);

/* Airplane — starts on the runway (left side) */
const plane = buildAirplane(THREE);
plane.position.set(-6, -1.95, 0);
plane.rotation.y = 0;
plane.scale.setScalar(1.0);
scene.add(plane);

/* Clouds */
const clouds = [
  makeCloud(THREE, -9,  2.0, -5, 0.85),
  makeCloud(THREE,  7,  2.5,  1, 0.70),
  makeCloud(THREE,  2,  4.0, -4, 0.60),
  makeCloud(THREE, -3, -0.5, -6, 0.55),
];
clouds.forEach(c => scene.add(c));

/* ── Confetti system ─────────────────────────────────────────── */
const ctx2d = confetti.getContext('2d');
const COLORS = ['#6366f1', '#f97316', '#0ea5e9', '#10b981', '#fbbf24', '#ec4899'];
let particles = [];

function sizeConfetti() {
  confetti.width  = window.innerWidth;
  confetti.height = window.innerHeight;
}
sizeConfetti();
window.addEventListener('resize', sizeConfetti);

function burstConfetti() {
  for (let i = 0; i < 120; i++) {
    particles.push({
      x:     confetti.width * (0.3 + Math.random() * 0.4),
      y:     confetti.height * 0.45,
      vx:    (Math.random() - 0.5) * 12,
      vy:    -(Math.random() * 14 + 4),
      size:  Math.random() * 9 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      angle: Math.random() * Math.PI * 2,
      spin:  (Math.random() - 0.5) * 0.35,
      alpha: 1,
    });
  }
}

function tickConfetti() {
  ctx2d.clearRect(0, 0, confetti.width, confetti.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.22; /* gravity */
    p.angle += p.spin;
    p.alpha -= 0.007;
    if (p.alpha <= 0) { particles.splice(i, 1); continue; }
    ctx2d.save();
    ctx2d.globalAlpha = p.alpha;
    ctx2d.fillStyle = p.color;
    ctx2d.translate(p.x, p.y);
    ctx2d.rotate(p.angle);
    ctx2d.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx2d.restore();
  }
}

/* ── Resize for 3D canvas ───────────────────────────────────── */
function resize3d() {
  const nW = overlay.clientWidth  || window.innerWidth;
  const nH = overlay.clientHeight || window.innerHeight;
  if (!nW || !nH) return;
  camera.aspect = nW / nH;
  camera.updateProjectionMatrix();
  renderer.setSize(nW, nH);
}
const ro = new ResizeObserver(resize3d);
ro.observe(overlay);

/* ── Animation timeline ─────────────────────────────────────── */
const clock = new THREE.Clock();
let elapsed  = 0;
let confettiFired = false;

const WARMUP   = 0.6;
const ROLL_END = 1.8;
const CLIMB_END = 3.2;
const EXIT_END = 4.0;

const easeIn3   = t => t * t * t;
const easeOut3  = t => 1 - Math.pow(1 - t, 3);
const easeInOut3 = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
const lerp      = (a, b, t) => a + (b - a) * t;

(function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  /* ── Phase 0: warm-up (0 → WARMUP) ─────────────────────── */
  if (elapsed < WARMUP) {
    const tv = easeInOut3(elapsed / WARMUP);
    /* Tiny engine vibration */
    plane.position.x = -6 + Math.sin(elapsed * 40) * 0.018;
    plane.position.y = -1.95 + Math.sin(elapsed * 37) * 0.010;

  /* ── Phase 1: roll (WARMUP → ROLL_END) ─────────────────── */
  } else if (elapsed < ROLL_END) {
    const t = (elapsed - WARMUP) / (ROLL_END - WARMUP);
    const et = easeIn3(t);
    /* Accelerate from x=-6 to x=4 */
    plane.position.x = lerp(-6, 4, et);
    plane.position.y = -1.95;
    plane.rotation.z = lerp(0, 0.04, et); /* tiny lift at nose */

  /* ── Phase 2: climb (ROLL_END → CLIMB_END) ─────────────── */
  } else if (elapsed < CLIMB_END) {
    const t = (elapsed - ROLL_END) / (CLIMB_END - ROLL_END);
    const et = easeOut3(t);
    /* Lift off and climb steeply */
    plane.position.x = lerp(4, 10, t);
    plane.position.y = lerp(-1.95, 5.5, et);
    /* Nose pitches up */
    plane.rotation.z = lerp(0.04, 0.38, easeInOut3(t));
    plane.rotation.y = lerp(0, -0.12, t); /* slight bank */
    /* Scale: grows then shrinks as it flies away */
    plane.scale.setScalar(lerp(1.0, 0.6, t));

    /* Fire confetti at liftoff */
    if (!confettiFired) { confettiFired = true; burstConfetti(); }

  /* ── Phase 3: exit (CLIMB_END → EXIT_END) ──────────────── */
  } else if (elapsed < EXIT_END) {
    const t = (elapsed - CLIMB_END) / (EXIT_END - CLIMB_END);
    plane.position.x = lerp(10, 18, t);
    plane.position.y = lerp(5.5, 9, t);
    plane.scale.setScalar(lerp(0.6, 0.1, easeIn3(t)));

  /* ── Phase 4: complete ──────────────────────────────────── */
  } else if (elapsed >= EXIT_END) {
    /* Fade overlay and reveal confirmation */
    overlay.style.transition = 'opacity 0.7s ease';
    overlay.style.opacity    = '0';
    setTimeout(revealConfirmation, 700);
    /* Stop the loop — elapsed will overshoot but the overlay is gone */
    elapsed = EXIT_END + 999; /* sentinel so we don't enter again */
  }

  /* Always drift clouds + tick confetti */
  clouds.forEach((c, i) => {
    c.position.x -= 0.003 * (0.5 + i * 0.12);
    if (c.position.x < -20) c.position.x = 20;
  });
  tickConfetti();

  renderer.render(scene, camera);
})();

window.addEventListener('unload', () => { ro.disconnect(); renderer.dispose(); }, { once: true });

/* ── Helpers ─────────────────────────────────────────────────── */
function revealConfirmation() {
  const ov = document.getElementById('takeoff-overlay');
  if (ov) ov.style.display = 'none';
  const content = document.getElementById('confirm-wrapper');
  if (content) {
    content.classList.remove('hidden');
    content.classList.add('confirm-slide-in');
  }
}

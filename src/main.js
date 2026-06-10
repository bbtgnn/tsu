import paper from 'paper';
import { animate } from 'animejs';
import { config } from './config.js';
import { createInitialState, nextRound } from './rounds.js';
import { toRenderState, toCorners, inscribedRect } from './geometry.js';
import logoUrl from '../assets/tsu-logo.svg';

paper.setup(document.getElementById('canvas'));
const { view } = paper;

let model = createInitialState();
let current = toRenderState(model);
const paths = new Map(); // id -> paper.Path
let logo = null;

paper.project.importSVG(logoUrl, {
  onLoad: (item) => {
    logo = item;
    draw();
  },
});

const NUM_KEYS = ['yTop', 'yBottom', 'topX0', 'topX1', 'botX0', 'botX1'];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpStates(from, to, t) {
  return to.map((entry) => {
    const f = from.get(entry.id);
    const out = { id: entry.id };
    for (const k of NUM_KEYS) out[k] = lerp(f[k], entry[k], t);
    return out;
  });
}

function draw() {
  const seen = new Set();
  for (const entry of current) {
    seen.add(entry.id);
    let path = paths.get(entry.id);
    if (!path) {
      path = new paper.Path({ closed: true, fillColor: config.fill });
      for (let i = 0; i < 4; i++) path.add(new paper.Point(0, 0));
      paths.set(entry.id, path);
    }
    const corners = toCorners(entry, view.size.width, view.size.height);
    corners.forEach(([x, y], i) => path.segments[i].point.set(x, y));
  }
  for (const [id, path] of paths) {
    if (!seen.has(id)) {
      path.remove();
      paths.delete(id);
    }
  }
  placeLogo();
}

// Fit the logo (aspect preserved) into the rectangle inscribed in the top
// PA, snapped to the rectangle's top-left corner.
function placeLogo() {
  if (!logo || current.length === 0) return;
  const r = inscribedRect(current[0]);
  const { width, height } = view.size;
  const rect = new paper.Rectangle(
    r.x0 * width,
    r.y0 * height,
    (r.x1 - r.x0) * width,
    (r.y1 - r.y0) * height,
  );
  logo.fitBounds(rect);
  logo.bounds.topLeft = rect.topLeft;
  logo.bringToFront();
}

function startRound() {
  model = nextRound(model);
  const to = toRenderState(model);
  const from = new Map(current.map((e) => [e.id, e]));
  to.forEach((entry, i) => {
    if (from.has(entry.id)) return;
    // Entering PA: starts collapsed at the bottom edge of the screen and
    // grows upward. Its top edge starts as the old bottom edge of the PA
    // above it, so the ribbon seam stays closed throughout the tween.
    const aboveOld = from.get(to[i - 1].id);
    from.set(entry.id, {
      ...entry,
      yTop: 1,
      yBottom: 1,
      topX0: aboveOld.botX0,
      topX1: aboveOld.botX1,
    });
  });
  const progress = { t: 0 };
  animate(progress, {
    t: 1,
    duration: config.transitionMs,
    ease: 'inOutCubic',
    onUpdate: () => {
      current = lerpStates(from, to, progress.t);
      draw();
    },
    onComplete: () => {
      current = to;
      draw();
      setTimeout(startRound, config.holdMs);
    },
  });
}

function fitView() {
  view.viewSize = new paper.Size(window.innerWidth, window.innerHeight);
  draw();
}

window.addEventListener('resize', fitView);
fitView();
setTimeout(startRound, config.holdMs);

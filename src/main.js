import paper from 'paper';
import { animate } from 'animejs';
import { config } from './config.js';
import { createInitialState, nextRound } from './rounds.js';
import { toRenderState, toCorners } from './geometry.js';

paper.setup(document.getElementById('canvas'));
const { view } = paper;

let model = createInitialState();
let current = toRenderState(model);
const paths = new Map(); // id -> paper.Path

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
}

function startRound() {
  model = nextRound(model);
  const to = toRenderState(model);
  const from = new Map(current.map((e) => [e.id, e]));
  for (const entry of to) {
    if (!from.has(entry.id)) {
      // Entering PA: starts collapsed at the bottom edge of the screen,
      // same x-edges as its target, so it purely grows upward.
      from.set(entry.id, { ...entry, yTop: 1, yBottom: 1 });
    }
  }
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

draw();
view.onResize = draw;
setTimeout(startRound, config.holdMs);

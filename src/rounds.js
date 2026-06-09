import { config } from './config.js';

let nextId = 1;

function randomEdge(rng) {
  return config.minEdge + rng() * (1 - config.minEdge);
}

function newPa(rng) {
  return {
    id: nextId++,
    h: 0,
    L: randomEdge(rng),
    orient: rng() < 0.5 ? 1 : -1,
    entering: true,
    exiting: false,
  };
}

// Overlap in x (fraction of width) between upper's bottom edge and
// lower's top edge. Opposite orientations share a canvas side; same
// orientations sit on opposite sides and overlap by L1 + L2 - 1.
export function overlapOf(upper, lower) {
  if (upper.orient !== lower.orient) return Math.min(upper.L, lower.L);
  return upper.L + lower.L - 1;
}

export function createInitialState(rng = Math.random) {
  const span = config.countMax - config.countMin + 1;
  const count = config.countMin + Math.floor(rng() * span);
  const pas = Array.from({ length: count }, () => ({
    ...newPa(rng),
    entering: false,
  }));
  distributeHeights(pas, rng);
  repairOverlaps(pas);
  checkInvariants(pas);
  return pas;
}

// Pure round generator: current rest state -> next rest state.
// PAs are ordered top to bottom. Enter/exit happen only at the bottom.
export function nextRound(current, rng = Math.random) {
  const pas = current
    .filter((pa) => !pa.exiting)
    .map((pa) => ({ ...pa, entering: false }));

  const roll = rng();
  if (roll < config.pCountUp && pas.length < config.countMax) {
    pas.push(newPa(rng)); // enters at the bottom, will grow upward
  } else if (
    roll < config.pCountUp + config.pCountDown &&
    pas.length > config.countMin
  ) {
    pas[pas.length - 1].exiting = true; // bottom PA shrinks away
  }

  for (const pa of pas) {
    pa.L = randomEdge(rng);
    if (rng() < config.pFlip) pa.orient = -pa.orient;
  }

  distributeHeights(pas, rng);
  repairOverlaps(pas);
  checkInvariants(pas);
  return pas;
}

// Alive heights: minHeight guaranteed, remainder split by random
// weights, total exactly 1. Exiting PAs collapse to 0.
function distributeHeights(pas, rng) {
  const alive = pas.filter((pa) => !pa.exiting);
  const weights = alive.map(() => 0.05 + rng());
  const total = weights.reduce((a, b) => a + b, 0);
  const spare = 1 - alive.length * config.minHeight;
  alive.forEach((pa, i) => {
    pa.h = config.minHeight + (spare * weights[i]) / total;
  });
  for (const pa of pas) {
    if (pa.exiting) pa.h = 0;
  }
}

// Widen edges until every adjacent pair overlaps by >= minOverlap.
// Widening an edge can only increase overlaps, so repairs never
// invalidate previously-checked pairs.
function repairOverlaps(pas) {
  for (let i = 0; i < pas.length - 1; i++) {
    const upper = pas[i];
    const lower = pas[i + 1];
    let deficit = config.minOverlap - overlapOf(upper, lower);
    if (deficit <= 0) continue;
    const [shorter, longer] = upper.L <= lower.L ? [upper, lower] : [lower, upper];
    const grow = Math.min(deficit, 1 - shorter.L);
    shorter.L += grow;
    deficit -= grow;
    if (deficit > 0) longer.L = Math.min(1, longer.L + deficit);
  }
}

function checkInvariants(pas) {
  const alive = pas.filter((pa) => !pa.exiting);
  const sum = alive.reduce((a, pa) => a + pa.h, 0);
  console.assert(Math.abs(sum - 1) < 1e-9, 'heights must sum to 1, got', sum);
  console.assert(
    alive.length >= config.countMin && alive.length <= config.countMax,
    'alive count out of range',
    alive.length
  );
  for (const pa of pas) {
    console.assert(
      pa.L >= config.minEdge - 1e-9 && pa.L <= 1 + 1e-9,
      'edge length out of range',
      pa.L
    );
  }
  for (let i = 0; i < pas.length - 1; i++) {
    console.assert(
      overlapOf(pas[i], pas[i + 1]) >= config.minOverlap - 1e-9,
      'adjacent overlap violated at pair',
      i
    );
  }
}

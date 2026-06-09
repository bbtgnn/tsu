# PA Stack Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen generative animation where 1–3 stacked parallelograms (PAs) redistribute height, width, and slant in eased rounds, reading as one folded black ribbon.

**Architecture:** Pure-data keyframe model. `rounds.js` generates the next rest state (all constraints enforced there), `geometry.js` projects fractional state to pixels, `main.js` tweens a flat numeric render-state between rest states with anime.js and redraws Paper.js paths each frame.

**Tech Stack:** Vite, Paper.js, anime.js (v4), Node's built-in `node:test` runner for the pure modules (zero new dev dependencies).

**Spec:** `docs/superpowers/specs/2026-06-10-pa-stack-animation-design.md`

---

## Key domain facts (read first)

All geometry is stored as **fractions of canvas size** (x of width, y of height). A PA at rest is `{ id, h, L, orient }`: `h` = height fraction (alive heights sum to 1), `L` = horizontal edge length fraction, `orient` = `+1` rising / `-1` falling.

- **Rising** (`orient: +1`): bottom edge spans `[0, L]` (flush left), top edge spans `[1−L, 1]` (flush right). **Falling** is the mirror. This makes the long diagonal touch both canvas sides — there is no free horizontal positioning.
- **Overlap rule:** the touching edges of vertical neighbors must share ≥ `minOverlap` in x. Opposite orientations → overlap = `min(L_up, L_low)` (always valid because `minEdge ≥ minOverlap`). Same orientation → overlap = `L_up + L_low − 1`, repaired by widening edges.
- **Enter/exit:** new PAs enter at the **bottom** of the stack growing upward from `h = 0`; the bottom PA exits by shrinking to `h = 0`. Both fall out of the interpolation naturally because the bottom PA's bottom edge is pinned at `y = 1`.

---

### Task 1: Install anime.js

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install**

Run: `npm install animejs`
Expected: `added 1 package` (or similar), `animejs` appears under `dependencies` in `package.json` at `^4.x`.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add animejs for tween easing"
```

---

### Task 2: Config module

**Files:**
- Create: `src/config.js`

- [ ] **Step 1: Write the config**

Create `src/config.js`:

```js
export const config = {
  countMin: 1,
  countMax: 3,
  pCountUp: 0.25,    // chance per round that a PA enters (if below countMax)
  pCountDown: 0.25,  // chance per round that the bottom PA exits (if above countMin)
  pFlip: 0.5,        // chance per PA per round of flipping slant orientation
  transitionMs: 1600,
  holdMs: 1000,
  minHeight: 0.12,   // min resting height fraction per alive PA
  minEdge: 0.15,     // min horizontal edge length, fraction of canvas width
  minOverlap: 0.08,  // min shared x-range between adjacent touching edges
  background: '#ffffff',
  fill: '#111111',
};

// Opposite-orientation neighbors overlap by min(L_up, L_low); that case is
// only guaranteed valid when every edge is at least minOverlap long.
console.assert(
  config.minEdge >= config.minOverlap,
  'config: minEdge must be >= minOverlap'
);
```

- [ ] **Step 2: Sanity check it loads**

Run: `node -e "import('./src/config.js').then(m => console.log(m.config.countMax))"`
Expected: prints `3`, no assertion warning.

- [ ] **Step 3: Commit**

```bash
git add src/config.js
git commit -m "feat: add animation config"
```

---

### Task 3: Geometry module (TDD)

**Files:**
- Create: `tests/geometry.test.js`
- Create: `src/geometry.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/geometry.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { edgesOf, toRenderState, toCorners } from '../src/geometry.js';

test('rising PA: bottom edge flush left, top edge flush right', () => {
  const e = edgesOf({ L: 0.4, orient: 1 });
  assert.deepEqual(e, { botX0: 0, botX1: 0.4, topX0: 0.6, topX1: 1 });
});

test('falling PA is the mirror of rising', () => {
  const e = edgesOf({ L: 0.4, orient: -1 });
  assert.deepEqual(e, { botX0: 0.6, botX1: 1, topX0: 0, topX1: 0.4 });
});

test('toRenderState stacks heights top to bottom', () => {
  const pas = [
    { id: 1, h: 0.25, L: 1, orient: 1 },
    { id: 2, h: 0.75, L: 1, orient: -1 },
  ];
  const [a, b] = toRenderState(pas);
  assert.equal(a.yTop, 0);
  assert.equal(a.yBottom, 0.25);
  assert.equal(b.yTop, 0.25);
  assert.equal(b.yBottom, 1);
});

test('toCorners projects fractions to pixels', () => {
  const entry = { yTop: 0, yBottom: 0.5, topX0: 0.6, topX1: 1, botX0: 0, botX1: 0.4 };
  const corners = toCorners(entry, 1000, 800);
  assert.deepEqual(corners, [
    [600, 0],
    [1000, 0],
    [400, 400],
    [0, 400],
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/geometry.test.js`
Expected: FAIL — `Cannot find module '../src/geometry.js'`.

- [ ] **Step 3: Implement geometry.js**

Create `src/geometry.js`:

```js
// Pure geometry: PA descriptors (fractions of canvas size) -> render
// entries -> pixel corners. No Paper.js, no DOM.

// Edge x-intervals derived from edge length and orientation.
// Rising (+1): bottom edge flush left, top edge flush right. Falling: mirror.
// This pins the long diagonal to both canvas sides.
export function edgesOf(pa) {
  if (pa.orient === 1) {
    return { botX0: 0, botX1: pa.L, topX0: 1 - pa.L, topX1: 1 };
  }
  return { botX0: 1 - pa.L, botX1: 1, topX0: 0, topX1: pa.L };
}

// Rest state (PAs top to bottom) -> flat numeric render entries.
export function toRenderState(pas) {
  const entries = [];
  let y = 0;
  for (const pa of pas) {
    const { botX0, botX1, topX0, topX1 } = edgesOf(pa);
    entries.push({
      id: pa.id,
      yTop: y,
      yBottom: y + pa.h,
      botX0,
      botX1,
      topX0,
      topX1,
    });
    y += pa.h;
  }
  return entries;
}

// Render entry (fractions) -> 4 pixel corners, clockwise from top-left.
export function toCorners(entry, width, height) {
  return [
    [entry.topX0 * width, entry.yTop * height],
    [entry.topX1 * width, entry.yTop * height],
    [entry.botX1 * width, entry.yBottom * height],
    [entry.botX0 * width, entry.yBottom * height],
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/geometry.test.js`
Expected: PASS — 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/geometry.js tests/geometry.test.js
git commit -m "feat: add pure geometry module for PA projection"
```

---

### Task 4: Round generator (TDD)

**Files:**
- Create: `tests/rounds.test.js`
- Create: `src/rounds.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/rounds.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, nextRound, overlapOf } from '../src/rounds.js';
import { config } from '../src/config.js';

// Deterministic LCG so test runs are reproducible.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function aliveOf(pas) {
  return pas.filter((pa) => !pa.exiting);
}

test('overlapOf: opposite orientations overlap by the shorter edge', () => {
  assert.equal(overlapOf({ L: 0.3, orient: 1 }, { L: 0.8, orient: -1 }), 0.3);
});

test('overlapOf: same orientation overlap is L1 + L2 - 1', () => {
  const v = overlapOf({ L: 0.7, orient: 1 }, { L: 0.6, orient: 1 });
  assert.ok(Math.abs(v - 0.3) < 1e-12);
});

test('invariants hold across many rounds', () => {
  const rng = makeRng(42);
  let state = createInitialState(rng);
  for (let round = 0; round < 500; round++) {
    state = nextRound(state, rng);
    const alive = aliveOf(state);
    const sum = alive.reduce((a, pa) => a + pa.h, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `heights sum to 1 (round ${round})`);
    assert.ok(alive.length >= config.countMin && alive.length <= config.countMax);
    for (const pa of state) {
      assert.ok(pa.h >= 0);
      assert.ok(pa.L >= config.minEdge - 1e-9 && pa.L <= 1 + 1e-9);
      if (!pa.exiting) assert.ok(pa.h >= config.minHeight - 1e-9);
    }
    for (let i = 0; i < state.length - 1; i++) {
      assert.ok(
        overlapOf(state[i], state[i + 1]) >= config.minOverlap - 1e-9,
        `overlap (round ${round}, pair ${i})`
      );
    }
  }
});

test('entering PAs appear only at the bottom of the stack', () => {
  const rng = makeRng(7);
  let state = createInitialState(rng);
  let sawEnter = false;
  for (let round = 0; round < 300; round++) {
    state = nextRound(state, rng);
    state.forEach((pa, i) => {
      if (pa.entering) {
        sawEnter = true;
        assert.equal(i, state.length - 1);
      }
    });
  }
  assert.ok(sawEnter, 'expected at least one enter in 300 rounds');
});

test('exiting PAs are only at the bottom, get h = 0, and are gone next round', () => {
  const rng = makeRng(99);
  let state = createInitialState(rng);
  let sawExit = false;
  for (let round = 0; round < 300; round++) {
    const prev = state;
    state = nextRound(state, rng);
    for (const pa of prev) {
      if (pa.exiting) {
        assert.ok(!state.some((p) => p.id === pa.id), 'exited PA removed next round');
      }
    }
    state.forEach((pa, i) => {
      if (pa.exiting) {
        sawExit = true;
        assert.equal(i, state.length - 1);
        assert.equal(pa.h, 0);
      }
    });
  }
  assert.ok(sawExit, 'expected at least one exit in 300 rounds');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/rounds.test.js`
Expected: FAIL — `Cannot find module '../src/rounds.js'`.

- [ ] **Step 3: Implement rounds.js**

Create `src/rounds.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/rounds.test.js`
Expected: PASS — 5 passing tests, no `console.assert` warnings in output.

- [ ] **Step 5: Run the full suite**

Run: `node --test tests/`
Expected: PASS — 9 passing tests total.

- [ ] **Step 6: Commit**

```bash
git add src/rounds.js tests/rounds.test.js
git commit -m "feat: add pure round generator with overlap and height constraints"
```

---

### Task 5: Animation driver and rendering

**Files:**
- Rewrite: `src/main.js` (replace the placeholder sine-wave demo entirely)
- Modify: `src/style.css` (background `#111` → white)
- Modify: `index.html` (title only)

- [ ] **Step 1: Rewrite main.js**

Replace the full contents of `src/main.js` with:

```js
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
```

- [ ] **Step 2: Update style.css**

In `src/style.css`, change the body background from `#111` to white:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #ffffff;
}

#canvas {
  width: 100%;
  height: 100%;
  display: block;
}
```

- [ ] **Step 3: Update the page title**

In `index.html`, change `<title>Paper.js Project</title>` to `<title>PA Stack</title>`.

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev`, open the printed URL. Verify:

1. Full-screen white canvas with 1–3 solid black parallelogram bands stacked vertically, filling the entire height.
2. Every PA's long diagonal reaches both the left and right canvas edges at rest.
3. Roughly every ~2.6 s the stack eases to a new configuration (heights, widths, slants change), then rests.
4. Watch a few rounds: occasionally a PA grows in from the bottom edge upward, or the bottom PA shrinks down and disappears.
5. Adjacent PAs always stay connected along their shared horizontal line (one folded ribbon, no floating pieces) at rest.
6. Resize the window mid-animation and at rest — the composition re-projects instantly with no distortion or stale sizes.
7. Open the devtools console — no errors, no `console.assert` warnings.

- [ ] **Step 5: Verify production build**

Run: `npm run build`
Expected: `✓ built` with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/main.js src/style.css index.html
git commit -m "feat: animate PA stack with eased rounds, enter/exit, resize"
```

---

### Task 6: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite README**

Replace the full contents of `README.md` with:

```markdown
# PA Stack

A full-screen generative animation built with [Paper.js](http://paperjs.org/),
[anime.js](https://animejs.com/) and [Vite](https://vitejs.dev/).

A vertical stack of 1–3 parallelograms fills the screen. In timed rounds the
stack redistributes its height, each parallelogram changes width and slant,
and parallelograms enter (growing up from the bottom) or exit (shrinking
down). Each parallelogram's long diagonal always touches both sides of the
canvas, and adjacent parallelograms always share part of their horizontal
edge, so the stack reads as one folded black ribbon.

Design spec: `docs/superpowers/specs/2026-06-10-pa-stack-animation-design.md`

## Getting started

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — dev server with hot reload
- `npm run build` — production build into `dist/`
- `npm run preview` — preview the production build
- `node --test tests/` — run unit tests for the pure modules

## Structure

- `src/config.js` — all tunables (counts, durations, size constraints, colors)
- `src/rounds.js` — pure round generator; all geometry constraints enforced here
- `src/geometry.js` — pure projection from fractional state to pixel corners
- `src/main.js` — Paper.js rendering + anime.js tween driving
- `tests/` — `node:test` unit tests for `rounds.js` and `geometry.js`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: describe PA stack animation and project structure"
```

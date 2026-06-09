# PA Stack Animation — Design

**Date:** 2026-06-10
**Status:** Approved

## Overview

A full-screen, responsive generative animation built with Paper.js. A vertical stack of 1–3 parallelograms ("PAs") fills the screen. In timed rounds, the stack redistributes its height, each PA changes width and slant orientation, and PAs occasionally enter or exit at the bottom of the stack. Each round eases from the current rest state to the next, holds briefly, then repeats.

## Core geometry

A PA is a flat 2D parallelogram with two horizontal edges (top and bottom) and two slanted parallel sides. Invariants at every rest state:

- The PA's **long diagonal touches both the left and right canvas edges**. Placement is therefore fully derived from edge length and orientation — there is no free horizontal positioning:
  - **Rising** (1–3 quadrant, `orient = +1`): bottom edge flush left, spanning `[0, L]`; top edge flush right, spanning `[1−L, 1]` (x as fraction of canvas width).
  - **Falling** (2–4 quadrant, `orient = −1`): mirrored — bottom edge flush right, top edge flush left.
- The stack's heights sum to the full canvas height (entering/exiting PAs contribute their animated height).
- **Shared-edge rule:** the bottom edge of each PA and the top edge of the PA below it lie on the same horizontal line and must overlap in x by at least `minOverlap`, so the stack reads as one connected, folded ribbon.
  - Opposite-orientation neighbors share a canvas side at the touching line → overlap equals `min(L_upper, L_lower)`. Config must satisfy `L_min ≥ minOverlap` so this case is always valid.
  - Same-orientation neighbors overlap iff `L_upper + L_lower ≥ 1 + minOverlap`. The generator enforces this.

"Narrow vs wide" refers to the horizontal edge length `L`: a narrow PA is a thin slanted blade (diagonal still spans the full width); a wide PA approaches a full-width band.

## Architecture

Vite + Paper.js (rendering) + anime.js (easing/tweening). Four modules:

| File | Responsibility |
|---|---|
| `src/config.js` | All tunables: PA count range (1–3), transition duration (~1.6 s), hold duration (~1 s), min height fraction, min edge length `L_min`, `minOverlap`, colors. |
| `src/rounds.js` | **Pure** state generator: `nextRound(currentState) → targetState`. All rules and constraints live here. No Paper, no DOM. |
| `src/geometry.js` | Pure: PA descriptor + canvas size → 4 corner points in pixels. |
| `src/main.js` | Paper setup, render loop, anime.js tween driving, round scheduling, resize handling. |

## Data model

All values are **fractions of canvas size** (this makes responsiveness free). A PA at rest:

```js
{ id, h, L, orient }
// h: height fraction of canvas (heights sum to 1)
// L: horizontal edge length as fraction of canvas width
// orient: +1 rising / −1 falling
```

For animation, each PA is lowered to six numbers that get tweened directly:

```js
{ yTop, yBottom, botX0, botX1, topX0, topX1 }
```

Orientation flips animate naturally as edges sliding across the canvas.

## Round generation rules (`rounds.js`)

- **Count:** random walk — stay / +1 / −1 with weighted probabilities, clamped to [1, 3].
- **Enter:** a new PA is pushed at the **bottom** of the stack with `h = 0` and tweens up to its allotted height (grows upward from the bottom edge of the screen).
- **Exit:** the **bottom** PA tweens `h → 0` (its top edge slides down) and is removed from the model when the round completes. The rest of the stack re-flows to fill the screen.
- **Heights:** random weights normalized to sum to 1 across surviving PAs; each clamped to a minimum height fraction.
- **Edge length:** random in `[L_min, 1]`.
- **Orientation:** random flip with a per-round probability.
- **Overlap repair:** if a same-orientation adjacent pair violates `L_up + L_low ≥ 1 + minOverlap`, repair deterministically (bump one length, or flip one orientation). No rejection-sampling loops.

## Animation lifecycle

1. Compute `targetState = nextRound(currentState)`.
2. One anime.js tween animates the flat numeric render-state current → target, `easeInOutCubic`, ~1.6 s.
3. Hold ~1 s at rest.
4. Repeat.

Paper rebuilds each 4-segment path from the current numbers every frame (cheap). The diagonal-touches-both-sides invariant holds exactly at rest states; mid-transition it may drift — that is the intended morph.

## Rendering & responsiveness

- Solid black PAs on a white background, no stroke (minimal monochrome).
- PAs meet only along shared horizontal lines (no area overlap), so the silhouette reads as a single folded black ribbon.
- Full-screen canvas with Paper's `resize` attribute; on window resize, fractional state is re-projected to pixels immediately. No state invalidation.

## Error handling & testing

- `rounds.js` is pure; dev-mode `console.assert`s validate invariants after each generation: heights sum to 1, all adjacent overlaps ≥ `minOverlap`, lengths within `[L_min, 1]`, count within [1, 3].
- No test framework for now; the generator's purity allows adding vitest later without refactoring.

## Out of scope

- User interaction (rounds are timer-driven only).
- Colors, gradients, textures beyond monochrome.
- More than 3 PAs (config-ready, but capped at 3 for now).

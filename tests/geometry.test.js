import test from 'node:test';
import assert from 'node:assert/strict';
import { edgesOf, toRenderState, toCorners, inscribedRect } from '../src/geometry.js';

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

test('inscribedRect of an unsheared entry is the full bounds', () => {
  const entry = { yTop: 0.1, yBottom: 0.5, topX0: 0.2, topX1: 0.8, botX0: 0.2, botX1: 0.8 };
  assert.deepEqual(inscribedRect(entry), { x0: 0.2, x1: 0.8, y0: 0.1, y1: 0.5 });
});

test('inscribedRect spans full height when edges overlap enough (rising, L=0.75)', () => {
  // top [0.25, 1], bottom [0, 0.75]: shear 0.25 <= W/2, full height.
  const entry = { yTop: 0, yBottom: 0.4, topX0: 0.25, topX1: 1, botX0: 0, botX1: 0.75 };
  assert.deepEqual(inscribedRect(entry), { x0: 0.25, x1: 0.75, y0: 0, y1: 0.4 });
});

test('inscribedRect clips height at the max-area point (rising, L=0.5)', () => {
  // W = 0.5, shear d = -0.5: optimal dy = 0.5, losing 0.25 on the right.
  const entry = { yTop: 0, yBottom: 0.4, topX0: 0.5, topX1: 1, botX0: 0, botX1: 0.5 };
  assert.deepEqual(inscribedRect(entry), { x0: 0.5, x1: 0.75, y0: 0, y1: 0.2 });
});

test('inscribedRect mirrors for falling orientation', () => {
  const entry = { yTop: 0, yBottom: 0.4, topX0: 0, topX1: 0.5, botX0: 0.5, botX1: 1 };
  assert.deepEqual(inscribedRect(entry), { x0: 0.25, x1: 0.5, y0: 0, y1: 0.2 });
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

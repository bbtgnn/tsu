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

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

test('a PA survives at least minRoundsOn rounds before exiting', () => {
  const rng = makeRng(123);
  let state = createInitialState(rng);
  let sawYoungBottom = false;
  for (let round = 0; round < 1000; round++) {
    state = nextRound(state, rng);
    for (const pa of state) {
      if (pa.exiting) {
        assert.ok(
          pa.age >= config.minRoundsOn,
          `PA exited at age ${pa.age} (round ${round})`
        );
      }
    }
    const bottom = state[state.length - 1];
    if (!bottom.exiting && bottom.age < config.minRoundsOn) sawYoungBottom = true;
  }
  assert.ok(sawYoungBottom, 'expected the rule to actually be exercised');
});

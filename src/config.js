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

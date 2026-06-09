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

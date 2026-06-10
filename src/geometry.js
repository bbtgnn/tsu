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

// Maximal axis-aligned rectangle inscribed in a render entry (a
// parallelogram with horizontal top/bottom edges), anchored to the top
// edge. Width at any y is constant (W); spanning down by a fraction dy of
// the height shears the usable x-range by |d|*dy, so the area
// (W - |d|*dy) * dy peaks at dy = W / (2|d|), clamped to the full height.
export function inscribedRect(entry) {
  const W = entry.topX1 - entry.topX0;
  const d = entry.botX0 - entry.topX0; // horizontal shear, top -> bottom
  const dy = d === 0 ? 1 : Math.min(1, W / (2 * Math.abs(d)));
  const shear = Math.abs(d) * dy;
  return {
    x0: d > 0 ? entry.topX0 + shear : entry.topX0,
    x1: d > 0 ? entry.topX1 : entry.topX1 - shear,
    y0: entry.yTop,
    y1: entry.yTop + dy * (entry.yBottom - entry.yTop),
  };
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

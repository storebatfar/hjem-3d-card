export function wallPieces(openings, length, height) {
  const out = [];
  let pos = 0;
  for (const o of openings) {
    if (o.from > pos) out.push({ a: pos, b: o.from, y0: 0, y1: height, kind: 'wall' });
    if (o.sill > 0) out.push({ a: o.from, b: o.to, y0: 0, y1: o.sill, kind: 'wall' });
    if (o.head < height) out.push({ a: o.from, b: o.to, y0: o.head, y1: height, kind: 'wall' });
    out.push({ a: o.from, b: o.to, y0: o.sill, y1: o.head, kind: o.kind });
    pos = o.to;
  }
  if (pos < length) out.push({ a: pos, b: length, y0: 0, y1: height, kind: 'wall' });
  return out;
}

export function wallBoxes(side, shell, openings) {
  const { width: W, depth: D, wallHeight: H, wallThickness: T } = shell;
  const alongX = side === 'north' || side === 'south';
  const [c0, c1] = { north: [0, T], south: [D - T, D], west: [0, T], east: [W - T, W] }[side];
  let pieces = wallPieces(openings, alongX ? W : D, H);
  if (!alongX) {
    // north/south walls own the corners; trim west/east so the corners are not built twice
    pieces = pieces.map(p => ({ ...p, a: Math.max(p.a, T), b: Math.min(p.b, D - T) })).filter(p => p.b > p.a);
  }
  return pieces.map(p => alongX
    ? { x0: p.a, x1: p.b, y0: p.y0, y1: p.y1, z0: c0, z1: c1, kind: p.kind, side }
    : { x0: c0, x1: c1, y0: p.y0, y1: p.y1, z0: p.a, z1: p.b, kind: p.kind, side });
}

const FRAME = 0.05;

export function openingParts(b) {
  const alongX = b.side === 'north' || b.side === 'south';
  const a0 = alongX ? b.x0 : b.z0, a1 = alongX ? b.x1 : b.z1;
  const c = alongX ? (b.z0 + b.z1) / 2 : (b.x0 + b.x1) / 2;
  const piece = (p0, p1, y0, y1, half) => alongX
    ? { x0: p0, x1: p1, y0, y1, z0: c - half, z1: c + half }
    : { x0: c - half, x1: c + half, y0, y1, z0: p0, z1: p1 };
  const pane = piece(a0, a1, b.y0, b.y1, 0.03);
  const frame = [
    piece(a0, a0 + FRAME, b.y0, b.y1, 0.05),
    piece(a1 - FRAME, a1, b.y0, b.y1, 0.05),
    piece(a0, a1, b.y1 - FRAME, b.y1, 0.05),
  ];
  if (b.kind === 'window') frame.push(piece(a0, a1, b.y0, b.y0 + FRAME, 0.05));
  return { pane, frame };
}

export function roofGeometry(shell, roof) {
  const pitchRad = roof.pitch * Math.PI / 180;
  const half = shell.depth / 2;
  const rise = half * Math.tan(pitchRad);
  return {
    pitchRad, half, rise,
    ridgeY: shell.wallHeight + rise,
    slopeLength: (half + roof.overhang) / Math.cos(pitchRad),
    width: shell.width + 2 * roof.gableOverhang,
  };
}

export function panelRects(solar, gap = 0.04) {
  const out = [];
  for (const s of solar) {
    const pw = (s.x1 - s.x0) / s.cols, ph = (s.to - s.from) / s.rows;
    for (let i = 0; i < s.cols; i++) {
      for (let j = 0; j < s.rows; j++) {
        out.push({
          x0: s.x0 + i * pw + gap / 2, x1: s.x0 + (i + 1) * pw - gap / 2,
          from: s.from + j * ph + gap / 2, to: s.from + (j + 1) * ph - gap / 2,
        });
      }
    }
  }
  return out;
}

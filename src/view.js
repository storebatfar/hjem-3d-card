// Directions from the target toward the camera. Idle looks in from the south-west over the garden;
// plan looks almost straight down, tilted slightly so walls still read as 3D.
const IDLE_DIR = [-0.45, 0.6, 0.66];
const PLAN_DIR = [-0.12, 0.88, 0.46];
const DIST = 60;

const norm = v => { const l = Math.hypot(...v); return v.map(c => c / l); };
const along = (from, dir, k) => from.map((c, i) => c + dir[i] * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function ease(t) {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function fitView(dir, points, aspect, margin) {
  const safeAspect = (aspect > 0 && Number.isFinite(aspect)) ? aspect : 16 / 9;
  const f = norm([-dir[0], -dir[1], -dir[2]]);
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);

  let minR = Infinity, maxR = -Infinity, minU = Infinity, maxU = -Infinity;
  let centroidF = 0;
  for (const p of points) {
    const pR = dot(p, r), pU = dot(p, u);
    minR = Math.min(minR, pR); maxR = Math.max(maxR, pR);
    minU = Math.min(minU, pU); maxU = Math.max(maxU, pU);
    centroidF += dot(p, f);
  }
  centroidF /= points.length;

  const bboxW = maxR - minR, bboxH = maxU - minU;
  const cx = (minR + maxR) / 2, cy = (minU + maxU) / 2;
  const halfHeight = Math.max(bboxH / 2, (bboxW / 2) / safeAspect) * margin;

  const target = [
    cx * r[0] + cy * u[0] + centroidF * f[0],
    cx * r[1] + cy * u[1] + centroidF * f[1],
    cx * r[2] + cy * u[2] + centroidF * f[2],
  ];
  const pos = along(target, dir, DIST);

  return { pos, target, halfHeight };
}

export function computeViews(house) {
  const { plot, shell, roof, hedges } = house;

  // Idle view points: 8 corners of plot box from y = -0.32 to max hedge height (or 1.6), plus ridge ends
  const maxHedgeH = hedges && hedges.length > 0 ? Math.max(...hedges.map(h => h.h || 0)) : 0;
  const topY = Math.max(maxHedgeH, 1.6);
  const pitchRad = roof.pitch * Math.PI / 180;
  const ridgeY = shell.wallHeight + (shell.depth / 2) * Math.tan(pitchRad);

  const idlePoints = [
    [plot.x0, -0.32, plot.z0], [plot.x1, -0.32, plot.z0], [plot.x0, -0.32, plot.z1], [plot.x1, -0.32, plot.z1],
    [plot.x0, topY, plot.z0], [plot.x1, topY, plot.z0], [plot.x0, topY, plot.z1], [plot.x1, topY, plot.z1],
    [0, ridgeY, shell.depth / 2], [shell.width, ridgeY, shell.depth / 2],
  ];

  // Plan view points: house footprint corners at y = 0 and y = wallHeight
  const planPoints = [
    [0, 0, 0], [shell.width, 0, 0], [0, 0, shell.depth], [shell.width, 0, shell.depth],
    [0, shell.wallHeight, 0], [shell.width, shell.wallHeight, 0], [0, shell.wallHeight, shell.depth], [shell.width, shell.wallHeight, shell.depth],
  ];

  return {
    idle: { dir: IDLE_DIR, points: idlePoints, margin: 1.04 },
    plan: { dir: PLAN_DIR, points: planPoints, margin: 1.06 },
  };
}

export function viewAt(views, t, aspect) {
  const e = ease(t);
  const lerp = (a, b) => (e === 0 ? a : e === 1 ? b : a + (b - a) * e);
  const { idle: A, plan: B } = views;
  const idleView = fitView(A.dir, A.points, aspect, A.margin);
  const planView = fitView(B.dir, B.points, aspect, B.margin);
  return {
    pos: idleView.pos.map((c, i) => lerp(c, planView.pos[i])),
    target: idleView.target.map((c, i) => lerp(c, planView.target[i])),
    halfHeight: lerp(idleView.halfHeight, planView.halfHeight),
  };
}

export function roofAt(t) {
  const e = ease(t);
  return { lift: e * 6, opacity: 1 - e, visible: e < 0.999 };
}

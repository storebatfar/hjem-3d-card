// Directions from the target toward the camera. Idle looks in from the south-west over the garden;
// plan looks almost straight down, tilted slightly so walls still read as 3D.
const IDLE_DIR = [-0.45, 0.6, 0.66];
const PLAN_DIR = [-0.12, 0.88, 0.46];
const DIST = 60;

const norm = v => { const l = Math.hypot(...v); return v.map(c => c / l); };
const along = (from, dir, k) => from.map((c, i) => c + dir[i] * k);

export function ease(t) {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function computeViews(house) {
  const { plot, shell } = house;
  const span = Math.max(plot.x1 - plot.x0, plot.z1 - plot.z0);
  const idleTarget = [(plot.x0 + plot.x1) / 2, 0, (plot.z0 + plot.z1) / 2];
  const planTarget = [shell.width / 2, 0, shell.depth / 2 + 0.9];
  return {
    idle: { target: idleTarget, pos: along(idleTarget, norm(IDLE_DIR), DIST), halfHeight: span * 0.36, minHalfWidth: span * 0.55 },
    plan: { target: planTarget, pos: along(planTarget, norm(PLAN_DIR), DIST), halfHeight: shell.width * 0.375, minHalfWidth: shell.width * 0.56 },
  };
}

export function fitHalfHeight(halfHeight, minHalfWidth, aspect) {
  if (!(aspect > 0) || !Number.isFinite(aspect)) return halfHeight;
  return Math.max(halfHeight, minHalfWidth / aspect);
}

export function viewAt(views, t, aspect) {
  const e = ease(t);
  const lerp = (a, b) => (e === 0 ? a : e === 1 ? b : a + (b - a) * e);
  const { idle: A, plan: B } = views;
  return {
    pos: A.pos.map((c, i) => lerp(c, B.pos[i])),
    target: A.target.map((c, i) => lerp(c, B.target[i])),
    halfHeight: lerp(fitHalfHeight(A.halfHeight, A.minHalfWidth, aspect), fitHalfHeight(B.halfHeight, B.minHalfWidth, aspect)),
  };
}

export function roofAt(t) {
  const e = ease(t);
  return { lift: e * 6, opacity: 1 - e, visible: e < 0.999 };
}

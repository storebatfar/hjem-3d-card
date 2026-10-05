import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateHouse } from '../src/config.js';
import { ease, computeViews, fitView, viewAt, roofAt } from '../src/view.js';

const house = validateHouse(JSON.parse(readFileSync(new URL('./fixtures/example-house.json', import.meta.url))));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('ease is clamped, symmetric and monotonic', () => {
  close(ease(0), 0); close(ease(1), 1); close(ease(0.5), 0.5);
  close(ease(-3), 0); close(ease(7), 1);
  let prev = -1;
  for (let i = 0; i <= 100; i++) { const v = ease(i / 100); assert.ok(v >= prev); prev = v; }
});

test('fitView with example house projects all points inside frame with balanced margins', () => {
  const v = computeViews(house);
  const aspects = [1316 / 700, 16 / 9, 0.6];

  for (const aspect of aspects) {
    // Idle view
    const idle = fitView(v.idle.dir, v.idle.points, aspect, v.idle.margin);
    const hh = idle.halfHeight;
    const hw = hh * (aspect > 0 && Number.isFinite(aspect) ? aspect : 16 / 9);

    // Build camera basis
    const f = [idle.pos[0] - idle.target[0], idle.pos[1] - idle.target[1], idle.pos[2] - idle.target[2]];
    const fl = Math.hypot(...f);
    f[0] /= fl; f[1] /= fl; f[2] /= fl;
    const r = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0];
    const rl = Math.hypot(...r);
    r[0] /= rl; r[1] /= rl; r[2] /= rl;
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];

    let minProjR = Infinity, maxProjR = -Infinity, minProjU = Infinity, maxProjU = -Infinity;
    for (const p of v.idle.points) {
      const rel = [p[0] - idle.target[0], p[1] - idle.target[1], p[2] - idle.target[2]];
      const pR = rel[0] * r[0] + rel[1] * r[1] + rel[2] * r[2];
      const pU = rel[0] * u[0] + rel[1] * u[1] + rel[2] * u[2];
      minProjR = Math.min(minProjR, pR); maxProjR = Math.max(maxProjR, pR);
      minProjU = Math.min(minProjU, pU); maxProjU = Math.max(maxProjU, pU);
      assert.ok(pR >= -hw && pR <= hw, `idle point ${p} projects inside horizontal bounds at aspect ${aspect}`);
      assert.ok(pU >= -hh && pU <= hh, `idle point ${p} projects inside vertical bounds at aspect ${aspect}`);
    }

    // Check balanced margins
    assert.ok(Math.abs((hw + minProjR) - (hw - maxProjR)) < 1e-6 * hw, `idle horizontal margins balanced at aspect ${aspect}`);
    assert.ok(Math.abs((hh + minProjU) - (hh - maxProjU)) < 1e-6 * hh, `idle vertical margins balanced at aspect ${aspect}`);

    // Plan view
    const plan = fitView(v.plan.dir, v.plan.points, aspect, v.plan.margin);
    const hhp = plan.halfHeight;
    const hwp = hhp * (aspect > 0 && Number.isFinite(aspect) ? aspect : 16 / 9);

    const fp = [plan.pos[0] - plan.target[0], plan.pos[1] - plan.target[1], plan.pos[2] - plan.target[2]];
    const flp = Math.hypot(...fp);
    fp[0] /= flp; fp[1] /= flp; fp[2] /= flp;
    const rp = [fp[1] * 0 - fp[2] * 1, fp[2] * 0 - fp[0] * 0, fp[0] * 1 - fp[1] * 0];
    const rlp = Math.hypot(...rp);
    rp[0] /= rlp; rp[1] /= rlp; rp[2] /= rlp;
    const up = [rp[1] * fp[2] - rp[2] * fp[1], rp[2] * fp[0] - rp[0] * fp[2], rp[0] * fp[1] - rp[1] * fp[0]];

    let minProjRp = Infinity, maxProjRp = -Infinity, minProjUp = Infinity, maxProjUp = -Infinity;
    for (const p of v.plan.points) {
      const rel = [p[0] - plan.target[0], p[1] - plan.target[1], p[2] - plan.target[2]];
      const pR = rel[0] * rp[0] + rel[1] * rp[1] + rel[2] * rp[2];
      const pU = rel[0] * up[0] + rel[1] * up[1] + rel[2] * up[2];
      minProjRp = Math.min(minProjRp, pR); maxProjRp = Math.max(maxProjRp, pR);
      minProjUp = Math.min(minProjUp, pU); maxProjUp = Math.max(maxProjUp, pU);
      assert.ok(pR >= -hwp && pR <= hwp, `plan point ${p} projects inside horizontal bounds at aspect ${aspect}`);
      assert.ok(pU >= -hhp && pU <= hhp, `plan point ${p} projects inside vertical bounds at aspect ${aspect}`);
    }

    assert.ok(Math.abs((hwp + minProjRp) - (hwp - maxProjRp)) < 1e-6 * hwp, `plan horizontal margins balanced at aspect ${aspect}`);
    assert.ok(Math.abs((hhp + minProjUp) - (hhp - maxProjUp)) < 1e-6 * hhp, `plan vertical margins balanced at aspect ${aspect}`);
  }
});

test('fitView survives 0 / NaN / Infinity aspect', () => {
  const v = computeViews(house);
  for (const aspect of [0, NaN, Infinity]) {
    const idle = fitView(v.idle.dir, v.idle.points, aspect, v.idle.margin);
    assert.ok(Number.isFinite(idle.halfHeight), `idle halfHeight is finite for aspect ${aspect}`);
    assert.ok(idle.pos.every(Number.isFinite), `idle pos is finite for aspect ${aspect}`);
    assert.ok(idle.target.every(Number.isFinite), `idle target is finite for aspect ${aspect}`);

    const plan = fitView(v.plan.dir, v.plan.points, aspect, v.plan.margin);
    assert.ok(Number.isFinite(plan.halfHeight), `plan halfHeight is finite for aspect ${aspect}`);
    assert.ok(plan.pos.every(Number.isFinite), `plan pos is finite for aspect ${aspect}`);
    assert.ok(plan.target.every(Number.isFinite), `plan target is finite for aspect ${aspect}`);
  }
});

test('viewAt hits both end views exactly', () => {
  const v = computeViews(house);
  const aspect = 16 / 9;
  const a = viewAt(v, 0, aspect), b = viewAt(v, 1, aspect);
  const idle = fitView(v.idle.dir, v.idle.points, aspect, v.idle.margin);
  const plan = fitView(v.plan.dir, v.plan.points, aspect, v.plan.margin);

  assert.deepEqual(a.pos, idle.pos);
  assert.deepEqual(a.target, idle.target);
  close(a.halfHeight, idle.halfHeight);

  assert.deepEqual(b.pos, plan.pos);
  assert.deepEqual(b.target, plan.target);
  close(b.halfHeight, plan.halfHeight);
});

test('roof is down and solid at t=0, lifted and gone at t=1', () => {
  assert.deepEqual(roofAt(0), { lift: 0, opacity: 1, visible: true });
  const r = roofAt(1);
  close(r.lift, 6); close(r.opacity, 0); assert.equal(r.visible, false);
});

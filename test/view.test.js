import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateHouse } from '../src/config.js';
import { ease, computeViews, fitHalfHeight, viewAt, roofAt } from '../src/view.js';

const house = validateHouse(JSON.parse(readFileSync(new URL('./fixtures/example-house.json', import.meta.url))));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('ease is clamped, symmetric and monotonic', () => {
  close(ease(0), 0); close(ease(1), 1); close(ease(0.5), 0.5);
  close(ease(-3), 0); close(ease(7), 1);
  let prev = -1;
  for (let i = 0; i <= 100; i++) { const v = ease(i / 100); assert.ok(v >= prev); prev = v; }
});

test('views aim at the plot centre (idle) and the house (plan)', () => {
  const v = computeViews(house);
  assert.deepEqual(v.idle.target, [6, 0, 5]);
  assert.deepEqual(v.plan.target, [6, 0, 4.9]);
  assert.ok(v.idle.pos[1] > 0 && v.plan.pos[1] > 0);
  assert.ok(v.idle.pos[0] < v.idle.target[0], 'idle camera is west of the target');
  assert.ok(v.idle.pos[2] > v.idle.target[2], 'idle camera is south of the target');
  assert.ok(v.plan.halfHeight < v.idle.halfHeight, 'plan is zoomed in');
});

test('viewAt hits both end views exactly', () => {
  const v = computeViews(house);
  const a = viewAt(v, 0, 16 / 9), b = viewAt(v, 1, 16 / 9);
  assert.deepEqual(a.pos, v.idle.pos); assert.deepEqual(a.target, v.idle.target);
  assert.deepEqual(b.pos, v.plan.pos); assert.deepEqual(b.target, v.plan.target);
});

test('fitHalfHeight survives 0 / NaN / Infinity aspect and widens for portrait', () => {
  assert.equal(fitHalfHeight(10, 18, 0), 10);
  assert.equal(fitHalfHeight(10, 18, NaN), 10);
  assert.equal(fitHalfHeight(10, 18, Infinity), 10);
  assert.equal(fitHalfHeight(10, 18, 16 / 9), 10.125);
  assert.equal(fitHalfHeight(10, 18, 0.6), 30);
  assert.equal(fitHalfHeight(10, 5, 2), 10);
});

test('roof is down and solid at t=0, lifted and gone at t=1', () => {
  assert.deepEqual(roofAt(0), { lift: 0, opacity: 1, visible: true });
  const r = roofAt(1);
  close(r.lift, 6); close(r.opacity, 0); assert.equal(r.visible, false);
});

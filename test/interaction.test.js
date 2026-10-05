import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInteraction } from '../src/interaction.js';

const run = (ia, from, to, step = 16) => { let s; for (let at = from; at <= to; at += step) s = ia.tick(at); return s; };

test('starts idle at t=0', () => {
  assert.deepEqual(createInteraction({ idleTimeoutMs: 60000 }).snapshot(), { mode: 'idle', t: 0, animating: false });
});

test('tap opens; the animation ends in plan at t=1', () => {
  const ia = createInteraction({ idleTimeoutMs: 60000 });
  assert.equal(ia.tap(0, 'empty').mode, 'opening');
  const s = run(ia, 16, 2000);
  assert.deepEqual(s, { mode: 'plan', t: 1, animating: false });
});

test('in plan: tapping the house keeps plan, tapping empty closes to idle', () => {
  const ia = createInteraction({ idleTimeoutMs: 60000 });
  ia.tap(0, 'house'); run(ia, 16, 2000);
  assert.equal(ia.tap(2100, 'house').mode, 'plan');
  assert.equal(ia.tap(2200, 'empty').mode, 'closing');
  assert.deepEqual(run(ia, 2216, 4000), { mode: 'idle', t: 0, animating: false });
});

test('idle timeout closes plan after exactly idleTimeoutMs without input', () => {
  const ia = createInteraction({ idleTimeoutMs: 60000 });
  ia.tap(0, 'house'); run(ia, 16, 2000);
  assert.equal(ia.tick(59999).mode, 'plan');
  assert.equal(ia.tick(60000).mode, 'closing');
});

test('a tap on the house in plan restarts the idle timer', () => {
  const ia = createInteraction({ idleTimeoutMs: 60000 });
  ia.tap(0, 'house'); run(ia, 16, 2000);
  ia.tap(50000, 'house');
  assert.equal(ia.tick(60000).mode, 'plan');
  assert.equal(ia.tick(110000).mode, 'closing');
});

test('rapid taps during the animation never leave it stuck half-way', () => {
  const ia = createInteraction({ idleTimeoutMs: 60000 });
  let at = 0;
  for (let i = 0; i < 20; i++) { ia.tap(at, i % 2 ? 'empty' : 'house'); at += 100; ia.tick(at); }
  const s = run(ia, at, at + 4000);
  assert.ok((s.mode === 'idle' && s.t === 0) || (s.mode === 'plan' && s.t === 1), JSON.stringify(s));
  assert.equal(s.animating, false);
});

test('dt is clamped, so a long pause does not jump the animation', () => {
  const ia = createInteraction({ idleTimeoutMs: 60000 });
  ia.tap(0, 'empty');
  const s = ia.tick(10_000_000);
  assert.ok(s.t <= 100 / 1600 + 1e-9);
});

test('starting from rest measures dt from the tap, not from an old tick', () => {
  const ia = createInteraction({ idleTimeoutMs: 60000, now: 0 });
  ia.tick(5);
  ia.tap(1e9, 'empty');
  const s = ia.tick(1e9 + 16);
  assert.ok(Math.abs(s.t - 16 / 1600) < 1e-9);
});

test('jump sets t and the matching resting mode', () => {
  const ia = createInteraction({ idleTimeoutMs: 60000 });
  assert.deepEqual(ia.jump(1, 0), { mode: 'plan', t: 1, animating: false });
  assert.deepEqual(ia.jump(0, 0), { mode: 'idle', t: 0, animating: false });
  assert.equal(ia.jump(0.5, 0).t, 0.5);
});

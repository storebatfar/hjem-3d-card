import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQuality, PRESETS } from '../src/quality.js';

const feed = (q, ms, n) => { let r = null; for (let i = 0; i < n; i++) r = q.sample(ms) ?? r; return r; };

test('a fixed setting never changes', () => {
  const q = createQuality('medium');
  assert.equal(feed(q, 200, 100), null);
  assert.equal(q.level, 'medium');
  assert.equal(q.preset, PRESETS.medium);
});

test('auto starts high and keeps it when frames are fast', () => {
  const q = createQuality('auto');
  assert.equal(q.level, 'high');
  assert.equal(feed(q, 20, 60), null);
});

test('auto steps down one level per slow window, then stops at low', () => {
  const q = createQuality('auto');
  assert.equal(feed(q, 50, 30), 'medium');
  assert.equal(feed(q, 50, 30), 'low');
  assert.equal(feed(q, 50, 60), null);
  assert.equal(q.level, 'low');
});

test('needs a full window, and ignores garbage samples', () => {
  const q = createQuality('auto');
  assert.equal(feed(q, 50, 29), null);
  for (const bad of [NaN, -5, 0, Infinity]) assert.equal(q.sample(bad), null);
  assert.equal(q.level, 'high');
});

test('presets get cheaper from high to low', () => {
  assert.ok(PRESETS.high.pixelRatio > PRESETS.medium.pixelRatio && PRESETS.medium.pixelRatio > PRESETS.low.pixelRatio);
  assert.equal(PRESETS.low.shadows, false);
});

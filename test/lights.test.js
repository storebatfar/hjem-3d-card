import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kelvinToRgb, hsToRgb, lightGlow, roomGlows, watchedEntities, pickStates, statesChanged, flashTone } from '../src/live/lights.js';

test('kelvinToRgb matches Home Assistant for warm whites', () => {
  assert.deepEqual(kelvinToRgb(2000), [255, 137, 14]);
  assert.deepEqual(kelvinToRgb(2202), [255, 146, 39]);
  assert.equal(kelvinToRgb(6600)[2], 255);
  assert.equal(kelvinToRgb(1500)[2], 0);
});

test('hsToRgb converts Home Assistant hue/saturation at full value', () => {
  assert.deepEqual(hsToRgb([240, 100]), [0, 0, 255]);
  assert.deepEqual(hsToRgb([0, 0]), [255, 255, 255]);
  assert.deepEqual(hsToRgb([120, 50]), [128, 255, 128]);
  assert.deepEqual(hsToRgb([360, 100]), [255, 0, 0]);
});

test('lightGlow prefers rgb_color, then kelvin, then hs, then a warm default', () => {
  assert.deepEqual(lightGlow({ state: 'on', attributes: { rgb_color: [10, 20, 30], color_temp_kelvin: 2000, brightness: 255 } }).rgb, [10, 20, 30]);
  assert.deepEqual(lightGlow({ state: 'on', attributes: { color_temp_kelvin: 2000 } }).rgb, [255, 137, 14]);
  assert.deepEqual(lightGlow({ state: 'on', attributes: { hs_color: [240, 100] } }).rgb, [0, 0, 255]);
  assert.deepEqual(lightGlow({ state: 'on', attributes: {} }).rgb, kelvinToRgb(2700));
});

test('lightGlow validates rgb_color is an array of 3 finite numbers, else falls through', () => {
  assert.deepEqual(lightGlow({ state: 'on', attributes: { rgb_color: [255, null, 0], color_temp_kelvin: 2000 } }).rgb, [255, 137, 14]);
});

test('lightGlow brightness: null → full, 0 → minimum, 128 → half', () => {
  assert.equal(lightGlow({ state: 'on', attributes: { brightness: null } }).level, 1);
  assert.equal(lightGlow({ state: 'on', attributes: { brightness: 0 } }).level, 0.05);
  assert.ok(Math.abs(lightGlow({ state: 'on', attributes: { brightness: 128 } }).level - 128 / 255) < 1e-9);
});

test('lightGlow for off, unavailable, unknown and missing lights', () => {
  assert.deepEqual(lightGlow({ state: 'off', attributes: {} }), { on: false, unavailable: false, rgb: null, level: 0 });
  for (const s of [{ state: 'unavailable' }, { state: 'unknown' }, undefined]) {
    assert.deepEqual(lightGlow(s), { on: false, unavailable: true, rgb: null, level: 0 });
  }
});

test('roomGlows covers only rooms with a light; a missing entity is unavailable', () => {
  const rooms = { living: { light: 'light.living' }, bedroom: {}, hall: { light: 'light.typo' } };
  const g = roomGlows(rooms, { 'light.living': { state: 'on', attributes: { rgb_color: [1, 2, 3] } } });
  assert.deepEqual(Object.keys(g), ['living', 'hall']);
  assert.equal(g.living.on, true);
  assert.equal(g.hall.unavailable, true);
});

test('watchedEntities lists unique room lights plus the mode helper', () => {
  const ids = watchedEntities({ rooms: { a: { light: 'light.x' }, b: { light: 'light.x' }, c: {} }, mode_entity: 'input_select.mode' });
  assert.deepEqual(ids, ['light.x', 'input_select.mode']);
  assert.deepEqual(watchedEntities({ rooms: {}, mode_entity: null }), []);
});

test('statesChanged only reacts to watched entities, by object identity', () => {
  const lamp = { state: 'on' }, other = { state: '1' };
  const states = { 'light.x': lamp, 'sensor.y': other };
  const picked = pickStates(states, ['light.x']);
  assert.equal(statesChanged(null, states, ['light.x']), true);
  assert.equal(statesChanged(picked, { ...states, 'sensor.y': { state: '2' } }, ['light.x']), false);
  assert.equal(statesChanged(picked, { ...states, 'light.x': { state: 'off' } }, ['light.x']), true);
  assert.equal(statesChanged(picked, { 'sensor.y': other }, ['light.x']), true);
});

test('flashTone is dark only in Lys', () => {
  assert.equal(flashTone({ state: 'Lys' }), 'dark');
  assert.equal(flashTone({ state: 'Mørk' }), 'light');
  assert.equal(flashTone(undefined), 'light');
});

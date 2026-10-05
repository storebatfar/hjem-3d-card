import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeConfig, validateHouse, DEFAULTS } from '../src/config.js';

const example = () => JSON.parse(readFileSync(new URL('./fixtures/example-house.json', import.meta.url)));
const withHouse = mutate => { const h = example(); mutate(h); return { type: 'custom:hjem-3d-card', house: h }; };

test('fills defaults and keeps the house', () => {
  const c = normalizeConfig({ type: 'custom:hjem-3d-card', house: example() });
  for (const [k, v] of Object.entries(DEFAULTS)) assert.equal(c[k], v);
  assert.equal(c.house.shell.wallHeight, 2.5);
  assert.equal(c.house.shell.wallThickness, 0.4);
  assert.equal(c.house.roof.overhang, 0.35);
});

test('sorts openings along each wall', () => {
  const h = validateHouse(example());
  assert.deepEqual(h.openings.south.map(o => o.from), [1, 4]);
  assert.deepEqual(h.openings.east, []);
});

test('missing house gives a Danish error', () => {
  assert.throws(() => normalizeConfig({ type: 'x' }), /hjem-3d-card: house mangler/);
});

test('names the exact field when to <= from', () => {
  assert.throws(() => normalizeConfig(withHouse(h => { h.openings.north[0].to = 1; })),
    /house\.openings\.north\[0\]\.to skal være større end from/);
});

test('rejects overlapping openings', () => {
  assert.throws(() => normalizeConfig(withHouse(h => { h.openings.south.push({ from: 5, to: 7, sill: 0, head: 2, kind: 'door' }); })),
    /overlapper/);
});

test('rejects an opening outside its wall', () => {
  assert.throws(() => normalizeConfig(withHouse(h => { h.openings.west[0].to = 9; })), /uden for væggen \(0–8\)/);
});

test('rejects an unknown opening kind', () => {
  assert.throws(() => normalizeConfig(withHouse(h => { h.openings.north[0].kind = 'hatch'; })), /kind skal være en af window, door, garage-door/);
});

test('rejects an opening taller than the wall', () => {
  assert.throws(() => normalizeConfig(withHouse(h => { h.openings.north[0].head = 3; })), /er højere end væggen/);
});

test('rejects non-numbers', () => {
  assert.throws(() => normalizeConfig(withHouse(h => { h.plot.x1 = '16'; })), /house\.plot\.x1 skal være et tal/);
});

test('rejects bad options', () => {
  assert.throws(() => normalizeConfig({ house: example(), idle_timeout: 2 }), /idle_timeout skal være mindst 5/);
  assert.throws(() => normalizeConfig({ house: example(), quality: 'ultra' }), /quality skal være en af/);
  assert.throws(() => normalizeConfig({ house: example(), height: '' }), /height skal være en CSS-højde/);
});

test('ignores unknown keys such as _notes', () => {
  const h = example(); h._notes = ['provisional'];
  assert.ok(validateHouse(h));
});

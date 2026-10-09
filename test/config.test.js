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

test('rejects null or non-object list items', () => {
  assert.throws(() => normalizeConfig(withHouse(h => { h.openings.north.push(null); })),
    /house\.openings\.north\[2\] skal være et objekt/);
  assert.throws(() => normalizeConfig(withHouse(h => { h.surfaces.push('string'); })),
    /house\.surfaces\[2\] skal være et objekt/);
  assert.throws(() => normalizeConfig(withHouse(h => { h.roof.solar = [null]; })),
    /house\.roof\.solar\[0\] skal være et objekt/);
  assert.throws(() => normalizeConfig(withHouse(h => { h.roof.windows = [null]; })),
    /house\.roof\.windows\[0\] skal være et objekt/);
  assert.throws(() => normalizeConfig(withHouse(h => { h.hedges = [42]; })),
    /house\.hedges\[0\] skal være et objekt/);
});

test('rejects negative sill', () => {
  assert.throws(() => normalizeConfig(withHouse(h => { h.openings.north[0].sill = -0.5; })),
    /house\.openings\.north\[0\]\.sill må ikke være negativ/);
});

test('normalizes rooms, interior walls and fixtures', () => {
  const h = validateHouse(example());
  assert.deepEqual(Object.keys(h.rooms), ['living', 'bedroom']);
  assert.deepEqual(h.rooms.living.rects, [{ x0: 0.4, x1: 7.0, z0: 0.4, z1: 7.6 }]);
  assert.equal(h.walls.length, 2);
  assert.equal(h.walls[0].h, 2.5);
  assert.deepEqual(h.fixtures[0], { x0: 0.5, x1: 2.5, z0: 0.4, z1: 1.1, kind: 'counter', h: 0.9 });
});

test('keeps the room on openings that name one', () => {
  const h = validateHouse(example());
  assert.equal(h.openings.north[0].room, 'living');
  assert.equal('room' in h.openings.south[0], false);
});

test('a house without rooms, walls or fixtures is still valid', () => {
  const raw = example(); delete raw.rooms; delete raw.walls; delete raw.fixtures;
  for (const side of ['north', 'south', 'west', 'east']) raw.openings[side].forEach(o => delete o.room);
  const h = validateHouse(raw);
  assert.deepEqual(h.rooms, {}); assert.deepEqual(h.walls, []); assert.deepEqual(h.fixtures, []);
});

test('rejects an opening room that does not exist', () => {
  assert.throws(() => normalizeConfig(withHouse(h => { h.openings.north[0].room = 'attic'; })),
    /house\.openings\.north\[0\]\.room findes ikke i house\.rooms/);
});

test('rejects a room rectangle outside the house', () => {
  assert.throws(() => normalizeConfig(withHouse(h => { h.rooms.living.rects[0].x1 = 13; })),
    /house\.rooms\.living\.rects\[0\] ligger uden for huset/);
});

test('rejects a bad room id and a room without rectangles', () => {
  assert.throws(() => normalizeConfig(withHouse(h => { h.rooms['Stue!'] = { rects: [{ x0: 1, x1: 2, z0: 1, z1: 2 }] }; })),
    /navnet må kun indeholde a–z, 0–9 og _/);
  assert.throws(() => normalizeConfig(withHouse(h => { h.rooms.living.rects = []; })), /skal have mindst ét rektangel/);
});

test('rejects a bad fixture kind and a too-tall interior wall', () => {
  assert.throws(() => normalizeConfig(withHouse(h => { h.fixtures[0].kind = 'sofa'; })), /kind skal være en af cabinet, counter/);
  assert.throws(() => normalizeConfig(withHouse(h => { h.walls[0].h = 3; })), /house\.walls\[0\]\.h er højere end væggen/);
  assert.throws(() => normalizeConfig(withHouse(h => { h.fixtures[0].h = 2.5; })), /house\.fixtures\[0\]\.h er højere end væggen/);
});

test('room lights and mode entity default to empty', () => {
  const c = normalizeConfig({ house: example() });
  assert.deepEqual(c.rooms, {});
  assert.equal(c.mode_entity, null);
});

test('normalizes room lights; a room without a light is allowed', () => {
  const c = normalizeConfig({ house: example(), rooms: { living: { light: 'light.living' }, bedroom: null }, mode_entity: 'input_select.mode' });
  assert.deepEqual(c.rooms, { living: { light: 'light.living' }, bedroom: {} });
  assert.equal(c.mode_entity, 'input_select.mode');
});

test('rejects room lights for unknown rooms or non-light entities', () => {
  assert.throws(() => normalizeConfig({ house: example(), rooms: { kitchen: { light: 'light.kitchen' } } }),
    /rooms\.kitchen findes ikke i house\.rooms/);
  assert.throws(() => normalizeConfig({ house: example(), rooms: { living: { light: 'switch.living' } } }),
    /rooms\.living\.light skal være en light-entitet/);
});

test('rejects a malformed mode entity', () => {
  assert.throws(() => normalizeConfig({ house: example(), mode_entity: 'Lys' }), /mode_entity skal være en entitet/);
});

test('parking and charger are normalized; both default to empty', () => {
  const h = validateHouse(example());
  assert.deepEqual(h.parking, { p1: { x: -0.8, z: 3.2, facing: 'west' } });
  assert.deepEqual(h.charger, { x: 0.6, y: 1.2, z: 0, facing: 'north', route: [{ x: -0.4, z: -0.4 }] });
  const raw = example(); delete raw.parking; delete raw.charger;
  const h2 = validateHouse(raw);
  assert.deepEqual(h2.parking, {}); assert.equal(h2.charger, null);
});

test('rejects bad parking spots', () => {
  assert.throws(() => normalizeConfig(withHouse(h => { h.parking.p1.facing = 'up'; })), /house\.parking\.p1\.facing skal være en af north, south, east, west/);
  assert.throws(() => normalizeConfig(withHouse(h => { h.parking.p1.x = -30; })), /house\.parking\.p1 ligger uden for grunden/);
  assert.throws(() => normalizeConfig(withHouse(h => { h.parking['P 1'] = { x: 0, z: 0, facing: 'west' }; })), /navnet må kun indeholde/);
});

test('rejects a bad charger', () => {
  assert.throws(() => normalizeConfig(withHouse(h => { h.charger.y = 0.1; })), /house\.charger\.y skal være mellem 0\.3 og 2\.5/);
  assert.throws(() => normalizeConfig(withHouse(h => { h.charger.facing = 'in'; })), /house\.charger\.facing skal være en af/);
  assert.throws(() => normalizeConfig(withHouse(h => { h.charger.route = [{ x: 40, z: 0 }]; })), /house\.charger\.route\[0\] ligger uden for grunden/);
  assert.throws(() => normalizeConfig(withHouse(h => { h.charger = 'wall'; })), /house\.charger skal være et objekt/);
});

test('cars, charger and page entity default to empty', () => {
  const c = normalizeConfig({ house: example() });
  assert.deepEqual(c.cars, {});
  assert.deepEqual(c.charger, { led: null });
  assert.equal(c.page_entity, null);
});

test('normalizes a car with defaults and only the given entities', () => {
  const c = normalizeConfig({ house: example(), page_entity: 'input_select.page',
    cars: { car1: { spot: 'p1', tracker: 'device_tracker.car1', cable: 'binary_sensor.car1_cable' } },
    charger: { led: 'light.charger_led' } });
  assert.deepEqual(c.cars.car1, { spot: 'p1', model: 'model_y', color: '#c8c8c8', page: 'biler',
    tracker: 'device_tracker.car1', cable: 'binary_sensor.car1_cable' });
  assert.deepEqual(c.charger, { led: 'light.charger_led' });
  assert.equal(c.page_entity, 'input_select.page');
});

test('rejects bad car config', () => {
  const base = { house: example() };
  assert.throws(() => normalizeConfig({ ...base, cars: { car1: { spot: 'p9' } } }), /cars\.car1\.spot findes ikke i house\.parking/);
  assert.throws(() => normalizeConfig({ ...base, cars: { car1: { spot: 'p1', model: 'roadster' } } }), /cars\.car1\.model skal være en af model_y, model_3/);
  assert.throws(() => normalizeConfig({ ...base, cars: { car1: { spot: 'p1', color: 'red' } } }), /cars\.car1\.color skal være en farve/);
  assert.throws(() => normalizeConfig({ ...base, cars: { car1: { spot: 'p1', cable: 'switch.x' } } }), /cars\.car1\.cable skal være en entitet/);
  assert.throws(() => normalizeConfig({ ...base, cars: { car1: { spot: 'p1' }, car2: { spot: 'p1' } } }), /cars\.car2\.spot er allerede brugt af cars\.car1/);
});

test('rejects a charger LED without a house charger and a bad page entity', () => {
  const raw = example(); delete raw.charger;
  assert.throws(() => normalizeConfig({ house: raw, charger: { led: 'light.x' } }), /charger kræver house\.charger/);
  assert.throws(() => normalizeConfig({ house: example(), page_entity: 'sensor.page' }), /page_entity skal være en entitet/);
});

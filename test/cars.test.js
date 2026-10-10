import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carStates, cableTarget, carEntities, cableRoute } from '../src/live/cars.js';

const cfg = {
  a: { spot: 'p1', tracker: 'device_tracker.a', cable: 'binary_sensor.a_cable', charging: 'binary_sensor.a_chg', battery: 'sensor.a_bat' },
  b: { spot: 'p2', tracker: 'device_tracker.b', cable: 'binary_sensor.b_cable', charging: 'binary_sensor.b_chg', battery: 'sensor.b_bat' },
};
const st = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { state: v }]));

test('home, cable, charging and battery come from their entities', () => {
  const s = carStates(cfg, st({ 'device_tracker.a': 'home', 'binary_sensor.a_cable': 'on', 'binary_sensor.a_chg': 'on', 'sensor.a_bat': '72.4',
    'device_tracker.b': 'not_home', 'binary_sensor.b_cable': 'on', 'sensor.b_bat': '55' }));
  assert.deepEqual(s.a, { home: true, cable: true, charging: true, battery: 72 });
  assert.deepEqual(s.b, { home: false, cable: false, charging: false, battery: 55 });
});

test('unavailable/unknown/missing tracker keeps the car visible; only explicit away hides it', () => {
  for (const v of ['unavailable', 'unknown', undefined]) {
    const s = carStates(cfg, v === undefined ? {} : st({ 'device_tracker.a': v }));
    assert.equal(s.a.home, true, String(v));
  }
  assert.equal(carStates(cfg, st({ 'device_tracker.a': 'Work' })).a.home, false);
  assert.equal(carStates({ c: { spot: 'p1' } }, {}).c.home, true, 'no tracker → always shown');
});

test('battery that is not a number gives no label value', () => {
  for (const v of ['unavailable', '', 'abc']) assert.equal(carStates(cfg, st({ 'sensor.a_bat': v })).a.battery, null);
});

test('cableTarget: charging beats connected, away cars never get the cable', () => {
  assert.equal(cableTarget({ a: { home: true, cable: true, charging: false }, b: { home: true, cable: true, charging: true } }), 'b');
  assert.equal(cableTarget({ a: { home: true, cable: true, charging: false }, b: { home: true, cable: false, charging: false } }), 'a');
  assert.equal(cableTarget({ a: { home: false, cable: true, charging: true } }), null);
  assert.equal(cableTarget({}), null);
});

test('carEntities lists every car entity plus the charger LED', () => {
  assert.deepEqual(carEntities({ cars: { c: { spot: 'p', tracker: 't.x', battery: 'sensor.y' } }, charger: { led: 'light.z' } }), ['t.x', 'sensor.y', 'light.z']);
  assert.deepEqual(carEntities({ cars: {}, charger: { led: null } }), []);
});

test('cableRoute: from the charger outlet, down, along the waypoints, up into the port', () => {
  const charger = { x: 0.6, y: 1.2, z: 0, facing: 'north', route: [{ x: -0.4, z: -0.4 }] };
  const port = { x: -0.9, y: 0.86, z: 4.16, normal: [0, 0, 1] };
  const r = cableRoute(charger, port);
  assert.deepEqual(r[0], [0.6, 1.07, -0.1]);
  assert.deepEqual(r[1], [0.6, 0.04, -0.35]);
  assert.deepEqual(r[2], [-0.4, 0.04, -0.4]);
  assert.deepEqual(r[r.length - 2], [-0.9, 0.04, 4.51]);
  assert.deepEqual(r[r.length - 1], [-0.9, 0.86, 4.16]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { normalizeConfig } from '../src/config.js';
import { createMaterials } from '../src/scene/materials.js';
import { buildScene } from '../src/scene/build.js';
import { setCable, applyCars, applyFlow, applyChargerLed, MODELS } from '../src/scene/cars.js';
import { PRESETS } from '../src/quality.js';

const config = normalizeConfig({
  house: JSON.parse(readFileSync(new URL('./fixtures/example-house.json', import.meta.url))),
  cars: { car1: { spot: 'p1', model: 'model_3', color: '#a3161c' } },
  charger: { led: 'light.charger_led' },
});
const make = () => { const materials = createMaterials(); return buildScene(config.house, { materials, quality: PRESETS.high, cars: config.cars }); };

test('a backed-in car stands in its spot: rear at the spot, nose pointing west', () => {
  const world = make();
  const car = world.cars.cars.car1.car;
  const box = new THREE.Box3().setFromObject(car);
  assert.ok(Math.abs(box.max.x - (-0.8)) < 0.03, `rear near x=-0.8, got ${box.max.x}`);
  assert.ok(Math.abs(box.min.x - (-0.8 - MODELS.model_3.length)) < 0.03, `front near x=${-0.8 - MODELS.model_3.length}, got ${box.min.x}`);
  assert.ok(Math.abs((box.min.z + box.max.z) / 2 - 3.2) < 0.1, 'centred on z=3.2');
  assert.ok(box.max.y < 1.48, `Model 3 height ≤ 1.46, got ${box.max.y}`);
});

test('the charge port is at the rear, driver side (south when facing west)', () => {
  const world = make();
  const p = world.cars.cars.car1.port;
  assert.ok(Math.abs(p.x - (-0.8 - 0.12)) < 1e-6);
  assert.ok(Math.abs(p.z - (3.2 + MODELS.model_3.width / 2)) < 1e-6);
  assert.deepEqual(p.normal.map(v => Math.round(v)), [0, 0, 1]);
});

test('cars get picks; the charger box blocks taps', () => {
  const world = make();
  assert.deepEqual(world.pickTargets.cars.map(p => p.userData.carId), ['car1']);
  assert.ok(world.pickTargets.blockers.includes(world.charger.box));
});

test('cable: none → coil; a target → tube from charger to port; flow shows only when on', () => {
  const world = make();
  const ch = world.charger;
  setCable(ch, null, null);
  assert.equal(ch.coil.visible, true); assert.equal(ch.cable, null);
  setCable(ch, 'car1', world.cars.cars.car1.port);
  assert.equal(ch.coil.visible, false);
  assert.ok(ch.cable.geometry.attributes.position.count > 0);
  applyFlow(ch, true, 1.5);
  assert.equal(ch.flow.visible, true);
  applyFlow(ch, false, 2);
  assert.equal(ch.flow.visible, false);
  const old = ch.cable.geometry; let disposed = false; old.addEventListener('dispose', () => { disposed = true; });
  setCable(ch, null, null);
  assert.equal(disposed, true, 'old tube geometry disposed');
});

test('applyCars hides away cars; the LED follows the light glow', () => {
  const world = make();
  applyCars(world.cars, { car1: { home: false, cable: false, charging: false, battery: 50 } });
  assert.equal(world.cars.cars.car1.car.visible, false);
  applyCars(world.cars, { car1: { home: true, cable: false, charging: false, battery: 50 } });
  assert.equal(world.cars.cars.car1.car.visible, true);
  applyChargerLed(world.charger, { on: true, rgb: [0, 200, 80], level: 1 });
  assert.ok(world.charger.ledMat.emissiveIntensity > 0);
  applyChargerLed(world.charger, { on: false, rgb: null, level: 0 });
  assert.equal(world.charger.ledMat.emissiveIntensity, 0);
});

test('cable stays on the ground: every vertex y ≥ 0.03', () => {
  const world = make();
  setCable(world.charger, 'car1', world.cars.cars.car1.port);
  const pos = world.charger.cable.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    assert.ok(y >= 0.03, `vertex ${i} has y=${y}, should be ≥ 0.03`);
  }
});

test('no cars and no charger is fine', () => {
  const raw = JSON.parse(readFileSync(new URL('./fixtures/example-house.json', import.meta.url))); delete raw.charger;
  const c = normalizeConfig({ house: raw });
  const world = buildScene(c.house, { materials: createMaterials(), quality: PRESETS.high, cars: c.cars });
  assert.equal(world.charger, null);
  assert.deepEqual(world.pickTargets.cars, []);
});

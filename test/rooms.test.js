import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { validateHouse } from '../src/config.js';
import { createMaterials } from '../src/scene/materials.js';
import { buildScene, applyQuality } from '../src/scene/build.js';
import { applyRoomGlow, applyFlash } from '../src/scene/rooms.js';
import { PRESETS } from '../src/quality.js';

const house = validateHouse(JSON.parse(readFileSync(new URL('./fixtures/example-house.json', import.meta.url))));
const make = (litRooms = ['living', 'bedroom'], quality = PRESETS.high) => {
  const materials = createMaterials();
  return { materials, world: buildScene(house, { materials, quality, litRooms }) };
};
const lights = world => { const out = []; world.scene.traverse(o => { if (o.isPointLight) out.push(o); }); return out; };
const warm = { on: true, unavailable: false, rgb: [255, 146, 39], level: 1 };

test('one point light and one pick per lit room; picks know their room', () => {
  const { world } = make();
  assert.equal(lights(world).length, 2);
  assert.deepEqual(world.pickTargets.rooms.map(p => p.userData.roomId).sort(), ['bedroom', 'living']);
});

test('no lit rooms -> no point lights, but rooms are still pickable', () => {
  const { world } = make([]);
  assert.equal(lights(world).length, 0);
  assert.equal(world.pickTargets.rooms.length, 2);
});

test('windows of a lit room use that room\'s own glass material', () => {
  const { world } = make();
  const used = new Set(world.scene.getObjectByName('static').children.map(o => o.material));
  assert.ok(used.has(world.rooms.glass.living));
  assert.ok(used.has(world.rooms.glass.bedroom));
});

test('interior walls and fixtures are built', () => {
  const { world, materials } = make();
  const used = new Set(world.scene.getObjectByName('static').children.map(o => o.material));
  assert.ok(used.has(materials.inner));
  assert.ok(used.has(materials.counter));
});

test('applyRoomGlow lights floor, windows and the room light, and clears them again', () => {
  const { world } = make();
  const room = world.rooms.rooms.living;
  applyRoomGlow(world.rooms, { living: warm, bedroom: { on: false, unavailable: true, rgb: null, level: 0 } }, PRESETS.high);
  assert.ok(room.floorMat.emissiveIntensity > 0);
  assert.ok(world.rooms.glass.living.emissiveIntensity > 0);
  assert.ok(room.light.intensity > 0);
  assert.ok(room.floorMat.emissive.r > room.floorMat.emissive.b, 'warm colour');
  assert.equal(world.rooms.rooms.bedroom.light.intensity, 0);
  applyRoomGlow(world.rooms, {}, PRESETS.high);
  assert.equal(room.floorMat.emissiveIntensity, 0);
  assert.equal(room.light.intensity, 0);
});

test('low quality hides the room lights but keeps the emissive glow', () => {
  const { world } = make();
  applyQuality(world, PRESETS.low);
  applyRoomGlow(world.rooms, { living: warm }, PRESETS.low);
  assert.equal(world.rooms.rooms.living.light.visible, false);
  assert.ok(world.rooms.rooms.living.floorMat.emissiveIntensity > 0);
});

test('applyFlash fades in and out and follows the tone', () => {
  const { world } = make();
  const r = world.rooms.rooms.living;
  applyFlash(world.rooms, 'living', 0.5, 'dark');
  assert.ok(Math.abs(r.flashMat.opacity - 0.45) < 1e-9);
  assert.equal(r.flashMat.color.getHex(), 0x000000);
  assert.equal(r.flashMeshes.every(m => m.visible), true);
  applyFlash(world.rooms, 'living', 1, 'light');
  assert.equal(r.flashMeshes.every(m => !m.visible), true);
  applyFlash(world.rooms, 'nope', 0.5, 'light'); // unknown room: no throw
});

test('dispose also releases glass materials of lit rooms without windows', () => {
  const raw = JSON.parse(readFileSync(new URL('./fixtures/example-house.json', import.meta.url)));
  raw.openings.north = raw.openings.north.filter(o => o.room !== 'bedroom');
  const h = validateHouse(raw);
  const materials = createMaterials();
  const world = buildScene(h, { materials, quality: PRESETS.high, litRooms: ['bedroom'] });
  let disposed = false;
  world.rooms.glass.bedroom.addEventListener('dispose', () => { disposed = true; });
  world.dispose();
  assert.equal(disposed, true);
});

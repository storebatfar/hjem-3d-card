import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { validateHouse } from '../src/config.js';
import { roofGeometry } from '../src/geometry.js';
import { createMaterials } from '../src/scene/materials.js';
import { buildScene, applyRoof, applyQuality } from '../src/scene/build.js';
import { PRESETS } from '../src/quality.js';

const house = validateHouse(JSON.parse(readFileSync(new URL('./fixtures/example-house.json', import.meta.url))));
const make = (quality = PRESETS.high) => { const materials = createMaterials(); return { materials, world: buildScene(house, { materials, quality }) }; };

test('builds the named parts', () => {
  const { world } = make();
  for (const name of ['static', 'roof', 'pick-house', 'contact-shadow']) assert.ok(world.scene.getObjectByName(name), name);
  assert.equal(world.pickTargets.house.name, 'pick-house');
});

test('static geometry is merged to one mesh per material', () => {
  const { world } = make();
  const meshes = world.scene.getObjectByName('static').children.filter(o => o.isMesh);
  assert.ok(meshes.length <= 20, `${meshes.length} meshes`);
  assert.equal(new Set(meshes.map(m => m.material)).size, meshes.length);
});

test('static bounds match the plot and the wall height', () => {
  const { world } = make();
  const b = new THREE.Box3().setFromObject(world.scene.getObjectByName('static'));
  assert.ok(Math.abs(b.min.x - house.plot.x0) < 0.01 && Math.abs(b.max.x - house.plot.x1) < 0.01);
  assert.ok(Math.abs(b.max.y - house.shell.wallHeight) < 0.01, `max y ${b.max.y}`);
});

test('roof reaches the ridge and lifts away', () => {
  const { world, materials } = make();
  const ridge = roofGeometry(house.shell, house.roof).ridgeY;
  const b = new THREE.Box3().setFromObject(world.roofGroup);
  assert.ok(b.max.y > ridge && b.max.y < ridge + 0.3, `roof top ${b.max.y} vs ridge ${ridge}`);
  applyRoof(world.roofGroup, materials, { lift: 6, opacity: 0, visible: false });
  assert.equal(world.roofGroup.visible, false);
  assert.equal(world.roofGroup.position.y, 6);
  for (const m of materials.roofFade) assert.equal(m.opacity, 0);
});

test('openings produce glass, door and garage-door meshes', () => {
  const { world, materials } = make();
  const used = new Set(world.scene.getObjectByName('static').children.map(o => o.material));
  for (const k of ['glass', 'door', 'garageDoor', 'frame', 'hedge', 'deck', 'concrete']) assert.ok(used.has(materials[k]), k);
});

test('quality controls sun shadows', () => {
  const { world } = make(PRESETS.low);
  assert.equal(world.sun.castShadow, false);
  applyQuality(world, PRESETS.high);
  assert.equal(world.sun.castShadow, true);
  assert.equal(world.sun.shadow.mapSize.x, 2048);
});

test('dispose releases every geometry and material', () => {
  const { world } = make();
  const geos = new Set(), mats = new Set();
  world.scene.traverse(o => {
    if (o.geometry) geos.add(o.geometry);
    for (const m of [o.material].flat().filter(Boolean)) mats.add(m);
  });
  let g = 0, m = 0;
  geos.forEach(x => x.addEventListener('dispose', () => g++));
  mats.forEach(x => x.addEventListener('dispose', () => m++));
  world.dispose();
  assert.equal(g, geos.size);
  assert.equal(m, mats.size);
});

test('with a canvas factory, deck and garage doors get textures', () => {
  const fakeCtx = { fillRect() {}, createRadialGradient: () => ({ addColorStop() {} }), set fillStyle(v) {} };
  const makeCanvas = (width, height) => ({ width, height, getContext: () => fakeCtx });
  const m = createMaterials({ makeCanvas });
  assert.ok(m.deck.map, 'deck boards texture');
  assert.ok(m.garageDoor.map, 'garage door grooves texture');
  assert.ok(m.roofTile.map, 'roof tiles texture');
});

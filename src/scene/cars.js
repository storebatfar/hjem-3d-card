import * as THREE from 'three';
import { cableRoute } from '../live/cars.js';

// Car-local frame: x forward from the rear bumper (0) to the front (length), y up, z across (+z = right side).
export const MODELS = {
  model_y: { length: 4.75, width: 1.92, wheelR: 0.36, wheelX: [0.98, 3.87], height: 1.62,
    body: [[0, 0.34], [0, 0.88], [0.35, 1.0], [3.75, 0.98], [4.45, 0.82], [4.75, 0.62], [4.72, 0.34]],
    glass: [[0.45, 0.98], [1.15, 1.58], [2.65, 1.62], [3.7, 0.98]] },
  model_3: { length: 4.72, width: 1.85, wheelR: 0.34, wheelX: [0.98, 3.85], height: 1.44,
    body: [[0, 0.34], [0, 0.86], [0.3, 0.98], [3.7, 0.94], [4.4, 0.76], [4.72, 0.58], [4.69, 0.34]],
    glass: [[0.85, 0.94], [1.55, 1.4], [2.55, 1.44], [3.6, 0.94]] },
};
const YAW = { east: 0, north: Math.PI / 2, west: Math.PI, south: -Math.PI / 2 };
const NORMAL = { north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0] };
const PORT_LOCAL = { x: 0.12, y: 0.86 };   // rear, driver side (−z)

function extrudeProfile(points, width, bevel) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const depth = Math.max(0.01, width - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 });
  g.translate(0, 0, -depth / 2);
  return g;
}

export function buildCarModel(modelId, color, m) {
  const spec = MODELS[modelId];
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 });
  const body = new THREE.Mesh(extrudeProfile(spec.body, spec.width, 0.08), paint);
  const glass = new THREE.Mesh(extrudeProfile(spec.glass, spec.width * 0.84, 0.06), m.carGlass);
  for (const mesh of [body, glass]) { mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, spec.width * 0.8), m.tailLight);
  tail.position.set(0.0, 0.84, 0);
  group.add(tail);
  const wheelGeo = new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, 0.24, 24);
  wheelGeo.rotateX(Math.PI / 2);
  for (const wx of spec.wheelX) for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wheelGeo, m.tyre);
    w.position.set(wx, spec.wheelR, s * (spec.width / 2 - 0.14));
    w.castShadow = true;
    group.add(w);
  }
  return { group, spec, paint };
}

function makeLabel(makeCanvas) {
  const canvas = makeCanvas(128, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(1.2, 0.6, 1);
  sprite.renderOrder = 20;
  sprite.visible = false;
  return { sprite, canvas, tex, text: null };
}

function drawLabel(label, text) {
  if (label.text === text) return;
  label.text = text;
  const g = label.canvas.getContext('2d');
  g.clearRect(0, 0, 128, 64);
  g.fillStyle = 'rgba(20,24,30,0.72)';
  g.beginPath(); g.roundRect?.(8, 10, 112, 44, 14); if (!g.roundRect) g.rect(8, 10, 112, 44); g.fill();
  g.fillStyle = '#ffffff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 33);
  label.tex.needsUpdate = true;
}

export function buildCars(house, configCars, m, { makeCanvas } = {}) {
  const group = new THREE.Group();
  group.name = 'cars';
  const cars = {}, picks = [];
  for (const [id, c] of Object.entries(configCars)) {
    const spot = house.parking[c.spot];
    const { group: car, spec, paint } = buildCarModel(c.model, c.color, m);
    car.name = `car-${id}`;
    car.position.set(spot.x, 0, spot.z);
    car.rotation.y = YAW[spot.facing];
    group.add(car);
    car.updateMatrixWorld(true);
    const port = new THREE.Vector3(PORT_LOCAL.x, PORT_LOCAL.y, -spec.width / 2).applyMatrix4(car.matrixWorld);
    const normal = new THREE.Vector3(0, 0, -1).applyQuaternion(car.quaternion);
    const pick = new THREE.Mesh(new THREE.BoxGeometry(spec.length, spec.height, spec.width), m.pick);
    pick.position.set(spec.length / 2, spec.height / 2, 0);
    pick.userData.carId = id;
    car.add(pick);
    picks.push(pick);
    const clean = v => Math.abs(v) < 1e-10 ? 0 : v;
    const entry = { id, car, spec, paint, label: null,
      port: { x: port.x, y: port.y, z: port.z, normal: [clean(normal.x), clean(normal.y), clean(normal.z)] } };
    if (makeCanvas) {
      entry.label = makeLabel(makeCanvas);
      const centre = new THREE.Vector3(spec.length / 2, spec.height + 0.7, 0).applyMatrix4(car.matrixWorld);
      entry.label.sprite.position.copy(centre);
      group.add(entry.label.sprite);
    }
    cars[id] = entry;
  }
  return { group, cars, picks };
}

export function applyCars(handle, states) {
  for (const [id, entry] of Object.entries(handle.cars)) {
    const s = states[id];
    const home = !!s?.home;
    entry.car.visible = home;
    if (entry.label) {
      const show = home && s.battery !== null && s.battery !== undefined;
      entry.label.sprite.visible = show;
      if (show) drawLabel(entry.label, `${s.battery} %`);
    }
  }
}

export function buildCharger(house, m, { makeCanvas } = {}) {
  const c = house.charger;
  if (!c) return null;
  const group = new THREE.Group();
  group.name = 'charger';
  const n = NORMAL[c.facing];
  const alongX = c.facing === 'north' || c.facing === 'south';
  const box = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.19 : 0.1, 0.26, alongX ? 0.1 : 0.19), m.charger);
  box.position.set(c.x + n[0] * 0.05, c.y, c.z + n[2] * 0.05);
  box.castShadow = true;
  group.add(box);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, emissive: new THREE.Color(0x000000), emissiveIntensity: 0 });
  const led = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.025 : 0.012, 0.2, alongX ? 0.012 : 0.025), ledMat);
  led.position.set(c.x + n[0] * 0.106, c.y, c.z + n[2] * 0.106);
  group.add(led);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 10, 28), m.cable);
  const side = alongX ? [1, 0, 0] : [0, 0, 1];
  coil.position.set(c.x + side[0] * 0.25, c.y - 0.16, c.z + side[2] * 0.25);
  if (!alongX) coil.rotation.y = Math.PI / 2;
  group.add(coil);
  const flowMat = new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.95, depthWrite: false,
    ...(m.flowDashes ? { map: m.flowDashes } : {}) });
  return { group, box, ledMat, coil, cable: null, flow: null, flowMat, target: null, charger: c, m };
}

export function setCable(handle, targetId, port) {
  if (!handle) return;
  if (handle.target === targetId && (targetId === null || handle.cable)) return;
  for (const k of ['cable', 'flow']) {
    if (handle[k]) { handle.group.remove(handle[k]); handle[k].geometry.dispose(); handle[k] = null; }
  }
  handle.target = targetId;
  handle.coil.visible = !targetId;
  if (!targetId || !port) return;
  const initialCurve = new THREE.CatmullRomCurve3(cableRoute(handle.charger, port).map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const samples = initialCurve.getSpacedPoints(160);
  const cableRadius = 0.045;
  const minY = 0.03 + cableRadius;
  for (const pt of samples) { if (pt.y < minY) pt.y = minY; }
  const curve = new THREE.CatmullRomCurve3(samples, false, 'centripetal');
  handle.cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, cableRadius, 8, false), handle.m.cable);
  handle.cable.castShadow = true;
  handle.flow = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.056, 8, false), handle.flowMat);
  handle.flow.visible = false;
  handle.flow.renderOrder = 5;
  if (handle.flowMat.map) handle.flowMat.map.repeat.set(curve.getLength() / 0.5, 1);
  handle.group.add(handle.cable, handle.flow);
}

export function applyFlow(handle, on, seconds) {
  if (!handle?.flow) return;
  handle.flow.visible = !!on;
  if (on && handle.flowMat.map) handle.flowMat.map.offset.x = -((seconds * 0.8) % 1);
}

const BLACK = new THREE.Color(0x000000);
export function applyChargerLed(handle, glow) {
  if (!handle) return;
  if (glow?.on && glow.rgb) {
    handle.ledMat.emissive.setRGB(glow.rgb[0] / 255, glow.rgb[1] / 255, glow.rgb[2] / 255, THREE.SRGBColorSpace);
    handle.ledMat.emissiveIntensity = 1.5 * glow.level;
  } else {
    handle.ledMat.emissive.copy(BLACK);
    handle.ledMat.emissiveIntensity = 0;
  }
}

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { wallBoxes, openingParts, roofGeometry, panelRects } from '../geometry.js';

const SIDES = ['north', 'south', 'west', 'east'];
const ROOF_LIFT_CLEARANCE = 0.16; // slab thickness of each roof slope

function boxGeo(b, radius = 0, segments = 2) {
  const w = b.x1 - b.x0, h = b.y1 - b.y0, d = b.z1 - b.z0;
  const r = Math.min(radius, w / 2, h / 2, d / 2) * 0.999;
  const g = r > 0.001 ? new RoundedBoxGeometry(w, h, d, segments, r) : new THREE.BoxGeometry(w, h, d);
  g.translate((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
  return g;
}

// Collects geometries per material and merges them into one mesh each.
class Batch {
  constructor() { this.byMaterial = new Map(); }
  add(material, geometry) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.clearGroups();
    if (!this.byMaterial.has(material)) this.byMaterial.set(material, []);
    this.byMaterial.get(material).push(g);
  }
  flush(parent, { castShadow = true, receiveShadow = true } = {}) {
    for (const [material, geos] of this.byMaterial) {
      const merged = mergeGeometries(geos, false);
      geos.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      parent.add(mesh);
    }
    this.byMaterial.clear();
  }
}

const OPENING_MATERIAL = { window: 'glass', door: 'door', 'garage-door': 'garageDoor' };

function buildRoof(house, m) {
  const { shell, roof } = house;
  const R = roofGeometry(shell, roof);
  const group = new THREE.Group();
  group.name = 'roof';
  if (m.roofTile.map) m.roofTile.map.repeat.set(1, R.slopeLength / 0.38);

  const slope = sign => {
    const g = new THREE.Group();
    g.position.set(shell.width / 2, R.ridgeY, R.half);
    g.rotation.x = sign * R.pitchRad;
    group.add(g);
    const geo = new THREE.BoxGeometry(R.width, ROOF_LIFT_CLEARANCE, R.slopeLength);
    geo.translate(0, 0, sign * R.slopeLength / 2);
    const mesh = new THREE.Mesh(geo, [m.roofEdge, m.roofEdge, m.roofTile, m.roofEdge, m.roofEdge, m.roofEdge]);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
    return g;
  };
  slope(-1); // north face
  const south = slope(1);

  const onRoof = new Batch();
  const cx = shell.width / 2;
  for (const p of panelRects(roof.solar)) {
    onRoof.add(m.panel, boxGeo({ x0: p.x0 - cx, x1: p.x1 - cx, y0: 0.08, y1: 0.13, z0: p.from, z1: p.to }));
  }
  for (const w of roof.windows) {
    onRoof.add(m.roofWindow, boxGeo({ x0: w.x0 - cx, x1: w.x1 - cx, y0: 0.08, y1: 0.15, z0: w.from, z1: w.to }));
  }
  onRoof.flush(south, { castShadow: false });

  const shape = new THREE.Shape([
    new THREE.Vector2(0, shell.wallHeight),
    new THREE.Vector2(shell.depth, shell.wallHeight),
    new THREE.Vector2(R.half, R.ridgeY),
  ]);
  for (const x of [shell.wallThickness, shell.width]) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: shell.wallThickness, bevelEnabled: false });
    geo.rotateY(-Math.PI / 2); // shape x → world z, extrusion → world −x
    const mesh = new THREE.Mesh(geo, m.gable);
    mesh.position.x = x;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function buildScene(house, { materials: m, quality }) {
  const { plot, shell, roof } = house;
  const scene = new THREE.Scene();
  const statics = new THREE.Group();
  statics.name = 'static';
  scene.add(statics);
  const batch = new Batch();
  const pw = plot.x1 - plot.x0, pd = plot.z1 - plot.z0;
  const cx = (plot.x0 + plot.x1) / 2, cz = (plot.z0 + plot.z1) / 2;

  // Ground: a thin slab with a clean edge, the lawn on top, and a soft contact shadow below.
  batch.add(m.plotEdge, boxGeo({ x0: plot.x0, x1: plot.x1, y0: -0.3, y1: -0.02, z0: plot.z0, z1: plot.z1 }, 0.08));
  batch.add(m.lawn, boxGeo({ x0: plot.x0, x1: plot.x1, y0: -0.02, y1: 0, z0: plot.z0, z1: plot.z1 }));
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(pw * 1.15, pd * 1.25), m.contactShadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(cx + 0.6, -0.32, cz + 0.8);
  shadow.name = 'contact-shadow';
  scene.add(shadow);

  for (const s of house.surfaces) {
    const deck = s.kind === 'deck';
    batch.add(m[s.kind], boxGeo({ x0: s.x0, x1: s.x1, y0: 0, y1: deck ? 0.22 : 0.03, z0: s.z0, z1: s.z1 }, deck ? 0.03 : 0));
  }
  for (const h of house.hedges) {
    batch.add(m.hedge, boxGeo({ x0: h.x0, x1: h.x1, y0: 0, y1: h.h, z0: h.z0, z1: h.z1 }, 0.3, 3));
  }

  batch.add(m.floor, boxGeo({ x0: 0, x1: shell.width, y0: 0, y1: 0.08, z0: 0, z1: shell.depth }));
  for (const side of SIDES) {
    for (const b of wallBoxes(side, shell, house.openings[side])) {
      if (b.kind === 'wall') { batch.add(m.wall, boxGeo(b, 0.02)); continue; }
      const { pane, frame } = openingParts(b);
      batch.add(m[OPENING_MATERIAL[b.kind]], boxGeo(pane));
      for (const f of frame) batch.add(m.frame, boxGeo(f));
    }
  }
  batch.flush(statics);

  const roofGroup = buildRoof(house, m);
  scene.add(roofGroup);

  const R = roofGeometry(shell, roof);
  const pickHouse = new THREE.Mesh(new THREE.BoxGeometry(shell.width, R.ridgeY, shell.depth), m.pick);
  pickHouse.position.set(shell.width / 2, R.ridgeY / 2, shell.depth / 2);
  pickHouse.name = 'pick-house';
  scene.add(pickHouse);

  const hemi = new THREE.HemisphereLight(0xe8eef6, 0x7a6a55, 1.1);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.0);
  sun.position.set(cx - 12, 30, cz + 22);
  sun.target.position.set(cx, 0, cz);
  const ext = Math.max(pw, pd) * 0.75;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 100 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);
  const world = { scene, roofGroup, sun, hemi, pickTargets: { house: pickHouse }, dispose: () => disposeScene(scene) };
  applyQuality(world, quality);
  return world;
}

export function applyQuality({ sun }, preset) {
  sun.castShadow = preset.shadows;
  if (sun.shadow.mapSize.x !== preset.shadowMapSize) {
    sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
}

export function applyRoof(roofGroup, m, { lift, opacity, visible }) {
  roofGroup.position.y = lift;
  roofGroup.visible = visible;
  for (const mt of m.roofFade) {
    mt.opacity = opacity;
    mt.depthWrite = opacity > 0.98;
  }
}

export function disposeScene(root) {
  const seen = new Set();
  root.traverse(o => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    for (const mt of [o.material].flat().filter(Boolean)) {
      if (seen.has(mt)) continue;
      seen.add(mt);
      for (const v of Object.values(mt)) if (v && v.isTexture) v.dispose();
      mt.dispose();
    }
  });
}

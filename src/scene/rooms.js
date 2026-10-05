import * as THREE from 'three';

const FLOOR_Y0 = 0.08, FLOOR_Y1 = 0.1;   // a thin overlay on the house floor slab
const PICK_Y1 = 0.12;                     // pick at floor level: you tap the floor you see
const FLASH_Y = 0.121;
const FLOOR_GLOW = 0.7, GLASS_GLOW = 1.2, LIGHT_INTENSITY = 4, FLASH_PEAK = 0.45;
const BLACK = new THREE.Color(0x000000), WHITE = new THREE.Color(0xffffff);

function rectBox(r, y0, y1) {
  const g = new THREE.BoxGeometry(r.x1 - r.x0, y1 - y0, r.z1 - r.z0);
  g.translate((r.x0 + r.x1) / 2, (y0 + y1) / 2, (r.z0 + r.z1) / 2);
  return g;
}

export function buildRooms(house, m, litRooms) {
  const group = new THREE.Group();
  group.name = 'rooms';
  const lit = new Set(litRooms);
  const rooms = {}, glass = {}, picks = [];
  for (const [id, room] of Object.entries(house.rooms)) {
    const isLit = lit.has(id);
    const floorMat = isLit ? m.floor.clone() : m.floor;
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const entry = { id, center: null, floorMat: isLit ? floorMat : null, light: null, flashMat, flashMeshes: [] };
    let cx = 0, cz = 0, area = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const r of room.rects) {
      const floor = new THREE.Mesh(rectBox(r, FLOOR_Y0, FLOOR_Y1), floorMat);
      floor.receiveShadow = true;
      floor.name = `floor-${id}`;
      group.add(floor);
      const pick = new THREE.Mesh(rectBox(r, 0, PICK_Y1), m.pick);
      pick.userData.roomId = id;
      pick.name = `pick-${id}`;
      group.add(pick);
      picks.push(pick);
      const flash = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), flashMat);
      flash.rotation.x = -Math.PI / 2;
      flash.position.set((r.x0 + r.x1) / 2, FLASH_Y, (r.z0 + r.z1) / 2);
      flash.visible = false;
      flash.renderOrder = 10;
      group.add(flash);
      entry.flashMeshes.push(flash);
      const a = (r.x1 - r.x0) * (r.z1 - r.z0);
      cx += ((r.x0 + r.x1) / 2) * a; cz += ((r.z0 + r.z1) / 2) * a; area += a;
      minX = Math.min(minX, r.x0); maxX = Math.max(maxX, r.x1); minZ = Math.min(minZ, r.z0); maxZ = Math.max(maxZ, r.z1);
    }
    entry.center = { x: cx / area, z: cz / area };
    if (isLit) {
      const light = new THREE.PointLight(0xffffff, 0, Math.max(3, Math.hypot(maxX - minX, maxZ - minZ)), 2);
      light.position.set(entry.center.x, house.shell.wallHeight - 0.4, entry.center.z);
      light.userData.base = 0;
      group.add(light);
      entry.light = light;
      glass[id] = m.glass.clone();
    }
    rooms[id] = entry;
  }
  return { group, rooms, glass, picks, fade: 1 };
}

export function applyRoomGlow(handle, glows, preset) {
  const c = new THREE.Color();
  for (const [id, entry] of Object.entries(handle.rooms)) {
    if (!entry.light) continue;
    const g = glows[id];
    const on = !!(g && g.on && g.rgb);
    if (on) c.setRGB(g.rgb[0] / 255, g.rgb[1] / 255, g.rgb[2] / 255, THREE.SRGBColorSpace);
    const level = on ? g.level : 0;
    entry.floorMat.emissive.copy(on ? c : BLACK);
    entry.floorMat.emissiveIntensity = FLOOR_GLOW * level;
    const gm = handle.glass[id];
    gm.emissive.copy(on ? c : BLACK);
    gm.emissiveIntensity = GLASS_GLOW * level;
    entry.light.color.copy(on ? c : WHITE);
    const base = LIGHT_INTENSITY * level;
    entry.light.userData.base = base;
    entry.light.intensity = base * handle.fade;
    entry.light.visible = preset.roomLights;
  }
}

export function applyRoomLightFade(handle, f) {
  handle.fade = f;
  for (const entry of Object.values(handle.rooms)) {
    if (!entry.light) continue;
    entry.light.intensity = entry.light.userData.base * f;
  }
}

export function applyRoomQuality(handle, preset) {
  for (const entry of Object.values(handle.rooms)) if (entry.light) entry.light.visible = preset.roomLights;
}

export function applyFlash(handle, id, phase, tone) {
  const entry = handle.rooms[id];
  if (!entry) return;
  const p = Math.min(1, Math.max(0, phase));
  entry.flashMat.color.set(tone === 'dark' ? 0x000000 : 0xffffff);
  entry.flashMat.opacity = Math.sin(Math.PI * p) * FLASH_PEAK;
  for (const f of entry.flashMeshes) f.visible = p > 0 && p < 1;
}

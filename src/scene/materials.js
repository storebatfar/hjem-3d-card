import * as THREE from 'three';

export const PALETTE = Object.freeze({
  wall: 0xf3f1ec, frame: 0xf7f7f4, glass: 0x51687c, door: 0x4a4f56, garageDoor: 0x8a9097,
  lawn: 0x76a352, plotEdge: 0x5e7f45, concrete: 0xcdc9c0, path: 0xd5d1c8, deck: 0x9a6b45,
  hedge: 0x456f36, floor: 0xdccdb3, roofTile: 0x3a3e44, roofEdge: 0x2e3237, panel: 0x1d2738,
  roofWindow: 0xa9c7de,
});

export function createMaterials({ makeCanvas } = {}) {
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra });
  const m = {
    wall: std(PALETTE.wall),
    frame: std(PALETTE.frame, { roughness: 0.6 }),
    glass: std(PALETTE.glass, { roughness: 0.15, metalness: 0.1 }),
    door: std(PALETTE.door, { roughness: 0.7 }),
    garageDoor: std(PALETTE.garageDoor, { roughness: 0.6 }),
    lawn: std(PALETTE.lawn),
    plotEdge: std(PALETTE.plotEdge),
    concrete: std(PALETTE.concrete),
    path: std(PALETTE.path),
    deck: std(PALETTE.deck, { roughness: 0.8 }),
    hedge: std(PALETTE.hedge),
    floor: std(PALETTE.floor),
    // Roof materials fade out during the roof lift, so they are transparent from the start.
    roofTile: std(PALETTE.roofTile, { transparent: true }),
    roofEdge: std(PALETTE.roofEdge, { transparent: true }),
    gable: std(PALETTE.wall, { transparent: true }),
    panel: std(PALETTE.panel, { transparent: true, roughness: 0.3, metalness: 0.3 }),
    roofWindow: std(PALETTE.roofWindow, { transparent: true, roughness: 0.2 }),
    pick: new THREE.MeshBasicMaterial({ visible: false }),
    contactShadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
  };
  if (makeCanvas) {
    const tiles = makeCanvas(64, 64);
    const g = tiles.getContext('2d');
    g.fillStyle = '#3a3e44'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#2a2d32'; g.fillRect(0, 56, 64, 8);
    const tex = new THREE.CanvasTexture(tiles);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    m.roofTile.map = tex;
    m.roofTile.color.set(0xffffff);

    const sh = makeCanvas(128, 128);
    const s = sh.getContext('2d');
    const grad = s.createRadialGradient(64, 64, 8, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    s.fillStyle = grad; s.fillRect(0, 0, 128, 128);
    m.contactShadow.map = new THREE.CanvasTexture(sh);
  }
  m.roofFade = [m.roofTile, m.roofEdge, m.gable, m.panel, m.roofWindow];
  return m;
}

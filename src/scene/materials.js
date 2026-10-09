import * as THREE from 'three';

export const PALETTE = Object.freeze({
  wall: 0xeeeee9, frame: 0x2a2f33, glass: 0x2a3640, door: 0x1f2627, garageDoor: 0x2c3439,
  lawn: 0x6a9a2a, plotEdge: 0x5e7f45, concrete: 0xb8a68c, path: 0xb5a47e, deck: 0x5a4433,
  hedge: 0x2f4f1e, floor: 0xdccdb3, roofTile: 0x35383c, roofEdge: 0x2a2c30, panel: 0x161b22,
  roofWindow: 0xa9c7de, inner: 0xf2f1ed, cabinet: 0xe3ddd2, counter: 0xc9b79c,
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
    inner: std(PALETTE.inner),
    cabinet: std(PALETTE.cabinet),
    counter: std(PALETTE.counter, { roughness: 0.7 }),
    // Roof materials fade out during the roof lift, so they are transparent from the start.
    roofTile: std(PALETTE.roofTile, { transparent: true }),
    roofEdge: std(PALETTE.roofEdge, { transparent: true }),
    gable: std(PALETTE.wall, { transparent: true }),
    panel: std(PALETTE.panel, { transparent: true, roughness: 0.3, metalness: 0.3 }),
    roofWindow: std(PALETTE.roofWindow, { transparent: true, roughness: 0.2 }),
    pick: new THREE.MeshBasicMaterial({ visible: false }),
    contactShadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    carGlass: std(0x111418, { roughness: 0.1, metalness: 0.2 }),
    tyre: std(0x15181c, { roughness: 0.8 }),
    tailLight: std(0x6e0d10, { emissive: new THREE.Color(0x8a0f12), emissiveIntensity: 0.6 }),
    charger: std(0xf4f4f2, { roughness: 0.5 }),
    cable: std(0x111111, { roughness: 0.6 }),
  };
  if (makeCanvas) {
    const stripes = (w, h, base, line, every, thick, vertical) => {
      const c = makeCanvas(w, h), g = c.getContext('2d');
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = line;
      for (let p = 0; p < (vertical ? w : h); p += every) vertical ? g.fillRect(p, 0, thick, h) : g.fillRect(0, p, w, thick);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    };
    m.deck.map = stripes(64, 64, '#5a4433', '#46352a', 16, 2, false);
    m.deck.color.set(0xffffff);
    m.garageDoor.map = stripes(64, 64, '#2c3439', '#1d2327', 16, 2, false);
    m.garageDoor.color.set(0xffffff);

    const tiles = makeCanvas(64, 64);
    const g = tiles.getContext('2d');
    g.fillStyle = '#35383c'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#26282b'; g.fillRect(0, 56, 64, 8);
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

    const dashes = makeCanvas(64, 8), dg = dashes.getContext('2d');
    dg.fillStyle = 'rgba(61,220,132,1)'; dg.fillRect(0, 0, 32, 8);
    m.flowDashes = new THREE.CanvasTexture(dashes);
    m.flowDashes.wrapS = m.flowDashes.wrapT = THREE.RepeatWrapping;
  }
  m.roofFade = [m.roofTile, m.roofEdge, m.gable, m.panel, m.roofWindow];
  return m;
}

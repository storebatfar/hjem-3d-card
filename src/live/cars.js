const isOn = s => s?.state === 'on';
const AWAY_IGNORED = new Set(['home', 'on', 'unavailable', 'unknown']);

export function carStates(configCars, states) {
  const out = {};
  for (const [id, c] of Object.entries(configCars)) {
    const tracker = c.tracker ? states?.[c.tracker] : undefined;
    // Integration hiccups (unavailable/unknown/missing) must not make a parked car vanish.
    const home = !c.tracker || !tracker || AWAY_IGNORED.has(tracker.state);
    const raw = c.battery ? states?.[c.battery]?.state : undefined;
    const b = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
    out[id] = {
      home,
      cable: home && !!c.cable && isOn(states?.[c.cable]),
      charging: home && !!c.charging && isOn(states?.[c.charging]),
      battery: Number.isFinite(b) ? Math.round(b) : null,
    };
  }
  return out;
}

export function cableTarget(cars) {
  const ids = Object.keys(cars);
  return ids.find(id => cars[id].home && cars[id].charging)
    ?? ids.find(id => cars[id].home && cars[id].cable)
    ?? null;
}

export function carEntities(config) {
  const ids = [];
  for (const c of Object.values(config.cars ?? {})) {
    for (const k of ['tracker', 'cable', 'charging', 'battery']) if (c[k]) ids.push(c[k]);
  }
  if (config.charger?.led) ids.push(config.charger.led);
  return ids;
}

const NORMAL = { north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0] };
const GROUND = 0.04;
const r3 = v => Math.round(v * 1e6) / 1e6;

export function cableRoute(charger, port) {
  const n = NORMAL[charger.facing];
  const pts = [
    [charger.x + n[0] * 0.1, charger.y - 0.13, charger.z + n[2] * 0.1],
    [charger.x + n[0] * 0.35, GROUND, charger.z + n[2] * 0.35],
    ...charger.route.map(w => [w.x, GROUND, w.z]),
    [port.x + port.normal[0] * 0.35, GROUND, port.z + port.normal[2] * 0.35],
    [port.x, port.y, port.z],
  ];
  return pts.map(p => p.map(r3));
}

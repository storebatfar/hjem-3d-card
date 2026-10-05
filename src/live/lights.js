const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
const DEFAULT_KELVIN = 2700;
const MIN_LEVEL = 0.05;

// Tanner Helland's approximation — the same one Home Assistant uses for color_temp → rgb_color.
export function kelvinToRgb(kelvin) {
  const t = kelvin / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r), clamp(g), clamp(b)];
}

export function hsToRgb([h, s]) {
  const c = s / 100;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = 1 - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [clamp((r + m) * 255), clamp((g + m) * 255), clamp((b + m) * 255)];
}

export function lightGlow(stateObj) {
  if (!stateObj || stateObj.state === 'unavailable' || stateObj.state === 'unknown') {
    return { on: false, unavailable: true, rgb: null, level: 0 };
  }
  if (stateObj.state !== 'on') return { on: false, unavailable: false, rgb: null, level: 0 };
  const a = stateObj.attributes ?? {};
  const rgb = Array.isArray(a.rgb_color) ? a.rgb_color.map(clamp)
    : typeof a.color_temp_kelvin === 'number' ? kelvinToRgb(a.color_temp_kelvin)
    : Array.isArray(a.hs_color) ? hsToRgb(a.hs_color)
    : kelvinToRgb(DEFAULT_KELVIN);
  const level = typeof a.brightness === 'number' ? Math.max(MIN_LEVEL, Math.min(1, a.brightness / 255)) : 1;
  return { on: true, unavailable: false, rgb, level };
}

export function roomGlows(configRooms, states) {
  const out = {};
  for (const [id, rc] of Object.entries(configRooms)) if (rc.light) out[id] = lightGlow(states?.[rc.light]);
  return out;
}

export function watchedEntities(config) {
  const ids = Object.values(config.rooms).map(rc => rc.light).filter(Boolean);
  if (config.mode_entity) ids.push(config.mode_entity);
  return [...new Set(ids)];
}

export function pickStates(states, ids) {
  const out = {};
  for (const id of ids) out[id] = states?.[id];
  return out;
}

// HA replaces the state object of an entity only when that entity changes, so identity is enough.
export function statesChanged(prevPicked, nextStates, ids) {
  if (!prevPicked) return true;
  return ids.some(id => prevPicked[id] !== nextStates?.[id]);
}

export function flashTone(modeStateObj) {
  return modeStateObj?.state === 'Lys' ? 'dark' : 'light';
}

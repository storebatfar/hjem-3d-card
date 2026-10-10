import * as THREE from 'three';
import { createMaterials } from './scene/materials.js';
import { buildScene, applyQuality, applyRoof } from './scene/build.js';
import { computeViews, viewAt, roofAt, ease } from './view.js';
import { createInteraction } from './interaction.js';
import { createQuality } from './quality.js';
import { roomGlows, watchedEntities, pickStates, statesChanged, flashTone, lightGlow } from './live/lights.js';
import { applyRoomGlow, applyFlash, applyRoomLightFade } from './scene/rooms.js';
import { carStates, cableTarget, carEntities } from './live/cars.js';
import { setCable, applyCars, applyFlow, applyChargerLed } from './scene/cars.js';

export const stats = { liveViews: 0, frames: 0 };
const FLASH_MS = 400;
const FLOW_FRAME_MS = 66;   // ≈15 fps while a car charges

const TAP_MOVE_PX = 10;
const TAP_MAX_MS = 600;

export class View3D {
  constructor(container, config) {
    this.container = container;
    this.config = config;
    this.quality = createQuality(config.quality);
    this.renderer = null;
    this.canvas = null;
    this.world = null;
    this.disposed = false;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.autoUpdate = false;
      this.canvas = this.renderer.domElement;
      Object.assign(this.canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'manipulation' });
      container.appendChild(this.canvas);

      const makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
      this.materials = createMaterials({ makeCanvas });
      const litRooms = Object.keys(config.rooms).filter(id => config.rooms[id].light);
      this.world = buildScene(config.house, { materials: this.materials, quality: this.quality.preset, litRooms, cars: config.cars, makeCanvas });
      this.watched = [...new Set([...watchedEntities(config), ...carEntities(config)])];
      this.prevStates = null;
      this.hass = null;
      this.glows = {};
      this.tone = 'light';
      this.flash = null;
      this.cableId = null;
      this.flowOn = false;
      this.flowTimer = 0;
      this.views = computeViews(config.house);
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
      this.interaction = createInteraction({ idleTimeoutMs: config.idle_timeout * 1000, now: performance.now() });
      this.raycaster = new THREE.Raycaster();
      this.ndc = new THREE.Vector2();
      this.size = { w: 0, h: 0 };
      this.visible = true;
      this.pageVisible = document.visibilityState !== 'hidden';
      this.raf = 0;
      this.lastFrame = 0;

      if (config.debug) {
        this.overlay = document.createElement('div');
        this.overlay.className = 'debug';
        container.appendChild(this.overlay);
      }
      this.applyPreset();
      this.bindEvents();
      stats.liveViews++;
      this.requestRender();
    } catch (e) {
      this.world?.dispose();
      if (this.renderer) {
        this.renderer.dispose();
        this.renderer.forceContextLoss();
      }
      this.canvas?.remove();
      throw e;
    }
  }

  applyPreset() {
    const p = this.quality.preset;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.pixelRatio));
    this.renderer.shadowMap.type = p.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    applyQuality(this.world, p);
    applyRoomGlow(this.world.rooms, this.glows, p);
    this.renderer.shadowMap.needsUpdate = true;
    this.resize(true);
  }

  bindEvents() {
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);
    this.io = new IntersectionObserver(entries => {
      const e = entries[entries.length - 1];
      this.visible = e.isIntersecting;
      this.requestRender();
    });
    this.io.observe(this.container);
    this.onVisibility = () => { this.pageVisible = document.visibilityState !== 'hidden'; this.requestRender(); };
    document.addEventListener('visibilitychange', this.onVisibility);

    this.onContextLost = e => e.preventDefault();
    this.onContextRestored = () => this.requestRender();
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);

    let down = null;
    this.onDown = e => { down = { x: e.clientX, y: e.clientY, at: performance.now() }; };
    this.onUp = e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const held = performance.now() - down.at;
      down = null;
      if (moved < TAP_MOVE_PX && held < TAP_MAX_MS) this.handleTap(e.clientX, e.clientY);
    };
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointerup', this.onUp);
    // No render loop runs while resting, so wake once a second in plan mode to honour the idle timeout.
    this.timer = setInterval(() => { if (this.interaction.mode === 'plan') this.requestRender(); }, 1000);
  }

  resize(force = false) {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return; // not laid out yet (hidden conditional) — draw() retries later
    if (!force && w === this.size.w && h === this.size.h) return;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
  }

  hit(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (this.interaction.mode === 'plan') {
      const targets = [...this.world.pickTargets.rooms, ...this.world.pickTargets.blockers, ...this.world.pickTargets.cars];
      const nearest = this.raycaster.intersectObjects(targets, false)
        .filter(h => !h.object.userData.carId || h.object.parent.visible)   // away cars don't catch taps
        .sort((a, b) => a.distance - b.distance)[0];
      const ud = nearest?.object.userData ?? {};
      if (ud.roomId) return this.config.rooms[ud.roomId]?.light ? { kind: 'room', id: ud.roomId } : { kind: 'house' };
      if (ud.carId) return { kind: 'car', id: ud.carId };
    }
    // Lawn, driveway and other non-target hits fall through to the house box: outside it is "empty" → back to idle.
    return this.raycaster.intersectObject(this.world.pickTargets.house, false).length ? { kind: 'house' } : { kind: 'empty' };
  }

  startFlash(id, now) {
    if (this.flash && this.flash.id !== id) {
      applyFlash(this.world.rooms, this.flash.id, 1, this.tone);
    }
    this.flash = { id, start: now };
    applyFlash(this.world.rooms, id, 0.001, this.tone);
  }

  handleTap(x, y) {
    const now = performance.now();
    const h = this.hit(x, y);
    const inPlan = this.interaction.mode === 'plan';
    this.interaction.tap(now, h.kind === 'room' || h.kind === 'car' ? 'object' : h.kind);
    if (inPlan && h.kind === 'room') {
      this.toggleRoom(h.id);
      this.startFlash(h.id, now);
    }
    if (inPlan && h.kind === 'car') this.selectPage(this.config.cars[h.id].page);
    this.requestRender();
  }

  requestRender() {
    if (this.raf || this.disposed || !this.visible || !this.pageVisible) return;
    this.raf = requestAnimationFrame(now => this.frame(now));
  }

  frame(now) {
    this.raf = 0;
    const s = this.interaction.tick(now);
    if (s.animating && this.lastFrame && this.quality.sample(now - this.lastFrame)) this.applyPreset();
    this.lastFrame = s.animating ? now : 0;
    let flashing = false;
    if (this.flash) {
      const phase = (now - this.flash.start) / FLASH_MS;
      applyFlash(this.world.rooms, this.flash.id, phase, this.tone);
      if (phase >= 1) this.flash = null; else flashing = true;
    }
    if (this.flowOn) applyFlow(this.world.charger, true, now / 1000);
    if (s.animating) this.renderer.shadowMap.needsUpdate = true;
    this.draw(s.t);
    this.updateOverlay(s);
    if (s.animating || flashing) this.requestRender();
    else if (this.flowOn && !this.flowTimer) {
      this.flowTimer = setTimeout(() => { this.flowTimer = 0; this.requestRender(); }, FLOW_FRAME_MS);
    }
  }

  draw(t) {
    if (!this.size.w) { this.resize(true); if (!this.size.w) return; }
    const aspect = this.size.w / this.size.h;
    const v = viewAt(this.views, t, aspect);
    const hh = v.halfHeight;
    Object.assign(this.camera, { left: -hh * aspect, right: hh * aspect, top: hh, bottom: -hh });
    this.camera.position.set(...v.pos);
    this.camera.lookAt(...v.target);
    this.camera.updateProjectionMatrix();
    applyRoof(this.world.roofGroup, this.materials, roofAt(t));
    applyRoomLightFade(this.world.rooms, ease(t));
    stats.frames++;
    if (stats.frames === 1) this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.world.scene, this.camera);
  }

  updateOverlay(s) {
    if (!this.overlay) return;
    this.overlay.textContent = `${this.quality.level} · ${this.quality.median.toFixed(1)} ms · ${s.mode}`;
  }

  setHass(hass) {
    this.hass = hass;
    if (!statesChanged(this.prevStates, hass?.states, this.watched)) return;
    this.prevStates = pickStates(hass?.states, this.watched);
    this.glows = roomGlows(this.config.rooms, hass?.states);
    applyRoomGlow(this.world.rooms, this.glows, this.quality.preset);
    this.tone = flashTone(this.config.mode_entity ? hass?.states?.[this.config.mode_entity] : undefined);
    const cs = carStates(this.config.cars, hass?.states);
    applyCars(this.world.cars, cs);
    if (this.world.charger) {
      const target = cableTarget(cs);
      setCable(this.world.charger, target, target ? this.world.cars.cars[target].port : null);
      this.cableId = target;
      this.flowOn = !!(target && cs[target].charging);
      if (!this.flowOn) applyFlow(this.world.charger, false, 0);
      if (this.config.charger.led) applyChargerLed(this.world.charger, lightGlow(hass?.states?.[this.config.charger.led]));
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
  }

  toggleRoom(id) {
    const entity = this.config.rooms[id]?.light;
    if (!entity || typeof this.hass?.callService !== 'function') return;
    Promise.resolve()
      .then(() => this.hass.callService('light', 'toggle', {}, { entity_id: entity }))
      .catch(e => console.warn('hjem-3d-card: kunne ikke skifte', entity, e));
  }

  selectPage(option) {
    const entity = this.config.page_entity;
    if (!entity || typeof this.hass?.callService !== 'function') return;
    Promise.resolve()
      .then(() => this.hass.callService('input_select', 'select_option', { option }, { entity_id: entity }))
      .catch(e => console.warn('hjem-3d-card: kunne ikke skifte side', option, e));
  }

  debugState() {
    return { mode: this.interaction.mode, flow: this.flowOn ? 'on' : 'off', cable: this.cableId };
  }

  debugFlashes() {
    const visible = [];
    for (const [id, entry] of Object.entries(this.world.rooms.rooms)) {
      if (entry.flashMeshes.some(m => m.visible)) visible.push(id);
    }
    return visible;
  }

  debugTapAt(x, z, y = 0.1) {
    if (!this.size.w) this.resize(true);
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    this.handleTap(r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height);
  }

  debugJump(t) {
    const s = this.interaction.jump(t, performance.now());
    this.renderer.shadowMap.needsUpdate = true;
    this.resize(true);
    this.draw(s.t);
    this.updateOverlay(s);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
    clearTimeout(this.flowTimer);
    this.ro.disconnect();
    this.io.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.world.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.overlay?.remove();
    stats.liveViews--;
  }
}

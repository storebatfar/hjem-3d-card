import * as THREE from 'three';
import { createMaterials } from './scene/materials.js';
import { buildScene, applyQuality, applyRoof } from './scene/build.js';
import { computeViews, viewAt, roofAt } from './view.js';
import { createInteraction } from './interaction.js';
import { createQuality } from './quality.js';

export const stats = { liveViews: 0 };

const TAP_MOVE_PX = 10;
const TAP_MAX_MS = 600;

export class View3D {
  constructor(container, config) {
    this.container = container;
    this.config = config;
    this.quality = createQuality(config.quality);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.canvas = this.renderer.domElement;
    Object.assign(this.canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'manipulation' });
    container.appendChild(this.canvas);

    this.materials = createMaterials({
      makeCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
    });
    this.world = buildScene(config.house, { materials: this.materials, quality: this.quality.preset });
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
    this.disposed = false;

    if (config.debug) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'debug';
      container.appendChild(this.overlay);
    }
    this.applyPreset();
    this.bindEvents();
    stats.liveViews++;
    this.requestRender();
  }

  applyPreset() {
    const p = this.quality.preset;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.pixelRatio));
    this.renderer.shadowMap.type = p.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    applyQuality(this.world, p);
    this.resize(true);
  }

  bindEvents() {
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.requestRender(); });
    this.io.observe(this.container);
    this.onVisibility = () => { this.pageVisible = document.visibilityState !== 'hidden'; this.requestRender(); };
    document.addEventListener('visibilitychange', this.onVisibility);

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
    this.requestRender();
  }

  hit(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.intersectObject(this.world.pickTargets.house, false).length ? 'house' : 'empty';
  }

  handleTap(x, y) {
    this.interaction.tap(performance.now(), this.hit(x, y));
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
    this.draw(s.t);
    this.updateOverlay(s);
    if (s.animating) this.requestRender();
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
    this.renderer.render(this.world.scene, this.camera);
  }

  updateOverlay(s) {
    if (!this.overlay) return;
    this.overlay.textContent = `${this.quality.level} · ${this.quality.median.toFixed(1)} ms · ${s.mode}`;
  }

  debugJump(t) {
    const s = this.interaction.jump(t, performance.now());
    this.resize(true);
    this.draw(s.t);
    this.updateOverlay(s);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
    this.ro.disconnect();
    this.io.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
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

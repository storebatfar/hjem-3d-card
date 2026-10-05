import { normalizeConfig } from './config.js';
import { View3D, stats } from './renderer.js';
import { VERSION } from './version.js';

const webglAvailable = () => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
};

const STYLE = `
  :host { display: block; }
  ha-card { display: block; background: none; border: none; box-shadow: none; overflow: hidden; }
  .stage { position: relative; width: 100%; }
  .msg { padding: 16px; color: var(--primary-text-color); }
  .debug { position: absolute; top: 6px; left: 8px; font: 12px/1.3 monospace; color: #fff;
           background: rgba(0, 0, 0, .45); padding: 2px 6px; border-radius: 4px; pointer-events: none; }
`;

class HjemCard extends HTMLElement {
  setConfig(raw) {
    this.config = normalizeConfig(raw); // throws a readable error → HA shows its error card
    if (this.isConnected) this.mount();
  }

  set hass(hass) { this._hass = hass; }

  getCardSize() { return 12; }

  connectedCallback() { if (this.config) this.mount(); }

  disconnectedCallback() { this.unmount(); }

  mount() {
    this.unmount();
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${STYLE}</style><ha-card><div class="stage"></div></ha-card>`;
    const stage = root.querySelector('.stage');
    stage.style.height = this.config.height;
    if (!webglAvailable()) {
      stage.innerHTML = '<div class="msg">Denne browser kan ikke vise 3D (WebGL mangler).</div>';
      return;
    }
    this.view = new View3D(stage, this.config);
  }

  unmount() {
    this.view?.dispose();
    this.view = null;
  }

  debugJump(t) { this.view?.debugJump(t); }
}

if (!customElements.get('hjem-3d-card')) {
  customElements.define('hjem-3d-card', HjemCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'hjem-3d-card', name: 'Hjem 3D', description: 'Interaktiv 3D-model af hus og have' });
  console.info(`%c HJEM-3D-CARD %c v${VERSION} `, 'background:#3d6b2f;color:#fff', 'background:#ddd;color:#333');
}
window.hjem3dStats = stats;

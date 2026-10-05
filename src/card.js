import { VERSION } from './version.js';

class HjemCard extends HTMLElement {
  setConfig(config) { this.config = config; }
  getCardSize() { return 12; }
}
if (!customElements.get('hjem-3d-card')) customElements.define('hjem-3d-card', HjemCard);
console.info(`hjem-3d-card v${VERSION}`);

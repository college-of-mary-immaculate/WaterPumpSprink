const sprinklerIconSVG = (id) => `
<svg viewBox="0 0 34 34" aria-hidden="true">
  <rect x="14" y="2" width="6" height="8" rx="1.5" class="sprinkler-body" />
  <rect x="6" y="9" width="22" height="4" rx="2" class="sprinkler-deflector" />
  <circle cx="17" cy="9" r="2.2" class="sprinkler-body" />
  <g class="mist" id="mist-${id}">
    <line x1="10" y1="15" x2="7" y2="24" stroke="#4FA8D8" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="17" y1="15" x2="17" y2="26" stroke="#4FA8D8" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="24" y1="15" x2="27" y2="24" stroke="#4FA8D8" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="13" y1="15" x2="11" y2="22" stroke="#4FA8D8" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="21" y1="15" x2="23" y2="22" stroke="#4FA8D8" stroke-width="1.2" stroke-linecap="round"/>
  </g>
</svg>`;

export class SprinklerZones {
  constructor(root) {
    this.grid = root.querySelector('#zoneGrid');
    this.built = false;
    this.cards = new Map();
  }

  _build(sprinklers) {
    this.grid.innerHTML = '';
    sprinklers.forEach((z) => {
      const card = document.createElement('div');
      card.className = 'zone-card';
      card.innerHTML = `
        <div class="zone-icon-wrap">${sprinklerIconSVG(z.id)}</div>
        <div class="zone-info">
          <span class="zone-name">${z.zone}</span>
          <div class="zone-meta">
            <div class="zone-bar"><div class="zone-bar-fill" id="zonebar-${z.id}"></div></div>
            <span class="zone-status" id="zonestatus-${z.id}">CLOSED</span>
          </div>
        </div>`;
      this.grid.appendChild(card);
      this.cards.set(z.id, {
        mist: card.querySelector(`#mist-${z.id}`),
        bar: card.querySelector(`#zonebar-${z.id}`),
        status: card.querySelector(`#zonestatus-${z.id}`),
      });
    });
    this.built = true;
  }

  /** @param {Array} sprinklers  @param {number} opening 0-100 shared valve opening from the fuzzy controller */
  render(sprinklers, opening, statusLabel) {
    if (!this.built) this._build(sprinklers);

    sprinklers.forEach((z) => {
      const refs = this.cards.get(z.id);
      if (!refs) return;
      refs.bar.style.width = `${opening}%`;
      refs.bar.style.background = opening >= 80 ? 'var(--red)' : opening >= 45 ? 'var(--amber)' : 'var(--green)';
      refs.status.textContent = statusLabel;
      refs.status.classList.toggle('open', opening >= 45 && opening < 80);
      refs.status.classList.toggle('full', opening >= 80);
      refs.mist.classList.toggle('active', opening >= 10);
    });
  }

  destroy() {
    this.cards.clear();
    if (this.grid) this.grid.innerHTML = '';
    this.built = false;
  }
}

export class FirePanel {
  constructor(root, { onSimulateFire, onClear, onSmokeChange, onHeatChange }) {
    this.root = root;
    this.smokeValue = root.querySelector('#smokeValue');
    this.heatValue = root.querySelector('#heatValue');
    this.smokeFill = root.querySelector('#smokeFill');
    this.heatFill = root.querySelector('#heatFill');
    this.smokeMembership = root.querySelectorAll('#smokeMembership .mship');
    this.heatMembership = root.querySelectorAll('#heatMembership .mship');
    this.valveRuleTrace = root.querySelector('#valveRuleTrace');

    this.smokeSlider = root.querySelector('#smokeSlider');
    this.heatSlider = root.querySelector('#heatSlider');
    this.btnFire = root.querySelector('#btnFire');
    this.btnClear = root.querySelector('#btnClear');

    this._onFireClick = onSimulateFire;
    this._onClearClick = onClear;
    this._onSmokeInput = (e) => onSmokeChange && onSmokeChange(Number(e.target.value));
    this._onHeatInput = (e) => onHeatChange && onHeatChange(Number(e.target.value));

    this.btnFire.addEventListener('click', this._onFireClick);
    this.btnClear.addEventListener('click', this._onClearClick);

    if (this.smokeSlider) this.smokeSlider.addEventListener('input', this._onSmokeInput);
    if (this.heatSlider) this.heatSlider.addEventListener('input', this._onHeatInput);
  }

  /**
   * @param {{smoke:number, heat:number}} sensors
   * @param {{smokeDeg:object, heatDeg:object, dominantRule:string, opening:number}} valveResult
   */
  render(sensors, valveResult) {
    this.smokeValue.textContent = Math.round(sensors.smoke);
    this.heatValue.textContent = Math.round(sensors.heat);
    this.smokeFill.style.height = `${sensors.smoke}%`;
    this.heatFill.style.height = `${sensors.heat}%`;

    if (this.smokeSlider && document.activeElement !== this.smokeSlider) {
      this.smokeSlider.value = Math.round(sensors.smoke);
    }
    if (this.heatSlider && document.activeElement !== this.heatSlider) {
      this.heatSlider.value = Math.round(sensors.heat);
    }

    const danger = valveResult.opening >= 45;
    this.smokeFill.classList.toggle('danger', sensors.smoke >= 55);
    this.heatFill.classList.toggle('danger', sensors.heat >= 55);

    this._paintMembership(this.smokeMembership, valveResult.smokeDeg);
    this._paintMembership(this.heatMembership, valveResult.heatDeg);

    this.valveRuleTrace.textContent = valveResult.dominantRule;

    return danger;
  }

  _paintMembership(nodeList, degrees) {
    nodeList.forEach((el) => {
      const set = el.dataset.set === 'MED' ? 'MED' : el.dataset.set;
      const deg = degrees[set] || 0;
      el.classList.toggle('active', deg > 0.15);
      el.style.opacity = 0.5 + deg * 0.5;
    });
  }

  destroy() {
    this.btnFire.removeEventListener('click', this._onFireClick);
    this.btnClear.removeEventListener('click', this._onClearClick);
    if (this.smokeSlider) this.smokeSlider.removeEventListener('input', this._onSmokeInput);
    if (this.heatSlider) this.heatSlider.removeEventListener('input', this._onHeatInput);
  }
}

export class FirePanel {
  constructor(root, { onSimulateFire, onClear }) {
    this.root = root;
    this.smokeValue = root.querySelector('#smokeValue');
    this.heatValue = root.querySelector('#heatValue');
    this.smokeFill = root.querySelector('#smokeFill');
    this.heatFill = root.querySelector('#heatFill');
    this.smokeMembership = root.querySelectorAll('#smokeMembership .mship');
    this.heatMembership = root.querySelectorAll('#heatMembership .mship');
    this.valveRuleTrace = root.querySelector('#valveRuleTrace');

    root.querySelector('#btnFire').addEventListener('click', onSimulateFire);
    root.querySelector('#btnClear').addEventListener('click', onClear);
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
}

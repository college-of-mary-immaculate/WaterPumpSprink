const GAUGE_MAX_PSI = 100;
const GAUGE_ARC_LENGTH = 251.2;

export class PlantPanel {
  constructor(root, { onTargetLevelChange }) {
    this.root = root;
    this.tankLiquid = root.querySelector('#tankLiquid');
    this.tankTargetLine = root.querySelector('#tankTargetLine');
    this.tankValue = root.querySelector('#tankValue');
    this.targetLevelSlider = root.querySelector('#targetLevelSlider');
    this.targetLevelValue = root.querySelector('#targetLevelValue');

    this.gaugeFill = root.querySelector('#gaugeFill');
    this.gaugeNeedle = root.querySelector('#gaugeNeedle');
    this.pressureValue = root.querySelector('#pressureValue');
    this.targetPressureLabel = root.querySelector('#targetPressureLabel');

    this.motorRotor = root.querySelector('#motorRotor');
    this.pumpStatus = root.querySelector('#pumpStatus');
    this.pumpSpeedBar = root.querySelector('#pumpSpeedBar');
    this.pumpSpeedValue = root.querySelector('#pumpSpeedValue');
    this.pumpRpmValue = root.querySelector('#pumpRpmValue');
    this.pumpRuleTrace = root.querySelector('#pumpRuleTrace');
    this.rotorBlades = root.querySelectorAll('.rotor-blade');

    this._drawTicks();

    this.targetLevelSlider.addEventListener('input', (e) => {
      this.targetLevelValue.textContent = `${e.target.value}%`;
    });
    this.targetLevelSlider.addEventListener('change', (e) => {
      onTargetLevelChange(Number(e.target.value));
    });
  }

  _drawTicks() {
    const g = this.root.querySelector('#gaugeTicks');
    const cx = 100, cy = 110, r1 = 68, r2 = 78;
    for (let i = 0; i <= 10; i++) {
      const angle = Math.PI - (i / 10) * Math.PI; // 180deg sweep, left(0) to right(100)
      const x1 = cx + r1 * Math.cos(angle);
      const y1 = cy - r1 * Math.sin(angle);
      const x2 = cx + r2 * Math.cos(angle);
      const y2 = cy - r2 * Math.sin(angle);
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', x1); tick.setAttribute('y1', y1);
      tick.setAttribute('x2', x2); tick.setAttribute('y2', y2);
      tick.setAttribute('class', 'gauge-tick');
      g.appendChild(tick);
    }
  }

  setTargetLevel(value) {
    this.targetLevelSlider.value = value;
    this.targetLevelValue.textContent = `${value}%`;
  }

  /**
   * @param {object} sensors {tankLevel, pressure}
   * @param {object} system {targetLevel, targetPressure}
   * @param {object} pumpResult {speed, error, dominantRule}
   */
  render(sensors, system, pumpResult) {
    // Tank
    this.tankLiquid.style.height = `${sensors.tankLevel}%`;
    this.tankTargetLine.style.bottom = `${system.targetLevel}%`;
    this.tankValue.textContent = Math.round(sensors.tankLevel);
    const overfull = sensors.tankLevel > system.targetLevel + 15;
    this.tankLiquid.style.background = overfull
      ? 'linear-gradient(180deg, #8FD9F5, #4FA8D8 40%, #2C5A72)'
      : '';

    const pct = Math.max(0, Math.min(1, sensors.pressure / GAUGE_MAX_PSI));
    this.gaugeFill.style.strokeDashoffset = `${GAUGE_ARC_LENGTH * (1 - pct)}`;
    const angleDeg = pct * 180;
    this.gaugeNeedle.style.transform = `rotate(${angleDeg - 90}deg)`;
    this.pressureValue.textContent = Math.round(sensors.pressure);
    this.targetPressureLabel.textContent = Math.round(system.targetPressure);

    const lowPressure = sensors.pressure < system.targetPressure * 0.6;
    this.gaugeFill.style.stroke = lowPressure ? 'var(--red)' : 'var(--blue)';

    const speed = pumpResult.speed;
    const running = speed > 3;
    this.motorRotor.classList.toggle('spinning', running);
    this.motorRotor.style.animationDuration = `${Math.max(0.35, 3.2 - speed / 33)}s`;
    this.rotorBlades.forEach((b) => b.classList.toggle('active', running));

    this.pumpStatus.textContent = running ? (speed >= 85 ? 'FULL DRIVE' : 'RUNNING') : 'IDLE';
    this.pumpStatus.style.color = running ? (speed >= 85 ? 'var(--red)' : 'var(--green)') : 'var(--text-faint)';
    this.pumpSpeedBar.style.width = `${speed}%`;
    this.pumpSpeedValue.textContent = Math.round(speed);
    this.pumpRpmValue.textContent = Math.round((speed / 100) * 2900);

    this.pumpRuleTrace.textContent = pumpResult.dominantRule;
  }
}

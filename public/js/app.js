import { api } from './api/mockApi.js';
import { localApi } from './api/localFallback.js';
import { computePumpSpeed } from './fuzzy/pumpController.js';
import { computeValveOpening } from './fuzzy/sprinklerController.js';
import { FirePanel } from './components/FirePanel.js';
import { PlantPanel } from './components/PlantPanel.js';
import { SprinklerZones } from './components/SprinklerZones.js';
import { EventLog } from './components/EventLog.js';

const TICK_MS = 1100;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nowStr = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

let activeApi = api;
let usingFallback = false;

let state = null;
let fireActive = false;
let fireIntensityTarget = 0;
let lastLoggedValveStatus = null;
let lastLoggedPumpBand = null;
let lastValveOpening = 0;

const fireEl = document.getElementById('firePanel');
const plantEl = document.getElementById('plantPanel');
const sprinklerEl = document.getElementById('sprinklerPanel');
const logEl = document.querySelector('.event-log');

const fire = new FirePanel(fireEl, {
  onSimulateFire: () => {
    fireActive = true;
    fireIntensityTarget = 65 + Math.random() * 35;
    logEvent('WARN', 'MANUAL TRIGGER \u2014 fire event simulation started');
  },
  onClear: () => {
    fireActive = false;
    fireIntensityTarget = 0;
    logEvent('INFO', 'Manual reset \u2014 clearing smoke/heat, returning to standby');
  },
});

const plant = new PlantPanel(plantEl, {
  onTargetLevelChange: async (value) => {
    state.system.targetLevel = value;
    try { await activeApi.patchSystem({ targetLevel: value }); } catch (_) {}
    logEvent('INFO', `Operator changed tank setpoint to ${value}%`);
  },
});

const zones = new SprinklerZones(sprinklerEl);
const eventLog = new EventLog(logEl);

function setConnStatus(status) {
  const dot = document.getElementById('connDot');
  const label = document.getElementById('connLabel');
  dot.className = 'dot';
  if (status === 'live') { dot.classList.add('live'); label.textContent = usingFallback ? 'OFFLINE MOCK' : 'API LIVE'; }
  else if (status === 'alarm') { dot.classList.add('alarm'); label.textContent = 'ALARM'; }
  else { label.textContent = 'CONNECTING\u2026'; }
}

async function logEvent(level, msg) {
  const entry = { t: nowStr(), level, msg };
  try {
    await activeApi.postEvent(entry);
  } catch (_) { /* non-fatal */ }
}


async function boot() {
  try {
    state = await api.getSnapshot();
    activeApi = api;
    usingFallback = false;
  } catch (err) {
    console.warn('json-server unreachable, using in-browser fallback API:', err.message);
    activeApi = localApi;
    usingFallback = true;
    state = await localApi.getSnapshot();
  }
  plant.setTargetLevel(state.system.targetLevel);
  document.getElementById('modeLabel').textContent = state.system.mode;
  setConnStatus('live');
  eventLog.render(state.eventLog.slice().reverse());
  tick();
  setInterval(tick, TICK_MS);
  setInterval(updateClock, 1000);
  updateClock();
}

function updateClock() {
  document.getElementById('clock').textContent = nowStr();
}

async function tick() {
  const { sensors, system, pump, sprinklers } = state;

  const pumpResult = computePumpSpeed(system.targetLevel, sensors.tankLevel);
  const valveResult = computeValveOpening(sensors.smoke, sensors.heat);

  driftFireSensors(sensors, valveResult.opening);
  updatePlantDynamics(sensors, system, pumpResult, valveResult);

  pump.speed = pumpResult.speed;
  pump.rpm = Math.round((pumpResult.speed / 100) * 2900);
  pump.status = pumpResult.speed > 3 ? (pumpResult.speed >= 85 ? 'FULL DRIVE' : 'RUNNING') : 'IDLE';

  sprinklers.forEach((z) => {
    z.valve = valveResult.opening;
    z.status = valveResult.status;
  });
  
  syncToApi(sensors, pump, sprinklers);

  const dangerLevel = fire.render(sensors, valveResult);
  plant.render(sensors, system, pumpResult);
  zones.render(sprinklers, valveResult.opening, valveResult.status);
  setConnStatus(dangerLevel || valveResult.opening >= 45 ? 'alarm' : 'live');


  maybeLogTransition(pumpResult, valveResult);

  try {
    state.eventLog = await activeApi.getEventLog();
    eventLog.render(state.eventLog.slice().reverse());
  } catch (_) { /* keep last known log on transient failure */ }
}

function driftFireSensors(sensors, valveOpening) {
  const ambientSmoke = 2 + Math.random() * 3;
  const ambientHeat = 8 + Math.random() * 5;

  // Fire growth phase: active fires increase intensity
  if (fireActive) {
    fireIntensityTarget = clamp(fireIntensityTarget + (Math.random() - 0.3) * 4, 40, 100);
  } else {
    fireIntensityTarget = clamp(fireIntensityTarget - 6, 0, 100);
    if (fireIntensityTarget <= 0.5) fireIntensityTarget = 0;
  }

  // Sprinkler fire suppression: open sprinklers reduce fire intensity
  // This happens AFTER fire growth, so sprinklers actively fight the fire
  // Higher valve opening = stronger suppression (sprinklers put out fires)
  const suppressionRate = (valveOpening / 100) * 12;
  if (valveOpening >= 10) {
    fireIntensityTarget = clamp(fireIntensityTarget - suppressionRate, 0, 100);
    // Direct sensor reduction: sprinkler water directly cools and clears smoke
    const directReduction = (valveOpening / 100) * 8;
    sensors.smoke = clamp(sensors.smoke - directReduction, ambientSmoke, 100);
    sensors.heat = clamp(sensors.heat - directReduction * 1.2, ambientHeat, 100);
    if (fireActive && fireIntensityTarget <= 10) {
      fireActive = false;
      logEvent('INFO', 'Sprinklers suppressed fire — intensity returned to ambient');
    }
  }

  const smokeTarget = fireActive ? fireIntensityTarget * 0.9 : ambientSmoke;
  const heatTarget = fireActive ? fireIntensityTarget * 1.05 : ambientHeat;

  sensors.smoke = clamp(sensors.smoke + (smokeTarget - sensors.smoke) * 0.25 + (Math.random() - 0.5) * 1.5, 0, 100);
  sensors.heat = clamp(sensors.heat + (heatTarget - sensors.heat) * 0.35 + (Math.random() - 0.5) * 1.5, 0, 100);
}

  function updatePlantDynamics(sensors, system, pumpResult, valveResult) {
  const fillRate = (pumpResult.speed / 100) * 2.4;
  const sprinklerDraw = (valveResult.opening / 100) * 1.8;
  const baselineUse = 0.15;
  // Stop filling once tank reaches target level (with hysteresis to prevent overshoot)
  const effectiveFill = sensors.tankLevel >= system.targetLevel - 2 ? 0 : fillRate;
  sensors.tankLevel = clamp(sensors.tankLevel + effectiveFill - sprinklerDraw - baselineUse, 0, system.targetLevel + 1);

  const pressureTarget = system.targetPressure * (0.15 + 0.85 * (pumpResult.speed / 100)) - sprinklerDraw * 6;
  sensors.pressure = clamp(sensors.pressure + (pressureTarget - sensors.pressure) * 0.3 + (Math.random() - 0.5) * 0.6, 0, 100);
}

function syncToApi(sensors, pump, sprinklers) {
  activeApi.patchSensors({
    smoke: Math.round(sensors.smoke * 10) / 10,
    heat: Math.round(sensors.heat * 10) / 10,
    pressure: Math.round(sensors.pressure * 10) / 10,
    tankLevel: Math.round(sensors.tankLevel * 10) / 10,
  }).catch(() => {});
  activeApi.patchPump({ speed: pump.speed, rpm: pump.rpm, status: pump.status }).catch(() => {});
  sprinklers.forEach((z) => {
    activeApi.patchSprinkler(z.id, { valve: z.valve, status: z.status }).catch(() => {});
  });
}

function maybeLogTransition(pumpResult, valveResult) {
  const band = pumpResult.speed >= 85 ? 'MAX' : pumpResult.speed >= 55 ? 'HIGH' : pumpResult.speed >= 30 ? 'MED' : pumpResult.speed >= 5 ? 'LOW' : 'OFF';
  if (band !== lastLoggedPumpBand) {
    lastLoggedPumpBand = band;
    logEvent('INFO', `Pump governor \u2192 ${band} (${pumpResult.speed.toFixed(0)}% speed) \u2014 ${pumpResult.dominantRule}`);
  }
  if (valveResult.status !== lastLoggedValveStatus) {
    lastLoggedValveStatus = valveResult.status;
    const level = valveResult.status === 'CLOSED' ? 'INFO' : valveResult.status === 'FULL OPEN' ? 'ALARM' : 'WARN';
    logEvent(level, `Sprinkler valves \u2192 ${valveResult.status} (${valveResult.opening.toFixed(0)}%) \u2014 ${valveResult.dominantRule}`);
  }
}

boot();

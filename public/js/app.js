// app.js — wires together: JSON mock API (Fetch) -> fuzzy controllers -> components
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

let state = null;      // { system, sensors, pump, sprinklers }
let fireActive = false;
let fireIntensityTarget = 0;
let lastLoggedValveStatus = null;
let lastLoggedPumpBand = null;

// ---- Components ----
const fireEl = document.getElementById('firePanel');
const plantEl = document.getElementById('plantPanel');
const sprinklerEl = document.getElementById('sprinklerPanel');
const logEl = document.querySelector('.event-log');

const fire = new FirePanel(fireEl, {
  onSimulateFire: () => {
    fireActive = true;
    fireIntensityTarget = 65 + Math.random() * 35; // 65-100
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

// ---- Connection status chip ----
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

// ---- Boot: try the real JSON mock API first, fall back to the in-memory one ----
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
  tick(); // render once immediately, then start the loop
  setInterval(tick, TICK_MS);
  setInterval(updateClock, 1000);
  updateClock();
}

function updateClock() {
  document.getElementById('clock').textContent = nowStr();
}

// ---- Simulation + fuzzy inference + render, once per tick ----
async function tick() {
  const { sensors, system, pump, sprinklers } = state;

  // 1) Fuzzy controller #2 first — its valve opening drives suppression this tick
  const valveResult = computeValveOpening(sensors.smoke, sensors.heat);

  // 2) Sensor dynamics — valve opening is passed in so open sprinklers suppress the fire
  driftFireSensors(sensors, valveResult.opening);

  // 3) Fuzzy controller #1 — pump speed from tank-level error
  const pumpResult = computePumpSpeed(system.targetLevel, sensors.tankLevel);

  // 4) Emergency pump priority: if a fire is active and the tank has dropped below the
  //    setpoint, guarantee the fill rate outpaces the sprinkler draw so the tank refills.
  if (fireActive && sensors.tankLevel < system.targetLevel - 5) {
    const minSpeed = sensors.tankLevel < 25 ? 100 : 85;
    if (pumpResult.speed < minSpeed) {
      pumpResult.speed = minSpeed;
      pumpResult.dominantRule = `[FIRE PRIORITY] pump at ${minSpeed}% \u2014 ${pumpResult.dominantRule}`;
    }
  }

  // 5) Plant dynamics driven by the controller outputs
  updatePlantDynamics(sensors, system, pumpResult, valveResult);

  pump.speed = pumpResult.speed;
  pump.rpm = Math.round((pumpResult.speed / 100) * 2900);
  pump.status = pumpResult.speed > 3 ? (pumpResult.speed >= 85 ? 'FULL DRIVE' : 'RUNNING') : 'IDLE';

  sprinklers.forEach((z) => {
    z.valve = valveResult.opening;
    z.status = valveResult.status;
  });

  // 5) Push state to the JSON mock API (Fetch PATCH calls)
  syncToApi(sensors, pump, sprinklers);

  // 6) Dynamic rendering — every component repaints from the freshly computed state
  const dangerLevel = fire.render(sensors, valveResult);
  plant.render(sensors, system, pumpResult, valveResult);
  zones.render(sprinklers, valveResult.opening, valveResult.status);
  setConnStatus(dangerLevel || valveResult.opening >= 45 ? 'alarm' : 'live');

  // 7) Log meaningful state transitions (not every tick, to keep the log readable)
  maybeLogTransition(pumpResult, valveResult);

  // 8) Periodically pull the log back from the API so multi-tab / server-side events show too
  try {
    state.eventLog = await activeApi.getEventLog();
    eventLog.render(state.eventLog.slice().reverse());
  } catch (_) { /* keep last known log on transient failure */ }
}

function driftFireSensors(sensors, valveOpening) {
  // Each percent of valve opening contributes active suppression.
  // At FULL OPEN (100 %) suppression peaks at 10 intensity-units/tick.
  const suppression = (valveOpening / 100) * 10;

  if (fireActive) {
    // Fire grows randomly; open sprinklers subtract suppression each tick.
    // Floor is 0 (not 40) so sprinklers CAN fully extinguish the fire.
    fireIntensityTarget = clamp(
      fireIntensityTarget + (Math.random() - 0.3) * 4 - suppression,
      0, 100
    );
    // Auto-extinguish: sprinklers have brought intensity all the way down.
    if (fireIntensityTarget <= 1) {
      fireActive = false;
      fireIntensityTarget = 0;
      logEvent('INFO', 'Fire suppressed \u2713 \u2014 sprinklers extinguished the fire, returning to standby');
    }
  } else {
    // Natural decay after auto-extinguish or manual CLEAR
    fireIntensityTarget = clamp(fireIntensityTarget - 6, 0, 100);
    if (fireIntensityTarget <= 0.5) fireIntensityTarget = 0;
  }

  const ambientSmoke = 2 + Math.random() * 3;
  const ambientHeat  = 8 + Math.random() * 5;

  // Heat responds a bit faster than smoke to a growing fire (matches the
  // rule-base comment in sprinklerController.js).
  // Use fireIntensityTarget > 0 (not fireActive) so sensors track back to
  // ambient smoothly even after auto-extinguish sets fireActive = false.
  const smokeTarget = fireIntensityTarget > 0 ? fireIntensityTarget * 0.9  : ambientSmoke;
  const heatTarget  = fireIntensityTarget > 0 ? fireIntensityTarget * 1.05 : ambientHeat;

  sensors.smoke = clamp(sensors.smoke + (smokeTarget - sensors.smoke) * 0.25 + (Math.random() - 0.5) * 1.5, 0, 100);
  sensors.heat  = clamp(sensors.heat  + (heatTarget  - sensors.heat)  * 0.35 + (Math.random() - 0.5) * 1.5, 0, 100);
}

function updatePlantDynamics(sensors, system, pumpResult, valveResult) {
  // Tank: pump fills it, sprinkler draw + baseline usage drain it.
  // Upper bound is the operator setpoint — the tank never overflows past the target.
  const fillRate = (pumpResult.speed / 100) * 2.4;
  const sprinklerDraw = (valveResult.opening / 100) * 1.8;
  const baselineUse = 0.15;
  sensors.tankLevel = clamp(sensors.tankLevel + fillRate - sprinklerDraw - baselineUse, 0, system.targetLevel);

  // Header pressure: first-order lag toward a target driven by pump speed,
  // pulled down while sprinklers are drawing water
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

// pumpController.js
// Fuzzy logic controller #1 — MOTOR PUMP SPEED
//
// Input:  levelError = targetLevel - currentTankLevel   (range -100..100, %)
//         a positive error means the tank is BELOW its setpoint (needs filling)
// Output: pumpSpeed (0..100 %) — how hard the motor should drive the pump
//
// This mirrors how a real fire-pump jockey/controller behaves: it drives
// hard while the tank/header is far below setpoint, eases off as it
// approaches the target, and idles once at capacity (rather than an
// on/off bang-bang pump, which would hammer the motor).

import { triangle, trapezoid, centroidDefuzzify, clamp } from './fuzzyCore.js';

// --- Input membership functions: levelError, universe [-100, 100] ---
const errorSets = {
  NB: (x) => trapezoid(x, -100, -100, -60, -20),   // far ABOVE target (overfull)
  NS: (x) => triangle(x, -40, -15, 0),
  ZE: (x) => triangle(x, -10, 0, 10),
  PS: (x) => triangle(x, 0, 15, 40),
  PB: (x) => trapezoid(x, 20, 60, 100, 100),        // far BELOW target (needs fill)
};

// --- Output membership functions: pumpSpeed, universe [0, 100] ---
const speedSets = {
  OFF:  (y) => trapezoid(y, 0, 0, 2, 10),
  LOW:  (y) => triangle(y, 0, 20, 40),
  MED:  (y) => triangle(y, 25, 50, 75),
  HIGH: (y) => triangle(y, 60, 80, 100),
  MAX:  (y) => trapezoid(y, 85, 96, 100, 100),
};

/**
 * Rule base (5 rules — one per input set):
 *  NB (overfull)        -> OFF   (stop driving; tank/header already above setpoint)
 *  NS (slightly over)   -> LOW   (trickle, let demand bring it down naturally)
 *  ZE (at setpoint)     -> MED   (maintain — steady-state trim against usage/leak)
 *  PS (slightly under)  -> HIGH  (catch up)
 *  PB (far under)       -> MAX   (full motor speed — fire demand or big draw)
 */
export function computePumpSpeed(targetLevel, currentLevel) {
  const error = clamp(targetLevel - currentLevel, -100, 100);

  const strengths = {
    NB: errorSets.NB(error),
    NS: errorSets.NS(error),
    ZE: errorSets.ZE(error),
    PS: errorSets.PS(error),
    PB: errorSets.PB(error),
  };

  const firedRules = [
    { strength: strengths.NB, outputSet: speedSets.OFF,  rule: 'levelError is NB -> speed OFF'  },
    { strength: strengths.NS, outputSet: speedSets.LOW,  rule: 'levelError is NS -> speed LOW'  },
    { strength: strengths.ZE, outputSet: speedSets.MED,  rule: 'levelError is ZE -> speed MED'  },
    { strength: strengths.PS, outputSet: speedSets.HIGH, rule: 'levelError is PS -> speed HIGH' },
    { strength: strengths.PB, outputSet: speedSets.MAX,  rule: 'levelError is PB -> speed MAX'  },
  ].filter(r => r.strength > 0.001);

  const speed = clamp(centroidDefuzzify(firedRules, 0, 100, 1), 0, 100);

  const dominant = firedRules.length
    ? firedRules.reduce((a, b) => (b.strength > a.strength ? b : a))
    : null;

  return {
    error: Math.round(error * 10) / 10,
    speed: Math.round(speed * 10) / 10,
    memberships: strengths,
    dominantRule: dominant ? dominant.rule : 'no rule fired',
  };
}

export const PUMP_ERROR_SETS = errorSets;
export const PUMP_SPEED_SETS = speedSets;

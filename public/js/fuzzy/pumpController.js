import { triangle, trapezoid, centroidDefuzzify, clamp } from './fuzzyCore.js';

const errorSets = {
  NB: (x) => trapezoid(x, -100, -100, -40, -10),
  NS: (x) => triangle(x, -35, -15, 0),
  ZE: (x) => triangle(x, -8, 0, 8),
  PS: (x) => triangle(x, 0, 18, 45),
  PB: (x) => trapezoid(x, 30, 60, 100, 100),
};

const speedSets = {
  OFF:  (y) => trapezoid(y, 0, 0, 2, 10),
  LOW:  (y) => triangle(y, 5, 20, 35),
  MED:  (y) => triangle(y, 25, 45, 65),
  HIGH: (y) => triangle(y, 50, 70, 90),
  MAX:  (y) => trapezoid(y, 80, 95, 100, 100),
};

export function computePumpSpeed(targetLevel, currentLevel) {
  const error = clamp(targetLevel - currentLevel, -100, 100);

  // If tank is at or above target capacity (error <= 0), pump remains idle
  if (error <= 0) {
    return {
      error: Math.round(error * 10) / 10,
      speed: 0,
      memberships: { NB: 0, NS: 0, ZE: 1, PS: 0, PB: 0 },
      dominantRule: 'levelError is ZE -> speed OFF',
    };
  }

  const strengths = {
    NB: errorSets.NB(error),
    NS: errorSets.NS(error),
    ZE: errorSets.ZE(error),
    PS: errorSets.PS(error),
    PB: errorSets.PB(error),
  };

  // Rules: positive error = below setpoint -> pump to fill; negative/zero error = at or above setpoint -> stop
  const firedRules = [
    { strength: strengths.NB, outputSet: speedSets.OFF,  rule: 'levelError is NB -> speed OFF'  },
    { strength: strengths.NS, outputSet: speedSets.OFF,  rule: 'levelError is NS -> speed OFF'  },
    { strength: strengths.ZE, outputSet: speedSets.OFF,  rule: 'levelError is ZE -> speed OFF'  },
    { strength: strengths.PS, outputSet: speedSets.LOW,  rule: 'levelError is PS -> speed LOW'  },
    { strength: strengths.PB, outputSet: speedSets.MED,  rule: 'levelError is PB -> speed MED'  },
  ].filter(r => r.strength > 0.001);

  const rawSpeed = centroidDefuzzify(firedRules, 0, 100, 1);
  const speed = clamp(rawSpeed, 0, 100);

  const dominant = firedRules.length
    ? firedRules.reduce((a, b) => (b.strength > a.strength ? b : a))
    : null;

  return {
    error: Math.round(error * 10) / 10,
    speed: Math.round(speed * 10) / 10,
    memberships: strengths,
    dominantRule: dominant ? dominant.rule : 'levelError is ZE -> speed OFF',
  };
}

export const PUMP_ERROR_SETS = errorSets;
export const PUMP_SPEED_SETS = speedSets;

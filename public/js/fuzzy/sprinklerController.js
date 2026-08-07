import { triangle, trapezoid, centroidDefuzzify, clamp } from './fuzzyCore.js';

const level = {
  LOW:  (x) => trapezoid(x, 0, 0, 10, 35),
  MED:  (x) => triangle(x, 20, 45, 70),
  HIGH: (x) => trapezoid(x, 55, 80, 100, 100),
};

const valveSets = {
  CLOSED:  (y) => trapezoid(y, 0, 0, 2, 12),
  PARTIAL: (y) => triangle(y, 5, 35, 60),
  OPEN:    (y) => triangle(y, 45, 70, 90),
  FULL:    (y) => trapezoid(y, 80, 95, 100, 100),
};

const RULES = [
  ['LOW',  'LOW',  'CLOSED'],
  ['LOW',  'MED',  'PARTIAL'],
  ['LOW',  'HIGH', 'FULL'],
  ['MED',  'LOW',  'PARTIAL'],
  ['MED',  'MED',  'OPEN'],
  ['MED',  'HIGH', 'FULL'],
  ['HIGH', 'LOW',  'OPEN'],
  ['HIGH', 'MED',  'FULL'],
  ['HIGH', 'HIGH', 'FULL'],
];

export function computeValveOpening(smoke, heat) {
  const s = clamp(smoke, 0, 100);
  const h = clamp(heat, 0, 100);

  const smokeDeg = { LOW: level.LOW(s), MED: level.MED(s), HIGH: level.HIGH(s) };
  const heatDeg  = { LOW: level.LOW(h), MED: level.MED(h), HIGH: level.HIGH(h) };

  const firedRules = RULES.map(([sSet, hSet, outSet]) => {
    const strength = Math.min(smokeDeg[sSet], heatDeg[hSet]);
    return {
      strength,
      outputSet: valveSets[outSet],
      rule: `smoke is ${sSet} AND heat is ${hSet} -> valve ${outSet}`,
    };
  }).filter(r => r.strength > 0.001);

  const opening = clamp(centroidDefuzzify(firedRules, 0, 100, 1), 0, 100);

  const dominant = firedRules.length
    ? firedRules.reduce((a, b) => (b.strength > a.strength ? b : a))
    : null;

  let status = 'CLOSED';
  if (opening >= 80) status = 'FULL OPEN';
  else if (opening >= 45) status = 'OPEN';
  else if (opening >= 10) status = 'PARTIAL';

  return {
    smoke: s,
    heat: h,
    opening: Math.round(opening * 10) / 10,
    status,
    dominantRule: dominant ? dominant.rule : 'no rule fired',
    smokeDeg,
    heatDeg,
  };
}

export const VALVE_SETS = valveSets;
export const LEVEL_SETS = level;

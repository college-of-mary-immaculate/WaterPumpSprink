// fuzzyCore.js
// Minimal, dependency-free Mamdani fuzzy inference engine.
// Used by both the pump (tank-level) controller and the sprinkler
// (smoke/heat) controller so the two stay mathematically consistent.

/** Triangular membership function. Degenerate edges (a===b or b===c) act as a ramp. */
export function triangle(x, a, b, c) {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}

/** Trapezoidal membership function, used for the open-ended extreme sets. */
export function trapezoid(x, a, b, c, d) {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

/**
 * Runs Mamdani inference over a set of rules and defuzzifies by centroid.
 * @param {Array<{strength:number, outputSet:(y:number)=>number}>} firedRules
 * @param {number} universeMin
 * @param {number} universeMax
 * @param {number} step
 */
export function centroidDefuzzify(firedRules, universeMin = 0, universeMax = 100, step = 1) {
  let numerator = 0;
  let denominator = 0;
  for (let y = universeMin; y <= universeMax; y += step) {
    // Aggregate: for each y, take the max over all rules of min(strength, outputSet(y))
    let membership = 0;
    for (const rule of firedRules) {
      const clipped = Math.min(rule.strength, rule.outputSet(y));
      if (clipped > membership) membership = clipped;
    }
    numerator += membership * y;
    denominator += membership;
  }
  if (denominator === 0) return universeMin; // no rule fired -> safe default
  return numerator / denominator;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

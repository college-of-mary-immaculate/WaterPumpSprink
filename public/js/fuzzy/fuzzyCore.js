export function triangle(x, a, b, c) {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}

export function trapezoid(x, a, b, c, d) {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

export function centroidDefuzzify(firedRules, universeMin = 0, universeMax = 100, step = 1) {
  let numerator = 0;
  let denominator = 0;
  for (let y = universeMin; y <= universeMax; y += step) {
    let membership = 0;
    for (const rule of firedRules) {
      const clipped = Math.min(rule.strength, rule.outputSet(y));
      if (clipped > membership) membership = clipped;
    }
    numerator += membership * y;
    denominator += membership;
  }
  if (denominator === 0) return universeMin;
  return numerator / denominator;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { triangle, trapezoid, centroidDefuzzify, clamp } from '../public/js/fuzzy/fuzzyCore.js';
import { computePumpSpeed } from '../public/js/fuzzy/pumpController.js';
import { computeValveOpening } from '../public/js/fuzzy/sprinklerController.js';

test('fuzzyCore - membership functions and clamp', () => {
  assert.equal(triangle(10, 0, 10, 20), 1);
  assert.equal(triangle(5, 0, 10, 20), 0.5);
  assert.equal(triangle(25, 0, 10, 20), 0);

  assert.equal(trapezoid(5, 0, 10, 20, 30), 0.5);
  assert.equal(trapezoid(15, 0, 10, 20, 30), 1);
  assert.equal(trapezoid(25, 0, 10, 20, 30), 0.5);
  assert.equal(trapezoid(35, 0, 10, 20, 30), 0);

  assert.equal(clamp(150, 0, 100), 100);
  assert.equal(clamp(-10, 0, 100), 0);
  assert.equal(clamp(50, 0, 100), 50);
});

test('pumpController - smooth speed control and setpoint behavior', () => {
  // Over target / at target (error <= 0) => pump off
  const fullResult = computePumpSpeed(50, 55);
  assert.equal(fullResult.speed, 0);
  assert.equal(fullResult.dominantRule, 'levelError is ZE -> speed OFF');

  // Small positive error gap (50 vs 45) => low non-zero pump speed
  const smallGapResult = computePumpSpeed(50, 45);
  assert.ok(smallGapResult.speed > 0, 'Pump speed should be positive for positive error gap');
  assert.ok(smallGapResult.speed <= 30, 'Pump speed should be low for small error gap');

  // Large positive error gap (80 vs 20) => high pump speed
  const largeGapResult = computePumpSpeed(80, 20);
  assert.ok(largeGapResult.speed >= 40, 'Pump speed should be substantial for large error gap');
});

test('sprinklerController - valve actuation & zero clamp when closed', () => {
  // Ambient / Standby conditions => strictly 0% opening
  const closedResult = computeValveOpening(0, 0);
  assert.equal(closedResult.status, 'CLOSED');
  assert.equal(closedResult.opening, 0, 'Closed valve opening must be strictly 0%');

  // Moderate smoke and heat => PARTIAL or OPEN
  const medResult = computeValveOpening(45, 45);
  assert.ok(medResult.opening >= 30 && medResult.opening <= 75);

  // Severe heat alone => FULL OPEN actuation
  const highHeatResult = computeValveOpening(10, 90);
  assert.equal(highHeatResult.status, 'FULL OPEN');
  assert.ok(highHeatResult.opening >= 80);
});

import { PRESETS, analyzeRLC, evaluateRLC, solveRK45 } from './rlcModel';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

function assertNear(actual: number, expected: number, tol: number, label: string) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tol, `${label}: expected ${expected} ± ${tol}, got ${actual} (diff=${diff})`);
}

console.log('Running Overdamped Series RLC Analytical & RK45 Tests...');

// 1. Case 1: Standard Academic Moderate Damping (Methodology.tex Table 1 & Table 2)
{
  const p = PRESETS[0];
  const sys = analyzeRLC(p.params);
  assert(sys.regime === 'overdamped', 'Case 1 should be overdamped');
  assertNear(sys.discriminant, 600, 1e-9, 'Case 1 Δ');
  assertNear(sys.m1, -15.505102572, 1e-6, 'Case 1 m1');
  assertNear(sys.m2, -64.494897428, 1e-6, 'Case 1 m2');
  assertNear(sys.X, 21.6666667, 1e-5, 'Case 1 X');
  assertNear(sys.Z, 45.4911, 1e-3, 'Case 1 Z');
  assertNear(sys.Qmax * 1000, 8.7929, 1e-3, 'Case 1 Qmax (mC)');

  const s002 = evaluateRLC(sys, 0.02);
  assertNear(s002.qp * 1000, -6.7049, 1e-3, 'Case 1 qp(0.02) mC');
  assertNear(s002.qh * 1000, 9.1405, 1e-3, 'Case 1 qh(0.02) mC');
  assertNear(s002.q * 1000, 2.4356, 1e-3, 'Case 1 q(0.02) mC');

  const s030 = evaluateRLC(sys, 0.3);
  assertNear(s030.qp * 1000, -1.9602, 1e-3, 'Case 1 qp(0.30) mC');
  assertNear(s030.q * 1000, -1.8141, 1e-3, 'Case 1 q(0.30) mC');

  const rows = solveRK45(p.params, p.checkpoints);
  const maxErr = Math.max(...rows.map((r) => r.absError));
  assert(maxErr < 1e-10, `Case 1 RK45 max error ${maxErr} >= 1e-10 C`);
  console.log(`  ✓ Case 1 Moderate verified (Δ=+600, max RK45 err=${maxErr.toExponential(2)} C)`);
}

// 2. Case 2: Heavy Damping (Methodology.tex Table 3)
{
  const p = PRESETS[1];
  const sys = analyzeRLC(p.params);
  assert(sys.regime === 'overdamped', 'Case 2 should be overdamped');
  assertNear(sys.discriminant, 6000, 1e-9, 'Case 2 Δ');
  assertNear(sys.m1, -11.2701665, 1e-5, 'Case 2 m1');
  assertNear(sys.m2, -88.7298335, 1e-5, 'Case 2 m2');
  assertNear(sys.Qmax * 1000, 2.7796, 1e-3, 'Case 2 Qmax (mC)');

  const s005 = evaluateRLC(sys, 0.05);
  assertNear(s005.qp * 1000, -1.2019, 1e-3, 'Case 2 qp(0.05) mC');
  const s020 = evaluateRLC(sys, 0.2);
  assertNear(s020.q * 1000, 2.2496, 1e-3, 'Case 2 q(0.20) mC');

  const rows = solveRK45(p.params, p.checkpoints);
  const maxErr = Math.max(...rows.map((r) => r.absError));
  assert(maxErr < 1e-10, `Case 2 RK45 max error ${maxErr} >= 1e-10 C`);
  console.log(`  ✓ Case 2 Heavy verified (Δ=+6000, max RK45 err=${maxErr.toExponential(2)} C)`);
}

// 3. Case 3: Near-Critical Overdamping (Methodology.tex Table 4)
{
  const p = PRESETS[2];
  const sys = analyzeRLC(p.params);
  assert(sys.regime === 'overdamped', 'Case 3 should be overdamped');
  assertNear(sys.discriminant, 225, 1e-9, 'Case 3 Δ');
  assertNear(sys.m1, -40, 1e-9, 'Case 3 m1');
  assertNear(sys.m2, -100, 1e-9, 'Case 3 m2');
  assertNear(sys.X, -25.8333333, 1e-5, 'Case 3 X');
  assertNear(sys.Qmax * 1000, 9.1951, 1e-3, 'Case 3 Qmax (mC)');

  const s030 = evaluateRLC(sys, 0.3);
  assertNear(s030.q * 1000, 8.9911, 1e-3, 'Case 3 q(0.30) mC');

  const rows = solveRK45(p.params, p.checkpoints);
  const maxErr = Math.max(...rows.map((r) => r.absError));
  assert(maxErr < 1e-10, `Case 3 RK45 max error ${maxErr} >= 1e-10 C`);
  console.log(`  ✓ Case 3 Near-Critical verified (Δ=+225, max RK45 err=${maxErr.toExponential(2)} C)`);
}

// 4. Initial conditions, KVL, Critically Damped, Underdamped
{
  for (const p of PRESETS) {
    const sys = analyzeRLC(p.params);
    const s0 = evaluateRLC(sys, 0);
    assertNear(s0.q, p.params.q0, 1e-14, `${p.id} q(0)`);
    assertNear(s0.i, p.params.i0, 1e-14, `${p.id} i(0)`);
    const sMid = evaluateRLC(sys, 0.123);
    assertNear(sMid.vL + sMid.vR + sMid.vC, sMid.E, 1e-12, `${p.id} KVL`);
  }

  // Critically damped: L=0.5, C=0.002 => R_crit = 2*sqrt(250)
  const rCrit = 2 * Math.sqrt(0.5 / 0.002);
  const critParams = { R: rCrit, L: 0.5, C: 0.002, E0: 24, gamma: 60, q0: 0.003, i0: -0.2 };
  const critSys = analyzeRLC(critParams);
  assert(critSys.regime === 'critically_damped', 'Expected critically_damped regime');
  const crit0 = evaluateRLC(critSys, 0);
  assertNear(crit0.q, critParams.q0, 1e-14, 'Crit q(0)');
  assertNear(crit0.i, critParams.i0, 1e-14, 'Crit i(0)');
  const critRows = solveRK45(critParams, [0.05, 0.15]);
  assert(Math.max(...critRows.map((r) => r.absError)) < 1e-10, 'Crit RK45 error < 1e-10 C');

  // Underdamped: R=10
  const underParams = { R: 10, L: 0.5, C: 0.002, E0: 24, gamma: 60, q0: -0.002, i0: 0.5 };
  const underSys = analyzeRLC(underParams);
  assert(underSys.regime === 'underdamped', 'Expected underdamped regime');
  const under0 = evaluateRLC(underSys, 0);
  assertNear(under0.q, underParams.q0, 1e-14, 'Under q(0)');
  assertNear(under0.i, underParams.i0, 1e-14, 'Under i(0)');
  const underRows = solveRK45(underParams, [0.05, 0.15]);
  assert(Math.max(...underRows.map((r) => r.absError)) < 1e-10, 'Under RK45 error < 1e-10 C');

  console.log('  ✓ Initial conditions, KVL, critically damped, and underdamped regimes verified');
}

console.log('ALL RLC MODEL TESTS PASSED!');

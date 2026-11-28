export type ThemeMode = 'dark' | 'light';
export type DampingRegime = 'overdamped' | 'critically_damped' | 'underdamped';

export interface RLCParams {
  R: number;     // Resistance in Ohms (Ω)
  L: number;     // Inductance in Henrys (H)
  C: number;     // Capacitance in Farads (F)
  E0: number;    // Driving voltage amplitude (V)
  gamma: number; // Driving angular frequency (rad/s)
  q0: number;    // Initial capacitor charge (C)
  i0: number;    // Initial loop current (A)
}

export interface RLCPreset {
  id: 'case1' | 'case2' | 'case3';
  shortLabel: string;
  name: string;
  subtitle: string;
  params: RLCParams;
  tMax: number;
  checkpoints: number[];
}

export interface RLCSystem {
  params: RLCParams;
  alpha: number;
  omega0: number;
  rCrit: number;
  discriminant: number;
  regime: DampingRegime;
  m1: number;
  m2: number;
  omegaD: number;
  tau1: number;
  tau2: number;
  tSettle: number;
  XL: number;
  XC: number;
  X: number;
  Z: number;
  A: number;
  B: number;
  Qmax: number;
  thetaQ: number;
  Imax: number;
  phi: number;
  phiDeg: number;
  c1: number;
  c2: number;
  reactanceType: 'inductive' | 'capacitive' | 'resonant';
}

export interface RLCInstantState {
  t: number;
  qp: number;
  qh: number;
  q: number;
  ip: number;
  ih: number;
  i: number;
  E: number;
  vR: number;
  vL: number;
  vC: number;
  transientRatio: number;
}

export interface VerificationRow {
  t: number;
  qp: number;          // Isolated steady-state charge q_p(t) (C)
  qh: number;          // Complementary transient charge q_h(t) (C)
  q: number;           // Complete charge q(t) = q_h(t) + q_p(t) (C)
  ip: number;          // Steady-state current i_p(t) = q_p'(t) (A)
  odeLhs: number;      // L*q''(t) + R*q'(t) + (1/C)*q(t) (V)
  emf: number;         // E(t) = E0 * sin(gamma * t) (V)
  odeResidual: number; // |odeLhs - emf| (V)
  qpResidual: number;  // |L*qp''(t) + R*qp'(t) + (1/C)*qp(t) - E(t)| (V)
}

export const PRESETS: RLCPreset[] = [
  {
    id: 'case1',
    shortLabel: 'Case 1 · Moderate',
    name: 'Case 1: Standard Overdamped (Moderate Damping)',
    subtitle: 'R = 40 Ω, L = 0.50 H, C = 2.0 mF, E(t) = 24 sin(60t) V',
    params: {
      R: 40.0,
      L: 0.5,
      C: 0.002,
      E0: 24.0,
      gamma: 60.0,
      q0: 0.0,
      i0: 0.0,
    },
    tMax: 0.4,
    checkpoints: [0.02, 0.05, 0.1, 0.15, 0.2, 0.3],
  },
  {
    id: 'case2',
    shortLabel: 'Case 2 · Heavy',
    name: 'Case 2: Heavy Overdamped (Rapid Extinction)',
    subtitle: 'R = 100 Ω, L = 1.00 H, C = 1.0 mF, E(t) = 50 sin(120t) V',
    params: {
      R: 100.0,
      L: 1.0,
      C: 0.001,
      E0: 50.0,
      gamma: 120.0,
      q0: 0.005,
      i0: 0.0,
    },
    tMax: 0.25,
    checkpoints: [0.02, 0.05, 0.1, 0.15, 0.2],
  },
  {
    id: 'case3',
    shortLabel: 'Case 3 · Near-Critical',
    name: 'Case 3: Near-Critical Overdamped (Capacitive)',
    subtitle: 'R = 35 Ω, L = 0.25 H, C = 1.0 mF, E(t) = 12 sin(30t) V',
    params: {
      R: 35.0,
      L: 0.25,
      C: 0.001,
      E0: 12.0,
      gamma: 30.0,
      q0: 0.0,
      i0: 0.0,
    },
    tMax: 0.5,
    checkpoints: [0.02, 0.05, 0.1, 0.15, 0.2, 0.3],
  },
];

/**
 * Compute all characteristic constants, steady-state coefficients (A, B, Z, X),
 * and initial-condition transient coefficients (c1, c2) for a driven series RLC circuit.
 */
export function analyzeRLC(params: RLCParams): RLCSystem {
  const R = Math.max(1e-6, params.R);
  const L = Math.max(1e-6, params.L);
  const C = Math.max(1e-9, params.C);
  const E0 = params.E0;
  const gamma = Math.max(1e-4, params.gamma);
  const { q0, i0 } = params;

  const alpha = R / (2.0 * L);
  const omega0 = 1.0 / Math.sqrt(L * C);
  const rCrit = 2.0 * Math.sqrt(L / C);
  const discriminant = R * R - (4.0 * L) / C;

  const XL = gamma * L;
  const XC = 1.0 / (gamma * C);
  const X = XL - XC;
  const Z = Math.sqrt(R * R + X * X);

  const gammaZ2 = gamma * Z * Z;
  const A = -(E0 * X) / gammaZ2;
  const B = -(E0 * R) / gammaZ2;

  const Qmax = Math.sqrt(A * A + B * B);
  const thetaQ = Math.atan2(B, A);
  const Imax = E0 / Z;
  const phi = Math.atan2(X, R);
  const phiDeg = (phi * 180) / Math.PI;

  const reactanceType: RLCSystem['reactanceType'] =
    Math.abs(X) < 1e-6 ? 'resonant' : X > 0 ? 'inductive' : 'capacitive';

  const k1 = q0 - B;
  const k2 = i0 - A * gamma;
  const eps = 1e-9 * Math.max(1, R * R);

  let regime: DampingRegime;
  let m1 = -alpha;
  let m2 = -alpha;
  let omegaD = 0;
  let c1 = 0;
  let c2 = 0;
  let tau1 = 1 / alpha;
  let tau2 = 1 / alpha;

  if (discriminant > eps) {
    regime = 'overdamped';
    const sqrtDisc = Math.sqrt(discriminant);
    m1 = (-R + sqrtDisc) / (2.0 * L);
    m2 = (-R - sqrtDisc) / (2.0 * L);
    const denom = m2 - m1;
    c1 = (m2 * k1 - k2) / denom;
    c2 = (k2 - m1 * k1) / denom;
    tau1 = 1.0 / Math.abs(m1);
    tau2 = 1.0 / Math.abs(m2);
  } else if (Math.abs(discriminant) <= eps) {
    regime = 'critically_damped';
    m1 = -alpha;
    m2 = -alpha;
    c1 = k1;
    c2 = k2 + alpha * k1;
    tau1 = 1.0 / alpha;
    tau2 = tau1;
  } else {
    regime = 'underdamped';
    omegaD = Math.sqrt(-discriminant) / (2.0 * L);
    m1 = -alpha;
    m2 = -alpha;
    c1 = k1;
    c2 = (k2 + alpha * k1) / omegaD;
    tau1 = 1.0 / alpha;
    tau2 = tau1;
  }

  const tSettle = 5.0 * tau1;

  return {
    params: { R, L, C, E0, gamma, q0, i0 },
    alpha,
    omega0,
    rCrit,
    discriminant,
    regime,
    m1,
    m2,
    omegaD,
    tau1,
    tau2,
    tSettle,
    XL,
    XC,
    X,
    Z,
    A,
    B,
    Qmax,
    thetaQ,
    Imax,
    phi,
    phiDeg,
    c1,
    c2,
    reactanceType,
  };
}

/**
 * Evaluate exact analytical charge, current, and KVL component voltages at time t (seconds).
 */
export function evaluateRLC(sys: RLCSystem, t: number): RLCInstantState {
  const { R, C, E0, gamma } = sys.params;
  const sinGt = Math.sin(gamma * t);
  const cosGt = Math.cos(gamma * t);

  const qp = sys.A * sinGt + sys.B * cosGt;
  const ip = sys.A * gamma * cosGt - sys.B * gamma * sinGt;

  let qh = 0;
  let ih = 0;

  if (sys.regime === 'overdamped') {
    const e1 = Math.exp(sys.m1 * t);
    const e2 = Math.exp(sys.m2 * t);
    qh = sys.c1 * e1 + sys.c2 * e2;
    ih = sys.m1 * sys.c1 * e1 + sys.m2 * sys.c2 * e2;
  } else if (sys.regime === 'critically_damped') {
    const e = Math.exp(-sys.alpha * t);
    qh = (sys.c1 + sys.c2 * t) * e;
    ih = (sys.c2 - sys.alpha * (sys.c1 + sys.c2 * t)) * e;
  } else {
    const e = Math.exp(-sys.alpha * t);
    const cosWd = Math.cos(sys.omegaD * t);
    const sinWd = Math.sin(sys.omegaD * t);
    qh = e * (sys.c1 * cosWd + sys.c2 * sinWd);
    ih = e * ((-sys.alpha * sys.c1 + sys.omegaD * sys.c2) * cosWd - (sys.alpha * sys.c2 + sys.omegaD * sys.c1) * sinWd);
  }

  const q = qh + qp;
  const i = ih + ip;
  const E = E0 * sinGt;
  const vR = R * i;
  const vC = q / C;
  const vL = E - vR - vC;
  const transientRatio = sys.Qmax > 1e-15 ? Math.abs(qh) / sys.Qmax : 0;

  return { t, qp, qh, q, ip, ih, i, E, vR, vL, vC, transientRatio };
}

/**
 * Sample evenly spaced waveform points over [0, tMax].
 */
export function sampleWaveforms(sys: RLCSystem, tMax: number, count = 500): RLCInstantState[] {
  const n = Math.max(2, count);
  const out: RLCInstantState[] = new Array(n);
  for (let k = 0; k < n; k++) {
    const t = (k / (n - 1)) * tMax;
    out[k] = evaluateRLC(sys, t);
  }
  return out;
}

/**
 * Compute exact analytical second derivatives q_p''(t), q_h''(t), and q''(t)
 * for direct substitution into the governing KVL differential equation:
 *   L * q''(t) + R * q'(t) + (1/C) * q(t) = E(t)
 */
export function evaluateSecondDerivative(
  sys: RLCSystem,
  t: number
): { qpp: number; qhp: number; qTotalDD: number } {
  const { gamma } = sys.params;
  const sinGt = Math.sin(gamma * t);
  const cosGt = Math.cos(gamma * t);
  const qp = sys.A * sinGt + sys.B * cosGt;
  const qpp = -(gamma * gamma) * qp;

  let qhp = 0;
  if (sys.regime === 'overdamped') {
    const e1 = Math.exp(sys.m1 * t);
    const e2 = Math.exp(sys.m2 * t);
    qhp = sys.m1 * sys.m1 * sys.c1 * e1 + sys.m2 * sys.m2 * sys.c2 * e2;
  } else if (sys.regime === 'critically_damped') {
    const e = Math.exp(-sys.alpha * t);
    const a = sys.alpha;
    qhp = e * (a * a * sys.c1 - 2 * a * sys.c2 + a * a * sys.c2 * t);
  } else {
    const e = Math.exp(-sys.alpha * t);
    const a = sys.alpha;
    const w = sys.omegaD;
    const cosWd = Math.cos(w * t);
    const sinWd = Math.sin(w * t);
    qhp =
      e *
      (((a * a - w * w) * sys.c1 - 2 * a * w * sys.c2) * cosWd +
        ((a * a - w * w) * sys.c2 + 2 * a * w * sys.c1) * sinWd);
  }

  return { qpp, qhp, qTotalDD: qpp + qhp };
}

/**
 * Evaluate analytical checkpoints and verify direct substitution into the
 * governing KVL differential equation L*q''(t) + R*q'(t) + (1/C)*q(t) = E(t).
 */
export function verifyAnalyticalCheckpoints(
  sys: RLCSystem,
  checkpoints: number[]
): VerificationRow[] {
  const { R, L, C } = sys.params;
  return checkpoints.map((t) => {
    const inst = evaluateRLC(sys, t);
    const { qpp, qTotalDD } = evaluateSecondDerivative(sys, t);
    const odeLhs = L * qTotalDD + R * inst.i + inst.q / C;
    const qpLhs = L * qpp + R * inst.ip + inst.qp / C;
    return {
      t,
      qp: inst.qp,
      qh: inst.qh,
      q: inst.q,
      ip: inst.ip,
      odeLhs,
      emf: inst.E,
      odeResidual: Math.abs(odeLhs - inst.E),
      qpResidual: Math.abs(qpLhs - inst.E),
    };
  });
}

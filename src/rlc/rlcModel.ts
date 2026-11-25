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
  qp: number;
  qh: number;
  qAnalytical: number;
  qNumerical: number;
  absError: number;
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
 * Adaptive Dormand-Prince RK45 (5(4) explicit Runge-Kutta) numerical solver
 * for the state-space system:
 *   dq/dt = i
 *   di/dt = (E0 * sin(gamma * t) - R * i - q / C) / L
 *
 * Clamps each step directly onto sorted checkpoints so there is zero interpolation error.
 */
export function solveRK45(params: RLCParams, checkpoints: number[]): VerificationRow[] {
  const sys = analyzeRLC(params);
  const { R, L, C, E0, gamma, q0, i0 } = sys.params;

  const sorted = [...checkpoints].sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const deriv = (t: number, q: number, i: number): [number, number] => [
    i,
    (E0 * Math.sin(gamma * t) - R * i - q / C) / L,
  ];

  // Dormand-Prince Butcher tableau coefficients
  const c2 = 1 / 5, c3 = 3 / 10, c4 = 4 / 5, c5 = 8 / 9;
  const a21 = 1 / 5;
  const a31 = 3 / 40, a32 = 9 / 40;
  const a41 = 44 / 45, a42 = -56 / 15, a43 = 32 / 9;
  const a51 = 19372 / 6561, a52 = -25360 / 2187, a53 = 64448 / 6561, a54 = -212 / 729;
  const a61 = 9017 / 3168, a62 = -355 / 33, a63 = 46732 / 5247, a64 = 49 / 176, a65 = -5103 / 18656;

  // 5th-order weights
  const b1 = 35 / 384, b3 = 500 / 1113, b4 = 125 / 192, b5 = -2187 / 6784, b6 = 11 / 84;
  // Error coefficients (b_i - b*_i)
  const e1 = 71 / 57600, e3 = -71 / 16695, e4 = 71 / 1920, e5 = -17253 / 339200, e6 = 22 / 525, e7 = -1 / 40;

  const rtol = 1e-10;
  const atol = 1e-12;

  let t = 0;
  let q = q0;
  let i = i0;
  let h = Math.min(1e-4, Math.max(1e-7, (sorted[0] || 0.01) * 0.05));

  const results = new Map<number, number>();

  for (const targetT of sorted) {
    if (targetT <= 0) {
      results.set(targetT, q0);
      continue;
    }

    let steps = 0;
    while (t < targetT - 1e-15 && steps < 500000) {
      steps++;
      let hitTarget = false;
      let stepH = h;
      if (t + stepH >= targetT) {
        stepH = targetT - t;
        hitTarget = true;
      }

      const [k1q, k1i] = deriv(t, q, i);
      const [k2q, k2i] = deriv(t + c2 * stepH, q + stepH * a21 * k1q, i + stepH * a21 * k1i);
      const [k3q, k3i] = deriv(
        t + c3 * stepH,
        q + stepH * (a31 * k1q + a32 * k2q),
        i + stepH * (a31 * k1i + a32 * k2i)
      );
      const [k4q, k4i] = deriv(
        t + c4 * stepH,
        q + stepH * (a41 * k1q + a42 * k2q + a43 * k3q),
        i + stepH * (a41 * k1i + a42 * k2i + a43 * k3i)
      );
      const [k5q, k5i] = deriv(
        t + c5 * stepH,
        q + stepH * (a51 * k1q + a52 * k2q + a53 * k3q + a54 * k4q),
        i + stepH * (a51 * k1i + a52 * k2i + a53 * k3i + a54 * k4i)
      );
      const [k6q, k6i] = deriv(
        t + stepH,
        q + stepH * (a61 * k1q + a62 * k2q + a63 * k3q + a64 * k4q + a65 * k5q),
        i + stepH * (a61 * k1i + a62 * k2i + a63 * k3i + a64 * k4i + a65 * k5i)
      );

      const qNext = q + stepH * (b1 * k1q + b3 * k3q + b4 * k4q + b5 * k5q + b6 * k6q);
      const iNext = i + stepH * (b1 * k1i + b3 * k3i + b4 * k4i + b5 * k5i + b6 * k6i);

      const [k7q, k7i] = deriv(t + stepH, qNext, iNext);

      const errQ = stepH * (e1 * k1q + e3 * k3q + e4 * k4q + e5 * k5q + e6 * k6q + e7 * k7q);
      const errI = stepH * (e1 * k1i + e3 * k3i + e4 * k4i + e5 * k5i + e6 * k6i + e7 * k7i);

      const scaleQ = atol + rtol * Math.max(Math.abs(q), Math.abs(qNext));
      const scaleI = atol + rtol * Math.max(Math.abs(i), Math.abs(iNext));
      const errNorm = Math.sqrt(0.5 * ((errQ / scaleQ) ** 2 + (errI / scaleI) ** 2));

      if (errNorm <= 1.0 || stepH <= 1e-13) {
        t = hitTarget ? targetT : t + stepH;
        q = qNext;
        i = iNext;
        const factor = errNorm === 0 ? 2.0 : Math.min(2.5, Math.max(0.2, 0.9 * Math.pow(errNorm, -0.2)));
        if (!hitTarget) {
          h = Math.min(0.01, stepH * factor);
        }
      } else {
        const factor = Math.max(0.1, 0.9 * Math.pow(errNorm, -0.25));
        h = stepH * factor;
      }
    }

    results.set(targetT, q);
  }

  return checkpoints.map((cp) => {
    const inst = evaluateRLC(sys, cp);
    const qNum = results.get(cp) ?? inst.q;
    return {
      t: cp,
      qp: inst.qp,
      qh: inst.qh,
      qAnalytical: inst.q,
      qNumerical: qNum,
      absError: Math.abs(inst.q - qNum),
    };
  });
}

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { RLCSystem, solveRK45 } from '../rlc/rlcModel';

interface VerificationModalProps {
  system: RLCSystem;
  checkpoints: number[];
  onClose: () => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  system,
  checkpoints,
  onClose,
}) => {
  const [tab, setTab] = useState<'rk45' | 'derivation'>('rk45');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = useMemo(() => solveRK45(system.params, checkpoints), [system.params, checkpoints]);
  const maxError = useMemo(
    () => rows.reduce((acc, r) => Math.max(acc, r.absError), 0),
    [rows]
  );

  const { R, L, C, E0, gamma, q0, i0 } = system.params;
  const invC = 1 / C;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.56)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 780,
          maxHeight: '86vh',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-modal)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              Analytical Derivation &amp; RK45 Verification
            </span>

            <div
              style={{
                display: 'flex',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 7,
                padding: 2,
                gap: 2,
              }}
            >
              {(
                [
                  ['rk45', 'RK45 Benchmark'],
                  ['derivation', '10-Step Derivation'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 5,
                    border: 'none',
                    background: tab === k ? 'var(--bg-panel)' : 'transparent',
                    color: tab === k ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: tab === k ? 600 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {tab === 'rk45' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'var(--success-soft)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} color="var(--success)" />
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                    Closed-Form Analytical vs Adaptive Dormand-Prince RK45 (rtol = 10⁻¹⁰, atol = 10⁻¹²)
                  </span>
                </div>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>
                  Max |Δq| = {maxError.toExponential(2)} C
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-strong)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Time t (s)</th>
                      <th style={thStyle}>Steady qₚ (mC)</th>
                      <th style={thStyle}>Transient qₕ (mC)</th>
                      <th style={thStyle}>Complete q (mC)</th>
                      <th style={thStyle}>RK45 q_num (mC)</th>
                      <th style={thStyle}>Abs Error (C)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.t} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td className="mono" style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>
                          {r.t.toFixed(3)}
                        </td>
                        <td className="mono" style={{ ...tdStyle, color: 'var(--trace-qp)' }}>
                          {(r.qp * 1000).toFixed(4)}
                        </td>
                        <td className="mono" style={{ ...tdStyle, color: 'var(--trace-qh)' }}>
                          {(r.qh * 1000).toFixed(4)}
                        </td>
                        <td className="mono" style={{ ...tdStyle, color: 'var(--trace-q)', fontWeight: 600 }}>
                          {(r.qAnalytical * 1000).toFixed(4)}
                        </td>
                        <td className="mono" style={tdStyle}>
                          {(r.qNumerical * 1000).toFixed(4)}
                        </td>
                        <td className="mono" style={{ ...tdStyle, color: 'var(--text-secondary)' }}>
                          {r.absError.toExponential(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'derivation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12.5, lineHeight: 1.6 }}>
              <StepBox num={1} title="Given Parameters">
                <span className="mono">
                  R = {R.toFixed(1)} Ω, L = {L.toFixed(2)} H, C = {(C * 1000).toFixed(2)} mF ({C} F), E(t) = {E0.toFixed(1)} sin({gamma.toFixed(0)}t) V, q(0) = {(q0 * 1000).toFixed(2)} mC, i(0) = {i0.toFixed(2)} A
                </span>
              </StepBox>

              <StepBox num={2} title="Find">
                Isolated steady-state capacitor charge <span className="mono">qₚ(t)</span>, peak charge amplitude <span className="mono">Q_max</span>, and characteristic damping classification.
              </StepBox>

              <StepBox num={3} title="Governing Second-Order Linear ODE (KVL)">
                <div className="mono">
                  L q″ + R q′ + (1/C) q = E(t) &nbsp;⇒&nbsp; {L.toFixed(2)} q″ + {R.toFixed(1)} q′ + {invC.toFixed(1)} q = {E0.toFixed(1)} sin({gamma.toFixed(0)}t)
                </div>
                <div className="mono" style={{ color: 'var(--text-secondary)', marginTop: 3 }}>
                  Monic form: q″ + {(R / L).toFixed(2)} q′ + {(invC / L).toFixed(1)} q = {(E0 / L).toFixed(2)} sin({gamma.toFixed(0)}t)
                </div>
              </StepBox>

              <StepBox num={4} title="Characteristic Equation & Damping Classification">
                <div className="mono">
                  Δ = R² − 4L/C = {R.toFixed(1)}² − 4({L.toFixed(2)})/{C} = {system.discriminant >= 0 ? '+' : ''}
                  {system.discriminant.toFixed(2)} Ω² ({system.regime.replace('_', ' ')})
                </div>
                <div className="mono" style={{ color: 'var(--text-secondary)', marginTop: 3 }}>
                  {system.regime === 'overdamped'
                    ? `m₁ = ${system.m1.toFixed(4)} s⁻¹, m₂ = ${system.m2.toFixed(4)} s⁻¹`
                    : system.regime === 'critically_damped'
                    ? `m₁ = m₂ = ${system.m1.toFixed(4)} s⁻¹`
                    : `m = −${system.alpha.toFixed(3)} ± j${system.omegaD.toFixed(3)} s⁻¹`}
                </div>
              </StepBox>

              <StepBox num={5} title="Initial Conditions">
                <span className="mono">
                  q(0) = {(q0 * 1000).toFixed(3)} mC, &nbsp; q′(0) = i(0) = {i0.toFixed(3)} A
                </span>
              </StepBox>

              <StepBox num={6} title="Method of Undetermined Coefficients">
                <div className="mono">
                  X = γL − 1/(γC) = {system.XL.toFixed(3)} − {system.XC.toFixed(3)} = {system.X.toFixed(4)} Ω
                </div>
                <div className="mono">
                  Z = √(R² + X²) = {system.Z.toFixed(4)} Ω
                </div>
                <div className="mono" style={{ color: 'var(--trace-qp)', marginTop: 3 }}>
                  A = −(E₀ X)/(γ Z²) = {(system.A * 1000).toFixed(4)} mC, &nbsp; B = −(E₀ R)/(γ Z²) = {(system.B * 1000).toFixed(4)} mC
                </div>
              </StepBox>

              <StepBox num={7} title="Final Steady-State Expression">
                <span className="mono" style={{ color: 'var(--trace-qp)', fontWeight: 600 }}>
                  qₚ(t) = {(system.A * 1000).toFixed(4)} sin({gamma.toFixed(0)}t) {system.B >= 0 ? '+' : '−'}{' '}
                  {Math.abs(system.B * 1000).toFixed(4)} cos({gamma.toFixed(0)}t) [mC]
                </span>
              </StepBox>

              <StepBox num={8} title="Peak Amplitude & Phase">
                <span className="mono">
                  Q_max = E₀ / (γ Z) = {(system.Qmax * 1000).toFixed(4)} mC, &nbsp; I_max = E₀ / Z = {system.Imax.toFixed(4)} A, &nbsp; φ = arctan(X/R) = {system.phiDeg.toFixed(2)}°
                </span>
              </StepBox>

              <StepBox num={9} title="Transient Homogeneous Constants">
                <span className="mono" style={{ color: 'var(--trace-qh)' }}>
                  c₁ = {(system.c1 * 1000).toFixed(4)} mC, &nbsp; c₂ = {(system.c2 * 1000).toFixed(4)} mC &nbsp; (5τ₁ = {(system.tSettle * 1000).toFixed(1)} ms)
                </span>
              </StepBox>

              <StepBox num={10} title="Physical Interpretation">
                {system.regime === 'overdamped'
                  ? `Because R² > 4L/C (R > ${system.rCrit.toFixed(2)} Ω), the natural response qₕ(t) decays monotonically without oscillation. After 5τ₁ ≈ ${(system.tSettle * 1000).toFixed(1)} ms, the circuit settles purely into steady-state oscillation qₚ(t) in the ${system.reactanceType} regime.`
                  : `With R ≤ R_crit (${system.rCrit.toFixed(2)} Ω), the circuit is currently ${system.regime.replace('_', ' ')}. Increase R above ${system.rCrit.toFixed(2)} Ω to return to the overdamped regime.`}
              </StepBox>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StepBox: React.FC<{ num: number; title: string; children: React.ReactNode }> = ({
  num,
  title,
  children,
}) => (
  <div
    style={{
      padding: '10px 12px',
      borderRadius: 8,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
    }}
  >
    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: 'var(--text-primary)' }}>
      {num}. {title}
    </div>
    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{children}</div>
  </div>
);

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontWeight: 600,
  fontSize: 11.5,
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'right',
};

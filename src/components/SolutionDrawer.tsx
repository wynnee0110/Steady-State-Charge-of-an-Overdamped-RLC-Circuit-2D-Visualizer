import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import { RLCSystem, evaluateRLC } from '../rlc/rlcModel';
import { FocusedComponent } from './ParameterSidebar';
import { MathTex } from './MathTex';

interface SolutionDrawerProps {
  open: boolean;
  system: RLCSystem;
  currentTime: number;
  onToggle: () => void;
  onClose: () => void;
  onHighlightComponent: (c: FocusedComponent) => void;
}

interface FlowStep {
  num: number;
  instruction: string;
  focusComponent: FocusedComponent;
  code: string;
  codeOut: string;
  handTex: string;
}

const fmt = (n: number, d = 3) => {
  const fixed = n.toFixed(d);
  return fixed === '-0.000' || fixed === '-0.00' || fixed === '-0.0' || fixed === '-0'
    ? fixed.slice(1)
    : fixed;
};

const signedTex = (n: number, d = 3) =>
  `${n >= 0 ? '+' : '-'}${fmt(Math.abs(n), d)}`;

export const SolutionDrawer: React.FC<SolutionDrawerProps> = ({
  open,
  system,
  currentTime,
  onToggle,
  onClose,
  onHighlightComponent,
}) => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
  const [hasAutoStarted, setHasAutoStarted] = useState<boolean>(false);
  const [dragOffsetPx, setDragOffsetPx] = useState<number | null>(null);
  const [pulseCount, setPulseCount] = useState<number>(0);

  const drawerRef = useRef<HTMLElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevSigRef = useRef<string>('');

  const live = useMemo(() => evaluateRLC(system, currentTime), [system, currentTime]);
  const { R, L, C, E0, gamma, q0, i0 } = system.params;

  const paramSig = `${R}|${L}|${C}|${E0}|${gamma}|${q0}|${i0}`;
  useEffect(() => {
    if (prevSigRef.current && prevSigRef.current !== paramSig) {
      setPulseCount((c) => c + 1);
    }
    prevSigRef.current = paramSig;
  }, [paramSig]);

  useEffect(() => {
    if (open && !hasAutoStarted) {
      setHasAutoStarted(true);
      setActiveStep(1);
      setAutoPlay(true);
    }
    if (!open) {
      setAutoPlay(false);
    }
  }, [open, hasAutoStarted]);

  const steps: FlowStep[] = useMemo(() => {
    const invC = 1 / C;
    const aMc = system.A * 1000;
    const bMc = system.B * 1000;
    const qMaxMc = system.Qmax * 1000;
    const c1Mc = system.c1 * 1000;
    const c2Mc = system.c2 * 1000;

    const rootsTex =
      system.regime === 'overdamped'
        ? `m_1 = ${fmt(system.m1, 2)},\\; m_2 = ${fmt(system.m2, 2)}\\text{ s}^{-1}`
        : system.regime === 'critically_damped'
        ? `m_1 = m_2 = ${fmt(system.m1, 2)}\\text{ s}^{-1}`
        : `m = -${fmt(system.alpha, 2)} \\pm j${fmt(system.omegaD, 2)}\\text{ s}^{-1}`;

    const qhTex =
      system.regime === 'overdamped'
        ? `q_h(t) = ${fmt(c1Mc, 2)}e^{${fmt(system.m1, 2)}t} ${signedTex(c2Mc, 2)}e^{${fmt(system.m2, 2)}t}\\text{ mC}`
        : system.regime === 'critically_damped'
        ? `q_h(t) = (${fmt(c1Mc, 2)} ${signedTex(c2Mc, 2)}t)e^{-${fmt(system.alpha, 2)}t}\\text{ mC}`
        : `q_h(t) = e^{-${fmt(system.alpha, 2)}t}(${fmt(c1Mc, 2)}\\cos ${fmt(system.omegaD, 1)}t ${signedTex(c2Mc, 2)}\\sin ${fmt(system.omegaD, 1)}t)`;

    return [
      {
        num: 1,
        instruction: "Formulate Kirchhoff's Voltage Law ODE from the live inputs.",
        focusComponent: 'E',
        code: `const { R, L, C, E0, gamma } = params;\n// R=${fmt(R, 1)}, L=${fmt(L, 2)}, C=${C}, E0=${fmt(E0, 0)}, γ=${fmt(gamma, 0)}`,
        codeOut: `1/C = ${fmt(invC, 1)} F⁻¹`,
        handTex: `${fmt(L, 2)}\\frac{d^2q}{dt^2} + ${fmt(R, 1)}\\frac{dq}{dt} + ${fmt(invC, 1)}q = ${fmt(E0, 0)}\\sin(${fmt(gamma, 0)}t)`,
      },
      {
        num: 2,
        instruction: 'Check the characteristic discriminant Δ and find the roots.',
        focusComponent: 'R',
        code: `const disc = R*R - (4*L)/C;\nconst m1 = (-R + Math.sqrt(disc)) / (2*L);\nconst m2 = (-R - Math.sqrt(disc)) / (2*L);`,
        codeOut: `Δ = ${system.discriminant >= 0 ? '+' : ''}${fmt(system.discriminant, 1)} Ω² (${system.regime.replace('_', ' ')})`,
        handTex: `\\Delta = ${fmt(R, 1)}^2 - \\frac{4(${fmt(L, 2)})}{${C}} = ${system.discriminant >= 0 ? '+' : ''}${fmt(system.discriminant, 1)} \\\\[3pt] ${rootsTex}`,
      },
      {
        num: 3,
        instruction: 'Compute net reactance X and total impedance Z.',
        focusComponent: 'L',
        code: `const X = L*gamma - 1/(C*gamma);\nconst Z = Math.sqrt(X*X + R*R);`,
        codeOut: `X = ${fmt(system.X, 2)} Ω,  Z = ${fmt(system.Z, 2)} Ω`,
        handTex: `X = L\\gamma - \\frac{1}{C\\gamma} = ${fmt(system.X, 2)}\\;\\Omega \\\\[3pt] Z = \\sqrt{X^2 + R^2} = ${fmt(system.Z, 2)}\\;\\Omega`,
      },
      {
        num: 4,
        instruction: 'Solve undetermined coefficients A, B for steady-state charge qₚ(t).',
        focusComponent: 'C',
        code: `const A = -(E0 * X) / (gamma * Z * Z);\nconst B = -(E0 * R) / (gamma * Z * Z);\nconst qp = A*Math.sin(gamma*t) + B*Math.cos(gamma*t);`,
        codeOut: `Q_max = ${fmt(qMaxMc, 3)} mC  ·  qₚ(t) = ${fmt(live.qp * 1000, 3)} mC`,
        handTex: `q_p(t) = ${fmt(aMc, 3)}\\sin(${fmt(gamma, 0)}t) ${signedTex(bMc, 3)}\\cos(${fmt(gamma, 0)}t)\\;\\text{mC} \\\\[3pt] Q_{\\max} = \\frac{E_0}{\\gamma Z} = ${fmt(qMaxMc, 3)}\\;\\text{mC}`,
      },
      {
        num: 5,
        instruction: 'Combine transient qₕ(t) + steady-state qₚ(t) and evaluate live at t.',
        focusComponent: null,
        code: `const qh = c1*Math.exp(m1*t) + c2*Math.exp(m2*t);\nconst q  = qh + qp;\nconst ip = A*gamma*Math.cos(gamma*t) - B*gamma*Math.sin(gamma*t);`,
        codeOut: `t=${(currentTime * 1000).toFixed(1)}ms → q=${fmt(live.q * 1000, 3)} mC,  qₕ=${fmt(live.qh * 1000, 3)} mC`,
        handTex: `${qhTex} \\\\[3pt] q(t) = q_h(t) + q_p(t),\\quad 5\\tau_1 = ${fmt(system.tSettle * 1000, 1)}\\;\\text{ms}`,
      },
    ];
  }, [system, R, L, C, E0, gamma, live, currentTime]);

  useEffect(() => {
    if (!open || !autoPlay) return;
    const id = window.setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= steps.length) {
          setAutoPlay(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2400);
    return () => window.clearInterval(id);
  }, [open, autoPlay, steps.length]);

  useEffect(() => {
    if (!open) return;
    const cur = steps[activeStep - 1];
    if (cur) onHighlightComponent(cur.focusComponent);
    const el = stepRefs.current[activeStep - 1];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [open, activeStep, steps, onHighlightComponent]);

  const handlePullPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const drawerW = drawerRef.current?.getBoundingClientRect().width || 660;
    const baseOffset = open ? 0 : drawerW;
    let maxMove = 0;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      maxMove = Math.max(maxMove, Math.abs(dx));
      if (maxMove > 4) {
        setDragOffsetPx(Math.max(0, Math.min(drawerW, baseOffset + dx)));
      }
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (maxMove <= 4) {
        setDragOffsetPx(null);
        onToggle();
        return;
      }
      const dx = ev.clientX - startX;
      const finalOffset = Math.max(0, Math.min(drawerW, baseOffset + dx));
      setDragOffsetPx(null);
      if (1 - finalOffset / drawerW > 0.25) {
        if (!open) onToggle();
      } else {
        if (open) onClose();
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleTogglePlay = () => {
    if (autoPlay) {
      setAutoPlay(false);
    } else {
      if (activeStep >= steps.length) setActiveStep(1);
      setAutoPlay(true);
    }
  };

  const drawerClass = `solution-drawer ${open ? 'is-open' : 'is-closed'}${
    dragOffsetPx !== null ? ' is-dragging' : ''
  }`;

  return (
    <aside
      ref={drawerRef}
      aria-label="Program vs Hand Pull Drawer"
      className={drawerClass}
      style={
        dragOffsetPx !== null
          ? { transform: `translateX(${dragOffsetPx}px)` }
          : undefined
      }
    >
      {/* Slim Pull Handle */}
      <button
        type="button"
        onPointerDown={handlePullPointerDown}
        title={open ? 'Drag right or click to close' : 'Pull left or click for Solution'}
        style={{
          position: 'absolute',
          left: -24,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 24,
          height: 64,
          borderRadius: '8px 0 0 8px',
          border: '1px solid var(--border-color)',
          borderRight: 'none',
          background: 'var(--bg-panel)',
          color: open ? 'var(--accent)' : 'var(--text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        {open ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        <span
          style={{
            width: 2,
            height: 16,
            borderRadius: 999,
            background: 'var(--border-strong)',
          }}
        />
      </button>

      {/* Simple Top Bar */}
      <div
        style={{
          padding: '10px 22px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          Program Code vs Hand
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            disabled={activeStep <= 1}
            title="Previous step"
            onClick={() => {
              setAutoPlay(false);
              setActiveStep((s) => Math.max(1, s - 1));
            }}
            style={ghostBtn(activeStep <= 1)}
          >
            <ChevronLeft size={14} />
          </button>

          <button
            type="button"
            onClick={handleTogglePlay}
            style={{
              height: 25,
              padding: '0 9px',
              borderRadius: 6,
              border: 'none',
              background: autoPlay ? 'var(--accent-soft)' : 'var(--accent)',
              color: autoPlay ? 'var(--accent)' : '#ffffff',
              fontSize: 11.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
          >
            {autoPlay ? <Pause size={12} /> : <Play size={12} />}
            <span>{autoPlay ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            disabled={activeStep >= steps.length}
            title="Next step"
            onClick={() => {
              setAutoPlay(false);
              setActiveStep((s) => Math.min(steps.length, s + 1));
            }}
            style={ghostBtn(activeStep >= steps.length)}
          >
            <ChevronRight size={14} />
          </button>

          <button
            type="button"
            onClick={() => {
              setAutoPlay(false);
              setActiveStep((s) => (s === steps.length ? 1 : steps.length));
            }}
            title={activeStep === steps.length ? 'Reset to Step 1' : 'Show all steps'}
            style={{
              height: 25,
              padding: '0 7px',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
          >
            {activeStep === steps.length ? <RotateCcw size={11} /> : <Layers size={11} />}
            <span>{activeStep === steps.length ? '1' : 'All'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Close drawer (Esc)"
            style={ghostBtn(false)}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Slim Progress Line */}
      <div
        style={{
          height: 2,
          width: '100%',
          background: 'var(--border-color)',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${(activeStep / steps.length) * 100}%`,
            background: 'var(--accent)',
            transition: 'width 0.3s ease',
          }}
        />
        {autoPlay && (
          <div
            key={activeStep}
            className="step-progress-fill"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--trace-q)',
              opacity: 0.45,
            }}
          />
        )}
      </div>

      {/* Borderless Side-by-Side Flow */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {/* Column Headers */}
        <div
          className="side-flow-grid"
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--text-muted)',
            paddingBottom: 8,
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <span className="side-flow-left">Program Code</span>
          <span className="side-flow-right" style={{ borderLeft: 'none' }}>
            By Hand (LaTeX)
          </span>
        </div>

        {/* Steps */}
        {steps.slice(0, activeStep).map((st, idx) => {
          const isCurrent = st.num === activeStep;
          return (
            <div
              key={st.num}
              ref={(el) => {
                stepRefs.current[st.num - 1] = el;
              }}
              className="solve-step-fade"
              onClick={() => {
                setAutoPlay(false);
                setActiveStep(st.num);
              }}
              style={{
                cursor: 'pointer',
                paddingTop: idx === 0 ? 0 : 16,
                borderTop: idx === 0 ? 'none' : '1px solid var(--border-color)',
              }}
            >
              {/* Single Clean Instruction Line */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: isCurrent ? 'var(--accent)' : 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                <span className="mono" style={{ marginRight: 7, opacity: 0.7 }}>
                  0{st.num}
                </span>
                {st.instruction}
              </div>

              {/* Side-by-Side: Program Code | By Hand */}
              <div
                key={`flow-${st.num}-${pulseCount}`}
                className={`side-flow-grid${pulseCount > 0 ? ' live-value-fade' : ''}`}
              >
                {/* Left: Program Code */}
                <div className="side-flow-left">
                  <pre
                    className="mono"
                    style={{
                      margin: 0,
                      fontSize: 11,
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {st.code}
                  </pre>
                  <div
                    className="mono"
                    style={{
                      marginTop: 5,
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--trace-q)',
                    }}
                  >
                    → {st.codeOut}
                  </div>
                </div>

                {/* Right: By Hand (LaTeX) */}
                <div className="side-flow-right" style={{ color: 'var(--text-primary)', fontSize: 12 }}>
                  <MathTex display tex={st.handTex} />
                </div>
              </div>
            </div>
          );
        })}

        {/* Separator + Boxed Final Answer Comparison */}
        {activeStep >= steps.length && (
          <div
            className="solve-step-fade"
            style={{
              marginTop: 6,
              paddingTop: 18,
              borderTop: '1px solid var(--border-strong)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'var(--accent)',
                marginBottom: 10,
              }}
            >
              Final Answer Comparison
            </div>

            <div
              key={`final-${pulseCount}`}
              className={pulseCount > 0 ? 'live-value-fade' : undefined}
              style={{
                border: '1.5px solid var(--accent)',
                borderRadius: 8,
                padding: '14px 16px',
              }}
            >
              <div className="side-flow-grid">
                {/* Program Final Output */}
                <div className="side-flow-left" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--trace-q)' }}>
                    Program Output
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      border: '1px solid var(--trace-q)',
                      borderRadius: 4,
                      padding: '6px 9px',
                      lineHeight: 1.45,
                    }}
                  >
                    qₚ(t) = {fmt(system.A * 1000, 3)} sin({fmt(gamma, 0)}t) {system.B >= 0 ? '+' : '−'} {fmt(Math.abs(system.B * 1000), 3)} cos({fmt(gamma, 0)}t) [mC]
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Q_max = {fmt(system.Qmax * 1000, 4)} mC · I_max = {fmt(system.Imax, 4)} A
                    <br />
                    At t = {(currentTime * 1000).toFixed(1)} ms: qₚ = {fmt(live.qp * 1000, 4)} mC
                  </div>
                </div>

                {/* Hand Final Answer (Boxed LaTeX) */}
                <div className="side-flow-right" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--trace-qp)' }}>
                    By Hand (LaTeX)
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontSize: 12 }}>
                    <MathTex
                      display
                      tex={`\\boxed{q_p(t) = ${fmt(system.A * 1000, 3)}\\sin(${fmt(gamma, 0)}t) ${signedTex(system.B * 1000, 3)}\\cos(${fmt(gamma, 0)}t)\\;[\\text{mC}]}`}
                    />
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>
                    <MathTex
                      tex={`Q_{\\max} = ${fmt(system.Qmax * 1000, 4)}\\text{ mC}, \\quad \\phi = ${fmt(system.phiDeg, 2)}^\\circ`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

function ghostBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 26,
    height: 26,
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    opacity: disabled ? 0.35 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer',
  };
}

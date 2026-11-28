import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Moon, Sun } from 'lucide-react';
import { RLCParams, RLCSystem, ThemeMode } from '../rlc/rlcModel';
import { MathTex } from './MathTex';

export type FocusedComponent = 'R' | 'L' | 'C' | 'E' | null;

interface ParameterSidebarProps {
  params: RLCParams;
  system: RLCSystem;
  theme: ThemeMode;
  focusedComponent: FocusedComponent;
  onChangeParams: (patch: Partial<RLCParams>) => void;
  onToggleTheme: () => void;
}

export const ParameterSidebar: React.FC<ParameterSidebarProps> = ({
  params,
  system,
  theme,
  focusedComponent,
  onChangeParams,
  onToggleTheme,
}) => {
  const [icOpen, setIcOpen] = useState(params.q0 !== 0 || params.i0 !== 0);

  useEffect(() => {
    if (params.q0 !== 0 || params.i0 !== 0) {
      setIcOpen(true);
    }
  }, [params.q0, params.i0]);

  const regimeColor =
    system.regime === 'overdamped'
      ? 'var(--success)'
      : system.regime === 'critically_damped'
      ? 'var(--warning)'
      : 'var(--danger)';

  const regimeBg =
    system.regime === 'overdamped'
      ? 'var(--success-soft)'
      : system.regime === 'critically_damped'
      ? 'var(--warning-soft)'
      : 'var(--danger-soft)';

  const regimeLabel =
    system.regime === 'overdamped'
      ? 'Overdamped'
      : system.regime === 'critically_damped'
      ? 'Critically Damped'
      : 'Underdamped';

  const aMc = system.A * 1000;
  const bMc = system.B * 1000;
  const qMaxMc = system.Qmax * 1000;

  const bSign = bMc >= 0 ? '+' : '-';
  const qpLatex = `q_p(t) = ${aMc.toFixed(3)}\\sin(${params.gamma.toFixed(0)}t) ${bSign} ${Math.abs(bMc).toFixed(3)}\\cos(${params.gamma.toFixed(0)}t)\\;[\\text{mC}]`;

  return (
    <aside
      style={{
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: 16,
        gap: 14,
      }}
    >
      {/* Minimal title + theme toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: '-0.01em' }}>
          Overdamped RLC
        </span>
        <button
          type="button"
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={onToggleTheme}
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      {/* 1. Damping Regime Card */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: regimeColor,
                boxShadow: `0 0 8px ${regimeColor}`,
              }}
            />
            <span style={{ fontWeight: 600, fontSize: 13 }}>{regimeLabel}</span>
          </div>
          <span
            className="mono"
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 999,
              background: regimeBg,
              color: regimeColor,
            }}
          >
            Δ = {system.discriminant >= 0 ? '+' : ''}
            {system.discriminant.toFixed(0)} Ω²
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px', fontSize: 11.5 }}>
          <div>
            <div style={mutedLabel}>Roots (s⁻¹)</div>
            <div className="mono" style={{ fontWeight: 500, marginTop: 1 }}>
              {system.regime === 'overdamped'
                ? `${system.m1.toFixed(2)}, ${system.m2.toFixed(2)}`
                : system.regime === 'critically_damped'
                ? `${system.m1.toFixed(2)} (double)`
                : `−${system.alpha.toFixed(1)} ± j${system.omegaD.toFixed(1)}`}
            </div>
          </div>
          <div>
            <div style={mutedLabel}>Settling (5τ₁)</div>
            <div className="mono" style={{ fontWeight: 500, marginTop: 1 }}>
              {(system.tSettle * 1000).toFixed(1)} ms
            </div>
          </div>
        </div>

        {system.regime !== 'overdamped' && (
          <button
            type="button"
            onClick={() => onChangeParams({ R: Math.ceil(system.rCrit + 5) })}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '5px 8px',
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-panel)',
              color: 'var(--text-primary)',
              fontSize: 11.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Set R &gt; R_crit ({Math.ceil(system.rCrit + 5)} Ω) for Overdamped
          </button>
        )}
      </section>

      {/* 2. Circuit Parameters */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={sectionTitle}>Circuit Parameters</div>

        <SliderField
          label="Resistance (R)"
          sublabel={`R_crit=${system.rCrit.toFixed(1)}`}
          unit="Ω"
          decimals={1}
          min={5}
          max={200}
          hardMin={0.1}
          step={0.5}
          value={params.R}
          highlighted={focusedComponent === 'R'}
          onChange={(v) => onChangeParams({ R: v })}
        />

        <SliderField
          label="Inductance (L)"
          unit="H"
          decimals={2}
          min={0.05}
          max={2.0}
          hardMin={0.001}
          step={0.01}
          value={params.L}
          highlighted={focusedComponent === 'L'}
          onChange={(v) => onChangeParams({ L: v })}
        />

        <SliderField
          label="Capacitance (C)"
          unit="mF"
          decimals={1}
          min={0.2}
          max={5.0}
          hardMin={0.01}
          step={0.1}
          value={params.C * 1000}
          highlighted={focusedComponent === 'C'}
          onChange={(v) => onChangeParams({ C: v / 1000 })}
        />

        <SliderField
          label="Amplitude (E₀)"
          unit="V"
          decimals={0}
          min={1}
          max={100}
          hardMin={0.1}
          step={1}
          value={params.E0}
          highlighted={focusedComponent === 'E'}
          onChange={(v) => onChangeParams({ E0: v })}
        />

        <SliderField
          label="Frequency (γ)"
          sublabel={`${(params.gamma / (2 * Math.PI)).toFixed(1)}Hz`}
          unit="rad/s"
          decimals={0}
          min={5}
          max={200}
          hardMin={0.5}
          step={1}
          value={params.gamma}
          highlighted={focusedComponent === 'E'}
          onChange={(v) => onChangeParams({ gamma: v })}
        />
      </section>

      {/* 3. Initial Conditions (Collapsible) */}
      <section style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
        <button
          type="button"
          onClick={() => setIcOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: 'var(--text-secondary)',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
        >
          <span>Initial Conditions</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!icOpen && (
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'none' }}>
                q₀={(params.q0 * 1000).toFixed(1)} mC
              </span>
            )}
            {icOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </button>

        {icOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            <SliderField
              label="Initial Charge (q₀)"
              unit="mC"
              decimals={1}
              min={-15}
              max={15}
              step={0.5}
              value={params.q0 * 1000}
              onChange={(v) => onChangeParams({ q0: v / 1000 })}
            />
            <SliderField
              label="Initial Current (i₀)"
              unit="A"
              decimals={2}
              min={-2}
              max={2}
              step={0.05}
              value={params.i0}
              onChange={(v) => onChangeParams({ i0: v })}
            />
          </div>
        )}
      </section>

      {/* 4. Steady-State Solution Summary (LaTeX) */}
      <section style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, marginTop: 'auto' }}>
        <div style={{ ...sectionTitle, marginBottom: 6 }}>Steady-State Solution</div>

        <div
          style={{
            color: 'var(--trace-qp)',
            marginBottom: 10,
            fontSize: 11.5,
          }}
        >
          <MathTex display tex={qpLatex} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Metric label="Peak Charge Q_max" value={`${qMaxMc.toFixed(3)} mC`} />
          <Metric label="Peak Current I_max" value={`${system.Imax.toFixed(3)} A`} />
          <Metric
            label={`Impedance Z (${system.reactanceType === 'capacitive' ? 'Cap' : system.reactanceType === 'inductive' ? 'Ind' : 'Res'})`}
            value={`${system.Z.toFixed(2)} Ω`}
          />
          <Metric
            label="Net Reactance X"
            value={`${system.X >= 0 ? '+' : '−'}${Math.abs(system.X).toFixed(2)} Ω`}
          />
        </div>
      </section>
    </aside>
  );
};

interface SliderFieldProps {
  label: string;
  sublabel?: string;
  unit: string;
  decimals: number;
  min: number;
  max: number;
  hardMin?: number;
  step: number;
  value: number;
  highlighted?: boolean;
  onChange: (v: number) => void;
}

const SliderField: React.FC<SliderFieldProps> = ({
  label,
  sublabel,
  unit,
  decimals,
  min,
  max,
  hardMin,
  step,
  value,
  highlighted,
  onChange,
}) => {
  const [draft, setDraft] = useState(() => value.toFixed(decimals));

  useEffect(() => {
    setDraft(Number.isInteger(value) && decimals === 0 ? String(value) : value.toFixed(decimals));
  }, [value, decimals]);

  const commitDraft = () => {
    const parsed = parseFloat(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(value.toFixed(decimals));
      return;
    }
    const clamped = hardMin !== undefined ? Math.max(hardMin, parsed) : parsed;
    onChange(clamped);
    setDraft(clamped.toFixed(decimals));
  };

  return (
    <div
      style={{
        padding: '5px 8px',
        borderRadius: 7,
        background: highlighted ? 'var(--accent-soft)' : 'transparent',
        border: '1px solid ' + (highlighted ? 'var(--accent)' : 'transparent'),
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', minWidth: 0 }}>
          {label}
          {sublabel && (
            <span style={{ marginLeft: 5, fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
              {sublabel}
            </span>
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <input
            className="param-num-input"
            type="number"
            step={step}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              const parsed = parseFloat(e.target.value);
              if (Number.isFinite(parsed) && (hardMin === undefined || parsed >= hardMin)) {
                onChange(parsed);
              }
            }}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', minWidth: 16 }}>
            {unit}
          </span>
        </div>
      </div>
      <input
        className="rlc-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.max(min, Math.min(max, value))}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={mutedLabel}>{label}</div>
    <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginTop: 1 }}>
      {value}
    </div>
  </div>
);

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 9,
  padding: 12,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-secondary)',
};

const mutedLabel: React.CSSProperties = {
  fontSize: 10.5,
  color: 'var(--text-muted)',
};

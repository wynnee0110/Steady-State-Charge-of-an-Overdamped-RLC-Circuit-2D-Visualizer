import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { RLCParams, RLCSystem } from '../rlc/rlcModel';

export type FocusedComponent = 'R' | 'L' | 'C' | 'E' | null;

interface ParameterSidebarProps {
  params: RLCParams;
  system: RLCSystem;
  focusedComponent: FocusedComponent;
  onChangeParams: (patch: Partial<RLCParams>) => void;
}

export const ParameterSidebar: React.FC<ParameterSidebarProps> = ({
  params,
  system,
  focusedComponent,
  onChangeParams,
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

  const formatSigned = (val: number, digits = 3) =>
    `${val >= 0 ? '+' : '−'}${Math.abs(val).toFixed(digits)}`;

  return (
    <aside
      style={{
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: 16,
        gap: 16,
      }}
    >
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
      <section style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={sectionTitle}>Circuit Parameters</div>

        <SliderField
          label="Resistance (R)"
          sublabel={`R_crit = ${system.rCrit.toFixed(1)} Ω`}
          valueDisplay={`${params.R.toFixed(1)} Ω`}
          min={5}
          max={200}
          step={0.5}
          value={params.R}
          highlighted={focusedComponent === 'R'}
          onChange={(v) => onChangeParams({ R: v })}
        />

        <SliderField
          label="Inductance (L)"
          valueDisplay={`${params.L.toFixed(2)} H`}
          min={0.05}
          max={2.0}
          step={0.01}
          value={params.L}
          highlighted={focusedComponent === 'L'}
          onChange={(v) => onChangeParams({ L: v })}
        />

        <SliderField
          label="Capacitance (C)"
          valueDisplay={`${(params.C * 1000).toFixed(1)} mF`}
          min={0.2}
          max={5.0}
          step={0.1}
          value={params.C * 1000}
          highlighted={focusedComponent === 'C'}
          onChange={(v) => onChangeParams({ C: v / 1000 })}
        />

        <SliderField
          label="Source Amplitude (E₀)"
          valueDisplay={`${params.E0.toFixed(0)} V`}
          min={1}
          max={100}
          step={1}
          value={params.E0}
          highlighted={focusedComponent === 'E'}
          onChange={(v) => onChangeParams({ E0: v })}
        />

        <SliderField
          label="Angular Freq (γ)"
          sublabel={`${(params.gamma / (2 * Math.PI)).toFixed(1)} Hz`}
          valueDisplay={`${params.gamma.toFixed(0)} rad/s`}
          min={5}
          max={200}
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
              valueDisplay={`${(params.q0 * 1000).toFixed(1)} mC`}
              min={-15}
              max={15}
              step={0.5}
              value={params.q0 * 1000}
              onChange={(v) => onChangeParams({ q0: v / 1000 })}
            />
            <SliderField
              label="Initial Current (i₀)"
              valueDisplay={`${params.i0.toFixed(2)} A`}
              min={-2}
              max={2}
              step={0.05}
              value={params.i0}
              onChange={(v) => onChangeParams({ i0: v })}
            />
          </div>
        )}
      </section>

      {/* 4. Steady-State Solution Summary */}
      <section style={{ ...cardStyle, marginTop: 'auto' }}>
        <div style={{ ...sectionTitle, marginBottom: 8 }}>Steady-State Solution</div>

        <div
          className="mono"
          style={{
            fontSize: 11.5,
            lineHeight: 1.5,
            padding: '8px 10px',
            borderRadius: 6,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            color: 'var(--trace-qp)',
            marginBottom: 10,
            wordBreak: 'break-word',
          }}
        >
          qₚ(t) = {aMc.toFixed(3)} sin({params.gamma.toFixed(0)}t){' '}
          {formatSigned(bMc, 3)} cos({params.gamma.toFixed(0)}t) mC
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
  valueDisplay: string;
  min: number;
  max: number;
  step: number;
  value: number;
  highlighted?: boolean;
  onChange: (v: number) => void;
}

const SliderField: React.FC<SliderFieldProps> = ({
  label,
  sublabel,
  valueDisplay,
  min,
  max,
  step,
  value,
  highlighted,
  onChange,
}) => (
  <div
    style={{
      padding: '6px 8px',
      borderRadius: 7,
      background: highlighted ? 'var(--accent-soft)' : 'transparent',
      border: '1px solid ' + (highlighted ? 'var(--accent)' : 'transparent'),
      transition: 'background 0.15s ease, border-color 0.15s ease',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
        {label}
        {sublabel && (
          <span style={{ marginLeft: 5, fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 400 }}>
            {sublabel}
          </span>
        )}
      </span>
      <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
        {valueDisplay}
      </span>
    </div>
    <input
      className="rlc-slider"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  </div>
);

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

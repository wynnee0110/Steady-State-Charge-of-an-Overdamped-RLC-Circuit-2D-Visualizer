import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { RLCInstantState, RLCSystem, evaluateRLC, sampleWaveforms } from '../rlc/rlcModel';
import { ThemeMode } from './Header';

type ChartMode = 'charge' | 'current_voltage';

interface WaveformChartProps {
  system: RLCSystem;
  instant: RLCInstantState;
  currentTime: number;
  windowSpan: number;
  checkpoints: number[];
  isPlaying: boolean;
  playbackSpeed: number;
  theme: ThemeMode;
  onTogglePlay: () => void;
  onReset: () => void;
  onScrubTime: (t: number) => void;
  onChangeSpeed: (s: number) => void;
  onChangeWindowSpan: (span: number) => void;
}

const SPEED_OPTIONS = [0.05, 0.1, 0.25, 0.5, 1];
const SPAN_OPTIONS = [0.25, 0.4, 0.5, 1.0];

export const WaveformChart: React.FC<WaveformChartProps> = ({
  system,
  instant,
  currentTime,
  windowSpan,
  checkpoints,
  isPlaying,
  playbackSpeed,
  theme,
  onTogglePlay,
  onReset,
  onScrubTime,
  onChangeSpeed,
  onChangeWindowSpan,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 720, h: 280 });
  const [mode, setMode] = useState<ChartMode>('charge');
  const [showTotal, setShowTotal] = useState(true);
  const [showSteady, setShowSteady] = useState(true);
  const [showTransient, setShowTransient] = useState(true);
  const [showCheckpoints, setShowCheckpoints] = useState(true);
  const [showCurrent, setShowCurrent] = useState(true);
  const [showVoltage, setShowVoltage] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; state: RLCInstantState } | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          w: Math.max(300, entry.contentRect.width),
          h: Math.max(160, entry.contentRect.height),
        });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Rolling viewport: sweeps 0 -> currentTime during initial startup, then scrolls smoothly
  const tStart = currentTime > windowSpan ? currentTime - windowSpan : 0;
  const tEnd = currentTime > windowSpan ? currentTime : windowSpan;
  const drawEnd = currentTime;

  // Stable, non-jittering Y-axis bounds computed from startup + steady state
  const { yMaxLeft, yMaxRight } = useMemo(() => {
    const refHorizon = Math.max(windowSpan, system.tSettle, 0.5);
    const refSamples = sampleWaveforms(system, refHorizon, 400);
    if (mode === 'charge') {
      let maxAbsMc = Math.max(1, system.Qmax * 1000);
      for (const s of refSamples) {
        if (showTotal) maxAbsMc = Math.max(maxAbsMc, Math.abs(s.q * 1000));
        if (showSteady) maxAbsMc = Math.max(maxAbsMc, Math.abs(s.qp * 1000));
        if (showTransient) maxAbsMc = Math.max(maxAbsMc, Math.abs(s.qh * 1000));
      }
      return { yMaxLeft: maxAbsMc * 1.15, yMaxRight: 1 };
    } else {
      let maxI = Math.max(0.05, system.Imax);
      let maxE = Math.max(1, Math.abs(system.params.E0));
      for (const s of refSamples) {
        maxI = Math.max(maxI, Math.abs(s.i));
        maxE = Math.max(maxE, Math.abs(s.E));
      }
      return { yMaxLeft: maxI * 1.18, yMaxRight: maxE * 1.18 };
    }
  }, [system, windowSpan, mode, showTotal, showSteady, showTransient]);

  // Visible samples strictly from tStart to drawEnd
  const visibleSamples = useMemo(() => {
    if (drawEnd <= tStart + 1e-12) {
      return [evaluateRLC(system, tStart)];
    }
    const count = 420;
    const out: RLCInstantState[] = new Array(count);
    const span = drawEnd - tStart;
    for (let k = 0; k < count; k++) {
      const t = tStart + (k / (count - 1)) * span;
      out[k] = evaluateRLC(system, t);
    }
    return out;
  }, [system, tStart, drawEnd]);

  const pad = { left: 54, right: mode === 'current_voltage' ? 50 : 22, top: 18, bottom: 28 };

  const plotToTime = (clientX: number): number => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return tStart;
    const x = clientX - rect.left;
    const plotW = Math.max(1, size.w - pad.left - pad.right);
    const frac = Math.max(0, Math.min(1, (x - pad.left) / plotW));
    return tStart + frac * (tEnd - tStart);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = theme === 'dark';
    const gridCol = isDark ? 'rgba(148, 163, 184, 0.09)' : 'rgba(100, 116, 139, 0.12)';
    const axisZero = isDark ? 'rgba(148, 163, 184, 0.28)' : 'rgba(100, 116, 139, 0.35)';
    const textMuted = isDark ? '#788296' : '#64748b';
    const colQ = isDark ? '#34d399' : '#059669';
    const colQp = isDark ? '#38bdf8' : '#0284c7';
    const colQh = isDark ? '#f59e0b' : '#d97706';
    const colI = isDark ? '#a78bfa' : '#7c3aed';
    const colE = isDark ? '#f43f5e' : '#e11d48';

    const w = size.w;
    const h = size.h;
    const plotW = Math.max(10, w - pad.left - pad.right);
    const plotH = Math.max(10, h - pad.top - pad.bottom);
    const viewSpan = Math.max(1e-6, tEnd - tStart);
    const tToX = (t: number) => pad.left + ((t - tStart) / viewSpan) * plotW;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const valToYLeft = (v: number) => pad.top + plotH / 2 - (v / yMaxLeft) * (plotH / 2);
    const valToYRight = (v: number) => pad.top + plotH / 2 - (v / yMaxRight) * (plotH / 2);

    // Grid lines
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const gx = pad.left + (i / 5) * plotW;
      ctx.moveTo(gx, pad.top);
      ctx.lineTo(gx, pad.top + plotH);
    }
    for (let j = 0; j <= 4; j++) {
      const gy = pad.top + (j / 4) * plotH;
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(pad.left + plotW, gy);
    }
    ctx.stroke();

    // Zero baseline
    ctx.strokeStyle = axisZero;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + plotH / 2);
    ctx.lineTo(pad.left + plotW, pad.top + plotH / 2);
    ctx.stroke();

    // Y-axis tick labels
    ctx.fillStyle = textMuted;
    ctx.font = '500 10.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const leftTicks = [yMaxLeft, yMaxLeft / 2, 0, -yMaxLeft / 2, -yMaxLeft];
    leftTicks.forEach((v, idx) => {
      const y = pad.top + (idx / 4) * plotH;
      const label = mode === 'charge' ? v.toFixed(1) : v.toFixed(2);
      ctx.fillText(label, pad.left - 8, y);
    });

    ctx.textAlign = 'left';
    ctx.fillText(mode === 'charge' ? 'q (mC)' : 'i (A)', 8, pad.top + 4);

    if (mode === 'current_voltage') {
      ctx.textAlign = 'left';
      [yMaxRight, 0, -yMaxRight].forEach((v, idx) => {
        const y = pad.top + (idx / 2) * plotH;
        ctx.fillText(`${v.toFixed(0)}V`, pad.left + plotW + 6, y);
      });
    }

    // Rolling X-axis time labels (ms)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 5; i++) {
      const tVal = tStart + (i / 5) * viewSpan;
      const x = tToX(tVal);
      ctx.fillText(`${(tVal * 1000).toFixed(0)} ms`, x, pad.top + plotH + 8);
    }

    // Clip to plot area
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.left, pad.top, plotW, plotH);
    ctx.clip();

    // Steady-state ±Q_max envelope lines in Charge mode
    if (mode === 'charge') {
      const qMaxMc = system.Qmax * 1000;
      const yPos = valToYLeft(qMaxMc);
      const yNeg = valToYLeft(-qMaxMc);
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.26)' : 'rgba(2, 132, 199, 0.26)';
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, yPos);
      ctx.lineTo(pad.left + plotW, yPos);
      ctx.moveTo(pad.left, yNeg);
      ctx.lineTo(pad.left + plotW, yNeg);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.72)' : 'rgba(2, 132, 199, 0.78)';
      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('+Q_max', pad.left + plotW - 4, yPos - 2);
      ctx.textBaseline = 'top';
      ctx.fillText('−Q_max', pad.left + plotW - 4, yNeg + 2);
      ctx.restore();
    }

    // 5*tau_1 settling marker when visible inside [tStart, drawEnd]
    if (system.tSettle >= tStart && system.tSettle <= drawEnd) {
      const sx = tToX(system.tSettle);
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(245, 158, 11, 0.5)' : 'rgba(217, 119, 6, 0.5)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(sx, pad.top);
      ctx.lineTo(sx, pad.top + plotH);
      ctx.stroke();
      ctx.fillStyle = colQh;
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('5τ₁', Math.min(pad.left + plotW - 26, sx + 4), pad.top + 4);
      ctx.restore();
    }

    const drawSeries = (
      getY: (s: RLCInstantState) => number,
      color: string,
      lineWidth = 2,
      dashed: number[] = []
    ) => {
      if (visibleSamples.length < 2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dashed);
      ctx.beginPath();
      visibleSamples.forEach((s, idx) => {
        const x = tToX(s.t);
        const y = getY(s);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };

    if (mode === 'charge') {
      if (showTransient && visibleSamples.length >= 2) {
        const yZero = valToYLeft(0);
        ctx.save();
        ctx.fillStyle = isDark ? 'rgba(245, 158, 11, 0.09)' : 'rgba(217, 119, 6, 0.08)';
        ctx.beginPath();
        ctx.moveTo(tToX(visibleSamples[0].t), yZero);
        for (const s of visibleSamples) {
          ctx.lineTo(tToX(s.t), valToYLeft(s.qh * 1000));
        }
        ctx.lineTo(tToX(visibleSamples[visibleSamples.length - 1].t), yZero);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        drawSeries((s) => valToYLeft(s.qh * 1000), colQh, 1.75, [5, 4]);
      }

      if (showSteady) {
        drawSeries((s) => valToYLeft(s.qp * 1000), colQp, 2.2);
      }

      if (showTotal) {
        drawSeries((s) => valToYLeft(s.q * 1000), colQ, 2.4);
      }

      // Verification checkpoints scrolling with the trace
      if (showCheckpoints && showSteady) {
        for (const cp of checkpoints) {
          if (cp < tStart || cp > drawEnd) continue;
          const st = evaluateRLC(system, cp);
          const cx = tToX(cp);
          const cy = valToYLeft(st.qp * 1000);
          ctx.fillStyle = isDark ? '#0f1115' : '#ffffff';
          ctx.strokeStyle = colQp;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 3.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    } else {
      if (showVoltage) {
        drawSeries((s) => valToYRight(s.E), colE, 1.7, [4, 4]);
      }
      if (showCurrent) {
        drawSeries((s) => valToYLeft(s.i), colI, 2.3);
      }
    }

    // Active sweep head + glowing tip markers at currentTime
    const px = tToX(currentTime);
    ctx.strokeStyle = isDark ? 'rgba(236, 239, 244, 0.42)' : 'rgba(20, 23, 31, 0.35)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(px, pad.top);
    ctx.lineTo(px, pad.top + plotH);
    ctx.stroke();

    const drawGlowingTip = (y: number, color: string) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.24;
      ctx.beginPath();
      ctx.arc(px, y, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(px, y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isDark ? '#0f1115' : '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    };

    if (mode === 'charge') {
      if (showTransient) drawGlowingTip(valToYLeft(instant.qh * 1000), colQh);
      if (showSteady) drawGlowingTip(valToYLeft(instant.qp * 1000), colQp);
      if (showTotal) drawGlowingTip(valToYLeft(instant.q * 1000), colQ);
    } else {
      if (showVoltage) drawGlowingTip(valToYRight(instant.E), colE);
      if (showCurrent) drawGlowingTip(valToYLeft(instant.i), colI);
    }

    ctx.restore();
    ctx.restore();
  }, [
    size,
    visibleSamples,
    yMaxLeft,
    yMaxRight,
    system,
    instant,
    currentTime,
    tStart,
    tEnd,
    drawEnd,
    checkpoints,
    mode,
    showTotal,
    showSteady,
    showTransient,
    showCheckpoints,
    showCurrent,
    showVoltage,
    theme,
    pad.left,
    pad.right,
    pad.top,
    pad.bottom,
  ]);

  const isUnsteady = instant.transientRatio > 0.02;
  const transientPct = Math.min(999, Math.round(instant.transientRatio * 100));
  const scrubberMax = Math.max(windowSpan * 2, currentTime);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel)',
        overflow: 'hidden',
      }}
    >
      {/* Chart Header */}
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Mode Toggle */}
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
                ['charge', 'Charge q(t)'],
                ['current_voltage', 'Current & Voltage'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                style={{
                  padding: '3px 9px',
                  borderRadius: 5,
                  border: 'none',
                  background: mode === k ? 'var(--bg-panel)' : 'transparent',
                  color: mode === k ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 11.5,
                  fontWeight: mode === k ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Live Transient vs Steady-State Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 9px',
              borderRadius: 999,
              background: isUnsteady ? 'var(--warning-soft)' : 'var(--success-soft)',
              color: isUnsteady ? 'var(--warning)' : 'var(--success)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isUnsteady ? 'var(--warning)' : 'var(--success)',
              }}
            />
            <span>{isUnsteady ? `Transient · Unsteady (${transientPct}%)` : 'Steady State'}</span>
          </div>

          {/* Trace Legend Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {mode === 'charge' ? (
              <>
                <LegendPill
                  active={showTotal}
                  color="var(--trace-q)"
                  label="Total q(t)"
                  onClick={() => setShowTotal((v) => !v)}
                />
                <LegendPill
                  active={showSteady}
                  color="var(--trace-qp)"
                  label="Steady-State qₚ(t)"
                  onClick={() => setShowSteady((v) => !v)}
                />
                <LegendPill
                  active={showTransient}
                  color="var(--trace-qh)"
                  label="Transient qₕ(t)"
                  dashed
                  onClick={() => setShowTransient((v) => !v)}
                />
                <LegendPill
                  active={showCheckpoints}
                  color="var(--trace-qp)"
                  label="Checkpoints"
                  dotOnly
                  onClick={() => setShowCheckpoints((v) => !v)}
                />
              </>
            ) : (
              <>
                <LegendPill
                  active={showCurrent}
                  color="var(--trace-i)"
                  label="Current i(t)"
                  onClick={() => setShowCurrent((v) => !v)}
                />
                <LegendPill
                  active={showVoltage}
                  color="var(--trace-e)"
                  label="Source E(t)"
                  dashed
                  onClick={() => setShowVoltage((v) => !v)}
                />
              </>
            )}
          </div>
        </div>

        {/* Time Window Span Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Window</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {SPAN_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChangeWindowSpan(opt)}
                className="mono"
                style={{
                  padding: '2px 7px',
                  borderRadius: 5,
                  border: '1px solid ' + (Math.abs(windowSpan - opt) < 1e-6 ? 'var(--accent)' : 'var(--border-color)'),
                  background: Math.abs(windowSpan - opt) < 1e-6 ? 'var(--accent-soft)' : 'var(--bg-surface)',
                  color: Math.abs(windowSpan - opt) < 1e-6 ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {opt.toFixed(2)}s
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Plot Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', minHeight: 140 }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
          onMouseDown={(e) => {
            draggingRef.current = true;
            onScrubTime(plotToTime(e.clientX));
          }}
          onMouseMove={(e) => {
            const tHover = plotToTime(e.clientX);
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect && tHover <= drawEnd) {
              setHoverInfo({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                state: evaluateRLC(system, tHover),
              });
            } else {
              setHoverInfo(null);
            }
            if (draggingRef.current) {
              onScrubTime(tHover);
            }
          }}
          onMouseUp={() => {
            draggingRef.current = false;
          }}
          onMouseLeave={() => {
            draggingRef.current = false;
            setHoverInfo(null);
          }}
        />

        {hoverInfo && (
          <div
            className="mono"
            style={{
              position: 'absolute',
              top: 8,
              right: mode === 'current_voltage' ? 56 : 20,
              padding: '4px 9px',
              borderRadius: 6,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              fontSize: 11,
              color: 'var(--text-primary)',
              pointerEvents: 'none',
              display: 'flex',
              gap: 10,
            }}
          >
            <span>t={(hoverInfo.state.t * 1000).toFixed(1)}ms</span>
            {mode === 'charge' ? (
              <>
                <span style={{ color: 'var(--trace-q)' }}>q={(hoverInfo.state.q * 1000).toFixed(2)}mC</span>
                <span style={{ color: 'var(--trace-qp)' }}>qₚ={(hoverInfo.state.qp * 1000).toFixed(2)}mC</span>
                <span style={{ color: 'var(--trace-qh)' }}>qₕ={(hoverInfo.state.qh * 1000).toFixed(2)}mC</span>
              </>
            ) : (
              <>
                <span style={{ color: 'var(--trace-i)' }}>i={(hoverInfo.state.i * 1000).toFixed(1)}mA</span>
                <span style={{ color: 'var(--trace-e)' }}>E={hoverInfo.state.E.toFixed(1)}V</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Integrated Minimal Playback Bar */}
      <div
        style={{
          height: 44,
          padding: '0 14px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-panel)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            onClick={onTogglePlay}
            style={{
              height: 28,
              padding: '0 11px',
              borderRadius: 6,
              border: 'none',
              background: isPlaying ? 'var(--accent-soft)' : 'var(--accent)',
              color: isPlaying ? 'var(--accent)' : '#ffffff',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
            }}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            title="Replay unsteady startup from t = 0 (R)"
            onClick={onReset}
            style={{
              height: 28,
              padding: '0 9px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              fontSize: 11.5,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={12} />
            <span>Replay</span>
          </button>
        </div>

        <input
          className="rlc-slider"
          type="range"
          min={0}
          max={scrubberMax}
          step={scrubberMax / 500}
          value={Math.min(scrubberMax, currentTime)}
          onChange={(e) => onScrubTime(parseFloat(e.target.value))}
          style={{ flex: 1 }}
        />

        <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)', minWidth: 88, textAlign: 'right' }}>
          t = {(currentTime * 1000).toFixed(1)} ms
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {SPEED_OPTIONS.map((sp) => {
            const active = Math.abs(playbackSpeed - sp) < 1e-6;
            return (
              <button
                key={sp}
                type="button"
                onClick={() => onChangeSpeed(sp)}
                className="mono"
                style={{
                  padding: '3px 6px',
                  borderRadius: 5,
                  border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border-color)'),
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 10.5,
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                {sp}×
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const LegendPill: React.FC<{
  active: boolean;
  color: string;
  label: string;
  dashed?: boolean;
  dotOnly?: boolean;
  onClick: () => void;
}> = ({ active, color, label, dashed, dotOnly, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 8px',
      borderRadius: 999,
      border: '1px solid ' + (active ? 'var(--border-strong)' : 'var(--border-color)'),
      background: active ? 'var(--bg-surface)' : 'transparent',
      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
      fontSize: 11,
      fontWeight: 500,
      opacity: active ? 1 : 0.6,
      cursor: 'pointer',
    }}
  >
    {dotOnly ? (
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          border: `2px solid ${color}`,
        }}
      />
    ) : (
      <span
        style={{
          width: 12,
          height: 0,
          borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
        }}
      />
    )}
    <span>{label}</span>
  </button>
);

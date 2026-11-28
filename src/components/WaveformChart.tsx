import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Pause, Play, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { RLCInstantState, RLCSystem, ThemeMode, evaluateRLC, sampleWaveforms } from '../rlc/rlcModel';

interface WaveformChartProps {
  system: RLCSystem;
  instant: RLCInstantState;
  currentTime: number;
  windowSpan: number;
  isPlaying: boolean;
  playbackSpeed: number;
  theme: ThemeMode;
  onTogglePlay: () => void;
  onReset: () => void;
  onScrubTime: (t: number) => void;
  onChangeSpeed: (s: number) => void;
  onChangeWindowSpan: (span: number) => void;
  onExportFigure: () => void;
}

const SPEED_OPTIONS = [0.05, 0.1, 0.25, 0.5, 1];
const MIN_SPAN = 0.04;
const MAX_SPAN = 2.5;
const DEFAULT_SPAN = 0.4;

/** Round upward to clean oscilloscope graticule scale (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10 × 10^n). */
function niceCeil(val: number): number {
  const safe = Math.max(1e-6, val);
  const exp = Math.floor(Math.log10(safe));
  const pow = Math.pow(10, exp);
  const norm = safe / pow;
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  for (const s of steps) {
    if (norm <= s + 1e-9) return s * pow;
  }
  return 10 * pow;
}

function clampSpan(span: number): number {
  return Math.max(MIN_SPAN, Math.min(MAX_SPAN, span));
}

export const WaveformChart: React.FC<WaveformChartProps> = ({
  system,
  instant,
  currentTime,
  windowSpan,
  isPlaying,
  playbackSpeed,
  theme,
  onTogglePlay,
  onReset,
  onScrubTime,
  onChangeSpeed,
  onChangeWindowSpan,
  onExportFigure,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 720, h: 280 });
  const [showTotal, setShowTotal] = useState(true);
  const [showSteady, setShowSteady] = useState(true);
  const [showTransient, setShowTransient] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<RLCInstantState | null>(null);
  const draggingRef = useRef(false);

  const windowSpanRef = useRef(windowSpan);
  const onChangeSpanRef = useRef(onChangeWindowSpan);
  windowSpanRef.current = windowSpan;
  onChangeSpanRef.current = onChangeWindowSpan;

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

  // Non-passive wheel listener for smooth zoom in/out without page scroll warnings
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 0.85 : 1 / 0.85;
      onChangeSpanRef.current(clampSpan(windowSpanRef.current * factor));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Rolling viewport: sweeps 0 -> currentTime during startup, then scrolls smoothly
  const tStart = currentTime > windowSpan ? currentTime - windowSpan : 0;
  const tEnd = currentTime > windowSpan ? currentTime : windowSpan;
  const drawEnd = currentTime;

  // Fixed, non-jittering round Y-axis bounds for Charge q(t)
  const yMaxLeft = useMemo(() => {
    const refHorizon = Math.max(0.6, system.tSettle * 1.25);
    const refSamples = sampleWaveforms(system, refHorizon, 400);
    let maxAbsMc = Math.max(1, system.Qmax * 1000);
    for (const s of refSamples) {
      maxAbsMc = Math.max(maxAbsMc, Math.abs(s.q * 1000), Math.abs(s.qp * 1000), Math.abs(s.qh * 1000));
    }
    return niceCeil(maxAbsMc * 1.08);
  }, [system]);

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

  const pad = { left: 52, right: 20, top: 16, bottom: 26 };

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
    const gridCol = isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(100, 116, 139, 0.11)';
    const axisZero = isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(100, 116, 139, 0.32)';
    const textMuted = isDark ? '#707a8e' : '#64748b';
    const colQ = isDark ? '#34d399' : '#059669';
    const colQp = isDark ? '#38bdf8' : '#0284c7';
    const colQh = isDark ? '#f59e0b' : '#d97706';

    const w = size.w;
    const h = size.h;
    const plotW = Math.max(10, w - pad.left - pad.right);
    const plotH = Math.max(10, h - pad.top - pad.bottom);
    const viewSpan = Math.max(1e-6, tEnd - tStart);
    const tToX = (t: number) => pad.left + ((t - tStart) / viewSpan) * plotW;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const valToY = (v: number) => pad.top + plotH / 2 - (v / yMaxLeft) * (plotH / 2);

    // Fixed 10 × 4 oscilloscope graticule
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const gx = pad.left + (i / 10) * plotW;
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

    // Fixed Y-axis tick labels
    ctx.fillStyle = textMuted;
    ctx.font = '500 10.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    [yMaxLeft, yMaxLeft / 2, 0, -yMaxLeft / 2, -yMaxLeft].forEach((v, idx) => {
      const y = pad.top + (idx / 4) * plotH;
      const label = Math.abs(v) < 1e-9 ? '0' : Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1);
      ctx.fillText(label, pad.left - 8, y);
    });

    ctx.textAlign = 'left';
    ctx.fillText('mC', 10, pad.top + 2);

    // X-axis time labels (ms) aligned to every 2nd graticule division
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 10; i += 2) {
      const tVal = tStart + (i / 10) * viewSpan;
      const x = tToX(tVal);
      ctx.fillText(`${(tVal * 1000).toFixed(0)} ms`, x, pad.top + plotH + 7);
    }

    // Clip to graticule area
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.left, pad.top, plotW, plotH);
    ctx.clip();

    // Ultra-subtle ±Q_max steady-state reference lines
    const qMaxMc = system.Qmax * 1000;
    const yPos = valToY(qMaxMc);
    const yNeg = valToY(-qMaxMc);
    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(2, 132, 199, 0.2)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, yPos);
    ctx.lineTo(pad.left + plotW, yPos);
    ctx.moveTo(pad.left, yNeg);
    ctx.lineTo(pad.left + plotW, yNeg);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.65)' : 'rgba(2, 132, 199, 0.72)';
    ctx.font = '500 9.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('+Q_max', pad.left + plotW - 4, yPos - 2);
    ctx.textBaseline = 'top';
    ctx.fillText('−Q_max', pad.left + plotW - 4, yNeg + 2);
    ctx.restore();

    // Subtle 5*tau_1 settling tick when visible
    if (system.tSettle >= tStart && system.tSettle <= drawEnd) {
      const sx = tToX(system.tSettle);
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(245, 158, 11, 0.38)' : 'rgba(217, 119, 6, 0.38)';
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, pad.top);
      ctx.lineTo(sx, pad.top + plotH);
      ctx.stroke();
      ctx.fillStyle = colQh;
      ctx.font = '600 9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('5τ₁', Math.min(pad.left + plotW - 24, sx + 4), pad.top + 3);
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
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
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

    if (showTransient) drawSeries((s) => valToY(s.qh * 1000), colQh, 1.6, [5, 4]);
    if (showSteady) drawSeries((s) => valToY(s.qp * 1000), colQp, 2.1);
    if (showTotal) drawSeries((s) => valToY(s.q * 1000), colQ, 2.2);

    // Leading-edge dots at currentTime
    const px = tToX(currentTime);
    const drawTip = (y: number, color: string) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, y, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isDark ? '#0f1115' : '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    };

    if (showTransient) drawTip(valToY(instant.qh * 1000), colQh);
    if (showSteady) drawTip(valToY(instant.qp * 1000), colQp);
    if (showTotal) drawTip(valToY(instant.q * 1000), colQ);

    ctx.restore();
    ctx.restore();
  }, [
    size,
    visibleSamples,
    yMaxLeft,
    system,
    instant,
    currentTime,
    tStart,
    tEnd,
    drawEnd,
    showTotal,
    showSteady,
    showTransient,
    theme,
    pad.left,
    pad.right,
    pad.top,
    pad.bottom,
  ]);

  const isUnsteady = instant.transientRatio > 0.02;
  const msPerDiv = (windowSpan / 10) * 1000;
  const isDefaultZoom = Math.abs(windowSpan - DEFAULT_SPAN) < 0.005;

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
      {/* Clean Single-Row Top Bar */}
      <div
        style={{
          height: 38,
          padding: '0 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* Left: Topic Label + Trace Toggles + Subtle Status Dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, overflowX: 'auto' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            Steady-State Charge qₚ(t)
          </span>

          <div style={{ width: 1, height: 14, background: 'var(--border-color)', flexShrink: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LegendToggle
              active={showSteady}
              color="var(--trace-qp)"
              label="qₚ(t)"
              onClick={() => setShowSteady((v) => !v)}
            />
            <LegendToggle
              active={showTotal}
              color="var(--trace-q)"
              label="q(t)"
              onClick={() => setShowTotal((v) => !v)}
            />
            <LegendToggle
              active={showTransient}
              color="var(--trace-qh)"
              label="qₕ(t)"
              dashed
              onClick={() => setShowTransient((v) => !v)}
            />
          </div>

          <div style={{ width: 1, height: 14, background: 'var(--border-color)', flexShrink: 0 }} />

          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              color: isUnsteady ? 'var(--warning)' : 'var(--success)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
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
            {isUnsteady ? 'Unsteady' : 'Steady'}
          </span>
        </div>

        {/* Right: Zoom Out / ms/div / Zoom In / Matplotlib PNG */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            type="button"
            title="Zoom Out (wider time span)"
            disabled={windowSpan >= MAX_SPAN - 1e-4}
            onClick={() => onChangeWindowSpan(clampSpan(windowSpan / 0.75))}
            style={zoomBtn(windowSpan >= MAX_SPAN - 1e-4)}
          >
            <ZoomOut size={14} />
          </button>

          <span
            className="mono"
            title="Time scale per division (scroll on scope to zoom)"
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              minWidth: 66,
              textAlign: 'center',
            }}
          >
            {msPerDiv >= 10 ? msPerDiv.toFixed(0) : msPerDiv.toFixed(1)} ms/div
          </span>

          <button
            type="button"
            title="Zoom In (finer time detail)"
            disabled={windowSpan <= MIN_SPAN + 1e-4}
            onClick={() => onChangeWindowSpan(clampSpan(windowSpan * 0.75))}
            style={zoomBtn(windowSpan <= MIN_SPAN + 1e-4)}
          >
            <ZoomIn size={14} />
          </button>

          {!isDefaultZoom && (
            <button
              type="button"
              title="Reset zoom to 40 ms/div"
              onClick={() => onChangeWindowSpan(DEFAULT_SPAN)}
              className="mono"
              style={{
                padding: '2px 5px',
                borderRadius: 4,
                border: 'none',
                background: 'transparent',
                color: 'var(--accent)',
                fontSize: 10.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              1×
            </button>
          )}

          <div style={{ width: 1, height: 14, background: 'var(--border-color)', margin: '0 4px' }} />

          <button
            type="button"
            title="Export Matplotlib-style PNG (charge graph, circuit & values)"
            onClick={onExportFigure}
            style={{
              height: 24,
              padding: '0 6px',
              borderRadius: 5,
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
            <Camera size={13} />
            <span className="mono">PNG</span>
          </button>
        </div>
      </div>

      {/* Fixed-Graticule Plot Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', minHeight: 150 }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
          onMouseDown={(e) => {
            draggingRef.current = true;
            onScrubTime(plotToTime(e.clientX));
          }}
          onMouseMove={(e) => {
            const tHover = plotToTime(e.clientX);
            if (tHover <= drawEnd) {
              setHoverInfo(evaluateRLC(system, tHover));
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
              right: 18,
              fontSize: 10.5,
              color: 'var(--text-secondary)',
              pointerEvents: 'none',
              display: 'flex',
              gap: 10,
            }}
          >
            <span>t={(hoverInfo.t * 1000).toFixed(1)}ms</span>
            <span style={{ color: 'var(--trace-qp)' }}>qₚ={(hoverInfo.qp * 1000).toFixed(2)}mC</span>
            <span style={{ color: 'var(--trace-q)' }}>q={(hoverInfo.q * 1000).toFixed(2)}mC</span>
            <span style={{ color: 'var(--trace-qh)' }}>qₕ={(hoverInfo.qh * 1000).toFixed(2)}mC</span>
          </div>
        )}
      </div>

      {/* Clean Fixed Bottom Playback Bar */}
      <div
        style={{
          height: 40,
          padding: '0 14px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-panel)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
              height: 26,
              padding: '0 10px',
              borderRadius: 6,
              border: 'none',
              background: isPlaying ? 'var(--accent-soft)' : 'var(--accent)',
              color: isPlaying ? 'var(--accent)' : '#ffffff',
              fontSize: 11.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
            }}
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            title="Replay unsteady startup from t = 0 (R)"
            onClick={onReset}
            style={{
              height: 26,
              padding: '0 8px',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 11.5,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={12} />
            <span>Replay</span>
          </button>

          <span className="mono" style={{ marginLeft: 8, fontSize: 11.5, color: 'var(--text-secondary)' }}>
            t = {(currentTime * 1000).toFixed(1)} ms
          </span>
        </div>

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
                  border: 'none',
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

function zoomBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    borderRadius: 5,
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

const LegendToggle: React.FC<{
  active: boolean;
  color: string;
  label: string;
  dashed?: boolean;
  onClick: () => void;
}> = ({ active, color, label, dashed, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '2px 4px',
      border: 'none',
      background: 'transparent',
      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
      fontSize: 11,
      fontWeight: 500,
      opacity: active ? 1 : 0.45,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }}
  >
    <span
      style={{
        width: 11,
        height: 0,
        borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
      }}
    />
    <span className="mono">{label}</span>
  </button>
);

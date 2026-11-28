import React, { useEffect, useRef, useState } from 'react';
import { RLCInstantState, RLCSystem, ThemeMode } from '../rlc/rlcModel';
import { FocusedComponent } from './ParameterSidebar';

interface CircuitSchematicProps {
  system: RLCSystem;
  instant: RLCInstantState;
  theme: ThemeMode;
  focusedComponent: FocusedComponent;
  onFocusComponent: (c: FocusedComponent) => void;
}

interface HitBox {
  id: Exclude<FocusedComponent, null>;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CircuitSchematic: React.FC<CircuitSchematicProps> = ({
  system,
  instant,
  theme,
  focusedComponent,
  onFocusComponent,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 720, h: 280 });
  const [hovered, setHovered] = useState<FocusedComponent>(null);
  const hitBoxesRef = useRef<HitBox[]>([]);
  const particleOffsetRef = useRef(0);
  const lastDrawTsRef = useRef<number | null>(null);

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          w: Math.max(300, entry.contentRect.width),
          h: Math.max(180, entry.contentRect.height),
        });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();
    const dtFrame = lastDrawTsRef.current === null ? 0.016 : Math.min(0.05, (now - lastDrawTsRef.current) / 1000);
    lastDrawTsRef.current = now;

    // Advance charge-carrier dots proportionally to instantaneous current i(t)
    const iNorm = Math.max(-1.6, Math.min(1.6, instant.i / Math.max(0.05, system.Imax)));
    particleOffsetRef.current = (particleOffsetRef.current + iNorm * dtFrame * 140 + 1000) % 1000;

    const isDark = theme === 'dark';
    const textMain = isDark ? '#eceff4' : '#14171f';
    const textMuted = isDark ? '#788296' : '#6b7280';
    const wireColor = isDark ? '#5a6477' : '#94a3b8';
    const dotGrid = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.2)';
    const accent = isDark ? '#38bdf8' : '#0284c7';
    const qColor = isDark ? '#34d399' : '#059669';
    const posColor = '#34d399';
    const negColor = '#f43f5e';

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.w, size.h);

    // Subtle schematic dot grid
    const spacing = 24;
    ctx.fillStyle = dotGrid;
    for (let x = spacing; x < size.w; x += spacing) {
      for (let y = spacing; y < size.h; y += spacing) {
        ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
      }
    }

    // Loop geometry centered cleanly
    const padX = Math.max(70, Math.min(140, size.w * 0.16));
    const left = padX;
    const right = size.w - padX;
    const top = Math.max(58, size.h * 0.24);
    const bottom = Math.min(size.h - 46, size.h * 0.78);
    const midY = (top + bottom) / 2;
    const spanX = right - left;
    const rX = left + spanX * 0.34;
    const lX = left + spanX * 0.68;

    hitBoxesRef.current = [
      { id: 'E', x: left - 44, y: midY - 36, w: 88, h: 72 },
      { id: 'R', x: rX - 50, y: top - 34, w: 100, h: 68 },
      { id: 'L', x: lX - 50, y: top - 34, w: 100, h: 68 },
      { id: 'C', x: right - 44, y: midY - 36, w: 88, h: 72 },
    ];

    // Draw focus / hover highlight rectangles behind components
    for (const box of hitBoxesRef.current) {
      const isActive = focusedComponent === box.id || hovered === box.id;
      if (!isActive) continue;
      ctx.save();
      ctx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(2, 132, 199, 0.07)';
      ctx.strokeStyle = focusedComponent === box.id ? accent : 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.w, box.h, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Series closed loop wires (with gaps for components)
    ctx.strokeStyle = wireColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawWireSeg = (pts: [number, number][]) => {
      ctx.beginPath();
      pts.forEach(([px, py], idx) => {
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    };

    // Left vertical top -> R
    drawWireSeg([
      [left, midY - 22],
      [left, top],
      [rX - 34, top],
    ]);
    // R -> L
    drawWireSeg([
      [rX + 34, top],
      [lX - 34, top],
    ]);
    // L -> C top
    drawWireSeg([
      [lX + 34, top],
      [right, top],
      [right, midY - 12],
    ]);
    // C bottom -> bottom return -> E bottom
    drawWireSeg([
      [right, midY + 12],
      [right, bottom],
      [left, bottom],
      [left, midY + 22],
    ]);

    // Ground symbol centered on bottom rail
    const gndX = (left + right) / 2;
    ctx.strokeStyle = wireColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(gndX, bottom);
    ctx.lineTo(gndX, bottom + 9);
    ctx.moveTo(gndX - 11, bottom + 9);
    ctx.lineTo(gndX + 11, bottom + 9);
    ctx.moveTo(gndX - 7, bottom + 13);
    ctx.lineTo(gndX + 7, bottom + 13);
    ctx.moveTo(gndX - 3, bottom + 17);
    ctx.lineTo(gndX + 3, bottom + 17);
    ctx.stroke();

    // Animated current carrier dots around the perimeter loop
    const perim = 2 * (right - left) + 2 * (bottom - top);
    const numDots = 18;
    const stepLen = perim / numDots;
    const dotAlpha = Math.min(0.95, 0.25 + Math.abs(iNorm) * 0.7);
    ctx.fillStyle = isDark ? `rgba(167, 139, 250, ${dotAlpha})` : `rgba(124, 58, 237, ${dotAlpha})`;

    for (let k = 0; k < numDots; k++) {
      const dist = ((k * stepLen + (particleOffsetRef.current % stepLen)) % perim + perim) % perim;
      let dx = left;
      let dy = top;
      const wTop = right - left;
      const hSide = bottom - top;
      if (dist < wTop) {
        dx = left + dist;
        dy = top;
      } else if (dist < wTop + hSide) {
        dx = right;
        dy = top + (dist - wTop);
      } else if (dist < 2 * wTop + hSide) {
        dx = right - (dist - wTop - hSide);
        dy = bottom;
      } else {
        dx = left;
        dy = bottom - (dist - 2 * wTop - hSide);
      }
      // Skip dots overlapping component bodies
      const nearE = Math.abs(dx - left) < 4 && Math.abs(dy - midY) < 26;
      const nearR = Math.abs(dy - top) < 4 && Math.abs(dx - rX) < 38;
      const nearL = Math.abs(dy - top) < 4 && Math.abs(dx - lX) < 38;
      const nearC = Math.abs(dx - right) < 4 && Math.abs(dy - midY) < 18;
      if (!nearE && !nearR && !nearL && !nearC) {
        ctx.beginPath();
        ctx.arc(dx, dy, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 1. AC Source E(t) on left branch
    ctx.save();
    ctx.translate(left, midY);
    ctx.fillStyle = isDark ? '#15181f' : '#ffffff';
    ctx.strokeStyle = instant.E >= 0 ? posColor : negColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner sine wave
    ctx.strokeStyle = textMain;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let sx = -11; sx <= 11; sx++) {
      const sy = -Math.sin((sx / 11) * Math.PI) * 6;
      if (sx === -11) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    ctx.fillStyle = textMain;
    ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('E(t)', -29, -8);
    ctx.fillStyle = textMuted;
    ctx.font = '500 10.5px "JetBrains Mono", monospace';
    ctx.fillText(`${instant.E >= 0 ? '+' : ''}${instant.E.toFixed(1)} V`, -29, 8);
    ctx.restore();

    // 2. Resistor R (zigzag) on top-left
    ctx.save();
    ctx.translate(rX, top);
    ctx.strokeStyle = textMain;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-34, 0);
    ctx.lineTo(-24, 0);
    const zigs = 6;
    for (let i = 0; i < zigs; i++) {
      const x1 = -24 + (i + 0.5) * (48 / zigs);
      const y1 = i % 2 === 0 ? -9 : 9;
      ctx.lineTo(x1, y1);
    }
    ctx.lineTo(24, 0);
    ctx.lineTo(34, 0);
    ctx.stroke();

    ctx.fillStyle = textMain;
    ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`R = ${system.params.R.toFixed(0)} Ω`, 0, -14);
    ctx.fillStyle = textMuted;
    ctx.font = '500 10.5px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`v_R ${instant.vR >= 0 ? '+' : ''}${instant.vR.toFixed(1)}V`, 0, 14);
    ctx.restore();

    // 3. Inductor L (coils + magnetic glow) on top-right
    ctx.save();
    ctx.translate(lX, top);
    const magIntensity = Math.min(1, Math.abs(instant.i) / Math.max(0.05, system.Imax));
    if (magIntensity > 0.04) {
      ctx.fillStyle = `rgba(56, 189, 248, ${0.14 * magIntensity})`;
      ctx.beginPath();
      ctx.roundRect(-28, -14, 56, 20, 8);
      ctx.fill();
    }

    ctx.strokeStyle = textMain;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-34, 0);
    ctx.lineTo(-24, 0);
    const coils = 4;
    const coilW = 48 / coils;
    for (let i = 0; i < coils; i++) {
      const cx = -24 + (i + 0.5) * coilW;
      ctx.arc(cx, 0, coilW / 2, Math.PI, 0, false);
    }
    ctx.lineTo(34, 0);
    ctx.stroke();

    ctx.fillStyle = textMain;
    ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`L = ${system.params.L.toFixed(2)} H`, 0, -14);
    ctx.fillStyle = textMuted;
    ctx.font = '500 10.5px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`v_L ${instant.vL >= 0 ? '+' : ''}${instant.vL.toFixed(1)}V`, 0, 14);
    ctx.restore();

    // 4. Capacitor C on right branch with live charge fill & plate polarity
    ctx.save();
    ctx.translate(right, midY);
    const qMaxScale = Math.max(system.Qmax, Math.abs(system.params.q0), 1e-6);
    const qFrac = Math.max(-1, Math.min(1, instant.q / qMaxScale));
    const plateColor = qFrac >= 0 ? posColor : negColor;

    // Dielectric charge fill between plates
    const fillMag = Math.abs(qFrac);
    if (fillMag > 0.01) {
      ctx.fillStyle =
        qFrac >= 0
          ? `rgba(52, 211, 153, ${0.18 + fillMag * 0.35})`
          : `rgba(244, 63, 94, ${0.18 + fillMag * 0.35})`;
      const barW = 34 * fillMag;
      ctx.fillRect(-barW / 2, -10, barW, 20);
    }

    // Plates
    ctx.strokeStyle = Math.abs(qFrac) > 0.05 ? plateColor : textMain;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, -11);
    ctx.lineTo(20, -11);
    ctx.moveTo(-20, 11);
    ctx.lineTo(20, 11);
    ctx.stroke();

    // Polarity signs
    if (Math.abs(qFrac) > 0.03) {
      ctx.fillStyle = plateColor;
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(qFrac >= 0 ? '+' : '−', -26, -11);
      ctx.fillText(qFrac >= 0 ? '−' : '+', -26, 11);
    }

    ctx.fillStyle = textMain;
    ctx.font = '600 11.5px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`C = ${(system.params.C * 1000).toFixed(1)} mF`, 28, -9);
    ctx.fillStyle = qColor;
    ctx.font = '600 10.5px "JetBrains Mono", monospace';
    ctx.fillText(`q = ${(instant.q * 1000).toFixed(2)} mC`, 28, 7);
    ctx.restore();

    ctx.restore();
  }, [size, system, instant, theme, focusedComponent, hovered]);

  const findHit = (clientX: number, clientY: number): FocusedComponent => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (const b of hitBoxesRef.current) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return b.id;
      }
    }
    return null;
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        flex: '0 0 43%',
        minHeight: 205,
        background: 'var(--bg-canvas)',
        borderBottom: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: hovered ? 'pointer' : 'default',
        }}
        onMouseMove={(e) => setHovered(findHit(e.clientX, e.clientY))}
        onMouseLeave={() => setHovered(null)}
        onClick={(e) => {
          const hit = findHit(e.clientX, e.clientY);
          onFocusComponent(hit === focusedComponent ? null : hit);
        }}
      />

      {/* Minimal floating telemetry strip */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '5px 11px',
          borderRadius: 7,
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          fontSize: 11.5,
          pointerEvents: 'none',
        }}
      >
        <TelemetryItem label="t" value={`${(instant.t * 1000).toFixed(1)} ms`} />
        <TelemetryItem label="q(t)" value={`${(instant.q * 1000).toFixed(3)} mC`} color="var(--trace-q)" />
        <TelemetryItem label="qₚ(t)" value={`${(instant.qp * 1000).toFixed(3)} mC`} color="var(--trace-qp)" />
        <TelemetryItem label="qₕ(t)" value={`${(instant.qh * 1000).toFixed(3)} mC`} color="var(--trace-qh)" />
        <TelemetryItem label="i(t)" value={`${(instant.i * 1000).toFixed(1)} mA`} color="var(--trace-i)" />
      </div>

      {/* Subtle hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 14,
          fontSize: 11,
          color: 'var(--text-muted)',
          pointerEvents: 'none',
        }}
      >
        Click E, R, L, or C to highlight parameter
      </div>
    </div>
  );
};

const TelemetryItem: React.FC<{ label: string; value: string; color?: string }> = ({
  label,
  value,
  color,
}) => (
  <span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{label}</span>
    <span className="mono" style={{ fontWeight: 600, color: color ?? 'var(--text-primary)' }}>
      {value}
    </span>
  </span>
);

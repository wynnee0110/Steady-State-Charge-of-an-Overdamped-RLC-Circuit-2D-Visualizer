import {
  RLCInstantState,
  RLCSystem,
  evaluateRLC,
  sampleWaveforms,
} from './rlcModel';

const SANS = '"IBM Plex Sans", "DejaVu Sans", system-ui, -apple-system, sans-serif';
const MONO = '"JetBrains Mono", "DejaVu Sans Mono", ui-monospace, monospace';

function niceCeil(val: number): number {
  const safe = Math.max(1e-6, val);
  const exp = Math.floor(Math.log10(safe));
  const pow = Math.pow(10, exp);
  const norm = safe / pow;
  for (const s of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (norm <= s + 1e-9) return s * pow;
  }
  return 10 * pow;
}

function fmt(n: number, d = 3): string {
  const s = n.toFixed(d);
  return s === '-0.000' || s === '-0.00' || s === '-0.0' || s === '-0' ? s.slice(1) : s;
}

function drawLegendBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  items: { label: string; color: string; dashed?: boolean }[]
) {
  ctx.save();
  ctx.font = `500 16px ${SANS}`;
  let maxW = 0;
  for (const it of items) {
    maxW = Math.max(maxW, ctx.measureText(it.label).width);
  }
  const boxW = maxW + 64;
  const rowH = 25;
  const boxH = items.length * rowH + 14;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, 5);
  ctx.fill();
  ctx.stroke();

  items.forEach((it, idx) => {
    const ry = y + 18 + idx * rowH;
    ctx.strokeStyle = it.color;
    ctx.lineWidth = 2.8;
    ctx.setLineDash(it.dashed ? [6, 5] : []);
    ctx.beginPath();
    ctx.moveTo(x + 12, ry);
    ctx.lineTo(x + 40, ry);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(it.label, x + 50, ry);
  });
  ctx.restore();
}

function drawChargeAxesFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tPlot: number,
  yMaxQ: number,
  title: string
) {
  ctx.save();

  ctx.fillStyle = '#111827';
  ctx.font = `600 21px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(title, x + w / 2, y - 12);

  // Subtle dashed Matplotlib grid (10 × 4)
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1.1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (let i = 1; i < 10; i++) {
    const gx = x + (i / 10) * w;
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
  }
  for (let j = 1; j < 4; j++) {
    const gy = y + (j / 4) * h;
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Zero reference line
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();

  // 4-spine Matplotlib box
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x, y, w, h);

  // X ticks
  ctx.fillStyle = '#374151';
  ctx.font = `500 15.5px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= 10; i += 2) {
    const gx = x + (i / 10) * w;
    const tVal = (i / 10) * tPlot;
    ctx.beginPath();
    ctx.moveTo(gx, y + h);
    ctx.lineTo(gx, y + h + 6);
    ctx.stroke();
    ctx.fillText(tVal.toFixed(2), gx, y + h + 10);
  }
  ctx.font = `600 17px ${SANS}`;
  ctx.fillStyle = '#1f2937';
  ctx.fillText('Time t (s)', x + w / 2, y + h + 36);

  // Y ticks
  ctx.font = `500 15.5px ${MONO}`;
  ctx.fillStyle = '#374151';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  [yMaxQ, yMaxQ / 2, 0, -yMaxQ / 2, -yMaxQ].forEach((v, idx) => {
    const gy = y + (idx / 4) * h;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x - 6, gy);
    ctx.stroke();
    const label = Math.abs(v) < 1e-9 ? '0' : Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1);
    ctx.fillText(label, x - 10, gy);
  });

  // Rotated Y-axis label
  ctx.save();
  ctx.translate(x - 66, y + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#1f2937';
  ctx.font = `600 17px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Capacitor Charge q (mC)', 0, 0);
  ctx.restore();

  ctx.restore();
}

function drawSchematicPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  system: RLCSystem,
  instant: RLCInstantState
) {
  ctx.save();

  ctx.fillStyle = '#111827';
  ctx.font = `600 21px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`(b) Series RLC Circuit Snapshot (t = ${(instant.t * 1000).toFixed(1)} ms)`, x + w / 2, y - 12);

  ctx.fillStyle = '#fafafa';
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1.6;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  const left = x + 140;
  const right = x + w - 165;
  const top = y + 106;
  const bottom = y + h - 88;
  const midY = (top + bottom) / 2;
  const spanX = right - left;
  const rX = left + spanX * 0.34;
  const lX = left + spanX * 0.69;

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const wire = (pts: [number, number][]) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.stroke();
  };

  wire([
    [left, midY - 32],
    [left, top],
    [rX - 50, top],
  ]);
  wire([
    [rX + 50, top],
    [lX - 50, top],
  ]);
  wire([
    [lX + 50, top],
    [right, top],
    [right, midY - 17],
  ]);
  wire([
    [right, midY + 17],
    [right, bottom],
    [left, bottom],
    [left, midY + 32],
  ]);

  // Ground
  const gndX = (left + right) / 2;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(gndX, bottom);
  ctx.lineTo(gndX, bottom + 13);
  ctx.moveTo(gndX - 16, bottom + 13);
  ctx.lineTo(gndX + 16, bottom + 13);
  ctx.moveTo(gndX - 10, bottom + 20);
  ctx.lineTo(gndX + 10, bottom + 20);
  ctx.moveTo(gndX - 4, bottom + 27);
  ctx.lineTo(gndX + 4, bottom + 27);
  ctx.stroke();

  // AC Voltage Source E(t)
  ctx.save();
  ctx.translate(left, midY);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = instant.E >= 0 ? '#059669' : '#dc2626';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let sx = -16; sx <= 16; sx++) {
    const sy = -Math.sin((sx / 16) * Math.PI) * 9;
    if (sx === -16) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.font = `600 17px ${SANS}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('E(t)', -42, -11);
  ctx.fillStyle = '#4b5563';
  ctx.font = `500 14.5px ${MONO}`;
  ctx.fillText(`${instant.E >= 0 ? '+' : ''}${instant.E.toFixed(2)} V`, -42, 11);
  ctx.restore();

  // Resistor R
  ctx.save();
  ctx.translate(rX, top);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(-50, 0);
  ctx.lineTo(-35, 0);
  for (let i = 0; i < 6; i++) {
    const zx = -35 + (i + 0.5) * (70 / 6);
    const zy = i % 2 === 0 ? -13 : 13;
    ctx.lineTo(zx, zy);
  }
  ctx.lineTo(35, 0);
  ctx.lineTo(50, 0);
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.font = `600 17px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`R = ${system.params.R.toFixed(1)} Ω`, 0, -20);
  ctx.fillStyle = '#4b5563';
  ctx.font = `500 14px ${MONO}`;
  ctx.textBaseline = 'top';
  ctx.fillText(`v_R = ${instant.vR >= 0 ? '+' : ''}${instant.vR.toFixed(2)} V`, 0, 20);
  ctx.restore();

  // Inductor L
  ctx.save();
  ctx.translate(lX, top);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(-50, 0);
  ctx.lineTo(-36, 0);
  const coilW = 72 / 4;
  for (let i = 0; i < 4; i++) {
    ctx.arc(-36 + (i + 0.5) * coilW, 0, coilW / 2, Math.PI, 0, false);
  }
  ctx.lineTo(50, 0);
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.font = `600 17px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`L = ${system.params.L.toFixed(2)} H`, 0, -20);
  ctx.fillStyle = '#4b5563';
  ctx.font = `500 14px ${MONO}`;
  ctx.textBaseline = 'top';
  ctx.fillText(`v_L = ${instant.vL >= 0 ? '+' : ''}${instant.vL.toFixed(2)} V`, 0, 20);
  ctx.restore();

  // Capacitor C
  ctx.save();
  ctx.translate(right, midY);
  const qScale = Math.max(system.Qmax, Math.abs(system.params.q0), 1e-6);
  const qFrac = Math.max(-1, Math.min(1, instant.q / qScale));
  const capColor = qFrac >= 0 ? '#059669' : '#dc2626';

  if (Math.abs(qFrac) > 0.01) {
    ctx.fillStyle = qFrac >= 0 ? 'rgba(5, 150, 105, 0.22)' : 'rgba(220, 38, 38, 0.22)';
    const bw = 54 * Math.abs(qFrac);
    ctx.fillRect(-bw / 2, -15, bw, 30);
  }

  ctx.strokeStyle = Math.abs(qFrac) > 0.04 ? capColor : '#111827';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-30, -16);
  ctx.lineTo(30, -16);
  ctx.moveTo(-30, 16);
  ctx.lineTo(30, 16);
  ctx.stroke();

  if (Math.abs(qFrac) > 0.03) {
    ctx.fillStyle = capColor;
    ctx.font = `700 17px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(qFrac >= 0 ? '+' : '−', -40, -16);
    ctx.fillText(qFrac >= 0 ? '−' : '+', -40, 16);
  }

  ctx.fillStyle = '#111827';
  ctx.font = `600 17px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`C = ${(system.params.C * 1000).toFixed(1)} mF`, 40, -22);
  ctx.fillStyle = '#059669';
  ctx.font = `600 15.5px ${MONO}`;
  ctx.fillText(`q = ${(instant.q * 1000).toFixed(3)} mC`, 40, 2);
  ctx.fillStyle = '#4b5563';
  ctx.font = `500 14px ${MONO}`;
  ctx.fillText(`v_C = ${instant.vC >= 0 ? '+' : ''}${instant.vC.toFixed(2)} V`, 40, 24);
  ctx.restore();

  // Instantaneous charge breakdown footer
  ctx.fillStyle = '#1f2937';
  ctx.font = `500 14.5px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(
    `q(t) = ${(instant.q * 1000).toFixed(3)} mC   |   q_p(t) = ${(instant.qp * 1000).toFixed(3)} mC   |   q_h(t) = ${(instant.qh * 1000).toFixed(3)} mC`,
    x + 22,
    y + h - 14
  );

  ctx.restore();
}

function drawValuesPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  system: RLCSystem,
  instant: RLCInstantState
) {
  ctx.save();

  ctx.fillStyle = '#111827';
  ctx.font = `600 21px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('(c) Circuit Parameters & Steady-State Values', x + w / 2, y - 12);

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1.6;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  const { R, L, C, E0, gamma, q0 } = system.params;
  const aMc = system.A * 1000;
  const bMc = system.B * 1000;

  // Boxed closed-form steady-state equation banner
  ctx.fillStyle = '#f0f9ff';
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 1.5;
  ctx.fillRect(x + 24, y + 20, w - 48, 82);
  ctx.strokeRect(x + 24, y + 20, w - 48, 82);

  ctx.fillStyle = '#0369a1';
  ctx.font = `600 15px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Steady-State Charge (Closed-Form Particular Solution)', x + 40, y + 31);

  ctx.fillStyle = '#0f172a';
  ctx.font = `600 20px ${MONO}`;
  const bSign = bMc >= 0 ? '+' : '−';
  ctx.fillText(
    `q_p(t) = ${fmt(aMc, 3)} sin(${fmt(gamma, 0)}t) ${bSign} ${fmt(Math.abs(bMc), 3)} cos(${fmt(gamma, 0)}t)  [mC]`,
    x + 40,
    y + 62
  );

  // Two-column parameter & derived constant list with generous vertical spacing
  const col1X = x + 28;
  const col2X = x + w / 2 + 12;
  let rowY = y + 132;
  const lineH = 38;

  const leftItems: [string, string][] = [
    ['Resistance R', `${fmt(R, 1)} Ω  (R_crit = ${fmt(system.rCrit, 2)} Ω)`],
    ['Inductance L', `${fmt(L, 2)} H`],
    ['Capacitance C', `${fmt(C * 1000, 2)} mF  (${C} F)`],
    ['Source E(t)', `${fmt(E0, 1)} sin(${fmt(gamma, 0)}t) V`],
    ['Initial Charge', `q₀ = ${fmt(q0 * 1000, 2)} mC`],
    ['Discriminant Δ', `${system.discriminant >= 0 ? '+' : ''}${fmt(system.discriminant, 2)} Ω² (${system.regime.replace('_', ' ')})`],
  ];

  const rightItems: [string, string][] = [
    [
      'Char. Roots',
      system.regime === 'overdamped'
        ? `m₁ = ${fmt(system.m1, 2)}, m₂ = ${fmt(system.m2, 2)} s⁻¹`
        : system.regime === 'critically_damped'
        ? `m₁ = m₂ = ${fmt(system.m1, 2)} s⁻¹`
        : `−${fmt(system.alpha, 2)} ± j${fmt(system.omegaD, 2)} s⁻¹`,
    ],
    ['Reactance X', `${system.X >= 0 ? '+' : '−'}${fmt(Math.abs(system.X), 3)} Ω (${system.reactanceType})`],
    ['Impedance Z', `${fmt(system.Z, 3)} Ω  (φ = ${fmt(system.phiDeg, 2)}°)`],
    ['Peak Charge Q_max', `${fmt(system.Qmax * 1000, 4)} mC`],
    ['Coeff A, B', `${fmt(aMc, 3)}, ${fmt(bMc, 3)} mC`],
    ['Settling 5τ₁', `${fmt(system.tSettle * 1000, 1)} ms`],
  ];

  for (let idx = 0; idx < leftItems.length; idx++) {
    const [k1, v1] = leftItems[idx];
    const [k2, v2] = rightItems[idx];

    ctx.font = `600 16px ${SANS}`;
    ctx.fillStyle = '#4b5563';
    ctx.textAlign = 'left';
    ctx.fillText(k1 + ':', col1X, rowY);
    ctx.fillText(k2 + ':', col2X, rowY);

    ctx.font = `500 16px ${MONO}`;
    ctx.fillStyle = '#111827';
    ctx.fillText(v1, col1X + 142, rowY);
    ctx.fillText(v2, col2X + 158, rowY);

    rowY += lineH;
  }

  // Divider before Live Snapshot Values
  const divY = rowY + 14;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 24, divY);
  ctx.lineTo(x + w - 24, divY);
  ctx.stroke();

  // Live Snapshot Values at t
  const snapY = divY + 18;
  ctx.fillStyle = '#374151';
  ctx.font = `600 16px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText(`Live Snapshot Values at t = ${instant.t.toFixed(3)} s`, x + 28, snapY);

  const metrics: { label: string; value: string; color: string }[] = [
    {
      label: 'Complete Charge q(t)',
      value: `${(instant.q * 1000).toFixed(4)} mC`,
      color: '#059669',
    },
    {
      label: 'Steady-State q_p(t)',
      value: `${(instant.qp * 1000).toFixed(4)} mC`,
      color: '#0284c7',
    },
    {
      label: 'Transient q_h(t)',
      value: `${(instant.qh * 1000).toFixed(4)} mC`,
      color: '#d97706',
    },
  ];

  const cardGap = 18;
  const cardW = (w - 56 - cardGap * 2) / 3;
  const cardY = snapY + 32;
  const cardH = h - (cardY - y) - 22;

  metrics.forEach((m, idx) => {
    const cx = x + 28 + idx * (cardW + cardGap);
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.2;
    ctx.fillRect(cx, cardY, cardW, cardH);
    ctx.strokeRect(cx, cardY, cardW, cardH);

    ctx.fillStyle = '#475569';
    ctx.font = `600 14px ${SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText(m.label, cx + 16, cardY + 14);

    ctx.fillStyle = m.color;
    ctx.font = `700 18px ${MONO}`;
    ctx.fillText(m.value, cx + 16, cardY + 38);
  });

  ctx.restore();
}

export function renderMatplotlibFigure(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  system: RLCSystem,
  currentTime: number,
  windowSpan: number
): void {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const { R, L, C, E0, gamma, q0, i0 } = system.params;
  const regimeTitle =
    system.regime === 'overdamped'
      ? 'Overdamped'
      : system.regime === 'critically_damped'
      ? 'Critically Damped'
      : 'Underdamped';

  // Suptitle & parameter subtitle
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 28px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${regimeTitle} Series RLC Circuit — Steady-State Charge q_p(t)`, width / 2, 22);

  ctx.fillStyle = '#475569';
  ctx.font = `500 16px ${MONO}`;
  ctx.fillText(
    `R = ${fmt(R, 1)} Ω,  L = ${fmt(L, 2)} H,  C = ${fmt(C * 1000, 1)} mF,  E(t) = ${fmt(E0, 0)} sin(${fmt(gamma, 0)}t) V,  q₀ = ${fmt(q0 * 1000, 1)} mC,  i₀ = ${fmt(i0, 2)} A  |  Δ = ${system.discriminant >= 0 ? '+' : ''}${fmt(system.discriminant, 1)} Ω²`,
    width / 2,
    60
  );

  const tPlot = Math.max(windowSpan, Math.min(1.5, system.tSettle * 1.25));
  const samples = sampleWaveforms(system, tPlot, 800);
  const instant = evaluateRLC(system, currentTime);

  // Top Wide Panel (a): Steady-State Charge Graph
  const topX = 115;
  const topY = 132;
  const topW = 1970;
  const topH = 445;

  let maxQMc = Math.max(1, system.Qmax * 1000);
  for (const s of samples) {
    maxQMc = Math.max(maxQMc, Math.abs(s.q * 1000), Math.abs(s.qp * 1000), Math.abs(s.qh * 1000));
  }
  const yMaxQ = niceCeil(maxQMc * 1.12);

  drawChargeAxesFrame(
    ctx,
    topX,
    topY,
    topW,
    topH,
    tPlot,
    yMaxQ,
    '(a) Steady-State Charge q_p(t) & Transient Convergence q(t) = q_h(t) + q_p(t)'
  );

  const tToX = (t: number) => topX + (t / tPlot) * topW;
  const qToY = (qMc: number) => topY + topH / 2 - (qMc / yMaxQ) * (topH / 2);

  ctx.save();
  ctx.beginPath();
  ctx.rect(topX, topY, topW, topH);
  ctx.clip();

  // ±Q_max lines
  const qMaxMc = system.Qmax * 1000;
  ctx.strokeStyle = 'rgba(2, 132, 199, 0.32)';
  ctx.setLineDash([4, 5]);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(topX, qToY(qMaxMc));
  ctx.lineTo(topX + topW, qToY(qMaxMc));
  ctx.moveTo(topX, qToY(-qMaxMc));
  ctx.lineTo(topX + topW, qToY(-qMaxMc));
  ctx.stroke();

  // 5*tau_1 settling marker
  if (system.tSettle > 0 && system.tSettle <= tPlot) {
    const sx = tToX(system.tSettle);
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.6)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(sx, topY);
    ctx.lineTo(sx, topY + topH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#b45309';
    ctx.font = `600 15px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`5τ₁ = ${(system.tSettle * 1000).toFixed(1)} ms`, Math.min(topX + topW - 150, sx + 8), topY + 10);
  }
  ctx.setLineDash([]);

  const plotTrace = (getY: (s: RLCInstantState) => number, color: string, lw: number, dash: number[] = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash(dash);
    ctx.beginPath();
    samples.forEach((s, i) => {
      const px = tToX(s.t);
      const py = getY(s);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };

  plotTrace((s) => qToY(s.qh * 1000), '#d97706', 2.2, [8, 6]);
  plotTrace((s) => qToY(s.q * 1000), '#059669', 2.4);
  plotTrace((s) => qToY(s.qp * 1000), '#0284c7', 3.0);

  ctx.restore();

  drawLegendBox(ctx, topX + topW - 265, topY + 14, [
    { label: 'Steady-State q_p(t)', color: '#0284c7' },
    { label: 'Complete q(t)', color: '#059669' },
    { label: 'Transient q_h(t)', color: '#d97706', dashed: true },
  ]);

  // Bottom Row: (b) Circuit Schematic | (c) Circuit Parameters & Steady-State Values
  const botY = 695;
  const botH = 505;
  drawSchematicPanel(ctx, 115, botY, 950, botH, system, instant);
  drawValuesPanel(ctx, 1115, botY, 970, botH, system, instant);

  ctx.restore();
}

export function downloadMatplotlibFigure(
  system: RLCSystem,
  currentTime: number,
  windowSpan: number
): void {
  const width = 2200;
  const height = 1260;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  renderMatplotlibFigure(ctx, width, height, system, currentTime, windowSpan);

  const { R, L, C, gamma } = system.params;
  const filename = `rlc_charge_R${fmt(R, 0)}_L${fmt(L, 2)}_C${fmt(C * 1000, 1)}mF_g${fmt(gamma, 0)}.png`;

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

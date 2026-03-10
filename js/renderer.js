/**
 * renderer.js — Canvas rendering for beam bending simulator
 */

const Renderer = (() => {
  // Color palette
  const COLORS = {
    background:    '#1a1d2e',
    gridLine:      'rgba(255,255,255,0.05)',
    beamUnloaded:  'rgba(255,255,255,0.18)',
    beamLoaded:    null,  // gradient, set per draw
    support:       '#94a3b8',
    wall:          '#475569',
    wallHatch:     '#64748b',
    loadArrow:     '#f97316',
    loadArrowSafe: '#38bdf8',
    text:          '#e2e8f0',
    textMuted:     '#94a3b8',
    yieldWarn:     '#ef4444',
    stressLow:     '#38bdf8',
    stressMid:     '#facc15',
    stressHigh:    '#ef4444',
    ground:        '#334155',
  };

  /**
   * Interpolate between two hex/rgb colours by t ∈ [0,1].
   * Simple 3-stop gradient: low→mid→high
   */
  function stressColor(t) {
    // Clamp
    t = Math.max(0, Math.min(1, t));
    if (t < 0.5) {
      const u = t * 2;
      return lerpColor([56, 189, 248], [250, 204, 21], u);
    } else {
      const u = (t - 0.5) * 2;
      return lerpColor([250, 204, 21], [239, 68, 68], u);
    }
  }

  function lerpColor(a, b, t) {
    const r    = Math.round(a[0] + (b[0] - a[0]) * t);
    const g    = Math.round(a[1] + (b[1] - a[1]) * t);
    const blue = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r},${g},${blue})`;
  }

  /**
   * Draw rounded rectangle helper.
   */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /**
   * Draw the wall / fixed support for cantilever (left side).
   */
  function drawWall(ctx, x, y0, height) {
    const wallW = 18;
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(x - wallW, y0 - height / 2, wallW, height);

    // Hatch lines
    ctx.strokeStyle = COLORS.wallHatch;
    ctx.lineWidth = 1.5;
    const spacing = 10;
    for (let yy = y0 - height / 2; yy <= y0 + height / 2; yy += spacing) {
      ctx.beginPath();
      ctx.moveTo(x - wallW, yy);
      ctx.lineTo(x - wallW - 10, yy + 10);
      ctx.stroke();
    }
  }

  /**
   * Draw a triangle support (pin/roller) at position (cx, baseY).
   */
  function drawTriangleSupport(ctx, cx, baseY, size) {
    const h = size * 0.866;
    ctx.beginPath();
    ctx.moveTo(cx, baseY - h);
    ctx.lineTo(cx - size / 2, baseY);
    ctx.lineTo(cx + size / 2, baseY);
    ctx.closePath();
    ctx.fillStyle = COLORS.support;
    ctx.fill();
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ground line
    ctx.strokeStyle = COLORS.ground;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - size / 2 - 5, baseY + 2);
    ctx.lineTo(cx + size / 2 + 5, baseY + 2);
    ctx.stroke();
    // Ground hatch
    ctx.strokeStyle = COLORS.support;
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 7, baseY + 2);
      ctx.lineTo(cx + i * 7 - 5, baseY + 9);
      ctx.stroke();
    }
  }

  /**
   * Draw a downward-pointing load arrow at position (cx, tipY).
   */
  function drawLoadArrow(ctx, cx, tipY, label, yielded) {
    const arrowLen = 44;
    const arrowHeadLen = 14;
    const arrowHeadW = 8;
    const color = yielded ? COLORS.yieldWarn : COLORS.loadArrow;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(cx, tipY - arrowLen);
    ctx.lineTo(cx, tipY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, tipY);
    ctx.lineTo(cx - arrowHeadW, tipY - arrowHeadLen);
    ctx.lineTo(cx + arrowHeadW, tipY - arrowHeadLen);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, tipY - arrowLen - 8);
  }

  /**
   * Render a complete beam scene to the given canvas.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {object} result  — output of BeamCalc.computeBeam()
   * @param {object} params  — same params passed to computeBeam()
   * @param {number} loadFraction — 0–1 animation fraction
   */
  function render(canvas, result, params, loadFraction = 1) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = COLORS.background;
    roundRect(ctx, 0, 0, W, H, 12);
    ctx.fill();

    const { beamType, L, P } = params;
    const { points, stressPoints, maxDeflection, maxStress, yieldStrength, hasYielded } = result;

    // Layout: beam spans 80% of canvas width, centred vertically
    const marginX = beamType === 'cantilever' ? 60 : 50;
    const marginTop = 70;
    const marginBottom = 80;
    const beamDrawW = W - marginX * 2;
    const beamBaseY = H / 2 - 20;
    const availH = H - marginTop - marginBottom;

    // Scale deflection to fit within the canvas nicely
    // Use up to 35% of available vertical space for max deflection
    const maxPixelDef = availH * 0.38;
    const defScale = maxDeflection > 0 ? maxPixelDef / maxDeflection : 1;

    // x-mapping: beam position → canvas x
    const toCanvasX = (x) => marginX + (x / L) * beamDrawW;
    // y-mapping: deflection (positive downward) → canvas y
    const toCanvasY = (deflection) => beamBaseY + deflection * defScale * loadFraction;

    // Draw faint reference (undeflected) line
    ctx.strokeStyle = COLORS.beamUnloaded;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(toCanvasX(0), beamBaseY);
    ctx.lineTo(toCanvasX(L), beamBaseY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw supports / wall
    if (beamType === 'cantilever') {
      drawWall(ctx, toCanvasX(0), beamBaseY, 52);
    } else {
      drawTriangleSupport(ctx, toCanvasX(0), beamBaseY + 6, 24);
      drawTriangleSupport(ctx, toCanvasX(L), beamBaseY + 6, 24);
    }

    // Draw deflected beam as stress-coloured polyline segments
    const beamThickness = Math.max(5, Math.min(12, H * 0.018));
    ctx.lineWidth = beamThickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw in segments so each can be coloured
    for (let i = 0; i < points.length - 1; i++) {
      const x1 = toCanvasX(points[i].x);
      const y1 = toCanvasY(points[i].y);
      const x2 = toCanvasX(points[i + 1].x);
      const y2 = toCanvasY(points[i + 1].y);

      const t = maxStress > 0 ? stressPoints[i] / maxStress : 0;
      ctx.strokeStyle = stressColor(t * loadFraction);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Draw load arrow
    if (P > 0) {
      if (beamType === 'cantilever') {
        const tipX = toCanvasX(L);
        const tipY = toCanvasY(points[points.length - 1].y);
        drawLoadArrow(ctx, tipX, tipY, `${(P * loadFraction).toFixed(0)} N`, hasYielded && loadFraction >= 1);
      } else {
        const midIdx = Math.floor(points.length / 2);
        const tipX = toCanvasX(points[midIdx].x);
        const tipY = toCanvasY(points[midIdx].y);
        drawLoadArrow(ctx, tipX, tipY, `${(P * loadFraction).toFixed(0)} N`, hasYielded && loadFraction >= 1);
      }
    }

    // Dimension labels
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`L = ${L.toFixed(2)} m`, W / 2, beamBaseY - 22);

    // Max deflection callout
    if (maxDeflection > 0 && P > 0) {
      let defX, defY;
      if (beamType === 'cantilever') {
        defX = toCanvasX(L) + 28;
        defY = toCanvasY(maxDeflection * loadFraction);
      } else {
        defX = toCanvasX(L / 2) + 30;
        defY = toCanvasY(maxDeflection * loadFraction);
      }
      ctx.fillStyle = COLORS.stressMid;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`δ = ${(maxDeflection * loadFraction * 1000).toFixed(2)} mm`, defX, defY + 4);
    }

    // Stress colour legend bar (bottom right)
    drawLegend(ctx, W, H, maxStress, yieldStrength, hasYielded);
  }

  /**
   * Draw a small stress colour legend bar in the bottom right.
   */
  function drawLegend(ctx, W, H, maxStress, yieldStrength, hasYielded) {
    const bx = W - 130;
    const by = H - 46;
    const bw = 110;
    const bh = 10;

    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText('Stress', bx, by - 4);

    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0,   '#38bdf8');
    grad.addColorStop(0.5, '#facc15');
    grad.addColorStop(1,   '#ef4444');
    ctx.fillStyle = grad;
    roundRect(ctx, bx, by, bw, bh, 4);
    ctx.fill();

    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'left';
    ctx.fillText('Low', bx, by + bh + 12);
    ctx.textAlign = 'right';
    ctx.fillText('High', bx + bw, by + bh + 12);

    if (hasYielded) {
      ctx.fillStyle = COLORS.yieldWarn;
      ctx.textAlign = 'center';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText('⚠ YIELDED', bx + bw / 2, by + bh + 26);
    }
  }

  /**
   * Render the stress diagram (bending moment / stress distribution) below.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {object} result
   * @param {object} params
   * @param {number} loadFraction
   */
  function renderStressDiagram(canvas, result, params, loadFraction = 1) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f1117';
    roundRect(ctx, 0, 0, W, H, 10);
    ctx.fill();

    const { beamType, L, P } = params;
    const { stressPoints, maxStress, yieldStrength, hasYielded } = result;
    const { points } = result;

    const marginX = 50;
    const marginTop = 28;
    const marginBottom = 28;
    const innerH = H - marginTop - marginBottom;
    const beamDrawW = W - marginX * 2;

    // Baseline
    const baseY = marginTop + innerH;

    // Scale: max stress → innerH
    const sScale = maxStress > 0 ? innerH / maxStress : 1;

    const toSX = (i) => marginX + (i / (points.length - 1)) * beamDrawW;
    const toSY = (s) => baseY - s * sScale * loadFraction;

    // Yield strength line
    if (yieldStrength < maxStress * 1.5) {
      const yLine = baseY - yieldStrength * sScale * loadFraction;
      if (yLine >= marginTop) {
        ctx.strokeStyle = COLORS.yieldWarn;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(marginX, yLine);
        ctx.lineTo(W - marginX, yLine);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COLORS.yieldWarn;
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Yield', marginX + 2, yLine - 3);
      }
    }

    // Fill area under stress curve
    ctx.beginPath();
    ctx.moveTo(toSX(0), baseY);
    for (let i = 0; i < stressPoints.length; i++) {
      ctx.lineTo(toSX(i), toSY(stressPoints[i]));
    }
    ctx.lineTo(toSX(stressPoints.length - 1), baseY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, marginTop, 0, baseY);
    grad.addColorStop(0, hasYielded ? 'rgba(239,68,68,0.6)' : 'rgba(56,189,248,0.45)');
    grad.addColorStop(1, 'rgba(56,189,248,0.05)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Stress curve line
    ctx.strokeStyle = hasYielded ? COLORS.stressHigh : COLORS.stressLow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < stressPoints.length; i++) {
      if (i === 0) ctx.moveTo(toSX(i), toSY(stressPoints[i]));
      else ctx.lineTo(toSX(i), toSY(stressPoints[i]));
    }
    ctx.stroke();

    // Baseline
    ctx.strokeStyle = COLORS.support;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginX, baseY);
    ctx.lineTo(W - marginX, baseY);
    ctx.stroke();

    // Labels
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Bending Stress Distribution', W / 2, marginTop - 6);

    ctx.textAlign = 'left';
    ctx.fillText('0', marginX - 4, baseY + 10);
    ctx.textAlign = 'right';
    ctx.fillText(formatStress(maxStress), W - marginX + 2, marginTop + 12);
  }

  function formatStress(s) {
    if (s >= 1e9) return (s / 1e9).toFixed(2) + ' GPa';
    if (s >= 1e6) return (s / 1e6).toFixed(1) + ' MPa';
    if (s >= 1e3) return (s / 1e3).toFixed(1) + ' kPa';
    return s.toFixed(0) + ' Pa';
  }

  return { render, renderStressDiagram, COLORS };
})();

window.Renderer = Renderer;

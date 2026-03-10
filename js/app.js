/**
 * app.js — Main application controller
 * Wires up all UI controls and triggers beam computations + rendering.
 */

(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────
  let animationId = null;
  let animationStart = null;
  const ANIM_DURATION = 800; // ms for load animation

  // ─── DOM references ──────────────────────────────────────────────────────────
  const beamCanvas    = document.getElementById('beamCanvas');
  const stressCanvas  = document.getElementById('stressCanvas');
  const beamTypeRadios = document.querySelectorAll('input[name="beamType"]');
  const materialSel   = document.getElementById('material');
  const sectionSel    = document.getElementById('sectionType');
  const sectionDimsEl = document.getElementById('sectionDims');

  // Sliders
  const sliderL     = document.getElementById('sliderL');
  const sliderP     = document.getElementById('sliderP');
  const sliderW     = document.getElementById('sliderWidth');
  const sliderH     = document.getElementById('sliderHeight');
  const sliderD     = document.getElementById('sliderDiameter');
  const sliderFW    = document.getElementById('sliderFlangeWidth');
  const sliderFT    = document.getElementById('sliderFlangeThickness');
  const sliderWH    = document.getElementById('sliderWebHeight');
  const sliderWT    = document.getElementById('sliderWebThickness');

  // Number inputs (linked to sliders)
  const numL   = document.getElementById('numL');
  const numP   = document.getElementById('numP');

  // Output labels
  const outDeflection = document.getElementById('outDeflection');
  const outStress     = document.getElementById('outStress');
  const outYield      = document.getElementById('outYield');
  const yieldBadge    = document.getElementById('yieldBadge');

  // Section sub-panels
  const panelRect  = document.getElementById('panelRect');
  const panelCirc  = document.getElementById('panelCirc');
  const panelIBeam = document.getElementById('panelIBeam');

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function getBeamType() {
    for (const r of beamTypeRadios) if (r.checked) return r.value;
    return 'cantilever';
  }

  function getSectionDims() {
    const type = sectionSel.value;
    switch (type) {
      case 'rectangular':
        return { width: parseFloat(sliderW.value) / 1000, height: parseFloat(sliderH.value) / 1000 };
      case 'circular':
        return { diameter: parseFloat(sliderD.value) / 1000 };
      case 'ibeam':
        return {
          flangeWidth:     parseFloat(sliderFW.value) / 1000,
          flangeThickness: parseFloat(sliderFT.value) / 1000,
          webHeight:       parseFloat(sliderWH.value) / 1000,
          webThickness:    parseFloat(sliderWT.value) / 1000,
        };
    }
  }

  function getParams() {
    return {
      beamType:    getBeamType(),
      L:           parseFloat(sliderL.value),
      P:           parseFloat(sliderP.value),
      material:    materialSel.value,
      sectionType: sectionSel.value,
      sectionDims: getSectionDims(),
    };
  }

  function formatStress(s) {
    if (s >= 1e9) return (s / 1e9).toFixed(3) + ' GPa';
    if (s >= 1e6) return (s / 1e6).toFixed(2) + ' MPa';
    if (s >= 1e3) return (s / 1e3).toFixed(2) + ' kPa';
    return s.toFixed(1) + ' Pa';
  }

  function formatDeflection(d) {
    if (d >= 1)     return d.toFixed(3) + ' m';
    if (d >= 0.001) return (d * 1000).toFixed(2) + ' mm';
    if (d >= 1e-6)  return (d * 1e6).toFixed(1) + ' µm';
    return d.toExponential(2) + ' m';
  }

  function resizeCanvases() {
    const container = beamCanvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const bh = Math.max(260, Math.min(400, window.innerHeight * 0.38));
    const sh = 110;

    beamCanvas.width   = w * dpr;
    beamCanvas.height  = bh * dpr;
    beamCanvas.style.width  = w + 'px';
    beamCanvas.style.height = bh + 'px';
    beamCanvas.getContext('2d').scale(dpr, dpr);

    stressCanvas.width  = w * dpr;
    stressCanvas.height = sh * dpr;
    stressCanvas.style.width  = w + 'px';
    stressCanvas.style.height = sh + 'px';
    stressCanvas.getContext('2d').scale(dpr, dpr);
  }

  // ─── Section dim panels ───────────────────────────────────────────────────────
  function updateSectionPanel() {
    const type = sectionSel.value;
    panelRect.classList.toggle('hidden', type !== 'rectangular');
    panelCirc.classList.toggle('hidden', type !== 'circular');
    panelIBeam.classList.toggle('hidden', type !== 'ibeam');
  }

  // ─── Sync slider ↔ number field ───────────────────────────────────────────────
  function syncSliderNum(slider, numField) {
    slider.addEventListener('input', () => {
      numField.value = slider.value;
      triggerUpdate();
    });
    numField.addEventListener('input', () => {
      const v = parseFloat(numField.value);
      if (!isNaN(v)) {
        slider.value = Math.min(parseFloat(slider.max), Math.max(parseFloat(slider.min), v));
        triggerUpdate();
      }
    });
  }

  // ─── Main draw ────────────────────────────────────────────────────────────────
  function draw(params, result, fraction) {
    const ctx1 = beamCanvas.getContext('2d');
    const ctx2 = stressCanvas.getContext('2d');
    // Reset transforms before render (resizeCanvases may have applied a DPR scale)
    const dpr = window.devicePixelRatio || 1;
    ctx1.save();
    ctx2.save();

    Renderer.render(beamCanvas, result, params, fraction);
    Renderer.renderStressDiagram(stressCanvas, result, params, fraction);

    ctx1.restore();
    ctx2.restore();
  }

  let pendingParams = null;
  let pendingResult = null;

  function triggerUpdate(animate = false) {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    const params = getParams();
    let result;
    try {
      result = BeamCalc.computeBeam(params);
    } catch (e) {
      console.error('Beam computation error:', e);
      return;
    }

    pendingParams = params;
    pendingResult = result;

    // Update stats immediately
    updateStats(result);

    if (animate) {
      animationStart = null;
      function step(ts) {
        if (!animationStart) animationStart = ts;
        const elapsed = ts - animationStart;
        const fraction = Math.min(1, elapsed / ANIM_DURATION);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - fraction, 3);
        draw(pendingParams, pendingResult, eased);
        if (fraction < 1) {
          animationId = requestAnimationFrame(step);
        } else {
          animationId = null;
        }
      }
      animationId = requestAnimationFrame(step);
    } else {
      draw(params, result, 1);
    }
  }

  function updateStats(result) {
    outDeflection.textContent = formatDeflection(result.maxDeflection);
    outStress.textContent     = formatStress(result.maxStress);

    const ys = result.yieldStrength;
    const pct = result.maxStress / ys * 100;
    outYield.textContent = `${formatStress(result.maxStress)} / ${formatStress(ys)} (${pct.toFixed(1)}%)`;

    if (result.hasYielded) {
      yieldBadge.textContent = '⚠ Material Yielded!';
      yieldBadge.className = 'badge badge-warn';
    } else if (pct > 75) {
      yieldBadge.textContent = '⚡ High Stress';
      yieldBadge.className = 'badge badge-caution';
    } else {
      yieldBadge.textContent = '✓ Safe';
      yieldBadge.className = 'badge badge-safe';
    }
  }

  // ─── Slider value display labels ─────────────────────────────────────────────
  function bindSliderLabel(slider, labelId, unit, scale = 1, decimals = 0) {
    const label = document.getElementById(labelId);
    if (!label) return;
    const update = () => {
      label.textContent = (parseFloat(slider.value) * scale).toFixed(decimals) + ' ' + unit;
    };
    slider.addEventListener('input', update);
    update();
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    resizeCanvases();

    // Beam type toggle
    beamTypeRadios.forEach(r => r.addEventListener('change', () => triggerUpdate(true)));

    // Material / section dropdowns
    materialSel.addEventListener('change', () => triggerUpdate(false));
    sectionSel.addEventListener('change', () => {
      updateSectionPanel();
      triggerUpdate(false);
    });

    // Sync L and P sliders ↔ number inputs
    syncSliderNum(sliderL, numL);
    syncSliderNum(sliderP, numP);

    // All other sliders trigger update
    [sliderW, sliderH, sliderD, sliderFW, sliderFT, sliderWH, sliderWT].forEach(s => {
      if (s) s.addEventListener('input', () => triggerUpdate(false));
    });

    // Slider labels
    bindSliderLabel(sliderL,  'labelL',  'm',  1, 2);
    bindSliderLabel(sliderP,  'labelP',  'N',  1, 0);
    bindSliderLabel(sliderW,  'labelW',  'mm', 1, 0);
    bindSliderLabel(sliderH,  'labelH',  'mm', 1, 0);
    bindSliderLabel(sliderD,  'labelD',  'mm', 1, 0);
    bindSliderLabel(sliderFW, 'labelFW', 'mm', 1, 0);
    bindSliderLabel(sliderFT, 'labelFT', 'mm', 1, 0);
    bindSliderLabel(sliderWH, 'labelWH', 'mm', 1, 0);
    bindSliderLabel(sliderWT, 'labelWT', 'mm', 1, 0);

    // Initial section panel state
    updateSectionPanel();

    // Responsive resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        resizeCanvases();
        triggerUpdate(false);
      }, 120);
    });

    // Initial draw with animation
    triggerUpdate(true);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

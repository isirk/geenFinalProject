/**
 * beam.js — Euler-Bernoulli beam bending calculations
 * Supports cantilever and simply supported beam types.
 */

const MATERIALS = {
  steel:    { name: 'Steel',     E: 200e9, yieldStrength: 250e6 },
  aluminum: { name: 'Aluminum',  E: 69e9,  yieldStrength: 270e6 },
  wood:     { name: 'Wood',      E: 12e9,  yieldStrength: 40e6  },
  titanium: { name: 'Titanium',  E: 116e9, yieldStrength: 880e6 },
  copper:   { name: 'Copper',    E: 110e9, yieldStrength: 210e6 },
};

/**
 * Compute second moment of area (I) and distance to outer fiber (c)
 * for a given cross-section type and dimensions (in metres).
 */
function crossSectionProperties(type, dims) {
  switch (type) {
    case 'rectangular': {
      const { width: b, height: h } = dims;
      return {
        I: (b * Math.pow(h, 3)) / 12,
        c: h / 2,
        area: b * h,
      };
    }
    case 'circular': {
      const { diameter: d } = dims;
      const r = d / 2;
      return {
        I: (Math.PI * Math.pow(d, 4)) / 64,
        c: r,
        area: Math.PI * r * r,
      };
    }
    case 'ibeam': {
      // Simplified I-beam: flanges width bf, thickness tf; web height hw, thickness tw
      const { flangeWidth: bf, flangeThickness: tf, webHeight: hw, webThickness: tw } = dims;
      const totalHeight = hw + 2 * tf;
      const Iflanges = 2 * ((bf * Math.pow(tf, 3)) / 12 + bf * tf * Math.pow((hw / 2 + tf / 2), 2));
      const Iweb = (tw * Math.pow(hw, 3)) / 12;
      return {
        I: Iflanges + Iweb,
        c: totalHeight / 2,
        area: 2 * bf * tf + tw * hw,
      };
    }
    default:
      throw new Error(`Unknown cross-section type: ${type}`);
  }
}

/**
 * Cantilever beam deflection at position x (0 = fixed end, L = free end).
 * y(x) = (P * x²) / (6EI) * (3L - x)
 */
function cantileverDeflection(x, P, L, E, I) {
  if (x < 0 || x > L) return 0;
  return (P * x * x) / (6 * E * I) * (3 * L - x);
}

/**
 * Simply supported beam deflection at position x (0 and L are the supports).
 * y(x) = (P * x) / (48EI) * (3L² - 4x²)  for x ≤ L/2
 * Symmetric for x > L/2
 */
function simplySupportedDeflection(x, P, L, E, I) {
  if (x < 0 || x > L) return 0;
  const half = L / 2;
  const xEff = x <= half ? x : L - x;
  return (P * xEff) / (48 * E * I) * (3 * L * L - 4 * xEff * xEff);
}

/**
 * Compute beam results (deflection curve, max deflection, max stress).
 *
 * @param {object} params
 * @param {string} params.beamType     - 'cantilever' | 'simplysupported'
 * @param {number} params.L            - beam length (m)
 * @param {number} params.P            - applied load (N)
 * @param {string} params.material     - key in MATERIALS
 * @param {string} params.sectionType  - cross-section type
 * @param {object} params.sectionDims  - cross-section dimensions
 * @param {number} [params.numPoints]  - number of points in the curve (default 200)
 * @returns {object} results
 */
function computeBeam(params) {
  const { beamType, L, P, material, sectionType, sectionDims, numPoints = 200 } = params;
  const mat = MATERIALS[material];
  if (!mat) throw new Error(`Unknown material: ${material}`);

  const { I, c } = crossSectionProperties(sectionType, sectionDims);
  const E = mat.E;

  let deflectionFn;
  let maxDeflection;
  let maxStress;

  if (beamType === 'cantilever') {
    deflectionFn = (x) => cantileverDeflection(x, P, L, E, I);
    maxDeflection = (P * Math.pow(L, 3)) / (3 * E * I);
    maxStress = (P * L * c) / I;
  } else {
    deflectionFn = (x) => simplySupportedDeflection(x, P, L, E, I);
    maxDeflection = (P * Math.pow(L, 3)) / (48 * E * I);
    maxStress = (P * L * c) / (4 * I);
  }

  // Sample deflection curve
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * L;
    const y = deflectionFn(x);
    points.push({ x, y });
  }

  // Stress along the beam (normalised 0–1 relative to max stress)
  const stressAtX = (x) => {
    let M;
    if (beamType === 'cantilever') {
      M = P * (L - x);
    } else {
      M = x <= L / 2 ? P * x / 2 : P * (L - x) / 2;
    }
    return (M * c) / I;
  };

  const stressPoints = points.map(({ x }) => stressAtX(x));
  const hasYielded = maxStress >= mat.yieldStrength;

  return {
    points,
    stressPoints,
    maxDeflection,
    maxStress,
    yieldStrength: mat.yieldStrength,
    hasYielded,
    E,
    I,
    c,
    material: mat,
  };
}

// Export for use in other modules (browser globals)
window.BeamCalc = {
  MATERIALS,
  crossSectionProperties,
  cantileverDeflection,
  simplySupportedDeflection,
  computeBeam,
};

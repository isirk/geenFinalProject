# Beam Bending Simulator

An interactive web application that simulates **cantilever beam bending** and **simply supported beam bending** using Euler-Bernoulli beam theory.

🔗 **Live Demo:** [isirk.github.io/geenFinalProject](https://isirk.github.io/geenFinalProject)

---

## Features

- **Two simulation modes:**
  - Cantilever beam — fixed at one end, point load at the free end
  - Simply supported beam — supported at both ends, point load at the centre
- **Real-time interactive controls** via sliders and number inputs:
  - Beam length (0.5 m – 5 m)
  - Applied load (0 – 10,000 N)
  - Material selection: Steel, Aluminum, Wood, Titanium, Copper
  - Cross-section type: Rectangular, Circular, I-Beam
  - Cross-section dimensions
- **Canvas visualisations:**
  - Deflected beam shape with stress colour-map (blue → yellow → red)
  - Supports drawn appropriately (wall hatching for cantilever, triangle supports for simply supported)
  - Load arrow with yield warning
  - Bending stress distribution diagram
- **Calculated results:** max deflection, max stress, yield strength comparison with ✓/⚠ indicator
- **Animated load application** on beam type change
- **Theory section** explaining the physics and equations
- **Mobile responsive** layout

---

## Physics

### Cantilever Beam
Fixed at one end (wall), free at the other, with a point load *P* at the free tip.

```
Deflection:    δ(x) = (P·x²) / (6EI) · (3L − x)
Max deflection: δ_max = PL³ / (3EI)
Max stress:    σ_max = P·L·c / I   (at the fixed end)
```

### Simply Supported Beam
Supported at both ends, with a point load *P* at the centre.

```
Deflection:    δ(x) = (P·x) / (48EI) · (3L² − 4x²)   for x ≤ L/2
Max deflection: δ_max = PL³ / (48EI)   (at the centre)
Max stress:    σ_max = P·L·c / (4I)    (at the centre)
```

### Variables
| Symbol | Meaning |
|--------|---------|
| E | Young's modulus (material stiffness, Pa) |
| I | Second moment of area (cross-section geometry, m⁴) |
| c | Distance from neutral axis to outer fiber (m) |
| L | Beam length (m) |
| P | Applied point load (N) |
| σ_y | Yield strength — material failure limit (Pa) |

### Cross-Section Properties
| Section | I | c |
|---------|---|---|
| Rectangular (b × h) | b·h³/12 | h/2 |
| Circular (diameter d) | π·d⁴/64 | d/2 |
| I-Beam | Σ(flanges + web) | totalHeight/2 |

---

## File Structure

```
index.html        — Main app page
css/
  style.css       — Styles (dark theme, responsive)
js/
  beam.js         — Beam calculation functions (Euler-Bernoulli)
  renderer.js     — Canvas rendering (deflection curve, stress colour-map)
  app.js          — UI wiring (sliders, dropdowns, animation)
README.md         — This file
```

## Tech Stack

- Vanilla HTML + CSS + JavaScript — **no build tools, no frameworks, no dependencies**
- HTML5 Canvas for visualisations
- Served via GitHub Pages (static hosting)

---

## Local Development

Just open `index.html` in any browser — no server or build step required.

```bash
# Optional: serve locally with any static server
npx serve .
# or
python3 -m http.server 8080
```

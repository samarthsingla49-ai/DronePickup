# 🛸 CYBERDROP: NEO-TOKYO COURIER // 2077

> **Browser-based Drone Pick-and-Drop Action Game with Story Mode & Interactive Campaign Map**  
> *Zero runtime dependencies, pure HTML5 Canvas & ES6 modules.*

---

## 🕹️ Quick Start (How to Run)

Browsers restrict ES module loading over the `file://` protocol. Run the game via a local HTTP server:

1. **Option A (Windows 1-Click):**  
   Double-click `play.bat` in the repository root. It will launch the local web server and open the game in your default browser.

2. **Option B (Command Line):**  
   ```bash
   # Using Python 3:
   python -m http.server 8000
   # Then open: http://localhost:8000

   # Or using Node / npx:
   npx serve .
   ```

---

## 🗺️ Story Mode & Holographic Campaign Map

The game features an interactive **Neo-Tokyo Sector Overworld Map**:
- **Interactive Holographic Sectors:** Click between unlocked city sectors (Sector 01: District 7, Sector 02: Neon Canyon, Sector 03: Omega Megaplex) with animated radar sweep, territory grids, and pulsating data conduits.
- **Campaign Progression & Star Ratings:** Completing contracts awards grades (`S+`, `S`, `A`, `B`) and unlocks subsequent restricted airspace routes.
- **Pilot Codex & Story Manual:** Click `📖 RULES & CODEX` on the Title screen or Campaign Map to view interactive tactical briefings on flight mechanics, tether dynamics, winch operations, solar recharge pads, and laser hazard mitigation.

---

## 🎯 Gameplay Mechanics

- **Simplified 2D Rigid-Body Flight Model:** Realistic inertia, rotational tilt, gravity, atmospheric drag, and visual thruster plumes.
- **Elastic Spring-Damper Tether:** Cargo sways dynamically on a cable underneath the drone, affecting momentum and flight balance.
- **Payload Variety:**
  - *Standard Cyber Courier:* Balanced mass and standard collision tolerance.
  - *Plasma Core:* Heavier mass with strong pendulum swing and lower impact tolerance.
  - *Quantum Data:* Ultra-delicate high-reward payload requiring gentle flight and landing.
- **Atmospheric Conditions & Hazards:** Turbulent crosswind gusts, torrential cyber rain, moving orbital security lasers, and an altitude ceiling.
- **Energy Management:** Solar recharge pads on rooftops replenish depleted battery cells.
- **100% Procedural Audio:** Synthesized in real-time via the Web Audio API with zero external audio assets.

---

## 🎮 Controls

| Action | Keyboard | Gamepad | Touch Screen |
| :--- | :--- | :--- | :--- |
| **Main Thrusters** | `W` or `↑` | `A` or `Right Trigger` | `▲ THRUST` |
| **Tilt / Rotate Left** | `A` or `←` | `Left Stick Left` | `◀` |
| **Tilt / Rotate Right** | `D` or `→` | `Left Stick Right` | `▶` |
| **Tether Grapple / Release** | `SPACE` or `S` or `↓` | `B` or `X` Button | `HOOK` |
| **Retract Winch (Shorten)** | `Q` | - | - |
| **Extend Winch (Lengthen)** | `E` | - | - |
| **Pause Simulation** | `P` or `ESC` | - | - |
| **Restart Mission** | `R` | - | Retry Button |
| **Toggle Sound** | `M` | - | `🔊 SOUND` Button |

---

## 🏗️ Repository Layout

```
DronePickup/
├── index.html            # Main entry point, HUD overlay, screen states, story codex modal
├── style.css             # Cyberpunk styling, responsive layout, holographic map styles
├── play.bat              # Windows batch launcher (starts server & opens browser)
├── README.md             # Project documentation and control reference
└── src/
    ├── audio.js          # Procedural Web Audio API sound synthesizer
    ├── map.js            # Holographic sector campaign map, radar sweep, narrative dispatch
    ├── physics.js        # Vector2 math, rigid-body dynamics, tether winch, wind system
    ├── particles.js      # Rotor downwash, thruster flame, sparks, confetti celebration
    ├── drone.js          # Drone flight physics, chassis rendering, cargo entity
    ├── levels.js         # Mission configurations, city obstacles, drop zones, laser paths
    └── game.js           # Core loop, input handling, camera tracking, scoring & grading
```

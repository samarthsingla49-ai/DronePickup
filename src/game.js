// ============================================================================
// CYBERDROP: NEO-TOKYO COURIER - Core Game Loop & State Manager
// Camera lerp, Parallax city, Touch/Gamepad inputs, Drop zone detection, HUD
// ============================================================================

import { audio } from './audio.js';
import { Vector2, WindSystem } from './physics.js';
import { ParticleSystem } from './particles.js';
import { Drone, Cargo } from './drone.js';
import { MISSIONS } from './levels.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Virtual resolution & scaling
        this.width = 1280;
        this.height = 720;
        this.scale = 1;

        // Camera
        this.camera = new Vector2(0, 0);

        // Core systems
        this.wind = new WindSystem();
        this.particles = new ParticleSystem();
        this.drone = new Drone(100, 300);
        this.cargo = null;

        // State Machine
        this.state = 'TITLE'; // TITLE, BRIEFING, PLAYING, LEVEL_SUCCESS, GAME_OVER, VICTORY
        this.currentMissionIndex = 0;
        this.currentMission = MISSIONS[0];

        // Scoring & Stats
        this.score = 0;
        this.totalScore = 0;
        this.timeLeft = 60;
        this.combo = 1;
        this.highScore = parseInt(localStorage.getItem('cyberdrop_highscore') || '0', 10);

        // Touch & Key Inputs
        this.keys = {};
        this.gamepadIndex = null;

        // Drop Zone Stability timer
        this.dropStableTimer = 0;
        this.failureReason = "";

        // Screen shake
        this.shakeTimer = 0;
        this.shakeIntensity = 0;

        // Laser obstacle animation
        this.laserTime = 0;

        // Setup listeners & resize
        this.initEventListeners();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Start animation loop
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        // Maintain 16:9 aspect ratio or fill gracefully
        this.canvas.width = winW;
        this.canvas.height = winH;
        this.width = winW;
        this.height = winH;
    }

    initEventListeners() {
        // Keyboard
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            // Audio unlock on user interaction
            audio.init();
            audio.resume();

            // Grapple toggle on Space or KeyS / ArrowDown
            if (e.code === 'Space' || e.code === 'KeyS' || e.code === 'ArrowDown') {
                e.preventDefault();
                this.toggleGrapple();
            }

            if (e.code === 'KeyM') {
                const muted = audio.toggleMute();
                this.updateMuteButton(muted);
            }

            if (e.code === 'KeyR' && (this.state === 'PLAYING' || this.state === 'GAME_OVER')) {
                this.restartMission();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Gamepad detection
        window.addEventListener('gamepadconnected', (e) => {
            this.gamepadIndex = e.gamepad.index;
        });

        window.addEventListener('gamepaddisconnected', () => {
            this.gamepadIndex = null;
        });

        // UI Button Bindings
        this.bindUI();
    }

    bindUI() {
        const startBtn = document.getElementById('start-btn');
        const deployBtn = document.getElementById('deploy-btn');
        const nextBtn = document.getElementById('next-btn');
        const retryBtn = document.getElementById('retry-btn');
        const playAgainBtn = document.getElementById('play-again-btn');
        const muteBtn = document.getElementById('mute-btn');

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                audio.init();
                audio.resume();
                audio.startMusic();
                this.startBriefing(0);
            });
        }

        if (deployBtn) {
            deployBtn.addEventListener('click', () => {
                audio.resume();
                this.startMission(this.currentMissionIndex);
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const nextIdx = this.currentMissionIndex + 1;
                if (nextIdx < MISSIONS.length) {
                    this.startBriefing(nextIdx);
                } else {
                    this.showVictory();
                }
            });
        }

        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.startMission(this.currentMissionIndex);
            });
        }

        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => {
                this.totalScore = 0;
                this.currentMissionIndex = 0;
                this.startBriefing(0);
            });
        }

        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                const muted = audio.toggleMute();
                this.updateMuteButton(muted);
            });
        }

        // On-screen touch buttons for mobile/tablet support
        this.bindTouchControls();
    }

    bindTouchControls() {
        const btnThrust = document.getElementById('touch-thrust');
        const btnLeft = document.getElementById('touch-left');
        const btnRight = document.getElementById('touch-right');
        const btnGrapple = document.getElementById('touch-grapple');

        const bindHold = (elem, keyCode) => {
            if (!elem) return;
            const start = (e) => { e.preventDefault(); audio.init(); this.keys[keyCode] = true; };
            const end = (e) => { e.preventDefault(); this.keys[keyCode] = false; };
            elem.addEventListener('touchstart', start, { passive: false });
            elem.addEventListener('touchend', end, { passive: false });
            elem.addEventListener('mousedown', start);
            elem.addEventListener('mouseup', end);
            elem.addEventListener('mouseleave', end);
        };

        bindHold(btnThrust, 'ArrowUp');
        bindHold(btnLeft, 'ArrowLeft');
        bindHold(btnRight, 'ArrowRight');

        if (btnGrapple) {
            const tapGrapple = (e) => {
                e.preventDefault();
                audio.init();
                this.toggleGrapple();
            };
            btnGrapple.addEventListener('touchstart', tapGrapple, { passive: false });
            btnGrapple.addEventListener('click', tapGrapple);
        }
    }

    updateMuteButton(muted) {
        const muteBtn = document.getElementById('mute-btn');
        if (muteBtn) {
            muteBtn.textContent = muted ? '🔇 UNMUTE' : '🔊 SOUND';
        }
    }

    toggleGrapple() {
        if (this.state !== 'PLAYING') return;

        if (this.drone.latchedCargo) {
            // Release cargo
            this.drone.releaseCargo(audio);
        } else {
            // Attempt to latch
            const latched = this.drone.tryLatch(this.cargo, audio, this.particles);
            if (!latched) {
                // If out of range, show warning or subtle buzz
                audio.playWarning();
            }
        }
    }

    pollGamepad() {
        if (this.gamepadIndex === null) return;
        const gp = navigator.getGamepads()[this.gamepadIndex];
        if (!gp) return;

        // Stick X for tilt
        const stickX = gp.axes[0];
        if (stickX < -0.25) this.keys['ArrowLeft'] = true;
        else if (stickX > 0.25) this.keys['ArrowRight'] = true;
        else {
            this.keys['ArrowLeft'] = false;
            this.keys['ArrowRight'] = false;
        }

        // Trigger or A button for thrust
        const thrustPressed = gp.buttons[0].pressed || gp.buttons[7].value > 0.2;
        this.keys['ArrowUp'] = thrustPressed;

        // B or X button for Grapple
        if (gp.buttons[1].pressed || gp.buttons[2].pressed) {
            if (!this.gamepadGrapplePressed) {
                this.toggleGrapple();
                this.gamepadGrapplePressed = true;
            }
        } else {
            this.gamepadGrapplePressed = false;
        }
    }

    startBriefing(missionIdx) {
        this.state = 'BRIEFING';
        this.currentMissionIndex = missionIdx;
        this.currentMission = MISSIONS[missionIdx];

        // Update Briefing UI
        document.getElementById('brief-title').textContent = this.currentMission.title;
        document.getElementById('brief-codename').textContent = this.currentMission.codename;
        document.getElementById('brief-text').textContent = this.currentMission.briefing;
        document.getElementById('brief-cargo').textContent = this.currentMission.cargo.type;
        document.getElementById('brief-time').textContent = `${this.currentMission.timeLimit}s`;
        document.getElementById('brief-wind').textContent = `${Math.abs(this.currentMission.weather.windBase)} KTS`;

        this.setScreen('screen-briefing');
    }

    startMission(missionIdx) {
        this.state = 'PLAYING';
        this.currentMissionIndex = missionIdx;
        this.currentMission = MISSIONS[missionIdx];

        // Reset Drone & Cargo
        const start = this.currentMission.droneStart;
        this.drone.reset(start.x, start.y);

        const cargoCfg = this.currentMission.cargo;
        this.cargo = new Cargo(cargoCfg.x, cargoCfg.y, cargoCfg.type);

        // Reset Weather & Particles
        const w = this.currentMission.weather;
        this.wind.configure(w.windBase, w.windGust, w.windFreq);
        this.particles.reset();

        if (w.rain) {
            this.particles.initRain(2000, 800, 150);
        }

        // Reset Timers
        this.timeLeft = this.currentMission.timeLimit;
        this.dropStableTimer = 0;
        this.failureReason = "";
        this.shakeTimer = 0;

        this.setScreen('screen-hud');
    }

    restartMission() {
        this.startMission(this.currentMissionIndex);
    }

    triggerShake(intensity = 8, duration = 0.25) {
        this.shakeIntensity = intensity;
        this.shakeTimer = duration;
    }

    setScreen(screenId) {
        const screens = [
            'screen-title',
            'screen-briefing',
            'screen-hud',
            'screen-success',
            'screen-gameover',
            'screen-victory'
        ];
        screens.forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                if (id === screenId || (screenId === 'screen-hud' && id === 'screen-hud')) {
                    el.classList.remove('hidden');
                } else if (screenId !== 'screen-hud' && id === 'screen-hud') {
                    // Keep HUD hidden when on menus
                    el.classList.add('hidden');
                } else {
                    el.classList.add('hidden');
                }
            }
        });
    }

    // ------------------------------------------------------------------------
    // Main Game Loop
    // ------------------------------------------------------------------------
    loop(timestamp) {
        const dt = Math.min(0.08, (timestamp - this.lastTime) / 1000);
        this.lastTime = timestamp;

        this.pollGamepad();

        if (this.state === 'PLAYING') {
            this.update(dt);
        }

        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        this.timeLeft -= dt;
        this.laserTime += dt;

        // Screen Shake decay
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
        }

        // 1. Wind & Atmospheric
        this.wind.update(dt);
        audio.updateWindSound(this.wind.currentSpeed / 60);

        // 2. Drone Controls & Physics
        this.drone.applyControls(this.keys, dt, this.particles);
        this.drone.updatePhysics(
            dt,
            this.wind,
            this.currentMission.obstacles,
            this.particles,
            audio
        );

        // Audio update for engine pitch
        const speedRatio = this.drone.vel.mag() / 300;
        audio.updateEngineSound(this.drone.thrustIntensity, speedRatio);

        // 3. Recharge Pad Detection
        this.checkRechargePads(dt);

        // 4. Cargo Physics
        if (this.cargo) {
            this.cargo.updatePhysics(
                dt,
                this.wind,
                this.currentMission.obstacles,
                this.particles,
                audio
            );

            // Check if cargo hit damage destroyed it
            if (this.cargo.status === 'DESTROYED') {
                this.triggerGameOver("Cargo was destroyed from severe structural impacts!");
                return;
            }
        }

        // 5. Laser Hazard Obstacles
        this.checkLaserHazards();

        // 6. Check Drop Zone Success Condition
        this.checkDropZone(dt);

        // 7. Check Fail Conditions
        if (this.timeLeft <= 0) {
            this.triggerGameOver("Mission Time Expired! The courier contract was cancelled.");
            return;
        }

        if (this.drone.health <= 0) {
            this.triggerGameOver("Drone Chassis Destroyed in a critical collision!");
            return;
        }

        if (this.drone.battery <= 0 && this.drone.vel.magSq() < 5) {
            this.triggerGameOver("Battery Depleted! The drone powered down in the field.");
            return;
        }

        // 8. Low battery / cargo warning sound pulse
        if (this.drone.battery < 20 || (this.cargo && this.cargo.integrity < 25)) {
            if (Math.floor(this.timeLeft * 3) % 4 === 0) {
                audio.playWarning();
            }
        }

        // 9. Update Particles
        this.particles.update(dt, this.wind.currentSpeed, { w: 2000, h: 800 });

        // 10. Camera Smooth Follow (Lerp)
        const targetX = this.drone.pos.x - this.width / 2;
        const targetY = this.drone.pos.y - this.height / 2;
        this.camera.x += (targetX - this.camera.x) * Math.min(1.0, 5.0 * dt);
        this.camera.y += (targetY - this.camera.y) * Math.min(1.0, 5.0 * dt);

        // Update HUD DOM
        this.updateHUD();
    }

    checkRechargePads(dt) {
        this.drone.isRecharging = false;
        const pads = this.currentMission.rechargePads || [];
        const droneAnchor = this.drone.getAnchorPos();

        for (const pad of pads) {
            const inX = droneAnchor.x >= pad.x && droneAnchor.x <= pad.x + pad.w;
            const inY = Math.abs(droneAnchor.y - pad.y) < 16;
            const slow = this.drone.vel.mag() < 35;

            if (inX && inY && slow) {
                this.drone.isRecharging = true;
                this.drone.battery = Math.min(this.drone.maxBattery, this.drone.battery + 50 * dt);
                this.particles.spawnSparks(droneAnchor.x, droneAnchor.y, '#00ff88', 2);
                if (Math.random() < 0.25) audio.playChargePad();
            }
        }
    }

    checkLaserHazards() {
        const lasers = this.currentMission.lasers || [];
        for (const laser of lasers) {
            const range = laser.y2 - laser.y1;
            const laserY = laser.y1 + ((Math.sin(this.laserTime * laser.speed + laser.offset) + 1) / 2) * range;

            // Check drone collision with laser beam point
            const distDrone = Math.hypot(this.drone.pos.x - laser.x, this.drone.pos.y - laserY);
            if (distDrone < 25) {
                this.drone.health = Math.max(0, this.drone.health - 25);
                this.triggerShake(12, 0.3);
                this.particles.spawnSparks(this.drone.pos.x, this.drone.pos.y, '#ff0044', 20);
                audio.playCrash();
            }

            // Check cargo collision with laser
            if (this.cargo && this.cargo.status !== 'DELIVERED') {
                const distCargo = Math.hypot(this.cargo.pos.x - laser.x, this.cargo.pos.y - laserY);
                if (distCargo < 25) {
                    this.cargo.integrity = Math.max(0, this.cargo.integrity - 35);
                    this.particles.spawnSparks(this.cargo.pos.x, this.cargo.pos.y, '#ff0044', 20);
                    audio.playCrash();
                }
            }
        }
    }

    checkDropZone(dt) {
        if (!this.cargo || this.cargo.status === 'DELIVERED') return;

        const dz = this.currentMission.dropZone;
        const cPos = this.cargo.pos;

        // Inside horizontal zone
        const inX = cPos.x >= dz.x + 10 && cPos.x <= dz.x + dz.w - 10;
        const inY = Math.abs(cPos.y - (dz.y - this.cargo.h / 2)) < 16;
        const lowSpeed = this.cargo.vel.mag() < 30;

        if (inX && inY && lowSpeed) {
            this.dropStableTimer += dt;
            this.particles.spawnSparks(cPos.x, dz.y, '#00ff88', 2);

            // If player releases cargo OR holds stably inside for 0.75s
            if (!this.drone.latchedCargo || this.dropStableTimer >= 0.75) {
                this.cargo.status = 'DELIVERED';
                this.drone.releaseCargo(null);
                this.completeMission();
            }
        } else {
            this.dropStableTimer = Math.max(0, this.dropStableTimer - dt * 2);
        }
    }

    completeMission() {
        this.state = 'LEVEL_SUCCESS';
        audio.playDeliverySuccess();

        const dz = this.currentMission.dropZone;
        this.particles.spawnCelebration(dz.x + dz.w / 2, dz.y - 20);
        this.triggerShake(6, 0.4);

        // Calculate scores
        const timeBonus = Math.floor(Math.max(0, this.timeLeft) * 35);
        const integrityBonus = Math.floor(this.cargo.integrity * 20);
        const batteryBonus = Math.floor(this.drone.battery * 15);
        const baseValue = this.cargo.value;
        const missionScore = baseValue + timeBonus + integrityBonus + batteryBonus;

        this.score = missionScore;
        this.totalScore += missionScore;

        if (this.totalScore > this.highScore) {
            this.highScore = this.totalScore;
            localStorage.setItem('cyberdrop_highscore', this.highScore.toString());
        }

        // Grade
        let grade = 'C';
        if (missionScore > 4800) grade = 'S+';
        else if (missionScore > 4000) grade = 'S';
        else if (missionScore > 3200) grade = 'A';
        else if (missionScore > 2400) grade = 'B';

        // Update UI
        document.getElementById('succ-score').textContent = missionScore.toLocaleString();
        document.getElementById('succ-time-bonus').textContent = `+${timeBonus}`;
        document.getElementById('succ-integrity-bonus').textContent = `+${integrityBonus} (${Math.round(this.cargo.integrity)}%)`;
        document.getElementById('succ-battery-bonus').textContent = `+${batteryBonus} (${Math.round(this.drone.battery)}%)`;
        document.getElementById('succ-total').textContent = this.totalScore.toLocaleString();
        document.getElementById('succ-grade').textContent = grade;

        setTimeout(() => {
            this.setScreen('screen-success');
        }, 900);
    }

    triggerGameOver(reason) {
        this.state = 'GAME_OVER';
        this.failureReason = reason;
        audio.playCrash();
        this.triggerShake(16, 0.5);

        document.getElementById('fail-reason').textContent = reason;
        document.getElementById('fail-score').textContent = this.totalScore.toLocaleString();

        setTimeout(() => {
            this.setScreen('screen-gameover');
        }, 800);
    }

    showVictory() {
        this.state = 'VICTORY';
        audio.playDeliverySuccess();
        document.getElementById('vic-total-score').textContent = this.totalScore.toLocaleString();
        this.setScreen('screen-victory');
    }

    updateHUD() {
        // Battery bar
        const batFill = document.getElementById('hud-battery-fill');
        const batVal = document.getElementById('hud-battery-val');
        if (batFill) {
            const bat = Math.max(0, Math.min(100, this.drone.battery));
            batFill.style.width = `${bat}%`;
            batVal.textContent = `${Math.round(bat)}%`;

            if (bat > 40) batFill.style.backgroundColor = '#00f0ff';
            else if (bat > 20) batFill.style.backgroundColor = '#ffea00';
            else batFill.style.backgroundColor = '#ff0044';
        }

        // Health bar
        const hpFill = document.getElementById('hud-health-fill');
        const hpVal = document.getElementById('hud-health-val');
        if (hpFill) {
            const hp = Math.max(0, Math.min(100, this.drone.health));
            hpFill.style.width = `${hp}%`;
            hpVal.textContent = `${Math.round(hp)}%`;
        }

        // Timer
        const timeEl = document.getElementById('hud-time');
        if (timeEl) {
            const t = Math.max(0, Math.ceil(this.timeLeft));
            timeEl.textContent = `${t}s`;
            if (t <= 15) timeEl.classList.add('urgent');
            else timeEl.classList.remove('urgent');
        }

        // Score
        const scoreEl = document.getElementById('hud-score');
        if (scoreEl) {
            scoreEl.textContent = this.totalScore.toLocaleString();
        }

        // Cargo status badge
        const cargoBadge = document.getElementById('hud-cargo-status');
        if (cargoBadge && this.cargo) {
            if (this.drone.latchedCargo) {
                cargoBadge.textContent = `LATCHED: ${Math.round(this.cargo.integrity)}%`;
                cargoBadge.className = 'status-badge latched';
            } else if (this.cargo.status === 'DELIVERED') {
                cargoBadge.textContent = 'DELIVERED';
                cargoBadge.className = 'status-badge delivered';
            } else {
                cargoBadge.textContent = 'NO CARGO';
                cargoBadge.className = 'status-badge unhooked';
            }
        }

        // Wind indicator
        const windSpeedEl = document.getElementById('hud-wind-speed');
        const windArrowEl = document.getElementById('hud-wind-arrow');
        if (windSpeedEl && windArrowEl) {
            const spd = Math.round(this.wind.currentSpeed);
            windSpeedEl.textContent = `${Math.abs(spd)} KTS`;
            const rot = spd >= 0 ? 0 : 180;
            windArrowEl.style.transform = `rotate(${rot}deg)`;
        }
    }

    // ------------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------------
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Apply screen shake
        ctx.save();
        if (this.shakeTimer > 0) {
            const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
            ctx.translate(shakeX, shakeY);
        }

        // Draw Parallax Cyberpunk City Background
        this.renderParallaxBackground(ctx);

        // Apply Camera Transform
        ctx.save();
        ctx.translate(-Math.floor(this.camera.x), -Math.floor(this.camera.y));

        // Draw World
        this.renderWorld(ctx);

        ctx.restore(); // Camera restored
        ctx.restore(); // Shake restored

        // Draw Screen Edge Beacons / Off-screen Nav Radar
        if (this.state === 'PLAYING') {
            this.renderNavBeacons(ctx);
        }
    }

    renderParallaxBackground(ctx) {
        // Deep cyber gradient sky
        const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        skyGrad.addColorStop(0, '#0a0d18');
        skyGrad.addColorStop(0.65, '#12172b');
        skyGrad.addColorStop(1, '#1b0e2a');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, this.width, this.height);

        // Distant Skyline Silhouettes (Layer 1 - slow parallax)
        const p1 = this.camera.x * 0.12;
        ctx.fillStyle = '#0f1426';
        for (let i = -1; i < 12; i++) {
            const x = i * 220 - (p1 % 220);
            const h = 260 + ((i * 47) % 180);
            ctx.fillRect(x, this.height - h, 180, h);

            // Glowing distant window dots
            ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
            for (let wy = this.height - h + 20; wy < this.height - 20; wy += 25) {
                if ((wy + i * 13) % 2 === 0) {
                    ctx.fillRect(x + 20, wy, 8, 12);
                    ctx.fillRect(x + 50, wy, 8, 12);
                    ctx.fillRect(x + 90, wy, 8, 12);
                }
            }
            ctx.fillStyle = '#0f1426';
        }

        // Midground Skyline Silhouettes (Layer 2 - medium parallax)
        const p2 = this.camera.x * 0.28;
        ctx.fillStyle = '#141a33';
        for (let i = -1; i < 10; i++) {
            const x = i * 290 - (p2 % 290);
            const h = 180 + ((i * 73) % 150);
            ctx.fillRect(x, this.height - h, 240, h);

            // Neon roof antenna beacon
            ctx.fillStyle = (i % 2 === 0) ? '#ff0077' : '#00f0ff';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(x + 120, this.height - h - 15, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#141a33';
        }
    }

    renderWorld(ctx) {
        const obsList = this.currentMission.obstacles || [];

        // 1. Draw Buildings & Obstacles
        for (const obs of obsList) {
            // Building Body
            ctx.fillStyle = obs.color || '#161c30';
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

            // Neon Rooftop Strip
            if (obs.neon) {
                ctx.save();
                ctx.strokeStyle = obs.neon;
                ctx.shadowColor = obs.neon;
                ctx.shadowBlur = 12;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(obs.x, obs.y);
                ctx.lineTo(obs.x + obs.w, obs.y);
                ctx.stroke();
                ctx.restore();
            }

            // Window Grids
            ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
            for (let wx = obs.x + 15; wx < obs.x + obs.w - 15; wx += 25) {
                for (let wy = obs.y + 20; wy < obs.y + obs.h - 20; wy += 35) {
                    ctx.fillRect(wx, wy, 14, 18);
                }
            }

            // Billboard label
            if (obs.label) {
                ctx.save();
                ctx.fillStyle = obs.neon || '#00f0ff';
                ctx.shadowColor = obs.neon || '#00f0ff';
                ctx.shadowBlur = 8;
                ctx.font = 'bold 12px "Courier New", monospace';
                ctx.fillText(obs.label, obs.x + 10, obs.y + 25);
                ctx.restore();
            }
        }

        // 2. Draw Recharge Pads
        const pads = this.currentMission.rechargePads || [];
        for (const pad of pads) {
            ctx.save();
            ctx.fillStyle = '#0a2218';
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#00ff88';
            ctx.shadowBlur = 10;
            ctx.fillRect(pad.x, pad.y, pad.w, pad.h);
            ctx.strokeRect(pad.x, pad.y, pad.w, pad.h);

            // Recharge Bolt Symbol
            ctx.fillStyle = '#00ff88';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText('⚡ RECHARGE', pad.x + 8, pad.y + 13);
            ctx.restore();
        }

        // 3. Draw Drop Zone
        const dz = this.currentMission.dropZone;
        if (dz) {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#00ff88';
            ctx.shadowBlur = 16;
            ctx.fillRect(dz.x, dz.y, dz.w, dz.h);
            ctx.strokeRect(dz.x, dz.y, dz.w, dz.h);

            // Drop zone beacon pulse beam
            const pulse = (Math.sin(this.laserTime * 3) + 1) / 2;
            const beamGrad = ctx.createLinearGradient(0, dz.y - 120, 0, dz.y);
            beamGrad.addColorStop(0, 'rgba(0, 255, 136, 0)');
            beamGrad.addColorStop(1, `rgba(0, 255, 136, ${0.15 + pulse * 0.2})`);
            ctx.fillStyle = beamGrad;
            ctx.fillRect(dz.x, dz.y - 120, dz.w, 120);

            // Landing Crosshairs
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 2;
            ctx.strokeRect(dz.x + dz.w / 2 - 15, dz.y + 2, 30, dz.h - 4);
            ctx.fillStyle = '#00ff88';
            ctx.font = 'bold 12px "Courier New", monospace';
            ctx.fillText(`TARGET: ${dz.label}`, dz.x + 10, dz.y + 16);
            ctx.restore();
        }

        // 4. Draw Laser Hazards
        const lasers = this.currentMission.lasers || [];
        for (const laser of lasers) {
            const range = laser.y2 - laser.y1;
            const laserY = laser.y1 + ((Math.sin(this.laserTime * laser.speed + laser.offset) + 1) / 2) * range;

            ctx.save();
            ctx.strokeStyle = '#ff0044';
            ctx.shadowColor = '#ff0044';
            ctx.shadowBlur = 18;
            ctx.lineWidth = 3;

            // Horizontal scanning beam
            ctx.beginPath();
            ctx.moveTo(laser.x - 70, laserY);
            ctx.lineTo(laser.x + 70, laserY);
            ctx.stroke();

            // Laser projector nodes
            ctx.fillStyle = '#ff0044';
            ctx.beginPath();
            ctx.arc(laser.x - 70, laserY, 4, 0, Math.PI * 2);
            ctx.arc(laser.x + 70, laserY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 5. Draw Cargo & Tether
        if (this.cargo) {
            this.cargo.render(ctx);
        }
        this.drone.renderTether(ctx);

        // 6. Draw Drone
        this.drone.render(ctx);

        // 7. Draw Particles & Weather FX
        this.particles.render(ctx);
    }

    renderNavBeacons(ctx) {
        // Off-screen indicator arrows on the edge of the screen
        const renderArrow = (worldPos, color, label) => {
            const screenX = worldPos.x - this.camera.x;
            const screenY = worldPos.y - this.camera.y;

            // If inside screen bounds, no need for radar arrow
            if (screenX >= 50 && screenX <= this.width - 50 && screenY >= 50 && screenY <= this.height - 50) {
                return;
            }

            // Clamp to screen edges
            const margin = 40;
            const cx = Math.max(margin, Math.min(this.width - margin, screenX));
            const cy = Math.max(margin, Math.min(this.height - margin, screenY));
            const angle = Math.atan2(screenY - this.height / 2, screenX - this.width / 2);

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);

            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;

            // Arrow triangle
            ctx.beginPath();
            ctx.moveTo(14, 0);
            ctx.lineTo(-8, -8);
            ctx.lineTo(-4, 0);
            ctx.lineTo(-8, 8);
            ctx.closePath();
            ctx.fill();

            ctx.restore();

            // Label text
            ctx.save();
            ctx.fillStyle = color;
            ctx.font = 'bold 11px monospace';
            ctx.fillText(label, cx - 20, cy + 22);
            ctx.restore();
        };

        // Draw beacon for Cargo if not picked up
        if (this.cargo && this.cargo.status === 'UNPICKED') {
            renderArrow(this.cargo.pos, '#ffaa00', 'CARGO');
        }

        // Draw beacon for Drop Zone
        const dz = this.currentMission.dropZone;
        if (dz) {
            renderArrow(new Vector2(dz.x + dz.w / 2, dz.y), '#00ff88', 'DROP PAD');
        }
    }
}

// Instantiate game on window load
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});

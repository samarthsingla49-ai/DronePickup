// ============================================================================
// CYBERDROP: NEO-TOKYO COURIER - Drone & Cargo Entities
// Cyberpunk vector rendering, dual-rotor physics, searchlights, cargo handling
// ============================================================================

import { Vector2, Tether, resolveBoxCollision } from './physics.js';

export class Drone {
    constructor(x, y) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2(0, 0);
        this.angle = 0;             // Radians (0 = upright)
        this.angularVel = 0;
        this.w = 46;
        this.h = 18;
        this.mass = 2.4;

        // Flight parameters
        this.thrustPower = 440;
        this.turnSpeed = 4.2;
        this.angularDamping = 0.91;
        this.drag = 0.985;
        this.gravity = 190;

        // Resources
        this.maxBattery = 100;
        this.battery = 100;
        this.maxHealth = 100;
        this.health = 100;
        this.isRecharging = false;

        // Visual animation states
        this.rotorSpin = 0;
        this.strobeTimer = 0;
        this.isThrusting = false;
        this.thrustIntensity = 0;

        // Grapple / Winch
        this.tether = new Tether(70, 190, 7.5);
        this.latchedCargo = null;
    }

    reset(x, y) {
        this.pos.set(x, y);
        this.vel.set(0, 0);
        this.angle = 0;
        this.angularVel = 0;
        this.battery = this.maxBattery;
        this.health = this.maxHealth;
        this.isRecharging = false;
        this.latchedCargo = null;
        this.tether.isActive = false;
        this.tether.restLength = 70;
        this.tether.targetLength = 70;
    }

    getAnchorPos() {
        // Grapple winch anchor point at bottom of drone chassis
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        return new Vector2(
            this.pos.x - sin * 10,
            this.pos.y + cos * 10
        );
    }

    applyControls(keys, dt, particles) {
        this.isThrusting = false;
        this.thrustIntensity = 0;

        // Disable control if battery dead or health zero
        if (this.battery <= 0 || this.health <= 0) return;

        // Tilt / Rotate
        if (keys['ArrowLeft'] || keys['KeyA']) {
            this.angularVel -= this.turnSpeed * dt;
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
            this.angularVel += this.turnSpeed * dt;
        }

        // Main Thrusters (Upward along drone's local vertical axis)
        if (keys['ArrowUp'] || keys['KeyW'] || keys['SpaceThrust']) {
            this.isThrusting = true;
            this.thrustIntensity = 1.0;

            // Thrust vector points opposite to drone local bottom
            // Angle 0: points up (0, -1)
            const thrustX = Math.sin(this.angle) * this.thrustPower;
            const thrustY = -Math.cos(this.angle) * this.thrustPower;

            this.vel.x += thrustX * dt;
            this.vel.y += thrustY * dt;

            // Deplete battery (slight increase when carrying cargo)
            const drainRate = this.latchedCargo ? 3.8 : 2.5;
            this.battery = Math.max(0, this.battery - drainRate * dt);

            // Particles for twin thrusters
            if (particles) {
                const cos = Math.cos(this.angle);
                const sin = Math.sin(this.angle);
                const leftX = this.pos.x - cos * 16 - sin * 4;
                const leftY = this.pos.y - sin * 16 + cos * 4;
                const rightX = this.pos.x + cos * 16 - sin * 4;
                const rightY = this.pos.y + sin * 16 + cos * 4;

                particles.spawnThrusterPlume(leftX, leftY, this.angle, 1.0);
                particles.spawnThrusterPlume(rightX, rightY, this.angle, 1.0);
                particles.spawnRotorDownwash(this.pos.x, this.pos.y, this.angle, 1.0);
            }
        }

        // Winch Controls
        if (keys['KeyQ'] || keys['WinchUp']) {
            this.tether.retract(dt);
        }
        if (keys['KeyE'] || keys['WinchDown']) {
            this.tether.extend(dt);
        }
    }

    updatePhysics(dt, windSystem, obstacles, particles, audio) {
        // Rotor animation
        const rotorSpeed = this.isThrusting ? 32 : 14;
        this.rotorSpin = (this.rotorSpin + rotorSpeed * dt * 20) % (Math.PI * 2);
        this.strobeTimer = (this.strobeTimer + dt) % 1.2;

        // Apply Gravity
        this.vel.y += this.gravity * dt;

        // Apply Wind
        const windForce = windSystem.getForceAt(this.pos);
        this.vel.x += (windForce.x / this.mass) * dt;

        // Angular integration & damping
        this.angle += this.angularVel * dt;
        this.angularVel *= Math.pow(this.angularDamping, dt * 60);

        // Clamp extreme tilt angle to help player recover
        this.angle = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, this.angle));

        // Self-stabilizing upright torque
        this.angularVel -= this.angle * 2.8 * dt;

        // Update Tether physics if cargo is latched
        if (this.latchedCargo && this.tether.isActive) {
            const anchor = this.getAnchorPos();
            const cargoAnchor = this.latchedCargo.getAnchorPos();

            const forces = this.tether.update(
                anchor,
                this.vel,
                cargoAnchor,
                this.latchedCargo.vel,
                this.mass,
                this.latchedCargo.mass,
                dt
            );

            // Apply tether force to drone
            this.vel.x += (forces.droneForce.x / this.mass) * dt;
            this.vel.y += (forces.droneForce.y / this.mass) * dt;

            // Apply tether force to cargo
            this.latchedCargo.vel.x += (forces.cargoForce.x / this.latchedCargo.mass) * dt;
            this.latchedCargo.vel.y += (forces.cargoForce.y / this.latchedCargo.mass) * dt;
        }

        // Velocity drag & Integration
        this.vel.x *= Math.pow(this.drag, dt * 60);
        this.vel.y *= Math.pow(this.drag, dt * 60);

        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;

        // Collision detection against building obstacles
        const bodyObj = { pos: this.pos, vel: this.vel, w: this.w, h: this.h };
        for (const obs of obstacles) {
            const col = resolveBoxCollision(bodyObj, obs, 0.25, 0.85);
            if (col && col.impactSpeed > 70) {
                // Hard collision damage
                const damage = (col.impactSpeed - 70) * 0.18;
                this.health = Math.max(0, this.health - damage);
                
                if (particles) {
                    particles.spawnSparks(this.pos.x, this.pos.y, '#00f0ff', 16);
                }
                if (audio) {
                    audio.playCrash();
                }
            }
        }
    }

    tryLatch(cargo, audio, particles) {
        if (this.latchedCargo || !cargo || cargo.status === 'DELIVERED') return false;

        const anchor = this.getAnchorPos();
        const cargoAnchor = cargo.getAnchorPos();
        const dist = anchor.dist(cargoAnchor);

        // Can latch if close enough
        if (dist <= this.tether.maxLength + 15) {
            this.latchedCargo = cargo;
            cargo.status = 'LATCHED';
            this.tether.isActive = true;
            this.tether.targetLength = Math.max(this.tether.minLength, Math.min(this.tether.maxLength, dist));
            this.tether.restLength = this.tether.targetLength;

            if (audio) audio.playLatch();
            if (particles) particles.spawnSparks(cargoAnchor.x, cargoAnchor.y, '#00ff88', 20);
            return true;
        }
        return false;
    }

    releaseCargo(audio) {
        if (!this.latchedCargo) return;
        this.latchedCargo.status = 'UNPICKED';
        this.latchedCargo = null;
        this.tether.isActive = false;
        if (audio) audio.playRelease();
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        // 1. Headlight Searchlight Beam
        const grad = ctx.createRadialGradient(0, 8, 4, 0, 160, 90);
        grad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
        grad.addColorStop(0.5, 'rgba(0, 240, 255, 0.12)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-6, 8);
        ctx.lineTo(-70, 180);
        ctx.lineTo(70, 180);
        ctx.lineTo(6, 8);
        ctx.closePath();
        ctx.fill();

        // 2. Drone Rotor Arms
        ctx.strokeStyle = '#445566';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-22, -2);
        ctx.lineTo(22, -2);
        ctx.stroke();

        // Rotor Mounts
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-23, -6, 5, 5);
        ctx.fillRect(18, -6, 5, 5);

        // 3. Spinning Propellers (Dual Rotor)
        const bladeW = Math.cos(this.rotorSpin) * 18;
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;

        // Left Rotor
        ctx.beginPath();
        ctx.ellipse(-20, -7, Math.abs(bladeW) + 2, 2.5, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Right Rotor
        ctx.beginPath();
        ctx.ellipse(20, -7, Math.abs(bladeW) + 2, 2.5, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 4. Drone Central Chassis
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ff0077';
        ctx.fillStyle = '#111520';
        ctx.strokeStyle = '#ff0077';
        ctx.lineWidth = 2;

        // Sleek aerodynamic hexagonal pod
        ctx.beginPath();
        ctx.moveTo(-16, -4);
        ctx.lineTo(16, -4);
        ctx.lineTo(12, 8);
        ctx.lineTo(-12, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cockpit AI Core / Neon Visor
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // 5. Navigation Strobe Light
        const strobeColor = this.strobeTimer < 0.2 ? '#00ff66' : '#ff0044';
        ctx.fillStyle = strobeColor;
        ctx.shadowColor = strobeColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, -5, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // 6. Winch Anchor Socket
        ctx.fillStyle = '#ffea00';
        ctx.fillRect(-3, 8, 6, 4);

        ctx.restore();
    }

    renderTether(ctx) {
        if (!this.latchedCargo || !this.tether.isActive) return;

        const anchor = this.getAnchorPos();
        const cargoAnchor = this.latchedCargo.getAnchorPos();

        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 6;
        ctx.lineWidth = 2.2;

        // Draw segmented cable with tension sag/pulse
        ctx.beginPath();
        ctx.moveTo(anchor.x, anchor.y);

        // Midpoint sag based on slack
        const midX = (anchor.x + cargoAnchor.x) / 2;
        const dist = anchor.dist(cargoAnchor);
        const slack = Math.max(0, this.tether.restLength - dist);
        const midY = (anchor.y + cargoAnchor.y) / 2 + slack * 0.45;

        ctx.quadraticCurveTo(midX, midY, cargoAnchor.x, cargoAnchor.y);
        ctx.stroke();

        // Glowing magnetic grapple clamp at cargo
        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(cargoAnchor.x, cargoAnchor.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ----------------------------------------------------------------------------
// Cargo Entity
// ----------------------------------------------------------------------------
export class Cargo {
    constructor(x, y, type = 'STANDARD') {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2(0, 0);
        this.angle = 0;
        this.angularVel = 0;
        this.w = 26;
        this.h = 26;
        this.mass = 1.6;

        this.type = type; // STANDARD, PLASMA, QUANTUM
        this.status = 'UNPICKED'; // UNPICKED, LATCHED, DELIVERED, DESTROYED
        this.integrity = 100;
        this.value = 1000;

        // Configure by cargo type
        if (type === 'PLASMA') {
            this.mass = 2.2;
            this.value = 1800;
            this.color = '#ff0055';
            this.label = 'PLASMA CORE';
        } else if (type === 'QUANTUM') {
            this.mass = 1.3;
            this.value = 2500;
            this.color = '#b026ff';
            this.label = 'QUANTUM DATA';
        } else {
            this.color = '#ffaa00';
            this.label = 'CYBER COURIER';
        }
    }

    getAnchorPos() {
        return new Vector2(this.pos.x, this.pos.y - this.h / 2);
    }

    updatePhysics(dt, windSystem, obstacles, particles, audio) {
        if (this.status === 'DELIVERED') return;

        // Gravity
        this.vel.y += 180 * dt;

        // Wind affects cargo depending on mass
        const wind = windSystem.getForceAt(this.pos);
        this.vel.x += (wind.x / this.mass) * 0.6 * dt;

        // Drag
        this.vel.x *= Math.pow(0.985, dt * 60);
        this.vel.y *= Math.pow(0.985, dt * 60);

        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;

        // Collisions with obstacles
        const bodyObj = { pos: this.pos, vel: this.vel, w: this.w, h: this.h };
        for (const obs of obstacles) {
            const col = resolveBoxCollision(bodyObj, obs, 0.15, 0.85);
            if (col && col.impactSpeed > 65) {
                const dmg = (col.impactSpeed - 65) * 0.22;
                this.integrity = Math.max(0, this.integrity - dmg);

                if (particles) {
                    particles.spawnSparks(this.pos.x, this.pos.y, this.color, 10);
                }
                if (audio) {
                    audio.playCrash();
                }

                if (this.integrity <= 0) {
                    this.status = 'DESTROYED';
                }
            }
        }
    }

    render(ctx) {
        if (this.status === 'DELIVERED') return;

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        // Container Shadow & Glow
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.status === 'LATCHED' ? 14 : 6;
        ctx.fillStyle = '#0f1422';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2.2;

        // Main Box
        ctx.beginPath();
        ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 4);
        ctx.fill();
        ctx.stroke();

        // Hazard Stripes / Neon Accents
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-this.w / 2 + 4, -this.h / 2 + 4);
        ctx.lineTo(this.w / 2 - 4, this.h / 2 - 4);
        ctx.moveTo(-this.w / 2 + 4, this.h / 2 - 4);
        ctx.lineTo(this.w / 2 - 4, -this.h / 2 + 4);
        ctx.stroke();

        // Top Magnetic Latch Node
        ctx.fillStyle = this.status === 'LATCHED' ? '#00ff88' : '#ffffff';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.fillRect(-4, -this.h / 2 - 3, 8, 4);

        // Integrity Bar on cargo if damaged
        if (this.integrity < 100) {
            ctx.fillStyle = '#ff0044';
            ctx.fillRect(-this.w / 2, this.h / 2 + 4, this.w, 3);
            ctx.fillStyle = '#00ff88';
            ctx.fillRect(-this.w / 2, this.h / 2 + 4, (this.w * this.integrity) / 100, 3);
        }

        ctx.restore();
    }
}

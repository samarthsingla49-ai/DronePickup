// ============================================================================
// CYBERDROP: NEO-TOKYO COURIER - Particle & Visual FX System
// Rotor wash, Thruster plasma, Collision sparks, Delivery shockwaves, Cyber rain
// ============================================================================

export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.shockwaves = [];
        this.rainDrops = [];
        this.maxParticles = 600;
    }

    reset() {
        this.particles = [];
        this.shockwaves = [];
        this.rainDrops = [];
    }

    initRain(width, height, count = 120) {
        this.rainDrops = [];
        for (let i = 0; i < count; i++) {
            this.rainDrops.push({
                x: Math.random() * width,
                y: Math.random() * height,
                length: 12 + Math.random() * 14,
                speedY: 550 + Math.random() * 250,
                speedX: -80, // Angle with wind
                alpha: 0.2 + Math.random() * 0.4
            });
        }
    }

    update(dt, windForce = 0, bounds = { w: 2000, h: 1200 }) {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx += (p.ax || 0) * dt;
            p.vy += (p.ay || 0) * dt;
            p.size = Math.max(0, p.size + (p.sizeChange || 0) * dt);
        }

        // Update shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.radius += sw.speed * dt;
            sw.alpha -= sw.decay * dt;
            if (sw.alpha <= 0) {
                this.shockwaves.splice(i, 1);
            }
        }

        // Update rain
        for (const drop of this.rainDrops) {
            drop.y += drop.speedY * dt;
            drop.x += (drop.speedX + windForce * 2.5) * dt;
            if (drop.y > bounds.h) {
                drop.y = -20;
                drop.x = Math.random() * bounds.w;
            }
            if (drop.x < 0) drop.x = bounds.w;
            if (drop.x > bounds.w) drop.x = 0;
        }
    }

    spawnThrusterPlume(x, y, angle, power = 1.0) {
        if (this.particles.length >= this.maxParticles) return;
        const count = Math.floor(2 + power * 3);
        const backAngle = angle + Math.PI / 2; // Opposite to drone top

        for (let i = 0; i < count; i++) {
            const spread = (Math.random() - 0.5) * 0.45;
            const speed = (120 + Math.random() * 160) * power;
            const pAngle = backAngle + spread;

            this.particles.push({
                x: x + (Math.random() - 0.5) * 6,
                y: y + (Math.random() - 0.5) * 4,
                vx: Math.cos(pAngle) * speed,
                vy: Math.sin(pAngle) * speed,
                ax: 0,
                ay: 60,
                size: 3.5 + Math.random() * 3,
                sizeChange: -4,
                color: Math.random() > 0.4 ? '#00f0ff' : '#ff0077', // Cyan / Magenta plasma
                life: 0.18 + Math.random() * 0.12,
                maxLife: 0.3,
                glow: true
            });
        }
    }

    spawnRotorDownwash(x, y, angle, power = 1.0) {
        if (this.particles.length >= this.maxParticles || Math.random() > 0.45) return;
        const downAngle = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.6;
        const speed = 90 + Math.random() * 120 * power;

        this.particles.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y,
            vx: Math.cos(downAngle) * speed,
            vy: Math.sin(downAngle) * speed,
            ax: 0,
            ay: 80,
            size: 2,
            sizeChange: -1,
            color: 'rgba(0, 240, 255, 0.4)',
            life: 0.22,
            maxLife: 0.22,
            glow: false
        });
    }

    spawnSparks(x, y, color = '#ffea00', count = 14) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 70 + Math.random() * 220;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                ax: 0,
                ay: 250, // Gravity pulls sparks down
                size: 2.2 + Math.random() * 1.8,
                sizeChange: -2.0,
                color: color,
                life: 0.3 + Math.random() * 0.3,
                maxLife: 0.6,
                glow: true
            });
        }
    }

    spawnCelebration(x, y) {
        // Neon confetti burst
        const colors = ['#00f0ff', '#ff0077', '#ffff00', '#00ff88', '#b026ff'];
        for (let i = 0; i < 70; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 320;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 60,
                ax: 0,
                ay: 280,
                size: 3 + Math.random() * 3,
                sizeChange: -1.2,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 0.8 + Math.random() * 0.6,
                maxLife: 1.4,
                glow: true
            });
        }

        // Expanding shockwave rings
        this.shockwaves.push({
            x,
            y,
            radius: 10,
            speed: 280,
            color: '#00ff88',
            lineWidth: 4,
            alpha: 1.0,
            decay: 1.6
        });
        this.shockwaves.push({
            x,
            y,
            radius: 5,
            speed: 190,
            color: '#00f0ff',
            lineWidth: 2,
            alpha: 0.9,
            decay: 1.2
        });
    }

    render(ctx) {
        ctx.save();

        // 1. Render rain
        if (this.rainDrops.length > 0) {
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (const drop of this.rainDrops) {
                ctx.moveTo(drop.x, drop.y);
                ctx.lineTo(drop.x + drop.speedX * 0.03, drop.y + drop.length);
            }
            ctx.stroke();
        }

        // 2. Render shockwaves
        for (const sw of this.shockwaves) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, sw.alpha);
            ctx.strokeStyle = sw.color;
            ctx.lineWidth = sw.lineWidth;
            ctx.shadowColor = sw.color;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 3. Render particles with glow
        for (const p of this.particles) {
            ctx.save();
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;

            if (p.glow) {
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 8;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }
}

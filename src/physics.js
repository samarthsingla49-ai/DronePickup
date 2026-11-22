// ============================================================================
// CYBERDROP: NEO-TOKYO COURIER - Physics Engine
// Vector math, Rigid Body, Elastic Tether Winch, Dynamic Wind & Collisions
// ============================================================================

export class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    clone() {
        return new Vector2(this.x, this.y);
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    mult(s) {
        this.x *= s;
        this.y *= s;
        return this;
    }

    div(s) {
        if (s !== 0) {
            this.x /= s;
            this.y /= s;
        }
        return this;
    }

    magSq() {
        return this.x * this.x + this.y * this.y;
    }

    mag() {
        return Math.sqrt(this.magSq());
    }

    norm() {
        const m = this.mag();
        if (m > 0) this.div(m);
        return this;
    }

    heading() {
        return Math.atan2(this.y, this.x);
    }

    dist(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    static add(v1, v2) {
        return new Vector2(v1.x + v2.x, v1.y + v2.y);
    }

    static sub(v1, v2) {
        return new Vector2(v1.x - v2.x, v1.y - v2.y);
    }

    static mult(v, s) {
        return new Vector2(v.x * s, v.y * s);
    }

    static dist(v1, v2) {
        return v1.dist(v2);
    }
}

// ----------------------------------------------------------------------------
// Elastic Tether / Winch Physics
// ----------------------------------------------------------------------------
export class Tether {
    constructor(restLength = 80, stiffness = 160, damping = 7.0) {
        this.restLength = restLength;
        this.targetLength = restLength;
        this.minLength = 35;
        this.maxLength = 180;
        this.stiffness = stiffness; // Hooke's spring constant
        this.damping = damping;     // Velocity damper
        this.isActive = false;      // Latched to cargo?
        this.winchSpeed = 45;       // Extension/retraction speed per sec
        this.tension = 0;           // Current tensile force magnitude
    }

    extend(dt) {
        this.targetLength = Math.min(this.maxLength, this.targetLength + this.winchSpeed * dt);
    }

    retract(dt) {
        this.targetLength = Math.max(this.minLength, this.targetLength - this.winchSpeed * dt);
    }

    update(dronePos, droneVel, cargoPos, cargoVel, droneMass, cargoMass, dt) {
        // Smoothly adjust current restLength towards target winch setting
        this.restLength += (this.targetLength - this.restLength) * Math.min(1.0, 5.0 * dt);

        if (!this.isActive) {
            this.tension = 0;
            return { droneForce: new Vector2(), cargoForce: new Vector2() };
        }

        // Vector from drone anchor to cargo anchor
        const delta = Vector2.sub(cargoPos, dronePos);
        const currentDist = delta.mag();
        if (currentDist === 0) return { droneForce: new Vector2(), cargoForce: new Vector2() };

        const dir = delta.clone().norm();

        // Ropes only pull (tension), they never push under compression
        if (currentDist > this.restLength) {
            const stretch = currentDist - this.restLength;
            
            // Relative velocity
            const relVel = Vector2.sub(cargoVel, droneVel);
            const dampForce = relVel.dot(dir) * this.damping;

            const springMag = (stretch * this.stiffness) + dampForce;
            this.tension = Math.max(0, springMag);

            // Pull drone toward cargo (+dir) and cargo toward drone (-dir)
            const forceOnDrone = Vector2.mult(dir, this.tension);
            const forceOnCargo = Vector2.mult(dir, -this.tension);

            return { droneForce: forceOnDrone, cargoForce: forceOnCargo };
        } else {
            this.tension = 0;
            return { droneForce: new Vector2(), cargoForce: new Vector2() };
        }
    }
}

// ----------------------------------------------------------------------------
// Wind & Atmospheric System
// ----------------------------------------------------------------------------
export class WindSystem {
    constructor() {
        this.baseSpeed = 0;
        this.currentSpeed = 0;
        this.gustFrequency = 0.5;
        this.gustAmplitude = 0;
        this.time = 0;
    }

    configure(baseSpeed, gustAmplitude, gustFrequency = 0.5) {
        this.baseSpeed = baseSpeed;
        this.gustAmplitude = gustAmplitude;
        this.gustFrequency = gustFrequency;
        this.currentSpeed = baseSpeed;
    }

    update(dt) {
        this.time += dt;
        // Natural gust oscillation with multiple frequencies
        const gust = Math.sin(this.time * this.gustFrequency) * 0.7 
                   + Math.sin(this.time * this.gustFrequency * 2.3) * 0.3;
        this.currentSpeed = this.baseSpeed + gust * this.gustAmplitude;
    }

    getForceAt(pos) {
        // Vertical altitude slightly increases wind speed
        const altitudeFactor = 1.0 + Math.max(0, (600 - pos.y) / 600) * 0.3;
        return new Vector2(this.currentSpeed * altitudeFactor, 0);
    }
}

// ----------------------------------------------------------------------------
// Collision Utilities
// ----------------------------------------------------------------------------
export function checkAABB(b1, b2) {
    return (
        b1.x < b2.x + b2.w &&
        b1.x + b1.w > b2.x &&
        b1.y < b2.y + b2.h &&
        b1.y + b1.h > b2.y
    );
}

export function resolveBoxCollision(body, obstacle, restitution = 0.25, friction = 0.85) {
    // Body is { pos: Vector2, vel: Vector2, w: number, h: number }
    // Obstacle is { x, y, w, h }
    const bLeft = body.pos.x - body.w / 2;
    const bRight = body.pos.x + body.w / 2;
    const bTop = body.pos.y - body.h / 2;
    const bBottom = body.pos.y + body.h / 2;

    const oLeft = obstacle.x;
    const oRight = obstacle.x + obstacle.w;
    const oTop = obstacle.y;
    const oBottom = obstacle.y + obstacle.h;

    if (bRight <= oLeft || bLeft >= oRight || bBottom <= oTop || bTop >= oBottom) {
        return null; // No collision
    }

    // Overlaps
    const overlapLeft = bRight - oLeft;
    const overlapRight = oRight - bLeft;
    const overlapTop = bBottom - oTop;
    const overlapBottom = oBottom - bTop;

    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
    let normal = new Vector2(0, 0);
    let impactSpeed = 0;

    if (minOverlap === overlapTop) {
        // Collided with top surface of obstacle
        normal.set(0, -1);
        body.pos.y -= overlapTop;
        impactSpeed = Math.abs(body.vel.y);
        body.vel.y = -body.vel.y * restitution;
        body.vel.x *= friction;
    } else if (minOverlap === overlapBottom) {
        // Collided with bottom surface
        normal.set(0, 1);
        body.pos.y += overlapBottom;
        impactSpeed = Math.abs(body.vel.y);
        body.vel.y = -body.vel.y * restitution;
        body.vel.x *= friction;
    } else if (minOverlap === overlapLeft) {
        // Collided with left surface
        normal.set(-1, 0);
        body.pos.x -= overlapLeft;
        impactSpeed = Math.abs(body.vel.x);
        body.vel.x = -body.vel.x * restitution;
        body.vel.y *= friction;
    } else {
        // Collided with right surface
        normal.set(1, 0);
        body.pos.x += overlapRight;
        impactSpeed = Math.abs(body.vel.x);
        body.vel.x = -body.vel.x * restitution;
        body.vel.y *= friction;
    }

    return { normal, impactSpeed };
}

// ============================================================================
// CYBERDROP: NEO-TOKYO COURIER - Interactive Sector Map & Story System
// Holographic vector city map, campaign nodes, radar sweep, narrative dispatch
// ============================================================================

export class SectorMap {
    constructor(game) {
        this.game = game;
        this.canvas = document.getElementById('mapCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        this.radarAngle = 0;
        this.dataPackets = [];
        this.selectedSector = 0; // 0, 1, 2
        this.hoveredSector = null;

        // Sector Node coordinates on the holographic map (relative 0..1 scale)
        this.nodes = [
            {
                id: 0,
                name: "SECTOR 01: DISTRICT 7",
                codename: "DEPOT ALPHA",
                xRatio: 0.22,
                yRatio: 0.62,
                cargo: "STANDARD CYBER BOX",
                danger: "LOW // ROOKIE AIRSPACE",
                lore: "Dense commercial skyscrapers with moderate building density. The local syndicate requires urgent delivery of cyberware components from rooftop Depot A to Pad Alpha."
            },
            {
                id: 1,
                name: "SECTOR 02: NEON CANYON",
                codename: "VERTEX SPIRES",
                xRatio: 0.52,
                yRatio: 0.38,
                cargo: "VOLATILE PLASMA CORE",
                danger: "MODERATE // HIGH CROSSWINDS",
                lore: "A treacherous wind alley carved between corporate mega-spires. Plasma energy cores are highly unstable: high mass and severe pendulum swing risk rupture if buffeted into spires."
            },
            {
                id: 2,
                name: "SECTOR 03: OMEGA MEGAPLEX",
                codename: "THE ARCOLOGY",
                xRatio: 0.82,
                yRatio: 0.52,
                cargo: "QUANTUM DATA VAULT",
                danger: "CRITICAL // ACID STORM & LASERS",
                lore: "The heavily fortified corporate core. Under a Category-4 cybernetic storm, orbital security scan lasers sweep the rooftops. Deliver the ultra-fragile quantum core before battery expires."
            }
        ];

        this.initPackets();
    }

    initPackets() {
        this.dataPackets = [];
        // Moving light pulses along the conduits connecting Sector 0 -> 1 -> 2
        for (let i = 0; i < 8; i++) {
            this.dataPackets.push({
                segment: i % 2, // 0 = node0->node1, 1 = node1->node2
                progress: Math.random(),
                speed: 0.25 + Math.random() * 0.3
            });
        }
    }

    resize() {
        if (!this.canvas) return;
        const container = document.getElementById('screen-map');
        if (!container) return;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        this.canvas.width = w;
        this.canvas.height = h;
    }

    update(dt) {
        this.radarAngle = (this.radarAngle + dt * 1.2) % (Math.PI * 2);

        // Update data packets traveling along conduits
        for (const pkt of this.dataPackets) {
            pkt.progress += pkt.speed * dt;
            if (pkt.progress > 1) {
                pkt.progress = 0;
            }
        }
    }

    getUnlockedCount() {
        try {
            return parseInt(localStorage.getItem('cyberdrop_unlocked_sector') || '1', 10);
        } catch (e) {
            return 1;
        }
    }

    unlockNextSector(completedSectorId) {
        try {
            const current = this.getUnlockedCount();
            if (completedSectorId + 2 > current) {
                const nextUnlocked = Math.min(3, completedSectorId + 2);
                localStorage.setItem('cyberdrop_unlocked_sector', nextUnlocked.toString());
            }
        } catch (e) {
            // no-op
        }
    }

    getMissionGrade(sectorId) {
        try {
            return localStorage.getItem(`cyberdrop_grade_${sectorId}`) || null;
        } catch (e) {
            return null;
        }
    }

    saveMissionGrade(sectorId, grade, score) {
        try {
            localStorage.setItem(`cyberdrop_grade_${sectorId}`, grade);
            const prevBest = parseInt(localStorage.getItem(`cyberdrop_best_${sectorId}`) || '0', 10);
            if (score > prevBest) {
                localStorage.setItem(`cyberdrop_best_${sectorId}`, score.toString());
            }
        } catch (e) {
            // no-op
        }
    }

    render() {
        if (!this.canvas || !this.ctx) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        // 1. Dark holographic map backdrop & hex grid
        ctx.fillStyle = '#080c16';
        ctx.fillRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
        ctx.lineWidth = 1;
        const gridSize = 45;
        for (let x = 0; x < w; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // 2. City District Outlines (Stylized holographic territory shapes)
        this.renderDistrictPolygons(ctx, w, h);

        // 3. Conduits / Flight paths connecting sectors
        this.renderFlightConduits(ctx, w, h);

        // 4. Rotating radar sweep from central relay
        const centerX = w * 0.52;
        const centerY = h * 0.48;
        const radarRadius = Math.min(w, h) * 0.45;

        ctx.save();
        ctx.translate(centerX, centerY);
        const sweepGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, radarRadius);
        sweepGrad.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
        sweepGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');

        ctx.fillStyle = sweepGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radarRadius, this.radarAngle, this.radarAngle + 0.4);
        ctx.closePath();
        ctx.fill();

        // Concentric radar circles
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
        ctx.lineWidth = 1;
        for (let r = 80; r < radarRadius; r += 90) {
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();

        // 5. Render Sector Nodes
        this.renderNodes(ctx, w, h);
    }

    renderDistrictPolygons(ctx, w, h) {
        // District boundaries in stylized neon
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
        ctx.fillStyle = 'rgba(0, 240, 255, 0.02)';
        ctx.lineWidth = 1.5;

        // Sector 1 District Territory
        ctx.beginPath();
        ctx.moveTo(w * 0.10, h * 0.45);
        ctx.lineTo(w * 0.35, h * 0.42);
        ctx.lineTo(w * 0.38, h * 0.82);
        ctx.lineTo(w * 0.14, h * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Sector 2 District Territory
        ctx.strokeStyle = 'rgba(255, 0, 119, 0.18)';
        ctx.fillStyle = 'rgba(255, 0, 119, 0.02)';
        ctx.beginPath();
        ctx.moveTo(w * 0.40, h * 0.20);
        ctx.lineTo(w * 0.65, h * 0.18);
        ctx.lineTo(w * 0.68, h * 0.60);
        ctx.lineTo(w * 0.42, h * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Sector 3 District Territory
        ctx.strokeStyle = 'rgba(176, 38, 255, 0.22)';
        ctx.fillStyle = 'rgba(176, 38, 255, 0.03)';
        ctx.beginPath();
        ctx.moveTo(w * 0.70, h * 0.32);
        ctx.lineTo(w * 0.94, h * 0.30);
        ctx.lineTo(w * 0.96, h * 0.75);
        ctx.lineTo(w * 0.72, h * 0.78);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    renderFlightConduits(ctx, w, h) {
        const unlockedCount = this.getUnlockedCount();

        const drawSegment = (n1, n2, isUnlocked, segIdx) => {
            const x1 = n1.xRatio * w;
            const y1 = n1.yRatio * h;
            const x2 = n2.xRatio * w;
            const y2 = n2.yRatio * h;

            // Conduit line
            ctx.save();
            ctx.strokeStyle = isUnlocked ? 'rgba(0, 255, 136, 0.5)' : 'rgba(70, 80, 100, 0.3)';
            ctx.lineWidth = isUnlocked ? 3 : 1.5;
            ctx.setLineDash([8, 6]);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            // Curved bezier conduit
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2 - 40;
            ctx.quadraticCurveTo(cx, cy, x2, y2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Render animated light pulses along unlocked conduits
            if (isUnlocked) {
                for (const pkt of this.dataPackets) {
                    if (pkt.segment === segIdx) {
                        const t = pkt.progress;
                        // Quadratic bezier interpolation: (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
                        const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
                        const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;

                        ctx.fillStyle = '#00ff88';
                        ctx.shadowColor = '#00ff88';
                        ctx.shadowBlur = 10;
                        ctx.beginPath();
                        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
            ctx.restore();
        };

        drawSegment(this.nodes[0], this.nodes[1], unlockedCount >= 2, 0);
        drawSegment(this.nodes[1], this.nodes[2], unlockedCount >= 3, 1);
    }

    renderNodes(ctx, w, h) {
        const unlockedCount = this.getUnlockedCount();

        this.nodes.forEach((node) => {
            const nx = node.xRatio * w;
            const ny = node.yRatio * h;
            const isUnlocked = node.id < unlockedCount;
            const isSelected = this.selectedSector === node.id;
            const grade = this.getMissionGrade(node.id);

            ctx.save();
            ctx.translate(nx, ny);

            // Pulsing outer ring
            const pulse = (Math.sin(this.radarAngle * 3 + node.id) + 1) / 2;
            const ringColor = isUnlocked ? (isSelected ? '#ffea00' : '#00f0ff') : '#445566';

            ctx.strokeStyle = ringColor;
            ctx.shadowColor = ringColor;
            ctx.shadowBlur = isSelected ? 20 : 10;
            ctx.lineWidth = isSelected ? 3 : 1.8;

            ctx.beginPath();
            ctx.arc(0, 0, 24 + pulse * 4, 0, Math.PI * 2);
            ctx.stroke();

            // Inner circle
            ctx.fillStyle = isUnlocked ? (isSelected ? '#201808' : '#0a1624') : '#10141c';
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.fill();

            // Center Symbol: Number or Lock
            ctx.fillStyle = ringColor;
            ctx.font = 'bold 13px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (isUnlocked) {
                ctx.fillText(`0${node.id + 1}`, 0, 0);
            } else {
                ctx.fillText('🔒', 0, 0);
            }

            // Grade / Stars badge if cleared
            if (grade) {
                ctx.fillStyle = '#00ff88';
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText(`★ ${grade}`, 0, 36);
            } else if (isUnlocked) {
                ctx.fillStyle = '#ffea00';
                ctx.font = 'bold 9px sans-serif';
                ctx.fillText('OPEN', 0, 36);
            }

            // Node Title Pill
            ctx.fillStyle = isSelected ? '#ffea00' : (isUnlocked ? '#00f0ff' : '#667788');
            ctx.font = 'bold 12px "Courier New", monospace';
            ctx.fillText(node.codename, 0, -32);

            ctx.restore();
        });
    }

    selectNodeAt(screenX, screenY) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const unlockedCount = this.getUnlockedCount();

        for (const node of this.nodes) {
            const nx = node.xRatio * w;
            const ny = node.yRatio * h;
            const dist = Math.hypot(screenX - nx, screenY - ny);

            if (dist <= 35) {
                this.selectedSector = node.id;
                this.updateDetailPanel();
                return node;
            }
        }
        return null;
    }

    updateDetailPanel() {
        const node = this.nodes[this.selectedSector];
        const unlockedCount = this.getUnlockedCount();
        const isUnlocked = node.id < unlockedCount;
        const grade = this.getMissionGrade(node.id);

        const titleEl = document.getElementById('map-detail-title');
        const codeEl = document.getElementById('map-detail-code');
        const cargoEl = document.getElementById('map-detail-cargo');
        const dangerEl = document.getElementById('map-detail-danger');
        const loreEl = document.getElementById('map-detail-lore');
        const launchBtn = document.getElementById('map-launch-btn');
        const gradeBadge = document.getElementById('map-detail-grade');

        if (titleEl) titleEl.textContent = node.name;
        if (codeEl) codeEl.textContent = node.codename;
        if (cargoEl) cargoEl.textContent = node.cargo;
        if (dangerEl) dangerEl.textContent = node.danger;
        if (loreEl) loreEl.textContent = node.lore;

        if (gradeBadge) {
            if (grade) {
                gradeBadge.textContent = `CLEARED // RATING: ${grade}`;
                gradeBadge.className = 'grade-tag cleared';
            } else if (isUnlocked) {
                gradeBadge.textContent = 'STATUS: CONTRACT AVAILABLE';
                gradeBadge.className = 'grade-tag available';
            } else {
                gradeBadge.textContent = 'STATUS: AIRSPACE LOCKED';
                gradeBadge.className = 'grade-tag locked';
            }
        }

        if (launchBtn) {
            if (isUnlocked) {
                launchBtn.disabled = false;
                launchBtn.textContent = 'DEPLOY TO SECTOR';
                launchBtn.classList.remove('disabled');
            } else {
                launchBtn.disabled = true;
                launchBtn.textContent = 'LOCKED (CLEAR PRIOR SECTOR)';
                launchBtn.classList.add('disabled');
            }
        }
    }
}

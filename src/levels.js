// ============================================================================
// CYBERDROP: NEO-TOKYO COURIER - Level & Mission Design
// City skylines, dropzones, recharge stations, hazard lasers, dynamic weather
// ============================================================================

export const MISSIONS = [
    {
        id: 1,
        title: "DISTRICT 7: THE ROOKIE DROP",
        codename: "OPERATION: FIRST FLIGHT",
        briefing: "Welcome to Neo-Tokyo logistics, Courier. Retrieve the standard Cyber-Courier package from the high-rise depot and deliver it safely to Drop Pad Alpha. Watch your tilt and use minimal throttle to conserve battery.",
        droneStart: { x: 120, y: 380 },
        cargo: { x: 260, y: 440, type: 'STANDARD' },
        dropZone: { x: 1250, y: 420, w: 140, h: 25, label: "PAD ALPHA" },
        timeLimit: 75,
        targetScore: 2500,
        weather: {
            windBase: 8,
            windGust: 15,
            windFreq: 0.4,
            rain: false
        },
        rechargePads: [
            { x: 740, y: 340, w: 90, h: 18, label: "SOLAR RECHARGE" }
        ],
        obstacles: [
            // Ground & Boundaries
            { x: 0, y: 640, w: 1600, h: 100, color: '#1a1f33', label: "STREET LEVEL" },
            { x: -50, y: 0, w: 50, h: 700, color: '#111422' },
            { x: 1550, y: 0, w: 50, h: 700, color: '#111422' },

            // Skyscraper Blocks
            { x: 80, y: 420, w: 130, h: 220, color: '#141829', neon: '#00f0ff', label: "DEPOT A" },
            { x: 230, y: 470, w: 150, h: 170, color: '#101426', neon: '#ff0077', label: "CARGO ROOF" },
            { x: 470, y: 260, w: 160, h: 380, color: '#181d33', neon: '#ffea00', label: "CYBERDYNE TOWER" },
            { x: 720, y: 360, w: 130, h: 280, color: '#141829', neon: '#00ff88', label: "STATION 09" },
            { x: 960, y: 290, w: 160, h: 350, color: '#191e36', neon: '#00f0ff', label: "NEO BANK" },
            { x: 1220, y: 445, w: 200, h: 195, color: '#12162a', neon: '#00ff66', label: "ALPHA PAD TERMINAL" }
        ],
        lasers: []
    },
    {
        id: 2,
        title: "NEON CANYON: TURBULENCE RUN",
        codename: "OPERATION: VOLATILE CARGO",
        briefing: "Heavy crosswinds detected between corporate spires. Your cargo is a volatile Plasma Core: high mass, severe swing inertia, and zero tolerance for collisions. Keep it stable or it explodes.",
        droneStart: { x: 120, y: 240 },
        cargo: { x: 280, y: 340, type: 'PLASMA' },
        dropZone: { x: 1380, y: 360, w: 130, h: 25, label: "PAD BETA" },
        timeLimit: 65,
        targetScore: 4000,
        weather: {
            windBase: -28,
            windGust: 38,
            windFreq: 0.65,
            rain: false
        },
        rechargePads: [
            { x: 820, y: 270, w: 90, h: 18, label: "FAST RECHARGE" }
        ],
        obstacles: [
            // Ground
            { x: 0, y: 640, w: 1700, h: 100, color: '#1a1f33', label: "ACID CANAL" },
            { x: -50, y: 0, w: 50, h: 700, color: '#111422' },
            { x: 1650, y: 0, w: 50, h: 700, color: '#111422' },

            // High Spires creating narrow alleys
            { x: 70, y: 280, w: 130, h: 360, color: '#141829', neon: '#00f0ff', label: "HANGAR 4" },
            { x: 240, y: 370, w: 140, h: 270, color: '#101426', neon: '#ff0055', label: "PLASMA LAB" },
            
            // Spires requiring high flight
            { x: 460, y: 190, w: 120, h: 450, color: '#181d33', neon: '#ff0077', label: "VERTEX HQ" },
            { x: 640, y: 340, w: 110, h: 300, color: '#141829', neon: '#ffea00', label: "PUMP STATION" },
            { x: 800, y: 290, w: 130, h: 350, color: '#181d33', neon: '#00ff88', label: "MID-POINT PAD" },
            { x: 1010, y: 170, w: 130, h: 470, color: '#13172e', neon: '#b026ff', label: "SHADOW MONOLITH" },
            { x: 1210, y: 290, w: 110, h: 350, color: '#15192d', neon: '#00f0ff', label: "RELAY 3" },
            { x: 1360, y: 385, w: 170, h: 255, color: '#101426', neon: '#00ff66', label: "BETA DROP BASE" }
        ],
        lasers: [
            { x: 580, y1: 200, y2: 440, speed: 1.8, offset: 0, vertical: true }
        ]
    },
    {
        id: 3,
        title: "CYBER-STORM: THE QUANTUM HEIST",
        codename: "OPERATION: MIDNIGHT SURGE",
        briefing: "Cat-4 Cyber Storm in effect. Torrential acid rain, shifting gale force winds, and active orbital security scan lasers. Transport the ultra-sensitive Quantum Data Vault across the city before time expires.",
        droneStart: { x: 100, y: 280 },
        cargo: { x: 240, y: 390, type: 'QUANTUM' },
        dropZone: { x: 1420, y: 280, w: 120, h: 25, label: "OMEGA BUNKER" },
        timeLimit: 55,
        targetScore: 6000,
        weather: {
            windBase: 35,
            windGust: 55,
            windFreq: 0.85,
            rain: true
        },
        rechargePads: [
            { x: 620, y: 240, w: 80, h: 18, label: "GRID TAP" },
            { x: 1080, y: 340, w: 80, h: 18, label: "EMERGENCY POWER" }
        ],
        obstacles: [
            // Ground
            { x: 0, y: 640, w: 1800, h: 100, color: '#1a1f33', label: "SUB-SECTOR ZERO" },
            { x: -50, y: 0, w: 50, h: 700, color: '#111422' },
            { x: 1750, y: 0, w: 50, h: 700, color: '#111422' },

            // Cyber City Canyon
            { x: 60, y: 320, w: 120, h: 320, color: '#141829', neon: '#b026ff' },
            { x: 210, y: 420, w: 130, h: 220, color: '#101426', neon: '#00f0ff', label: "VAULT ROOF" },
            { x: 410, y: 160, w: 130, h: 480, color: '#181d33', neon: '#ff0077', label: "KORP 1" },
            { x: 590, y: 260, w: 140, h: 380, color: '#141829', neon: '#00ff88', label: "CELL RECHARGE" },
            { x: 800, y: 130, w: 130, h: 510, color: '#101426', neon: '#ff0044', label: "NEXUS ARCOLOGY" },
            { x: 1050, y: 360, w: 140, h: 280, color: '#15192d', neon: '#ffea00' },
            { x: 1250, y: 210, w: 110, h: 430, color: '#181d33', neon: '#00f0ff' },
            { x: 1390, y: 305, w: 180, h: 335, color: '#12162a', neon: '#00ff66', label: "OMEGA RECEPTOR" }
        ],
        lasers: [
            { x: 400, y1: 170, y2: 380, speed: 2.2, offset: 0, vertical: true },
            { x: 790, y1: 140, y2: 420, speed: 2.8, offset: Math.PI, vertical: true },
            { x: 1240, y1: 220, y2: 460, speed: 2.4, offset: 1.5, vertical: true }
        ]
    }
];

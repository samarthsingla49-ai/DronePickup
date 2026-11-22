// ============================================================================
// CYBERDROP: NEO-TOKYO COURIER - Audio Synthesizer (Web Audio API)
// 100% Procedural Audio - Zero external files, zero CORS/network failure points.
// ============================================================================

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isMuted = false;
        this.isInitialized = false;

        // Active continuous sound nodes
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.engineGain = null;
        this.windGain = null;
        this.windFilter = null;

        // Cached audio buffers
        this.crashNoiseBuffer = null;

        // Music state
        this.musicPlaying = false;
        this.musicStep = 0;
        this.musicTimer = null;
    }

    init() {
        if (this.isInitialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            this._initEngineHum();
            this._initWindSound();
            this.isInitialized = true;
        } catch (e) {
            console.warn("Web Audio not supported or blocked:", e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime);
        }
        return this.isMuted;
    }

    // ------------------------------------------------------------------------
    // Continuous Sounds: Engine & Wind
    // ------------------------------------------------------------------------
    _initEngineHum() {
        if (!this.ctx) return;
        
        this.engineOsc1 = this.ctx.createOscillator();
        this.engineOsc2 = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();

        this.engineOsc1.type = 'sawtooth';
        this.engineOsc2.type = 'triangle';

        this.engineOsc1.frequency.setValueAtTime(65, this.ctx.currentTime);
        this.engineOsc2.frequency.setValueAtTime(130, this.ctx.currentTime);

        this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, this.ctx.currentTime);

        this.engineOsc1.connect(filter);
        this.engineOsc2.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);

        this.engineOsc1.start();
        this.engineOsc2.start();
    }

    _initWindSound() {
        if (!this.ctx) return;

        // Generate white noise buffer
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.frequency.setValueAtTime(400, this.ctx.currentTime);
        this.windFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

        this.windGain = this.ctx.createGain();
        this.windGain.gain.setValueAtTime(0.02, this.ctx.currentTime);

        whiteNoise.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.masterGain);

        whiteNoise.start();
    }

    updateEngineSound(throttleRatio, speedRatio) {
        if (!this.isInitialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Frequency scales with throttle + forward speed
        const targetFreq1 = 60 + throttleRatio * 85 + speedRatio * 35;
        const targetFreq2 = targetFreq1 * 2;
        const targetVol = 0.05 + throttleRatio * 0.25;

        this.engineOsc1.frequency.setTargetAtTime(targetFreq1, now, 0.06);
        this.engineOsc2.frequency.setTargetAtTime(targetFreq2, now, 0.06);
        this.engineGain.gain.setTargetAtTime(targetVol, now, 0.06);
    }

    updateWindSound(windSpeedRatio) {
        if (!this.isInitialized || this.isMuted || !this.windGain) return;
        const now = this.ctx.currentTime;
        const targetGain = 0.01 + Math.abs(windSpeedRatio) * 0.09;
        const targetFreq = 300 + Math.abs(windSpeedRatio) * 500;
        this.windGain.gain.setTargetAtTime(targetGain, now, 0.1);
        this.windFilter.frequency.setTargetAtTime(targetFreq, now, 0.1);
    }

    stopHum() {
        if (!this.isInitialized || !this.ctx) return;
        const now = this.ctx.currentTime;
        if (this.engineGain) {
            this.engineGain.gain.setTargetAtTime(0, now, 0.08);
        }
        if (this.windGain) {
            this.windGain.gain.setTargetAtTime(0, now, 0.08);
        }
    }

    // ------------------------------------------------------------------------
    // One-Shot SFX
    // ------------------------------------------------------------------------
    playLatch() {
        if (!this.isInitialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        // High-tech magnetic latch chime
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.12);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.26);

        // Clank click
        this._playClickSound(now + 0.02, 350, 0.05);
    }

    playRelease() {
        if (!this.isInitialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.21);
    }

    playDeliverySuccess() {
        if (!this.isInitialized || this.isMuted) return;
        const now = this.ctx.currentTime;
        
        // Ascending Cyberpunk Arpeggio (C5 -> E5 -> G5 -> C6)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);

            gain.gain.setValueAtTime(0.3, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.35);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.36);
        });
    }

    playCrash() {
        if (!this.isInitialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Reusable noise buffer allocation
        if (!this.crashNoiseBuffer && this.ctx) {
            const bufferSize = Math.floor(this.ctx.sampleRate * 0.5);
            this.crashNoiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = this.crashNoiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.crashNoiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(50, now + 0.45);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(now);

        // Sub bass thump
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(150, now);
        sub.frequency.exponentialRampToValueAtTime(30, now + 0.4);

        subGain.gain.setValueAtTime(0.8, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

        sub.connect(subGain);
        subGain.connect(this.masterGain);
        sub.start(now);
        sub.stop(now + 0.46);
    }

    playWarning() {
        if (!this.isInitialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.setValueAtTime(0, now + 0.08);
        gain.gain.setValueAtTime(0.18, now + 0.14);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.26);
    }

    playChargePad() {
        if (!this.isInitialized || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(900, now + 0.18);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.21);
    }

    _playClickSound(time, freq, dur) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + dur);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + dur + 0.01);
    }

    // ------------------------------------------------------------------------
    // Procedural Synthwave BGM Loop
    // ------------------------------------------------------------------------
    startMusic() {
        if (this.musicPlaying || this.musicTimer || !this.isInitialized) return;
        this.musicPlaying = true;
        this.musicStep = 0;
        
        // Cyberpunk synthwave bassline notes (D minor progression: D2, F2, G2, A2)
        const bassFreqs = [73.42, 73.42, 87.31, 73.42, 98.00, 73.42, 110.00, 98.00];
        const bpm = 120;
        const stepInterval = (60 / bpm) / 2 * 1000; // 16th notes / 8th notes

        this.musicTimer = setInterval(() => {
            if (this.isMuted || !this.musicPlaying || !this.ctx) return;
            const now = this.ctx.currentTime;
            const freq = bassFreqs[this.musicStep % bassFreqs.length];

            // Synth bass pluck
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(450, now);
            filter.frequency.exponentialRampToValueAtTime(120, now + 0.2);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.23);

            this.musicStep++;
        }, stepInterval);
    }

    stopMusic() {
        this.musicPlaying = false;
        if (this.musicTimer) {
            clearInterval(this.musicTimer);
            this.musicTimer = null;
        }
    }
}

export const audio = new SoundEngine();

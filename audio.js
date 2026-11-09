// Sintetizador de efectos de sonido en tiempo real mediante la API de Web Audio

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.waterNode = null;
    this.waterGain = null;
    this.isSpraying = false;
  }

  // Inicializa o reanuda el contexto de audio tras una interacción del usuario
  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Alterna el estado de silencio global
  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopWaterSpray();
    }
    return this.muted;
  }

  // Sonido breve para interacción con botones y controles de la interfaz
  playButtonClick() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.05);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Sonido ascendente al extinguir un árbol y obtener puntuación
  playExtinguishPoint() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880.0, now + 0.055);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Sonido continuo de agua usando ruido blanco filtrado por paso de banda
  startWaterSpray() {
    if (this.muted || this.isSpraying) return;
    this.initContext();
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 1.5;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1100, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.08);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    whiteNoise.start();
    this.waterNode = whiteNoise;
    this.waterGain = gain;
    this.isSpraying = true;
  }

  // Detiene suavemente el sonido continuo del chorro de agua
  stopWaterSpray() {
    if (!this.isSpraying || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      if (this.waterGain) {
        this.waterGain.gain.setValueAtTime(this.waterGain.gain.value, now);
        this.waterGain.gain.linearRampToValueAtTime(0.0001, now + 0.06);
      }
      const nodeToStop = this.waterNode;
      setTimeout(() => {
        if (nodeToStop) {
          try {
            nodeToStop.stop();
            nodeToStop.disconnect();
          } catch (e) {
            // El nodo ya fue detenido
          }
        }
      }, 70);
    } catch (e) {
      // Ignorar errores de cierre de contexto
    }
    this.waterNode = null;
    this.waterGain = null;
    this.isSpraying = false;
  }

  /**
   * Sonido sutil de crepitación cuando el fuego se propaga a nuevos árboles
   * @param {number} newFiresCount cantidad de nuevos árboles incendiados en el paso
   */
  playFireSpreadPulse(newFiresCount) {
    if (this.muted || newFiresCount <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const baseFreq = Math.min(220, 90 + newFiresCount * 3);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.07);

    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.075);
  }

  /**
   * Secuencia acústica al finalizar la simulación (éxito o pérdida del bosque)
   * @param {boolean} highPreservation indica si se salvó al menos el 50% del bosque
   */
  playSimulationEnd(highPreservation) {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    this.stopWaterSpray();
    const now = this.ctx.currentTime;
    const notes = highPreservation ? [523.25, 659.25, 783.99, 1046.5] : [392.0, 349.23, 311.13, 261.63];

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.11;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.22);
    });
  }
}

window.SoundEngine = SoundEngine;
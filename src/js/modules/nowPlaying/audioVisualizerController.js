import {
  DEFAULT_VISUALIZER_SETTINGS,
  normalizeVisualizerSettings,
} from "./visualizerSettings.js";

const FFT_SIZE = 2048;
const PARTICLE_LIMIT = 36;
const PAUSE_SETTLE_LEVEL = 0.012;

const PALETTES = Object.freeze({
  purple: ["#6d43ff", "#c43cff"],
  blue: ["#176dff", "#38cfff"],
  pink: ["#a52dff", "#ff4f9f"],
  gradient: ["#176dff", "#863cff", "#ff4f9f"],
});

function getAudioContextConstructor() {
  return window.AudioContext || window.webkitAudioContext;
}

function getAccentColor(root) {
  const value = getComputedStyle(root)
    .getPropertyValue("--thunder-electric-rgb")
    .trim();
  return value ? `rgb(${value})` : "#8b4dff";
}

function createParticle(index) {
  return {
    x: ((index * 47) % 97) / 97,
    y: ((index * 31) % 89) / 89,
    speed: 0.00008 + (index % 5) * 0.000025,
    size: 0.7 + (index % 4) * 0.35,
    alpha: 0.18 + (index % 6) * 0.055,
  };
}

export class AudioVisualizerController {
  constructor({
    canvas,
    root,
    AudioContextClass = getAudioContextConstructor(),
    requestFrame = requestAnimationFrame,
    cancelFrame = cancelAnimationFrame,
    ResizeObserverClass = window.ResizeObserver,
  }) {
    this.canvas = canvas;
    this.root = root;
    this.AudioContextClass = AudioContextClass;
    // Chromium's frame functions require their native receiver. Calling a
    // captured function as `this.requestFrame()` rebinds `this` to the
    // controller and throws "Illegal invocation", so keep receiver-safe
    // wrappers instead.
    this.requestFrame = (callback) => requestFrame(callback);
    this.cancelFrame = (frameId) => cancelFrame(frameId);
    this.ResizeObserverClass = ResizeObserverClass;
    this.context2d = null;
    this.audioContext = null;
    this.analyser = null;
    this.sources = new WeakMap();
    this.sourceNodes = new Set();
    this.frequencyData = new Uint8Array(FFT_SIZE / 2);
    this.levels = new Float32Array(128);
    this.particles = Array.from({ length: PARTICLE_LIMIT }, (_item, index) =>
      createParticle(index),
    );
    this.settings = { ...DEFAULT_VISUALIZER_SETTINGS };
    this.activeMedia = null;
    this.analysisAllowed = true;
    this.connected = false;
    this.eligible = false;
    this.playing = false;
    this.decaying = false;
    this.paused = false;
    this.initialized = false;
    this.destroyed = false;
    this.frameId = null;
    this.lastFrameAt = 0;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.gradient = null;
    this.reflectionGradient = null;
    this.connectionVersion = 0;
    this.reducedMotionQuery = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
    this.resizeObserver = null;
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.onMotionChange = this.onMotionChange.bind(this);
    this.renderFrame = this.renderFrame.bind(this);
    this.renderers = new Map([
      ["spectrum", (elapsed) => this.drawSpectrum(elapsed)],
    ]);
  }

  initialize() {
    if (this.destroyed || !this.canvas) return false;
    if (this.initialized) return true;
    try {
      this.context2d = this.canvas.getContext("2d");
    } catch {
      this.context2d = null;
    }
    if (!this.context2d) return false;
    this.initialized = true;
    if (this.ResizeObserverClass) {
      this.resizeObserver = new this.ResizeObserverClass(() => this.resize());
      this.resizeObserver.observe(this.canvas);
    } else {
      window.addEventListener("resize", this.onMotionChange);
    }
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.reducedMotionQuery?.addEventListener?.("change", this.onMotionChange);
    this.resize();
    return true;
  }

  isReducedMotion() {
    return (
      this.reducedMotionQuery?.matches === true ||
      document.body?.classList.contains("low-effects") ||
      document.documentElement?.classList.contains("low-effects")
    );
  }

  async ensureAudioGraph(media, version) {
    if (
      !media ||
      !this.analysisAllowed ||
      !this.AudioContextClass ||
      this.destroyed
    ) {
      return false;
    }
    if (!this.audioContext) {
      this.audioContext = new this.AudioContextClass();
    }
    if (this.audioContext.state !== "running") {
      try {
        await this.audioContext.resume();
      } catch {
        return false;
      }
    }
    if (
      this.destroyed ||
      version !== this.connectionVersion ||
      this.audioContext.state !== "running"
    ) {
      return false;
    }
    if (!this.analyser) {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.minDecibels = -92;
      this.analyser.maxDecibels = -18;
      this.analyser.connect(this.audioContext.destination);
    }
    this.analyser.smoothingTimeConstant = this.settings.smoothing;
    let source = this.sources.get(media);
    if (!source) {
      try {
        source = this.audioContext.createMediaElementSource(media);
        this.sources.set(media, source);
        this.sourceNodes.add(source);
        source.connect(this.analyser);
      } catch {
        return false;
      }
    }
    this.connected = true;
    return true;
  }

  async connect(media, { analysisAllowed = true } = {}) {
    if (!this.initialize()) return false;
    const version = ++this.connectionVersion;
    this.activeMedia = media || null;
    this.analysisAllowed = analysisAllowed !== false;
    this.connected = false;
    this.eligible = Boolean(media);
    this.paused = false;
    this.root.classList.toggle(
      "is-visualizer-static",
      this.eligible && !this.analysisAllowed,
    );
    if (!this.eligible) {
      this.clear();
      return false;
    }
    this.drawStatic();
    if (!this.analysisAllowed) return false;
    const connected = await this.ensureAudioGraph(media, version);
    if (version !== this.connectionVersion) return false;
    this.connected = connected;
    this.root.classList.toggle("is-visualizer-static", !connected);
    if (this.playing) this.ensureFrame();
    return connected;
  }

  start() {
    if (!this.eligible || this.destroyed) return false;
    this.playing = true;
    this.decaying = false;
    this.paused = false;
    if (this.connected && !document.hidden) this.ensureFrame();
    else this.drawStatic();
    return true;
  }

  pause() {
    if (!this.eligible || this.destroyed) return false;
    if (!this.playing && (this.decaying || this.paused)) return true;
    this.playing = false;
    this.paused = true;
    this.decaying = this.connected && !this.isReducedMotion();
    if (this.decaying && !document.hidden) this.ensureFrame();
    else this.drawStatic();
    return true;
  }

  resume() {
    return this.start();
  }

  updateSettings(value = {}) {
    this.settings = normalizeVisualizerSettings(value);
    if (this.analyser) {
      this.analyser.smoothingTimeConstant = this.settings.smoothing;
    }
    this.gradient = null;
    if (!this.playing) this.drawStatic();
    return { ...this.settings };
  }

  resize() {
    if (!this.initialized || !this.context2d) return false;
    const bounds = this.canvas.getBoundingClientRect();
    const width = Math.max(
      1,
      Math.round(bounds.width || this.canvas.clientWidth),
    );
    const height = Math.max(
      1,
      Math.round(bounds.height || this.canvas.clientHeight),
    );
    const dpr = Math.max(1, Number(window.devicePixelRatio) || 1);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    if (
      this.canvas.width !== pixelWidth ||
      this.canvas.height !== pixelHeight
    ) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
      this.context2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.gradient = null;
      this.reflectionGradient = null;
    }
    if (this.eligible && !this.playing) this.drawStatic();
    return true;
  }

  createGradient() {
    const ctx = this.context2d;
    if (!ctx) return "#8b4dff";
    if (this.settings.colorScheme === "accent") {
      return getAccentColor(this.root);
    }
    const colors = PALETTES[this.settings.colorScheme] || PALETTES.gradient;
    const gradient = ctx.createLinearGradient(0, 0, this.width, 0);
    colors.forEach((color, index) => {
      gradient.addColorStop(index / Math.max(1, colors.length - 1), color);
    });
    return gradient;
  }

  drawStatic() {
    if (!this.initialized || !this.eligible || !this.context2d) return;
    const count = this.settings.barCount;
    for (let index = 0; index < count; index += 1) {
      const wave =
        0.055 +
        Math.sin((index / Math.max(1, count - 1)) * Math.PI) * 0.09 +
        Math.sin(index * 0.73) * 0.012;
      this.levels[index] = Math.max(0.035, wave);
    }
    this.draw(0);
  }

  ensureFrame() {
    if (this.frameId !== null || document.hidden || this.destroyed) return;
    this.frameId = this.requestFrame(this.renderFrame);
  }

  renderFrame(timestamp = performance.now()) {
    this.frameId = null;
    if (
      this.destroyed ||
      document.hidden ||
      !this.eligible ||
      (!this.playing && !this.decaying)
    ) {
      return;
    }
    const minimumInterval = this.playing ? 1000 / 60 : 1000 / 30;
    if (timestamp - this.lastFrameAt < minimumInterval) {
      this.ensureFrame();
      return;
    }
    const elapsed = Math.max(0, timestamp - this.lastFrameAt);
    this.lastFrameAt = timestamp;
    const count = this.settings.barCount;
    let peak = 0;
    if (this.playing && this.connected && this.analyser) {
      this.analyser.getByteFrequencyData(this.frequencyData);
      const usableBins = Math.min(
        this.frequencyData.length,
        Math.max(count, 320),
      );
      for (let index = 0; index < count; index += 1) {
        const bin = Math.min(
          usableBins - 1,
          Math.floor((index / count) ** 1.55 * usableBins),
        );
        const raw = (this.frequencyData[bin] / 255) * this.settings.sensitivity;
        const value = Math.min(1, raw);
        this.levels[index] += (value - this.levels[index]) * 0.34;
        peak = Math.max(peak, this.levels[index]);
      }
    } else {
      for (let index = 0; index < count; index += 1) {
        this.levels[index] *= this.isReducedMotion() ? 0.68 : 0.86;
        peak = Math.max(peak, this.levels[index]);
      }
      if (peak <= PAUSE_SETTLE_LEVEL) {
        this.decaying = false;
        this.drawStatic();
        return;
      }
    }
    this.draw(elapsed);
    this.ensureFrame();
  }

  draw(elapsed) {
    const renderer =
      this.renderers.get(this.settings.type) ||
      this.renderers.get(DEFAULT_VISUALIZER_SETTINGS.type);
    renderer?.(elapsed);
  }

  drawSpectrum(elapsed) {
    const ctx = this.context2d;
    if (!ctx || !this.width || !this.height) return;
    const reducedMotion = this.isReducedMotion();
    const count = this.settings.barCount;
    const baseline = this.height * 0.69;
    const availableHeight = this.height * 0.47;
    const gap = Math.max(1.5, (this.width / count) * 0.2);
    const barWidth = Math.max(1.5, (this.width - gap * (count - 1)) / count);
    const totalWidth = barWidth * count + gap * (count - 1);
    const startX = (this.width - totalWidth) / 2;
    const fill = this.gradient || (this.gradient = this.createGradient());
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.fillStyle = fill;
    if (this.settings.style === "glow" && !reducedMotion) {
      ctx.shadowColor =
        this.settings.colorScheme === "blue" ? "#2b86ff" : "#8b3dff";
      ctx.shadowBlur = 16;
    }
    for (let index = 0; index < count; index += 1) {
      const height = Math.max(
        this.settings.style === "minimal" ? 2 : 3,
        this.levels[index] * availableHeight,
      );
      const x = startX + index * (barWidth + gap);
      ctx.fillRect(x, baseline - height, barWidth, height);
    }
    ctx.restore();

    if (
      this.settings.reflection &&
      this.settings.style !== "minimal" &&
      !reducedMotion
    ) {
      if (!this.reflectionGradient) {
        this.reflectionGradient = ctx.createLinearGradient(
          0,
          baseline,
          0,
          baseline + this.height * 0.2,
        );
        this.reflectionGradient.addColorStop(0, "rgba(117, 54, 255, 0.23)");
        this.reflectionGradient.addColorStop(1, "rgba(38, 85, 255, 0)");
      }
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = this.reflectionGradient;
      for (let index = 0; index < count; index += 1) {
        const height = this.levels[index] * availableHeight * 0.34;
        const x = startX + index * (barWidth + gap);
        ctx.fillRect(x, baseline + 3, barWidth, height);
      }
      ctx.restore();
    }

    if (
      this.settings.particles &&
      this.settings.style !== "minimal" &&
      !reducedMotion
    ) {
      ctx.save();
      ctx.fillStyle = "#da69ff";
      for (let index = 0; index < this.particles.length; index += 1) {
        const particle = this.particles[index];
        if (this.playing) {
          particle.y -= particle.speed * elapsed;
          if (particle.y < 0.08) particle.y = 0.78;
        }
        ctx.globalAlpha = particle.alpha;
        ctx.beginPath();
        ctx.arc(
          particle.x * this.width,
          particle.y * baseline,
          particle.size,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.restore();
    }
  }

  onVisibilityChange() {
    if (document.hidden) {
      this.cancelAnimation();
      return;
    }
    this.resize();
    if (this.playing || this.decaying) this.ensureFrame();
    else if (this.eligible) this.drawStatic();
  }

  onMotionChange() {
    this.resize();
    if (this.eligible && !this.playing) this.drawStatic();
  }

  cancelAnimation() {
    if (this.frameId === null) return;
    this.cancelFrame(this.frameId);
    this.frameId = null;
  }

  clear({ deactivate = true } = {}) {
    this.cancelAnimation();
    this.playing = false;
    this.decaying = false;
    this.paused = false;
    if (deactivate) {
      this.eligible = false;
      this.activeMedia = null;
      this.connectionVersion += 1;
    }
    this.levels.fill(0);
    this.context2d?.clearRect(0, 0, this.width, this.height);
    this.root.classList.remove("is-visualizer-static");
  }

  destroy() {
    if (this.destroyed) return;
    this.clear();
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    if (!this.ResizeObserverClass) {
      window.removeEventListener("resize", this.onMotionChange);
    }
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.reducedMotionQuery?.removeEventListener?.(
      "change",
      this.onMotionChange,
    );
    this.sourceNodes.forEach((source) => {
      try {
        source.disconnect();
      } catch {}
    });
    try {
      this.analyser?.disconnect();
    } catch {}
    void this.audioContext?.close?.();
    this.sourceNodes.clear();
    this.analyser = null;
    this.audioContext = null;
    this.context2d = null;
  }
}

export function createAudioVisualizerController(options) {
  return new AudioVisualizerController(options);
}

export default createAudioVisualizerController;

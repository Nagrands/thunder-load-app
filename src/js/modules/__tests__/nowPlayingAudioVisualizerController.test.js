import { AudioVisualizerController } from "../nowPlaying/audioVisualizerController.js";

function createCanvasContext() {
  const gradient = { addColorStop: jest.fn() };
  return {
    arc: jest.fn(),
    beginPath: jest.fn(),
    clearRect: jest.fn(),
    createLinearGradient: jest.fn(() => gradient),
    fill: jest.fn(),
    fillRect: jest.fn(),
    restore: jest.fn(),
    save: jest.fn(),
    setTransform: jest.fn(),
    gradient,
  };
}

function createAudioMocks() {
  const analyser = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    fftSize: 0,
    getByteFrequencyData: jest.fn((data) => data.fill(120)),
    maxDecibels: 0,
    minDecibels: 0,
    smoothingTimeConstant: 0,
  };
  const sources = [];
  class MockAudioContext {
    static instances = [];

    constructor() {
      this.destination = {};
      this.state = "suspended";
      this.resume = jest.fn(async () => {
        this.state = "running";
      });
      this.close = jest.fn(async () => {
        this.state = "closed";
      });
      this.createAnalyser = jest.fn(() => analyser);
      this.createMediaElementSource = jest.fn(() => {
        const source = { connect: jest.fn(), disconnect: jest.fn() };
        sources.push(source);
        return source;
      });
      MockAudioContext.instances.push(this);
    }
  }
  return { analyser, MockAudioContext, sources };
}

function createHarness({
  reducedMotion = false,
  receiverSensitiveFrames = false,
} = {}) {
  const root = document.createElement("section");
  const canvas = document.createElement("canvas");
  root.appendChild(canvas);
  document.body.appendChild(root);
  const context2d = createCanvasContext();
  canvas.getContext = jest.fn(() => context2d);
  canvas.getBoundingClientRect = jest.fn(() => ({
    width: 640,
    height: 360,
  }));
  const observe = jest.fn();
  const disconnect = jest.fn();
  class MockResizeObserver {
    constructor(callback) {
      this.callback = callback;
    }

    observe = observe;
    disconnect = disconnect;
  }
  const motionListeners = new Set();
  window.matchMedia = jest.fn(() => ({
    matches: reducedMotion,
    addEventListener: (_name, listener) => motionListeners.add(listener),
    removeEventListener: (_name, listener) => motionListeners.delete(listener),
  }));
  const callbacks = new Map();
  let frameSequence = 0;
  const requestFrame = jest.fn(function scheduleFrame(callback) {
    if (receiverSensitiveFrames && this !== undefined) {
      throw new TypeError("Illegal invocation");
    }
    const id = ++frameSequence;
    callbacks.set(id, callback);
    return id;
  });
  const cancelFrame = jest.fn(function cancelScheduledFrame(id) {
    if (receiverSensitiveFrames && this !== undefined) {
      throw new TypeError("Illegal invocation");
    }
    return callbacks.delete(id);
  });
  const audio = createAudioMocks();
  const controller = new AudioVisualizerController({
    canvas,
    root,
    AudioContextClass: audio.MockAudioContext,
    requestFrame,
    cancelFrame,
    ResizeObserverClass: MockResizeObserver,
  });
  return {
    ...audio,
    callbacks,
    cancelFrame,
    canvas,
    context2d,
    controller,
    disconnect,
    motionListeners,
    observe,
    requestFrame,
    root,
  };
}

describe("AudioVisualizerController", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2,
    });
  });

  test("creates one context and one source for each reusable media element", async () => {
    const harness = createHarness();
    const first = document.createElement("video");
    const second = document.createElement("video");

    await harness.controller.connect(first);
    await harness.controller.connect(first);
    await harness.controller.connect(second);

    expect(harness.MockAudioContext.instances).toHaveLength(1);
    const context = harness.MockAudioContext.instances[0];
    expect(context.createAnalyser).toHaveBeenCalledTimes(1);
    expect(context.createMediaElementSource).toHaveBeenCalledTimes(2);
    expect(harness.sources).toHaveLength(2);
    harness.controller.destroy();
  });

  test("keeps one animation frame and reuses the graph across pause and resume", async () => {
    const harness = createHarness();
    const media = document.createElement("video");
    await harness.controller.connect(media);

    harness.controller.start();
    harness.controller.start();
    expect(harness.requestFrame).toHaveBeenCalledTimes(1);

    const frame = [...harness.callbacks.values()][0];
    frame(100);
    expect(harness.analyser.getByteFrequencyData).toHaveBeenCalledTimes(1);
    harness.controller.pause();
    harness.controller.resume();

    expect(
      harness.MockAudioContext.instances[0].createMediaElementSource,
    ).toHaveBeenCalledTimes(1);
    harness.controller.destroy();
    expect(harness.cancelFrame).toHaveBeenCalled();
  });

  test("does not rebind receiver-sensitive browser frame functions", async () => {
    const harness = createHarness({ receiverSensitiveFrames: true });
    await harness.controller.connect(document.createElement("video"));

    expect(() => harness.controller.start()).not.toThrow();
    expect(() => harness.controller.destroy()).not.toThrow();
    expect(harness.requestFrame).toHaveBeenCalledTimes(1);
    expect(harness.cancelFrame).toHaveBeenCalledTimes(1);
  });

  test("lets only the latest media connect when AudioContext resume is pending", async () => {
    let releaseResume;
    const resumeGate = new Promise((resolve) => {
      releaseResume = resolve;
    });
    const sources = [];
    class SlowAudioContext {
      constructor() {
        this.destination = {};
        this.state = "suspended";
      }

      resume = jest.fn(async () => {
        await resumeGate;
        this.state = "running";
      });
      close = jest.fn();
      createAnalyser = jest.fn(() => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
        getByteFrequencyData: jest.fn(),
      }));
      createMediaElementSource = jest.fn((media) => {
        const source = { media, connect: jest.fn(), disconnect: jest.fn() };
        sources.push(source);
        return source;
      });
    }
    const harness = createHarness();
    harness.controller.AudioContextClass = SlowAudioContext;
    const first = document.createElement("video");
    const second = document.createElement("video");

    const firstConnection = harness.controller.connect(first);
    const secondConnection = harness.controller.connect(second);
    releaseResume();
    await Promise.all([firstConnection, secondConnection]);

    expect(sources).toHaveLength(1);
    expect(sources[0].media).toBe(second);
    harness.controller.destroy();
  });

  test("scales the backing store with devicePixelRatio and releases observers", () => {
    const harness = createHarness();
    harness.controller.initialize();

    expect(harness.canvas.width).toBe(1280);
    expect(harness.canvas.height).toBe(720);
    expect(harness.context2d.setTransform).toHaveBeenCalledWith(
      2,
      0,
      0,
      2,
      0,
      0,
    );
    expect(harness.observe).toHaveBeenCalledWith(harness.canvas);

    harness.controller.destroy();
    expect(harness.disconnect).toHaveBeenCalledTimes(1);
    expect(harness.motionListeners).toHaveProperty("size", 0);
  });

  test("stops rendering while hidden and resumes without a second graph", async () => {
    const harness = createHarness();
    await harness.controller.connect(document.createElement("video"));
    harness.controller.start();
    expect(harness.requestFrame).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(harness.cancelFrame).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(harness.requestFrame).toHaveBeenCalledTimes(2);
    expect(
      harness.MockAudioContext.instances[0].createMediaElementSource,
    ).toHaveBeenCalledTimes(1);
    harness.controller.destroy();
  });

  test("uses a static fallback without creating Web Audio for direct network media", async () => {
    const harness = createHarness();

    await expect(
      harness.controller.connect(document.createElement("video"), {
        analysisAllowed: false,
      }),
    ).resolves.toBe(false);

    expect(harness.MockAudioContext.instances).toHaveLength(0);
    expect(harness.root.classList.contains("is-visualizer-static")).toBe(true);
    expect(harness.context2d.fillRect).toHaveBeenCalled();
    harness.controller.destroy();
  });

  test("disables particles and reflection for reduced motion", async () => {
    const harness = createHarness({ reducedMotion: true });
    await harness.controller.connect(document.createElement("video"));
    harness.controller.updateSettings({
      particles: true,
      reflection: true,
      style: "glow",
    });
    harness.context2d.arc.mockClear();
    harness.context2d.createLinearGradient.mockClear();

    harness.controller.start();
    const frame = [...harness.callbacks.values()][0];
    frame(100);

    expect(harness.context2d.arc).not.toHaveBeenCalled();
    expect(harness.controller.reflectionGradient).toBeNull();
    harness.controller.destroy();
  });
});

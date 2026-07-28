export const DEFAULT_VISUALIZER_SETTINGS = Object.freeze({
  type: "spectrum",
  colorScheme: "gradient",
  style: "glow",
  sensitivity: 1,
  smoothing: 0.8,
  barCount: 64,
  particles: true,
  reflection: true,
});

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
}

export function normalizeVisualizerSettings(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    type: source.type === "spectrum" ? source.type : "spectrum",
    colorScheme: ["purple", "blue", "pink", "gradient", "accent"].includes(
      source.colorScheme,
    )
      ? source.colorScheme
      : DEFAULT_VISUALIZER_SETTINGS.colorScheme,
    style: ["normal", "glow", "minimal"].includes(source.style)
      ? source.style
      : DEFAULT_VISUALIZER_SETTINGS.style,
    sensitivity: clamp(source.sensitivity, 0.5, 2, 1),
    smoothing: clamp(source.smoothing, 0, 0.95, 0.8),
    barCount: Math.round(clamp(source.barCount, 24, 128, 64)),
    particles: typeof source.particles === "boolean" ? source.particles : true,
    reflection:
      typeof source.reflection === "boolean" ? source.reflection : true,
  };
}

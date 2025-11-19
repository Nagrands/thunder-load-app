// src/js/modules/effectsMode.js

const STORAGE_KEY = "lowEffects";

export function getLowEffects() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function applyLowEffects(enabled) {
  const flag = !!enabled;
  document.body.classList.toggle("low-effects", flag);
  document.documentElement.classList.toggle("low-effects", flag);
  return flag;
}

export function setLowEffects(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {}
  return applyLowEffects(enabled);
}

export function initLowEffectsFromStore() {
  return applyLowEffects(getLowEffects());
}

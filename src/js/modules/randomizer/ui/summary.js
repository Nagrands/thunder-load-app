// src/js/modules/randomizer/ui/summary.js

import { triggerPulse } from "../helpers.js";

export function createSummary({ getState, elements }) {
  const { summaryCountEl, summaryPresetEl, summaryModeEl, summaryPoolEl, poolHintEl } =
    elements;

  const updateSummary = () => {
    const { items, currentPresetName, settings, pool } = getState();
    if (summaryCountEl) summaryCountEl.textContent = items.length;
    if (summaryPresetEl) summaryPresetEl.textContent = currentPresetName || "—";
    if (summaryModeEl)
      summaryModeEl.textContent = settings.noRepeat ? "Без повторов" : "С повторами";
    if (summaryPoolEl) {
      const poolValue = settings.noRepeat
        ? `${pool.length}/${items.length || 0}`
        : "∞";
      summaryPoolEl.textContent = poolValue;
      summaryPoolEl.classList.toggle(
        "is-warning",
        settings.noRepeat && items.length > 0 && pool.length === 0,
      );
    }
  };

  const updatePoolHint = () => {
    if (!poolHintEl) return;
    const { items, pool, settings } = getState();
    const exhausted =
      settings.noRepeat && items.length > 0 && (pool?.length || 0) === 0;
    poolHintEl.classList.toggle("hidden", !exhausted);
  };

  const pulsePool = () => triggerPulse(summaryPoolEl);

  return { updateSummary, updatePoolHint, pulsePool };
}

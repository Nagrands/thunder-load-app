// src/js/modules/randomizer/ui/summary.js

import { triggerPulse } from "../helpers.js";
import { t } from "../../i18n.js";

export function createSummary({ getState, elements }) {
  const {
    summaryCountEl,
    summaryPresetEl,
    summaryPoolEl,
    summaryPoolModeEl,
    summaryDefaultBadgeEl,
    poolHintEl,
  } = elements;

  const updateSummary = () => {
    const { items, currentPresetName, defaultPresetName, settings, pool } =
      getState();
    const activeItems = items.filter((item) => !item.excluded);
    if (summaryCountEl) summaryCountEl.textContent = activeItems.length;
    if (summaryPresetEl) summaryPresetEl.textContent = currentPresetName || "—";
    if (summaryDefaultBadgeEl) {
      const isDefault =
        currentPresetName && currentPresetName === defaultPresetName;
      summaryDefaultBadgeEl.classList.toggle("hidden", !isDefault);
    }
    if (summaryPoolEl) {
      const poolValue = settings.noRepeat
        ? `${pool.length}/${activeItems.length || 0}`
        : "∞";
      summaryPoolEl.textContent = poolValue;
      summaryPoolEl.classList.toggle(
        "is-warning",
        settings.noRepeat && activeItems.length > 0 && pool.length === 0,
      );
    }
    if (summaryPoolModeEl) {
      const noRepeat = !!settings.noRepeat;
      summaryPoolModeEl.textContent = noRepeat
        ? t("randomizer.summary.noRepeat")
        : t("randomizer.summary.repeat");
      summaryPoolModeEl.dataset.mode = noRepeat ? "no-repeat" : "repeat";
    }
  };

  const updatePoolHint = () => {
    if (!poolHintEl) return;
    const { items, pool, settings } = getState();
    const activeItems = items.filter((item) => !item.excluded);
    const exhausted =
      settings.noRepeat && activeItems.length > 0 && (pool?.length || 0) === 0;
    poolHintEl.classList.toggle("hidden", !exhausted);
  };

  const pulsePool = () => triggerPulse(summaryPoolEl);

  return { updateSummary, updatePoolHint, pulsePool };
}

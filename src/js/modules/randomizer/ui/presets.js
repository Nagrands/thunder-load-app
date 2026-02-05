// src/js/modules/randomizer/ui/presets.js

import { t } from "../../i18n.js";
import { DEFAULT_PRESET_NAME } from "../helpers.js";

// Локальный helper для кастомного select, заимствован из randomizerView.
const enhanceSelect = (selectEl) => {
  if (!selectEl || selectEl.dataset.enhanced === "true") return null;
  selectEl.dataset.enhanced = "true";

  const wrapper = document.createElement("div");
  wrapper.className = "bk-select-wrapper";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "bk-select-trigger";
  const labelEl = document.createElement("span");
  labelEl.className = "bk-select-label";
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-chevron-down";
  trigger.append(labelEl, icon);

  const menu = document.createElement("div");
  menu.className = "bk-select-menu";
  menu.hidden = true;

  const updateLabel = () => {
    const opt =
      selectEl.selectedOptions && selectEl.selectedOptions[0]
        ? selectEl.selectedOptions[0]
        : selectEl.options[selectEl.selectedIndex];
    labelEl.textContent = opt ? opt.textContent : "";
    menu
      .querySelectorAll(".bk-select-option")
      .forEach((item) =>
        item.classList.toggle(
          "is-active",
          item.dataset.value === selectEl.value,
        ),
      );
  };

  const rebuild = () => {
    menu.innerHTML = "";
    Array.from(selectEl.options).forEach((opt) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "bk-select-option";
      item.dataset.value = opt.value;
      item.textContent = opt.textContent;
      item.addEventListener("click", () => {
        if (selectEl.value !== opt.value) {
          selectEl.value = opt.value;
          selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        }
        updateLabel();
        menu.hidden = true;
        wrapper.classList.remove("is-open");
      });
      menu.appendChild(item);
    });
    updateLabel();
  };

  const closeAll = (e) => {
    if (e && wrapper.contains(e.target)) return;
    menu.hidden = true;
    wrapper.classList.remove("is-open");
  };

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = menu.hidden;
    document
      .querySelectorAll(".bk-select-wrapper.is-open .bk-select-menu")
      .forEach((m) => {
        m.hidden = true;
        m.parentElement?.classList.remove("is-open");
      });
    if (willOpen) {
      menu.hidden = false;
      wrapper.classList.add("is-open");
    } else {
      closeAll();
    }
  });

  document.addEventListener("mousedown", closeAll);
  document.addEventListener("focusin", closeAll);
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      menu.hidden = false;
      wrapper.classList.add("is-open");
    }
  });

  selectEl.classList.add("bk-select-hidden");
  selectEl.parentNode.insertBefore(wrapper, selectEl);
  wrapper.append(trigger, selectEl, menu);
  rebuild();

  return { rebuild, updateLabel };
};

export function createPresetsUI({
  presetSelect,
  presetSaveBtn,
  presetNewBtn,
  presetSaveAsBtn,
  presetDeleteBtn,
  presetDefaultBtn,
  askPresetName,
  promptPresetNameFallback,
  createPreset,
  applyPreset,
  refreshPresets,
  deletePreset,
  setDefault,
  showToast,
  getState,
}) {
  let presetSelectUI = null;

  const refreshPresetSelect = () => {
    const { presets, currentPresetName, defaultPresetName } = getState();
    if (!presetSelect) return;
    presetSelect.innerHTML = "";
    presets.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.name;
      option.textContent =
        preset.name === defaultPresetName ? `${preset.name} •` : preset.name;
      if (preset.name === currentPresetName) option.selected = true;
      presetSelect.appendChild(option);
    });
    presetDeleteBtn.disabled = presets.length <= 1;
    presetDefaultBtn.disabled = !currentPresetName;

    if (!presetSelectUI) {
      presetSelectUI = enhanceSelect(presetSelect);
    }
    presetSelectUI?.rebuild?.();
  };

  const wire = () => {
    presetSelect?.addEventListener("change", (event) => {
      const name = event.target.value;
      if (!name) return;
      applyPreset(name);
      refreshPresetSelect();
      presetSelectUI?.updateLabel?.();
      showToast(t("randomizer.preset.loaded", { name }), "success");
    });

    presetSaveBtn?.addEventListener("click", () => {
      refreshPresets();
      showToast(t("randomizer.preset.saved"), "success");
      refreshPresetSelect();
    });

    presetNewBtn?.addEventListener("click", () => {
      const suggested = t("randomizer.preset.newName");
      const handleCreate = (name) => {
        const trimmed = (name || "").trim();
        if (!trimmed) return;
        createPreset(trimmed, []);
        applyPreset(trimmed);
        refreshPresetSelect();
        showToast(t("randomizer.preset.created", { name: trimmed }), "success");
      };

      const fallbackName = promptPresetNameFallback(suggested);
      if (fallbackName !== undefined) {
        handleCreate(fallbackName);
        return;
      }

      askPresetName(suggested).then((name) => {
        if (!name) return;
        handleCreate(name);
      });
    });

    presetSaveAsBtn?.addEventListener("click", () => {
      const { currentPresetName } = getState();
      const suggested =
        currentPresetName && currentPresetName !== DEFAULT_PRESET_NAME
          ? t("randomizer.preset.copyName", { name: currentPresetName })
          : t("randomizer.preset.newName");
      const fallbackName = promptPresetNameFallback(suggested);
      if (fallbackName !== undefined) {
        const trimmed = (fallbackName || "").trim();
        if (!trimmed) return;
        createPreset(trimmed);
        refreshPresetSelect();
        showToast(t("randomizer.preset.savedAs", { name: trimmed }), "success");
        return;
      }
      askPresetName(suggested).then((name) => {
        if (!name) return;
        createPreset(name);
        refreshPresetSelect();
        showToast(
          t("randomizer.preset.savedAs", { name: name.trim() }),
          "success",
        );
      });
    });

    presetDeleteBtn?.addEventListener("click", () => {
      const { currentPresetName, presets } = getState();
      if (!currentPresetName || presets.length <= 1) return;
      if (
        !confirm(
          t("randomizer.preset.deleteConfirm", { name: currentPresetName }),
        )
      )
        return;
      deletePreset(currentPresetName);
      showToast(t("randomizer.preset.deleted"), "success");
      refreshPresetSelect();
    });

    presetDefaultBtn?.addEventListener("click", () => {
      const { currentPresetName } = getState();
      if (!currentPresetName) return;
      setDefault(currentPresetName);
      refreshPresetSelect();
      showToast(
        t("randomizer.preset.setDefault", { name: currentPresetName }),
        "success",
      );
    });
  };

  return { refreshPresetSelect, wire };
}

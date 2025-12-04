// src/js/modules/interfaceHandlers.js

import {
  settingsModal,
  settingsButton,
  closeSettingsButton,
  filterInput,
  clearFilterInputButton,
  githubButton,
} from "./domElements.js";
import { openSettings, closeSettings } from "./settingsModal.js";
import { state } from "./state.js";
import { filterAndSortHistory } from "./filterAndSortHistory.js";

function initInterfaceHandlers() {
  settingsButton?.addEventListener("click", () => {
    if (settingsModal.style.display === "flex") {
      closeSettings();
    } else {
      openSettings();
    }
  });

  closeSettingsButton?.addEventListener("click", closeSettings);

  window.addEventListener("click", (event) => {
    if (event.target === settingsModal) {
      settingsModal.style.display = "none";
    }
  });

  githubButton?.addEventListener("click", () => {
    window.electron.invoke(
      "open-external-link",
      "https://github.com/Nagrands/thunder-load-app",
    );
  });

  clearFilterInputButton.addEventListener("click", () => {
    filterInput.value = "";
    state.currentSearchQuery = "";
    localStorage.setItem("lastSearch", "");
    filterAndSortHistory("", state.currentSortOrder);
    clearFilterInputButton.classList.add("hidden");
  });

  filterInput.addEventListener("input", (e) => {
    const query = e.target.value.trim();
    state.currentSearchQuery = query;
    localStorage.setItem("lastSearch", query);
    filterAndSortHistory(query, state.currentSortOrder);

    if (query.length > 0) {
      clearFilterInputButton.classList.remove("hidden");
    } else {
      clearFilterInputButton.classList.add("hidden");
    }
  });

  filterInput.value = state.currentSearchQuery;
  filterAndSortHistory(state.currentSearchQuery, state.currentSortOrder);

  if (filterInput.value.trim().length > 0) {
    clearFilterInputButton.classList.remove("hidden");
  } else {
    clearFilterInputButton.classList.add("hidden");
  }
}

export { initInterfaceHandlers };

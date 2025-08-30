// src/js/modules/interfaceHandlers.js

import {
  settingsModal,
  settingsButton,
  closeSettingsButton,
  overlay,
  sidebar,
  toggleBtn,
  closeBtn,
  filterInput,
  clearFilterInputButton,
} from "./domElements.js";
import { toggleSidebar, openSettings, closeSettings, closeSidebarForced } from "./sidebar.js";
import { state } from "./state.js";
import { filterAndSortHistory } from "./filterAndSortHistory.js";

function initInterfaceHandlers() {
  // Обработчики событий для кнопок
  toggleBtn.addEventListener("click", toggleSidebar);
  closeBtn.addEventListener("click", closeSidebarForced);

  settingsButton.addEventListener("click", () => {
    if (settingsModal.style.display === "flex") {
      closeSettings();
    } else {
      openSettings();
    }
  });

  closeSettingsButton.addEventListener("click", closeSettings);

  overlay.addEventListener("click", () => {
    if (settingsModal.style.display === "flex") {
      closeSettings();
    } else if (sidebar.classList.contains("active") && !sidebar.classList.contains("is-pinned")) {
      toggleSidebar();
    }
  });

  window.addEventListener("click", (event) => {
    if (event.target === settingsModal) {
      settingsModal.style.display = "none";
      overlay.classList.remove("active");
    }
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

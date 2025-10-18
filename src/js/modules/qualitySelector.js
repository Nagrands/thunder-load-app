// src/js/modules/qualitySelector.js

import {
  qualityContainer,
  qualityButton,
  qualityDropdown,
  buttonText,
} from "./domElements.js";
import { showToast } from "./toast.js";
import { state } from "./state.js";

let selectedQuality =
  window.localStorage.getItem("selectedQuality") || "Source";
const qualityOptions = Array.from(qualityDropdown.querySelectorAll("li"));

/**
 * Функция для обновления метки выбранного качества
 */
function updateSelectedQuality() {
  console.log("Обновление выбранного качества:", selectedQuality);
  qualityOptions.forEach((option) => {
    if (option.getAttribute("data-quality") === selectedQuality) {
      option.classList.add("selected");
    } else {
      option.classList.remove("selected");
    }
  });

  // Обновляем текст на кнопке скачивания
  if (selectedQuality === "Audio Only") {
    buttonText.textContent = "Скачать аудио";
  } else {
    buttonText.textContent = `Скачать «${selectedQuality}»`;
  }
}

/**
 * Функция для получения текущего выбранного качества
 * @returns {string} - Текущее выбранное качество
 */
function getSelectedQuality() {
  return selectedQuality;
}

function setSelectedQuality(q, silent = false) {
  const allowed = new Set(
    Array.from(qualityDropdown.querySelectorAll("[data-quality]")).map((el) =>
      el.getAttribute("data-quality"),
    ),
  );
  if (!allowed.has(q)) return;
  selectedQuality = q;
  window.localStorage.setItem("selectedQuality", selectedQuality);
  if (!silent) {
    showToast(`Выбрано качество: <strong>${selectedQuality}</strong>`, "info");
  }
  updateSelectedQuality();
}

/**
 * Функция для инициализации обработчиков событий качества
 */
function initQualitySelector() {
  console.log("Инициализация qualitySelector");

  // Инициализация выбранного качества при загрузке
  updateSelectedQuality();

  // Обработчик клика на кнопку выбора качества
  qualityButton.addEventListener("click", (event) => {
    if (state.isDownloading) {
      showToast("Нельзя менять качество во время загрузки.", "warning");
      return;
    }
    // console.log("qualityButton clicked");
    event.stopPropagation(); // Предотвращаем всплытие клика
    const isExpanded = qualityButton.getAttribute("aria-expanded") === "true";
    qualityButton.setAttribute("aria-expanded", !isExpanded);
    qualityDropdown.hidden = isExpanded;
  });

  // Обработчик выбора качества из выпадающего списка
  qualityDropdown.addEventListener("click", (event) => {
    if (state.isDownloading) {
      showToast("Нельзя менять качество во время загрузки.", "warning");
      return;
    }
    const target = event.target.closest("li");
    if (target) {
      selectedQuality = target.getAttribute("data-quality");
      console.log("Quality selected:", selectedQuality);
      window.localStorage.setItem("selectedQuality", selectedQuality);
      showToast(
        `Выбрано качество: <strong>${selectedQuality}</strong>`,
        "info",
      );
      qualityDropdown.hidden = true;
      qualityButton.setAttribute("aria-expanded", "false");

      // Обновляем метку выбранного качества
      updateSelectedQuality();
    }
  });

  // Закрытие выпадающего списка при клике вне его
  document.addEventListener("click", (event) => {
    if (!qualityContainer.contains(event.target)) {
      qualityDropdown.hidden = true;
      qualityButton.setAttribute("aria-expanded", "false");
    }
  });

  // Быстрые пресеты качества (если присутствуют в DOM)
  const presets = document.querySelectorAll(".quality-presets [data-quality]");
  presets.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.isDownloading) {
        showToast("Нельзя менять качество во время загрузки.", "warning");
        return;
      }
      const q = btn.getAttribute("data-quality");
      setSelectedQuality(q);
      // визуальная активность
      presets.forEach((b) => b.classList.toggle("active", b === btn));
    });
  });
  // начальная подсветка выбранного
  presets.forEach((b) =>
    b.classList.toggle(
      "active",
      b.getAttribute("data-quality") === selectedQuality,
    ),
  );

  // Блокировка/разблокировка пресетов и дропдауна при загрузке
  const presetsBox = document.querySelector(".quality-presets");
  const setControlsDisabled = (flag) => {
    try {
      qualityButton.disabled = !!flag;
      qualityButton.setAttribute("aria-disabled", String(!!flag));
      if (presetsBox) presetsBox.classList.toggle("is-disabled", !!flag);
      if (flag) qualityDropdown.hidden = true;
    } catch {}
  };
  setControlsDisabled(state.isDownloading);
  window.addEventListener("download:state", (e) =>
    setControlsDisabled(!!e.detail?.isDownloading),
  );
}

export {
  getSelectedQuality,
  setSelectedQuality,
  updateSelectedQuality,
  initQualitySelector,
};

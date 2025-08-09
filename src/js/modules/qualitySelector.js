// src/js/modules/qualitySelector.js

import {
  qualityContainer,
  qualityButton,
  qualityDropdown,
  buttonText,
} from "./domElements.js";
import { showToast } from "./toast.js";

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
    buttonText.textContent = `Скачать "${selectedQuality}"`;
  }
}

/**
 * Функция для получения текущего выбранного качества
 * @returns {string} - Текущее выбранное качество
 */
function getSelectedQuality() {
  return selectedQuality;
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
    // console.log("qualityButton clicked");
    event.stopPropagation(); // Предотвращаем всплытие клика
    const isExpanded = qualityButton.getAttribute("aria-expanded") === "true";
    qualityButton.setAttribute("aria-expanded", !isExpanded);
    qualityDropdown.hidden = isExpanded;
  });

  // Обработчик выбора качества из выпадающего списка
  qualityDropdown.addEventListener("click", (event) => {
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
}

export { getSelectedQuality, updateSelectedQuality, initQualitySelector };

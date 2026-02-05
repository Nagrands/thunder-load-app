// src/js/modules/whatsNewModal.js

import {
  versionContainer,
  whatsNewModal,
  whatsNewContent,
  closeWhatsNewBtn,
  shortcutsModal,
  confirmationModal,
  settingsModal,
} from "./domElements.js";
import { closeAllModals } from "./modalManager.js";
import { getLanguage, t } from "./i18n.js";
const WHATSNEW_ALLOWED_TAGS = [
  "h2",
  "h3",
  "h4",
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "code",
  "pre",
  "blockquote",
  "hr",
  "br",
  "small",
  "a",
];

const WHATSNEW_ALLOWED_ATTR = {
  "*": ["title"],
  a: ["href", "title", "target", "rel"],
};

const WHATSNEW_ALLOWED_URI = /^(https?:|mailto:)/i;

function sanitizeWhatsNewHtml(html) {
  const purifier = window?.DOMPurify;
  if (!purifier || typeof purifier.sanitize !== "function") {
    console.warn("[WhatsNew] DOMPurify is not available; rendering raw HTML.");
    return html;
  }
  return purifier.sanitize(html, {
    ALLOWED_TAGS: WHATSNEW_ALLOWED_TAGS,
    ALLOWED_ATTR: WHATSNEW_ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: WHATSNEW_ALLOWED_URI,
  });
}

// Export for tests only
export const __test_sanitizeWhatsNewHtml = sanitizeWhatsNewHtml;

/**
 * Функция для отображения модального окна "Что нового".
 * @param {string} version - Текущая версия приложения.
 */
async function showWhatsNew(version) {
  try {
    const data = await window.electron.invoke("get-whats-new", getLanguage());
    console.log("Полученные данные для 'Что нового?':", data); // Для отладки

    // Проверяем, соответствует ли версия в JSON текущей версии приложения
    if (data.version !== version) {
      console.warn(
        `Версия в whatsNew.json (${data.version}) не соответствует текущей версии приложения (${version}).`,
      );
      return;
    }

    // Обновляем заголовок модального окна с версией
    const header = whatsNewModal.querySelector("h2");
    if (header) {
      // Очищаем текущий текст и вставляем новый с версией
      header.innerHTML = ""; // Очищаем содержимое h2
      const icon = document.createElement("i");
      icon.className = "fa fa-question-circle";
      icon.setAttribute("aria-hidden", "true");
      header.appendChild(icon);
      header.insertAdjacentText("afterbegin", " "); // Добавить пробел после иконки
      header.insertAdjacentText(
        "beforeend",
        t("whatsnew.version", { version: data.version }),
      );
    }

    // Очищаем содержимое контейнера
    if (!whatsNewContent) {
      console.error("whatsNewContent элемент не найден");
      return;
    }

    whatsNewContent.innerHTML = "";

    // Заполняем содержимое контейнера HTML-строками из JSON
    data.changes.forEach((change) => {
      if (change.trim() !== "") {
        // Пропускаем пустые строки
        const safeHtml = sanitizeWhatsNewHtml(change);
        whatsNewContent.insertAdjacentHTML("beforeend", safeHtml);
      }
    });

    // Показываем модальное окно
    whatsNewModal.style.display = "flex";
    whatsNewModal.style.flexWrap = "wrap";
    whatsNewModal.style.justifyContent = "center";
    whatsNewModal.style.alignItems = "center";

    console.log("Модальное окно 'Что нового?' отображено с содержимым."); // Для отладки
    try {
      await window.electron.invoke("whats-new:ack", data.version);
    } catch (ackError) {
      console.warn("[WhatsNew] Не удалось подтвердить отображение:", ackError);
    }
  } catch (error) {
    console.error(
      "Ошибка загрузки данных для модального окна 'Что нового?':",
      error,
    );
  }
}

/**
 * Функция для инициализации модального окна "Что нового" при клике на элемент версии.
 */
function initWhatsNewModal() {
  // Обработчик клика на контейнер версии
  if (versionContainer) {
    versionContainer.addEventListener("click", async () => {
      const currentVersion = await window.electron.invoke("get-version");
      closeAllModals([
        whatsNewModal,
        shortcutsModal,
        confirmationModal,
        settingsModal,
      ]); // Закрываем все модальные окна перед открытием нового
      showWhatsNew(currentVersion);
    });
  }

  // Обработчик клика на кнопку закрытия модального окна
  if (closeWhatsNewBtn) {
    closeWhatsNewBtn.addEventListener("click", () => {
      whatsNewModal.style.display = "none";
    });
  }

  // Закрытие модального окна при клике вне его области
  window.addEventListener("click", (event) => {
    if (event.target === whatsNewModal) {
      whatsNewModal.style.display = "none";
    }
  });

  // Подписываемся на IPC-сообщение для отображения модального окна
  window.electron.onShowWhatsNew((version) => {
    closeAllModals([
      whatsNewModal,
      shortcutsModal,
      confirmationModal,
      settingsModal,
    ]); // Закрываем все модальные окна перед открытием нового
    showWhatsNew(version);
  });

  try {
    window.electron.invoke("whats-new:ready");
  } catch (error) {
    console.warn("[WhatsNew] Не удалось отправить сигнал готовности:", error);
  }
}

export { initWhatsNewModal };

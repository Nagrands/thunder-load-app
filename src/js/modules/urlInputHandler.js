// src/js/modules/urlInputHandler.js

import { urlInput } from "./domElements.js";

const clearButton = document.getElementById("clear-url");
const pasteButton = document.getElementById("paste-url");
const selectFolderButton = document.getElementById("select-folder");

function initUrlInputHandler() {
  if (!urlInput || !clearButton || !pasteButton || !selectFolderButton) return;

  const toggleButtons = () => {
    const isEmpty = urlInput.value.trim() === "";
    clearButton.classList.toggle("hidden", isEmpty);
    pasteButton.classList.toggle("hidden", !isEmpty);

    if (selectFolderButton) {
      selectFolderButton.classList.remove("hidden"); // папка должна быть всегда видна (если не загрузка)
    }
  };

  urlInput.addEventListener("input", toggleButtons);
  urlInput.addEventListener("focus", toggleButtons);
  urlInput.addEventListener("blur", toggleButtons);

  clearButton.addEventListener("click", () => {
    urlInput.value = "";
    toggleButtons();
    urlInput.focus();
  });

  pasteButton.addEventListener("click", async () => {
    const text = await navigator.clipboard.readText();
    urlInput.value = text.trim();
    toggleButtons();
    urlInput.dispatchEvent(new Event("input", { bubbles: true })); // запускаем реакцию
    urlInput.focus();
  });
}

function hideUrlActionButtons() {
  pasteButton?.classList.add("hidden");
  selectFolderButton?.classList.add("hidden");
}

function showUrlActionButtons() {
  pasteButton?.classList.remove("hidden");
  selectFolderButton?.classList.remove("hidden");
}

export { initUrlInputHandler, hideUrlActionButtons, showUrlActionButtons };

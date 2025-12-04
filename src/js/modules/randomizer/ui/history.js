// src/js/modules/randomizer/ui/history.js

import { escapeHtml } from "../helpers.js";

export function createHistoryRenderer({
  getState,
  historyList,
  historyEmpty,
  onSelectEntry,
}) {
  return function renderHistory() {
    const { history } = getState();
    historyList.innerHTML = "";
    if (!history.length) {
      historyEmpty.classList.remove("hidden");
      return;
    }
    historyEmpty.classList.add("hidden");
    const fragment = document.createDocumentFragment();
    history.forEach((entry) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-entry";
      button.dataset.value = entry.value;
      button.innerHTML = `
        <span class="text">${escapeHtml(entry.value)}</span>
        <span class="time">${new Intl.DateTimeFormat("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(entry.ts)}</span>
      `;
      button.addEventListener("click", () => {
        onSelectEntry(entry.value);
      });
      li.appendChild(button);
      fragment.appendChild(li);
    });
    historyList.appendChild(fragment);
  };
}

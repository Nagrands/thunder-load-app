// src/js/modules/socialLinks.js

import { isValidUrl } from "./validation.js";
import { showToast } from "./toast.js";

function initSocialLinks() {
  const iconLinks = document.querySelectorAll(".icon-links a, .github a");
  iconLinks.forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      const url = link.getAttribute("data-link");
      try {
        if (!url || !isValidUrl(url)) {
          showToast(
            "Недопустимый или отсутствующий URL для открытия.",
            "error",
          );
          return;
        }
        await window.electron.invoke("open-external-link", url);
      } catch (error) {
        console.error("Error opening external link:", error);
        showToast("Ошибка открытия внешней ссылки.", "error");
      }
    });
  });
}

export { initSocialLinks };

// src/js/modules/whatsNewModal.js

import {
  versionContainer,
  whatsNewModal,
  whatsNewContent,
  closeWhatsNewBtn,
  confirmationModal,
  settingsModal,
} from "./domElements.js";
import { closeAllModals } from "./modalManager.js";
import { getLanguage, t } from "./i18n.js";
import {
  acquireOverlayActive,
  releaseOverlayActive,
} from "./scrollLockManager.js";

const WHATSNEW_ALLOWED_TAGS = [
  "h1",
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
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];
const WHATS_NEW_MODAL_OVERLAY_OWNER = "whats-new-modal";
const INITIAL_SLIDE_INDEX = 0;

const WHATSNEW_ALLOWED_ATTR = {
  "*": ["title"],
  a: ["href", "title", "target", "rel"],
  th: ["align"],
  td: ["align"],
};

const WHATSNEW_ALLOWED_URI = /^(https?:|mailto:)/i;

let slides = [];
let currentIndex = INITIAL_SLIDE_INDEX;

function sanitizeWhatsNewHtml(html) {
  const purifier = window?.DOMPurify || globalThis?.DOMPurify;
  if (!purifier || typeof purifier.sanitize !== "function") {
    console.warn("[WhatsNew] DOMPurify is not available; rendering raw HTML.");
    return html;
  }
  return purifier.sanitize(html, {
    ALLOWED_TAGS: WHATSNEW_ALLOWED_TAGS,
    ALLOWED_ATTR: WHATSNEW_ALLOWED_ATTR,
    ADD_ATTR: ["align"],
    ALLOWED_URI_REGEXP: WHATSNEW_ALLOWED_URI,
  });
}

function getModalElement(selector) {
  return whatsNewModal?.querySelector(selector) || null;
}

function getTextContent(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  return (template.content.textContent || "").trim();
}

function parseSafeDocument(htmlParts = []) {
  const root = document.createElement("div");
  htmlParts
    .map((part) => sanitizeWhatsNewHtml(part))
    .filter((part) => part.trim() !== "")
    .forEach((part) => {
      root.insertAdjacentHTML("beforeend", part);
    });
  return root;
}

function buildSlidesFromHtml(htmlParts = [], version = "") {
  const root = parseSafeDocument(htmlParts);
  const releaseTitle =
    root.querySelector("h1")?.textContent?.trim() ||
    t("whatsnew.version", { version });
  const tableRows = Array.from(root.querySelectorAll("table tbody tr"));
  const featureSlides = tableRows
    .map((row, index) => {
      const cells = Array.from(row.querySelectorAll("td"));
      const titleHtml = (cells[0]?.innerHTML || "").trim();
      const bodyHtml = (cells[1]?.innerHTML || "").trim();
      if (!titleHtml && !bodyHtml) return null;
      return {
        id: `feature-${index}`,
        type: "feature",
        titleHtml,
        bodyHtml,
      };
    })
    .filter(Boolean);

  if (featureSlides.length === 0) {
    return [
      {
        id: "fallback",
        type: "fallback",
        titleText: releaseTitle,
        bodyHtml: root.innerHTML,
        featureCount: 0,
      },
    ];
  }

  return [
    {
      id: "overview",
      type: "overview",
      titleText: releaseTitle,
      subtitleText: t("modal.whatsNew.subtitle"),
      featureCount: featureSlides.length,
      previewItems: featureSlides.slice(0, 2).map((slide) => ({
        titleHtml: slide.titleHtml,
        bodyText: getTextContent(slide.bodyHtml),
      })),
    },
    ...featureSlides,
  ];
}

function closeWhatsNewModal() {
  if (!whatsNewModal) return;
  whatsNewModal.style.display = "none";
  whatsNewModal.setAttribute("aria-hidden", "true");
  releaseOverlayActive(WHATS_NEW_MODAL_OVERLAY_OWNER);
}

function openWhatsNewModal() {
  if (!whatsNewModal) return;
  whatsNewModal.style.display = "flex";
  whatsNewModal.style.flexWrap = "wrap";
  whatsNewModal.style.justifyContent = "center";
  whatsNewModal.style.alignItems = "center";
  whatsNewModal.setAttribute("aria-hidden", "false");
  acquireOverlayActive(WHATS_NEW_MODAL_OVERLAY_OWNER);
}

function updateHeaderMeta() {
  const countEl = getModalElement('[data-ui="whats-slide-count"]');
  const summaryEl = getModalElement('[data-ui="whats-slide-summary"]');
  const total = Math.max(slides.length, 1);
  const current = Math.min(currentIndex + 1, total);
  if (countEl) {
    countEl.textContent = t("whatsnew.slideCounter", { current, total });
  }
  if (summaryEl) {
    const featureCount = slides.find(
      (slide) => slide.type === "overview",
    )?.featureCount;
    summaryEl.textContent =
      typeof featureCount === "number"
        ? t("whatsnew.changesCount", { count: featureCount })
        : t("modal.whatsNew");
  }
}

function renderOverviewSlide(slide) {
  const preview = slide.previewItems
    .map(
      (item) => `
        <li class="whats-overview-item">
          <span class="whats-overview-icon" aria-hidden="true">
            <i class="fa-solid fa-bolt"></i>
          </span>
          <span>
            <strong>${item.titleHtml}</strong>
            <small>${item.bodyText}</small>
          </span>
        </li>
      `,
    )
    .join("");

  return `
    <article class="whats-slide whats-slide--overview">
      <div class="whats-slide-kicker">${t("modal.whatsNew")}</div>
      <h2>${slide.titleText}</h2>
      <p>${slide.subtitleText}</p>
      <ul class="whats-overview-list">${preview}</ul>
    </article>
  `;
}

function renderFeatureSlide(slide) {
  const titleId = `whats-slide-title-${slide.id}`;
  return `
    <article class="whats-slide whats-slide--feature">
      <div class="whats-slide-kicker">${t("modal.whatsNew")}</div>
      <h2 id="${titleId}">${slide.titleHtml}</h2>
      <div class="whats-feature-body" role="region" aria-labelledby="${titleId}" tabindex="0">${slide.bodyHtml}</div>
    </article>
  `;
}

function renderFallbackSlide(slide) {
  const titleId = `whats-slide-title-${slide.id}`;
  return `
    <article class="whats-slide whats-slide--fallback">
      <div class="whats-slide-kicker">${t("modal.whatsNew")}</div>
      <h2 id="${titleId}">${slide.titleText}</h2>
      <div class="whats-feature-body" role="region" aria-labelledby="${titleId}" tabindex="0">${slide.bodyHtml}</div>
    </article>
  `;
}

function renderCurrentSlide() {
  if (!whatsNewContent || slides.length === 0) return;
  const slide = slides[currentIndex] || slides[INITIAL_SLIDE_INDEX];
  const slideHtml =
    slide.type === "overview"
      ? renderOverviewSlide(slide)
      : slide.type === "feature"
        ? renderFeatureSlide(slide)
        : renderFallbackSlide(slide);
  whatsNewContent.innerHTML = slideHtml;
}

function renderDots() {
  const dotsEl = getModalElement('[data-ui="whats-dots"]');
  if (!dotsEl) return;
  dotsEl.innerHTML = "";
  slides.forEach((slide, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "whats-slide-dot";
    dot.dataset.index = String(index);
    dot.setAttribute("role", "tab");
    dot.setAttribute(
      "aria-label",
      t("whatsnew.goToSlide", {
        current: index + 1,
        total: slides.length,
      }),
    );
    dot.setAttribute(
      "aria-selected",
      index === currentIndex ? "true" : "false",
    );
    dot.classList.toggle("is-active", index === currentIndex);
    dot.addEventListener("click", () => {
      setCurrentSlide(index);
    });
    dotsEl.appendChild(dot);
  });
}

function updateControls() {
  const prevButton = getModalElement('[data-ui="whats-prev"]');
  const nextButton = getModalElement('[data-ui="whats-next"]');
  const continueButton = getModalElement('[data-ui="whats-continue"]');
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === slides.length - 1;

  if (prevButton) prevButton.disabled = isFirst;
  if (nextButton) nextButton.disabled = isLast;
  if (continueButton) {
    continueButton.textContent = isLast
      ? t("whatsnew.close")
      : t("whatsnew.continue");
  }
}

function renderPresentation() {
  currentIndex = Math.min(currentIndex, Math.max(slides.length - 1, 0));
  renderCurrentSlide();
  renderDots();
  updateHeaderMeta();
  updateControls();
}

function setCurrentSlide(index) {
  const nextIndex = Math.max(0, Math.min(index, slides.length - 1));
  if (nextIndex === currentIndex) return;
  currentIndex = nextIndex;
  renderPresentation();
}

function goToNextSlide() {
  setCurrentSlide(currentIndex + 1);
}

function goToPreviousSlide() {
  setCurrentSlide(currentIndex - 1);
}

function handleKeydown(event) {
  if (!whatsNewModal || whatsNewModal.getAttribute("aria-hidden") === "true") {
    return;
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    goToNextSlide();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    goToPreviousSlide();
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeWhatsNewModal();
  }
}

async function showWhatsNew(version) {
  try {
    const data = await window.electron.invoke("get-whats-new", getLanguage());

    if (data.version !== version) {
      console.warn(
        `Версия в whatsNew.json (${data.version}) не соответствует текущей версии приложения (${version}).`,
      );
      return;
    }

    slides = buildSlidesFromHtml(data.changes || [], data.version);
    currentIndex = INITIAL_SLIDE_INDEX;
    renderPresentation();
    openWhatsNewModal();

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

function bindPresentationControls() {
  getModalElement('[data-ui="whats-prev"]')?.addEventListener(
    "click",
    goToPreviousSlide,
  );
  getModalElement('[data-ui="whats-next"]')?.addEventListener(
    "click",
    goToNextSlide,
  );
  getModalElement('[data-ui="whats-continue"]')?.addEventListener(
    "click",
    () => {
      if (currentIndex >= slides.length - 1) {
        closeWhatsNewModal();
        return;
      }
      goToNextSlide();
    },
  );
}

function initWhatsNewModal() {
  if (versionContainer) {
    versionContainer.addEventListener("click", async () => {
      const currentVersion = await window.electron.invoke("get-version");
      closeAllModals([
        whatsNewModal,
        confirmationModal,
        settingsModal,
      ]);
      showWhatsNew(currentVersion);
    });
  }

  if (closeWhatsNewBtn) {
    closeWhatsNewBtn.addEventListener("click", closeWhatsNewModal);
  }

  bindPresentationControls();

  window.addEventListener("click", (event) => {
    if (event.target === whatsNewModal) {
      closeWhatsNewModal();
    }
  });
  window.addEventListener("keydown", handleKeydown);

  window.electron.onShowWhatsNew((version) => {
    closeAllModals([
      whatsNewModal,
      confirmationModal,
      settingsModal,
    ]);
    showWhatsNew(version);
  });

  try {
    window.electron.invoke("whats-new:ready");
  } catch (error) {
    console.warn("[WhatsNew] Не удалось отправить сигнал готовности:", error);
  }
}

export const __test_sanitizeWhatsNewHtml = sanitizeWhatsNewHtml;
export const __test_buildSlidesFromHtml = buildSlidesFromHtml;

export { initWhatsNewModal };

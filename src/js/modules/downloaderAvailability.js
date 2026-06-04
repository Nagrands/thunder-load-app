// src/js/modules/downloaderAvailability.js

import { t } from "./i18n.js";
import { isValidUrl, isSupportedUrl } from "./validation.js";

const AVAILABILITY_EVENT = "downloader:availability-changed";
const MISSING_HELPER_KEY = "input.url.helper.ytDlpMissing";

let isInitialized = false;
let hasYtDlp = false;

const getElements = () => ({
  shell: document.querySelector(".url-entry-shell"),
  wrapper: document.querySelector(".url-input-wrapper"),
  urlInput: document.getElementById("url"),
  helperText: document.getElementById("url-helper-text"),
  sourceLinkButton: document.getElementById("url-source-link"),
  pasteButton: document.getElementById("paste-url"),
  clearButton: document.getElementById("clear-url"),
  downloadButton: document.getElementById("download-button"),
  enqueueButton: document.getElementById("enqueue-button"),
});

const setDisabled = (element, disabled) => {
  if (!element) return;
  element.disabled = disabled;
  element.setAttribute("aria-disabled", disabled ? "true" : "false");
};

const hasUsableYtDlp = (payload) =>
  payload?.ytDlp?.ok === true && Boolean(payload?.ytDlp?.path);

const hasSummaryYtDlp = (summary) => {
  const details = Array.isArray(summary?.details) ? summary.details : [];
  const yt = details.find((tool) => tool?.id === "yt");
  return yt?.ok === true;
};

function resolveYtDlpAvailability(detail = {}) {
  if (detail?.raw) return hasUsableYtDlp(detail.raw);
  if (detail?.summary) return hasSummaryYtDlp(detail.summary);
  return hasUsableYtDlp(detail);
}

function applyDownloaderAvailability() {
  const disabled = !hasYtDlp;
  const {
    shell,
    wrapper,
    urlInput,
    helperText,
    sourceLinkButton,
    pasteButton,
    clearButton,
    downloadButton,
    enqueueButton,
  } = getElements();

  shell?.classList.toggle("is-downloader-unavailable", disabled);
  wrapper?.classList.toggle("is-downloader-unavailable", disabled);
  wrapper?.setAttribute("aria-disabled", disabled ? "true" : "false");

  setDisabled(urlInput, disabled);
  setDisabled(pasteButton, disabled);
  setDisabled(clearButton, disabled);

  if (disabled) {
    setDisabled(sourceLinkButton, true);
    setDisabled(downloadButton, true);
    setDisabled(enqueueButton, true);
  } else {
    const url = String(urlInput?.value || "").trim();
    setDisabled(
      sourceLinkButton,
      !(url && isValidUrl(url) && isSupportedUrl(url)),
    );
  }

  if (helperText) {
    if (disabled) {
      helperText.textContent = t(MISSING_HELPER_KEY);
      helperText.dataset.downloaderAvailabilityMessage = "yt-dlp-missing";
    } else if (
      helperText.dataset.downloaderAvailabilityMessage === "yt-dlp-missing"
    ) {
      helperText.textContent = t("input.url.helper");
      delete helperText.dataset.downloaderAvailabilityMessage;
    }
  }
}

function setYtDlpAvailability(nextValue) {
  const next = nextValue === true;
  const changed = hasYtDlp !== next;
  hasYtDlp = next;
  applyDownloaderAvailability();
  void import("./state.js")
    .then(({ updateButtonState }) => {
      updateButtonState();
    })
    .catch(() => {});
  if (changed) {
    window.dispatchEvent(
      new CustomEvent(AVAILABILITY_EVENT, { detail: { hasYtDlp } }),
    );
  }
}

async function fetchInitialAvailability() {
  try {
    const versions = await window.electron?.tools?.getVersions?.();
    setYtDlpAvailability(hasUsableYtDlp(versions));
  } catch (error) {
    console.warn("[downloaderAvailability] getVersions failed:", error);
    setYtDlpAvailability(false);
  }
}

export function isDownloaderAvailable() {
  return hasYtDlp;
}

export function initDownloaderAvailability() {
  applyDownloaderAvailability();
  if (isInitialized) return;
  isInitialized = true;

  window.addEventListener("tools:status", (event) => {
    setYtDlpAvailability(resolveYtDlpAvailability(event?.detail || {}));
  });

  void fetchInitialAvailability();
}

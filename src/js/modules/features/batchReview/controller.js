import { t } from "../../i18n.js";
import {
  closeRegisteredModal,
  openRegisteredModal,
  registerModal,
} from "../../modalManager.js";
import {
  acquireBodyScrollLock,
  releaseBodyScrollLock,
} from "../../scrollLockManager.js";
import { isSupportedUrl, isValidUrl } from "../../validation.js";
import { createBatchMetadataLoader } from "./metadata.js";
import { normalizePlaylistItems, parseBatchText } from "./model.js";
import { renderBatchReviewItems } from "./view.js";

const PAGE_SIZE = 100;
const METADATA_DEBOUNCE_MS = 450;
const METADATA_RENDER_DEBOUNCE_MS = 50;
const SCROLL_LOCK_OWNER = "batch-review-modal";
let runtime = null;
let committedDraft = null;

function cloneDraft(draft) {
  if (!draft) return null;
  return {
    mode: draft.mode,
    sourceUrl: draft.sourceUrl || "",
    sourceText: draft.sourceText || "",
    urls: [...(draft.urls || [])],
    action: draft.action || "",
    confirmed: Boolean(draft.confirmed),
    revision: draft.revision || 0,
  };
}

function createBatchReviewController() {
  const modal = document.getElementById("batch-review-modal");
  if (!modal) return null;
  const elements = {
    title: modal.querySelector('[data-ui="batch-review-title"]'),
    eyebrow: modal.querySelector('[data-ui="batch-review-eyebrow"]'),
    inputWrap: modal.querySelector('[data-ui="batch-review-input-wrap"]'),
    input: modal.querySelector('[data-ui="batch-review-input"]'),
    search: modal.querySelector('[data-ui="batch-review-search"]'),
    filters: [...modal.querySelectorAll('[data-action="batch-review-filter"]')],
    count: modal.querySelector('[data-ui="batch-review-count"]'),
    issues: modal.querySelector('[data-ui="batch-review-issues"]'),
    quality: modal.querySelector('[data-ui="batch-review-quality"]'),
    list: modal.querySelector('[data-ui="batch-review-list"]'),
    pagination: modal.querySelector('[data-ui="batch-review-pagination"]'),
    page: modal.querySelector('[data-ui="batch-review-page"]'),
    previous: modal.querySelector('[data-action="batch-review-prev"]'),
    next: modal.querySelector('[data-action="batch-review-next"]'),
    enqueue: modal.querySelector('[data-action="batch-review-enqueue"]'),
    enqueueLabel: modal.querySelector('[data-ui="batch-review-enqueue-label"]'),
    download: modal.querySelector('[data-action="batch-review-download"]'),
    downloadLabel: modal.querySelector(
      '[data-ui="batch-review-download-label"]',
    ),
  };
  const state = {
    mode: "batch",
    items: [],
    duplicates: [],
    unsupported: [],
    selected: new Set(),
    page: 0,
    query: "",
    filter: "all",
    sourceText: "",
    sourceUrl: "",
    revision: 0,
    resolver: null,
    previousFocus: null,
    isOpen: false,
  };
  const unregister = registerModal(modal);
  let metadataTimer = null;
  let metadataDebounceActive = false;
  let renderTimer = null;
  const metadataLoader = createBatchMetadataLoader({ onUpdate: applyMetadata });

  function cancelMetadataTimer() {
    if (metadataTimer !== null) {
      window.clearTimeout(metadataTimer);
      metadataTimer = null;
    }
    metadataDebounceActive = false;
  }

  function cancelScheduledRender() {
    if (renderTimer !== null) {
      window.clearTimeout(renderTimer);
      renderTimer = null;
    }
  }

  function scheduleRender() {
    if (renderTimer !== null) return;
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      render();
    }, METADATA_RENDER_DEBOUNCE_MS);
  }

  function applyMetadata(url, info) {
    const title = String(info?.title || "").trim();
    const thumbnail = String(info?.thumbnail || "").trim();
    const duration = Math.max(0, Number(info?.duration) || 0);
    const uploader = String(info?.uploader || info?.channel || "").trim();
    const hasPreview = Boolean(title || thumbnail);
    let updated = false;
    state.items.forEach((item) => {
      if (item.url !== url) return;
      if (item.available) {
        item.metadataPending = false;
        item.metadataFailed = !info || !hasPreview;
      }
      if (info) {
        if (title) item.title = title;
        if (thumbnail) item.thumbnail = thumbnail;
        if (duration) item.duration = duration;
        if (uploader) item.uploader = uploader;
      }
      updated = true;
    });
    if (updated) scheduleRender();
  }

  function ensureVisibleMetadata(pageItems) {
    if (!state.isOpen || state.mode !== "batch") return;
    const urls = pageItems
      .filter((item) => item.available && item.metadataPending)
      .map((item) => item.url);
    if (urls.length) metadataLoader.ensure(urls);
  }

  const filteredItems = () => {
    const query = state.query.trim().toLowerCase();
    return state.items.filter((item) => {
      if (state.filter === "available" && !item.available) return false;
      if (state.filter === "problems" && item.available) return false;
      if (!query) return true;
      return `${item.title} ${item.url} ${item.uploader}`
        .toLowerCase()
        .includes(query);
    });
  };

  function render({ ensureMetadata = true, resetScroll = false } = {}) {
    const previousScrollTop = elements.list.scrollTop;
    const filtered = filteredItems();
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.min(state.page, pageCount - 1);
    const pageItems = filtered.slice(
      state.page * PAGE_SIZE,
      (state.page + 1) * PAGE_SIZE,
    );
    renderBatchReviewItems({
      container: elements.list,
      items: pageItems,
      selected: state.selected,
      emptyKey: state.items.length ? "batchReview.noMatches" : "batchReview.empty",
      t,
    });
    elements.list.scrollTop = resetScroll ? 0 : previousScrollTop;
    const selectedCount = state.selected.size;
    elements.count.textContent = t("batchReview.selected", {
      selected: selectedCount,
      total: state.items.filter((item) => item.available).length,
    });
    elements.issues.textContent = t("batchReview.issues", {
      duplicates: state.duplicates.length,
      unsupported: state.unsupported.length,
    });
    const quality = document.getElementById("downloader-output-summary")?.textContent;
    elements.quality.textContent = quality
      ? t("batchReview.sharedQuality", { quality })
      : "";
    elements.quality
      .closest(".batch-review-chip")
      ?.classList.toggle("is-empty", !quality);
    elements.filters.forEach((button) => {
      const active = (button.dataset.filter || "all") === state.filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const isPlaylist = state.mode === "playlist";
    elements.list.classList.toggle(
      "batch-review-modal__list--grid",
      isPlaylist,
    );
    modal.classList.toggle("is-playlist", isPlaylist);
    elements.pagination.hidden = pageCount <= 1;
    elements.page.textContent = t("batchReview.page", {
      page: state.page + 1,
      pages: pageCount,
    });
    elements.previous.disabled = state.page === 0;
    elements.next.disabled = state.page >= pageCount - 1;
    elements.enqueue.disabled = selectedCount === 0;
    elements.download.disabled = selectedCount === 0;
    if (elements.enqueueLabel) {
      elements.enqueueLabel.textContent = t("batchReview.enqueueCount", {
        count: selectedCount,
      });
    }
    if (elements.downloadLabel) {
      elements.downloadLabel.textContent = t("batchReview.downloadCount", {
        count: selectedCount,
      });
    }
    if (ensureMetadata && !metadataDebounceActive) {
      ensureVisibleMetadata(pageItems);
    }
  }

  function syncHeading() {
    elements.eyebrow.textContent = t(
      state.mode === "playlist"
        ? "batchReview.playlistEyebrow"
        : "batchReview.batchEyebrow",
    );
    elements.title.textContent = t(
      state.mode === "playlist"
        ? "batchReview.playlistTitle"
        : "batchReview.batchTitle",
    );
  }

  function setBatchText(text, { immediateMetadata = false } = {}) {
    const parsed = parseBatchText(text, { isValidUrl, isSupportedUrl });
    parsed.valid.forEach((item) => {
      item.metadataPending = true;
      item.metadataFailed = false;
    });
    const previousUrls = new Set(
      state.items.filter((item) => state.selected.has(item.id)).map((item) => item.url),
    );
    state.sourceText = String(text || "");
    state.items = [...parsed.valid, ...parsed.duplicates, ...parsed.unsupported].sort(
      (left, right) => left.index - right.index,
    );
    state.duplicates = parsed.duplicates;
    state.unsupported = parsed.unsupported;
    state.selected = new Set(
      state.items
        .filter(
          (item) =>
            item.available &&
            (!previousUrls.size || previousUrls.has(item.url)),
        )
        .map((item) => item.id),
    );
    state.page = 0;
    metadataLoader.reset();
    cancelScheduledRender();
    cancelMetadataTimer();
    if (immediateMetadata || !parsed.valid.length) {
      render({ resetScroll: true });
      return;
    }
    metadataDebounceActive = true;
    metadataTimer = window.setTimeout(() => {
      metadataTimer = null;
      metadataDebounceActive = false;
      render();
    }, METADATA_DEBOUNCE_MS);
    render({ ensureMetadata: false, resetScroll: true });
  }

  function close(result = null) {
    state.isOpen = false;
    cancelMetadataTimer();
    cancelScheduledRender();
    metadataLoader.reset();
    closeRegisteredModal(modal);
    releaseBodyScrollLock(SCROLL_LOCK_OWNER);
    const resolve = state.resolver;
    state.resolver = null;
    resolve?.(result);
    state.previousFocus?.focus?.();
  }

  function submit(action) {
    const urls = state.items
      .filter((item) => item.available && state.selected.has(item.id))
      .map((item) => item.url);
    if (!urls.length) return;
    committedDraft = {
      mode: state.mode,
      sourceUrl: state.sourceUrl,
      sourceText: state.sourceText,
      urls,
      action,
      confirmed: true,
      revision: state.revision,
    };
    const result = { mode: state.mode, urls, action };
    close(result);
  }

  function open({ mode, text = "", sourceUrl = "", items = [] }) {
    if (state.resolver) close(null);
    state.isOpen = true;
    state.mode = mode;
    state.sourceUrl = sourceUrl;
    state.revision += 1;
    state.query = "";
    state.page = 0;
    state.filter = "all";
    state.previousFocus = document.activeElement;
    elements.search.value = "";
    elements.inputWrap.hidden = mode !== "batch";
    syncHeading();
    if (mode === "batch") {
      elements.input.value = text;
      setBatchText(text, { immediateMetadata: true });
    } else {
      cancelMetadataTimer();
      cancelScheduledRender();
      metadataLoader.reset();
      state.sourceText = "";
      state.items = normalizePlaylistItems(items);
      state.duplicates = [];
      state.unsupported = state.items.filter((item) => !item.available);
      state.selected = new Set(
        state.items.filter((item) => item.available).map((item) => item.id),
      );
      render({ resetScroll: true });
    }
    openRegisteredModal(modal);
    acquireBodyScrollLock(SCROLL_LOCK_OWNER);
    window.setTimeout(() =>
      (mode === "batch" ? elements.input : elements.search).focus(), 0);
    return new Promise((resolve) => {
      state.resolver = resolve;
    });
  }

  const onClick = (event) => {
    const actionElement = event.target.closest("[data-action]");
    const action = actionElement?.dataset.action;
    if (!action) return;
    if (action === "batch-review-cancel") close(null);
    if (action === "batch-review-download") submit("download");
    if (action === "batch-review-enqueue") submit("enqueue");
    if (action === "batch-review-filter") {
      state.filter = actionElement.dataset.filter || "all";
      state.page = 0;
      metadataLoader.reset();
      render({ resetScroll: true });
    }
    if (action === "batch-review-select-all") {
      state.selected = new Set(
        state.items.filter((item) => item.available).map((item) => item.id),
      );
      render();
    }
    if (action === "batch-review-clear") {
      state.selected.clear();
      render();
    }
    if (action === "batch-review-prev") {
      state.page -= 1;
      metadataLoader.reset();
      render({ resetScroll: true });
    }
    if (action === "batch-review-next") {
      state.page += 1;
      metadataLoader.reset();
      render({ resetScroll: true });
    }
  };
  const onChange = (event) => {
    const id = event.target.dataset.itemId;
    if (!id) return;
    if (event.target.checked) state.selected.add(id);
    else state.selected.delete(id);
    render();
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(null);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...modal.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
    )].filter((element) => !element.closest("[hidden]"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const onInput = () => setBatchText(elements.input.value);
  const onSearch = () => {
    state.query = elements.search.value;
    state.page = 0;
    metadataLoader.reset();
    render({ resetScroll: true });
  };
  const onOverlayClick = (event) => {
    if (event.target === modal) close(null);
  };
  const onLanguageChanged = () => {
    syncHeading();
    render();
  };
  elements.input.addEventListener("input", onInput);
  elements.search.addEventListener("input", onSearch);
  modal.addEventListener("click", onClick);
  modal.addEventListener("change", onChange);
  modal.addEventListener("keydown", onKeydown);
  modal.addEventListener("click", onOverlayClick);
  window.addEventListener("i18n:changed", onLanguageChanged);

  return {
    openBatch: ({ text = "" } = {}) => open({ mode: "batch", text }),
    openPlaylist: ({ sourceUrl = "", items = [] } = {}) =>
      open({ mode: "playlist", sourceUrl, items }),
    getDraft: () => cloneDraft(committedDraft),
    cancel: () => close(null),
    reset: resetBatchReview,
    dispose() {
      close(null);
      metadataLoader.dispose();
      unregister();
      elements.input.removeEventListener("input", onInput);
      elements.search.removeEventListener("input", onSearch);
      modal.removeEventListener("click", onClick);
      modal.removeEventListener("change", onChange);
      modal.removeEventListener("keydown", onKeydown);
      modal.removeEventListener("click", onOverlayClick);
      window.removeEventListener("i18n:changed", onLanguageChanged);
    },
  };
}

function initBatchReviewController() {
  runtime?.dispose?.();
  runtime = createBatchReviewController();
  return runtime;
}

const openBatchReview = (options) => runtime?.openBatch(options) || Promise.resolve(null);
const openPlaylistReview = (options) => runtime?.openPlaylist(options) || Promise.resolve(null);
const getBatchReviewDraft = () => cloneDraft(committedDraft);
function resetBatchReview(reason = "reset") {
  committedDraft = null;
  runtime?.cancel?.();
  window.dispatchEvent(new CustomEvent("downloader:batch-reset", { detail: { reason } }));
}

export {
  getBatchReviewDraft,
  initBatchReviewController,
  openBatchReview,
  openPlaylistReview,
  resetBatchReview,
};

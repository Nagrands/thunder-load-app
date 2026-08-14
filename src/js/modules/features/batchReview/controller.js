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
import { normalizePlaylistItems, parseBatchText } from "./model.js";
import { renderBatchReviewItems } from "./view.js";

const PAGE_SIZE = 100;
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
    count: modal.querySelector('[data-ui="batch-review-count"]'),
    issues: modal.querySelector('[data-ui="batch-review-issues"]'),
    quality: modal.querySelector('[data-ui="batch-review-quality"]'),
    list: modal.querySelector('[data-ui="batch-review-list"]'),
    pagination: modal.querySelector('[data-ui="batch-review-pagination"]'),
    page: modal.querySelector('[data-ui="batch-review-page"]'),
    previous: modal.querySelector('[data-action="batch-review-prev"]'),
    next: modal.querySelector('[data-action="batch-review-next"]'),
    enqueue: modal.querySelector('[data-action="batch-review-enqueue"]'),
    download: modal.querySelector('[data-action="batch-review-download"]'),
  };
  const state = {
    mode: "batch",
    items: [],
    duplicates: [],
    unsupported: [],
    selected: new Set(),
    page: 0,
    query: "",
    sourceText: "",
    sourceUrl: "",
    revision: 0,
    resolver: null,
    previousFocus: null,
  };
  const unregister = registerModal(modal);

  const filteredItems = () => {
    const query = state.query.trim().toLowerCase();
    if (!query) return state.items;
    return state.items.filter((item) =>
      `${item.title} ${item.url} ${item.uploader}`.toLowerCase().includes(query),
    );
  };

  function render() {
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
    elements.pagination.hidden = pageCount <= 1;
    elements.page.textContent = t("batchReview.page", {
      page: state.page + 1,
      pages: pageCount,
    });
    elements.previous.disabled = state.page === 0;
    elements.next.disabled = state.page >= pageCount - 1;
    elements.enqueue.disabled = selectedCount === 0;
    elements.download.disabled = selectedCount === 0;
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

  function setBatchText(text) {
    const parsed = parseBatchText(text, { isValidUrl, isSupportedUrl });
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
    render();
  }

  function close(result = null) {
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
    state.mode = mode;
    state.sourceUrl = sourceUrl;
    state.revision += 1;
    state.query = "";
    state.page = 0;
    state.previousFocus = document.activeElement;
    elements.search.value = "";
    elements.inputWrap.hidden = mode !== "batch";
    syncHeading();
    if (mode === "batch") {
      elements.input.value = text;
      setBatchText(text);
    } else {
      state.sourceText = "";
      state.items = normalizePlaylistItems(items);
      state.duplicates = [];
      state.unsupported = state.items.filter((item) => !item.available);
      state.selected = new Set(
        state.items.filter((item) => item.available).map((item) => item.id),
      );
      render();
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
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "batch-review-cancel") close(null);
    if (action === "batch-review-download") submit("download");
    if (action === "batch-review-enqueue") submit("enqueue");
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
      render();
    }
    if (action === "batch-review-next") {
      state.page += 1;
      render();
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
    render();
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

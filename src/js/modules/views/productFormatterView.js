import { formatProductLists } from "../formatters/productListFormatter.js";
import { applyI18n, t } from "../i18n.js";

const DEMO_INPUT = `Витамин
Банан пол пака
Лимон 2кг

Тесто
Грибы 4 кг.
картофель 10 кг.
помидоры 500г
огурцы 1 кг.
перец болгарский 5 шт.
укроп 2 пуч.
петрушка 2 Пуч.
Чеснок 0,5
Лимон 4шт

Магазин
Киви
Банан
Картофель бел 2
Укроп 20
Лук Марс
ПетрушкаЦ 15`;

function fallbackCopyText(value = "") {
  const textarea = document.createElement("textarea");
  textarea.value = String(value || "");
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const success = document.execCommand?.("copy");
  document.body.removeChild(textarea);
  if (!success) {
    throw new Error("copy_failed");
  }
}

async function copyText(value = "") {
  const text = String(value || "");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  fallbackCopyText(text);
}

function buildMarkup() {
  return `
    <div class="products-center">
      <div class="products-formatter-shell" data-ui="products-shell">
        <section class="products-workbench-header wg-glass">
          <div class="products-workbench-header__icon" aria-hidden="true">
            <i class="fa-solid fa-list-check"></i>
          </div>
          <div class="products-workbench-header__copy">
            <h1 data-i18n="productsFormatter.title">${t("productsFormatter.title")}</h1>
            <p data-i18n="productsFormatter.subtitle">${t("productsFormatter.subtitle")}</p>
          </div>
        </section>

        <div class="products-workbench" data-ui="products-workbench">
          <section class="products-pane products-pane--input wg-glass" data-ui="products-input-pane">
            <header class="products-pane__header">
              <div class="products-pane__title products-pane__title--stack">
                <h2 data-i18n="productsFormatter.inputLabel">${t("productsFormatter.inputLabel")}</h2>
              </div>
              <label class="products-formatter-toggle">
                <input
                  id="products-summary-toggle"
                  type="checkbox"
                  checked
                />
                <span data-i18n="productsFormatter.summaryToggle">${t("productsFormatter.summaryToggle")}</span>
              </label>
            </header>

            <div class="products-pane__toolbar" data-ui="products-input-tools">
              <button id="products-paste" type="button" class="small-button products-utility-button">
                <i class="fa-regular fa-paste"></i>
                <span data-i18n="productsFormatter.paste">${t("productsFormatter.paste")}</span>
              </button>
              <button id="products-clear" type="button" class="small-button products-utility-button">
                <i class="fa-solid fa-eraser"></i>
                <span data-i18n="productsFormatter.clear">${t("productsFormatter.clear")}</span>
              </button>
              <button id="products-demo" type="button" class="small-button products-utility-button">
                <i class="fa-solid fa-sparkles"></i>
                <span data-i18n="productsFormatter.demo">${t("productsFormatter.demo")}</span>
              </button>
            </div>

            <div class="products-pane__body products-pane__body--editor">
              <textarea
                id="products-input"
                class="products-formatter-textarea"
                data-i18n-placeholder="productsFormatter.inputPlaceholder"
                placeholder="${t("productsFormatter.inputPlaceholder")}"
                aria-label="${t("productsFormatter.inputLabel")}"
                data-i18n-aria="productsFormatter.inputLabel"
                spellcheck="false"
              ></textarea>
            </div>

            <footer class="products-pane__footer">
              <button
                id="products-format"
                type="button"
                class="large-button"
              >
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <span data-i18n="productsFormatter.format">${t("productsFormatter.format")}</span>
              </button>
            </footer>
          </section>

          <section class="products-pane products-pane--result wg-glass" data-ui="products-result-pane">
            <header class="products-pane__header products-pane__header--result">
              <div class="products-pane__title products-pane__title--stack">
                <h2 data-i18n="productsFormatter.outputLabel">${t("productsFormatter.outputLabel")}</h2>
                <div
                  id="products-status"
                  class="products-formatter-status"
                  role="status"
                  aria-live="polite"
                ></div>
              </div>
              <button
                id="products-copy"
                type="button"
                class="small-button products-copy-button"
                disabled
              >
                <i class="fa-regular fa-copy"></i>
                <span data-i18n="productsFormatter.copy">${t("productsFormatter.copy")}</span>
              </button>
            </header>

            <div
              id="products-result-meta"
              class="products-result-meta"
              data-ui="products-result-meta"
              hidden
            >
              <span id="products-meta-sections" class="products-result-meta__pill"></span>
              <span id="products-meta-items" class="products-result-meta__pill"></span>
              <span id="products-meta-summary" class="products-result-meta__pill products-result-meta__pill--accent"></span>
            </div>

            <div class="products-pane__body products-pane__body--result">
              <div
                id="products-output-empty"
                class="products-formatter-empty"
                data-i18n="productsFormatter.empty"
                data-ui="products-empty"
              >
                ${t("productsFormatter.empty")}
              </div>

              <div
                id="products-result-content"
                class="products-result-content"
                data-ui="products-result-content"
                hidden
              >
                <div
                  id="products-summary-card"
                  class="products-summary-card"
                  data-ui="products-summary-card"
                  hidden
                ></div>
                <div
                  id="products-preview-scroll"
                  class="products-preview-scroll"
                  data-ui="products-preview-scroll"
                >
                  <div
                    id="products-preview"
                    class="products-preview"
                    data-ui="products-preview"
                  ></div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

function createSectionBlock(title, items = [], type = "section") {
  const section = document.createElement("section");
  section.className =
    type === "summary"
      ? "products-preview__section products-preview__section--summary"
      : "products-preview__section";
  section.dataset.previewType = type;

  const heading = document.createElement("h3");
  heading.className = "products-preview__title";
  heading.textContent = title;
  section.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "products-preview__list";

  items.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "products-preview__item";
    item.textContent = entry.line || entry.text || "";
    list.appendChild(item);
  });

  section.appendChild(list);
  return section;
}

function renderPreview(previewEl, summaryCardEl, result) {
  if (!previewEl || !summaryCardEl) return;

  previewEl.replaceChildren();
  summaryCardEl.replaceChildren();
  summaryCardEl.hidden = !result.summary;

  if (result.summary) {
    summaryCardEl.appendChild(
      createSectionBlock(result.summary.title, result.summary.items, "summary"),
    );
  }

  result.sections.forEach((section) => {
    previewEl.appendChild(createSectionBlock(section.title, section.items));
  });
}

function getMetrics(result) {
  const sectionCount = result.sections.length;
  const itemCount = result.sections.reduce(
    (total, section) => total + section.items.length,
    0,
  );
  return {
    sectionCount,
    itemCount,
    hasSummary: !!result.summary,
  };
}

function setCopyButtonState(copyButton, mode = "idle") {
  if (!copyButton) return;
  copyButton.dataset.state = mode;
  const label = copyButton.querySelector("span");
  const icon = copyButton.querySelector("i");
  if (!label || !icon) return;

  if (mode === "success") {
    label.textContent = t("productsFormatter.copyDone");
    icon.className = "fa-solid fa-check";
    return;
  }

  label.textContent = t("productsFormatter.copy");
  icon.className = "fa-regular fa-copy";
}

export default function renderProductFormatterView(wrapper) {
  if (!wrapper) return wrapper;

  if (!wrapper.__productsFormatterBuilt) {
    wrapper.innerHTML = buildMarkup();
    wrapper.classList.add("products-view", "tab-content");
    wrapper.__productsFormatterBuilt = true;
  }

  const input = wrapper.querySelector("#products-input");
  const includeSummary = wrapper.querySelector("#products-summary-toggle");
  const formatButton = wrapper.querySelector("#products-format");
  const pasteButton = wrapper.querySelector("#products-paste");
  const clearButton = wrapper.querySelector("#products-clear");
  const demoButton = wrapper.querySelector("#products-demo");
  const copyButton = wrapper.querySelector("#products-copy");
  const preview = wrapper.querySelector("#products-preview");
  const summaryCard = wrapper.querySelector("#products-summary-card");
  const resultContent = wrapper.querySelector("#products-result-content");
  const resultMeta = wrapper.querySelector("#products-result-meta");
  const metaSections = wrapper.querySelector("#products-meta-sections");
  const metaItems = wrapper.querySelector("#products-meta-items");
  const metaSummary = wrapper.querySelector("#products-meta-summary");
  const empty = wrapper.querySelector("#products-output-empty");
  const status = wrapper.querySelector("#products-status");

  const state =
    wrapper.__productsFormatterState ||
    (wrapper.__productsFormatterState = {
      copiedText: "",
      hasResult: false,
      copyFeedbackTimer: null,
    });

  const setStatus = (message = "", tone = "") => {
    if (!status) return;
    status.textContent = message;
    if (tone) status.dataset.tone = tone;
    else delete status.dataset.tone;
  };

  const clearCopyFeedbackTimer = () => {
    if (!state.copyFeedbackTimer) return;
    clearTimeout(state.copyFeedbackTimer);
    state.copyFeedbackTimer = null;
  };

  const resetPreview = () => {
    state.copiedText = "";
    state.hasResult = false;
    clearCopyFeedbackTimer();
    preview?.replaceChildren();
    summaryCard?.replaceChildren();
    if (summaryCard) summaryCard.hidden = true;
    if (resultContent) resultContent.hidden = true;
    if (resultMeta) resultMeta.hidden = true;
    if (empty) empty.hidden = false;
    if (copyButton) {
      copyButton.disabled = true;
      setCopyButtonState(copyButton, "idle");
    }
  };

  const updateMetrics = (result) => {
    const metrics = getMetrics(result);
    if (metaSections) {
      metaSections.textContent = t("productsFormatter.meta.sections", {
        count: metrics.sectionCount,
      });
    }
    if (metaItems) {
      metaItems.textContent = t("productsFormatter.meta.items", {
        count: metrics.itemCount,
      });
    }
    if (metaSummary) {
      metaSummary.textContent = metrics.hasSummary
        ? t("productsFormatter.meta.summaryOn")
        : t("productsFormatter.meta.summaryOff");
    }
  };

  const showResult = (result) => {
    state.copiedText = result.fullOutputText;
    state.hasResult = !!result.fullOutputText;
    clearCopyFeedbackTimer();
    renderPreview(preview, summaryCard, result);
    updateMetrics(result);
    if (resultMeta) resultMeta.hidden = false;
    if (resultContent) resultContent.hidden = false;
    if (empty) empty.hidden = true;
    if (copyButton) {
      copyButton.disabled = !state.hasResult;
      setCopyButtonState(copyButton, state.hasResult ? "ready" : "idle");
    }
  };

  if (!wrapper.__productsFormatterBound) {
    formatButton?.addEventListener("click", () => {
      const source = String(input?.value || "").trim();
      if (!source) {
        resetPreview();
        setStatus(t("productsFormatter.status.empty"), "warning");
        return;
      }

      const result = formatProductLists(source, {
        includeSummary: includeSummary?.checked !== false,
        labels: {
          summary: t("productsFormatter.summaryTitle"),
          unsorted: t("productsFormatter.unsorted"),
        },
      });

      showResult(result);
      setStatus(t("productsFormatter.status.formatted"), "success");
    });

    pasteButton?.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard?.readText?.();
        if (!text) {
          resetPreview();
          input.value = "";
          input.focus();
          setStatus(t("productsFormatter.status.pasteEmpty"), "warning");
          return;
        }
        input.value = text;
        input.focus();
        resetPreview();
        setStatus(t("productsFormatter.status.pasted"), "success");
      } catch {
        setStatus(t("productsFormatter.status.pasteError"), "error");
      }
    });

    clearButton?.addEventListener("click", () => {
      input.value = "";
      input.focus();
      resetPreview();
      setStatus(t("productsFormatter.status.cleared"));
    });

    demoButton?.addEventListener("click", () => {
      input.value = DEMO_INPUT;
      input.focus();
      resetPreview();
      setStatus(t("productsFormatter.status.demoLoaded"), "success");
    });

    copyButton?.addEventListener("click", async () => {
      if (!state.copiedText) return;
      try {
        await copyText(state.copiedText);
        clearCopyFeedbackTimer();
        setCopyButtonState(copyButton, "success");
        setStatus(t("productsFormatter.status.copied"), "success");
        state.copyFeedbackTimer = setTimeout(() => {
          setCopyButtonState(copyButton, state.hasResult ? "ready" : "idle");
          state.copyFeedbackTimer = null;
        }, 1400);
      } catch {
        setStatus(t("productsFormatter.status.copyError"), "error");
      }
    });

    input?.addEventListener("input", () => {
      if (String(input.value || "").trim()) return;
      resetPreview();
      setStatus("", "");
    });

    wrapper.__productsFormatterBound = true;
  }

  applyI18n(wrapper);
  return wrapper;
}

import { formatProductLists } from "../formatters/productListFormatter.js";
import { applyI18n, t } from "../i18n.js";
import { initTooltips } from "../tooltipInitializer.js";

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
                <div class="products-pane__toggles">
                  <label class="products-formatter-toggle">
                    <input
                      id="products-summary-toggle"
                      type="checkbox"
                      checked
                    />
                    <span data-i18n="productsFormatter.summaryToggle">${t("productsFormatter.summaryToggle")}</span>
                  </label>
                  <label class="products-formatter-toggle">
                    <input
                      id="products-greens-toggle"
                      type="checkbox"
                    />
                    <span data-i18n="productsFormatter.greensToggle">${t("productsFormatter.greensToggle")}</span>
                  </label>
                </div>
              </div>
            </header>

            <div class="products-pane__toolbar" data-ui="products-input-tools">
              <button
                id="products-paste"
                type="button"
                class="small-button products-utility-button products-utility-button--icon"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                title="${t("productsFormatter.paste")}"
                data-i18n-title="productsFormatter.paste"
                aria-label="${t("productsFormatter.paste")}"
                data-i18n-aria="productsFormatter.paste"
              >
                <i class="fa-regular fa-paste"></i>
              </button>
              <button
                id="products-clear"
                type="button"
                class="small-button products-utility-button products-utility-button--icon"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                title="${t("productsFormatter.clear")}"
                data-i18n-title="productsFormatter.clear"
                aria-label="${t("productsFormatter.clear")}"
                data-i18n-aria="productsFormatter.clear"
              >
                <i class="fa-solid fa-eraser"></i>
              </button>
              <button
                id="products-demo"
                type="button"
                class="small-button products-utility-button products-utility-button--icon"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                title="${t("productsFormatter.demo")}"
                data-i18n-title="productsFormatter.demo"
                aria-label="${t("productsFormatter.demo")}"
                data-i18n-aria="productsFormatter.demo"
              >
                <i class="fa-solid fa-sparkles"></i>
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
                class="large-button products-format-button"
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
                class="small-button products-copy-button products-icon-button"
                disabled
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                title="${t("productsFormatter.copy")}"
                data-i18n-title="productsFormatter.copy"
                aria-label="${t("productsFormatter.copy")}"
                data-i18n-aria="productsFormatter.copy"
              >
                <i class="fa-regular fa-copy"></i>
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
              <span id="products-meta-greens" class="products-result-meta__pill products-result-meta__pill--accent"></span>
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
                  id="products-diagnostics"
                  class="products-diagnostics"
                  data-ui="products-diagnostics"
                  hidden
                >
                  <section
                    id="products-issues-panel"
                    class="products-diagnostics__panel"
                    data-ui="products-issues-panel"
                    hidden
                  >
                    <h3 class="products-diagnostics__title" data-i18n="productsFormatter.diagnostics.issues">${t("productsFormatter.diagnostics.issues")}</h3>
                    <div id="products-issues-list" class="products-issues-list"></div>
                  </section>

                  <section
                    id="products-diff-panel"
                    class="products-diagnostics__panel"
                    data-ui="products-diff-panel"
                    hidden
                  >
                    <h3 class="products-diagnostics__title" data-i18n="productsFormatter.diagnostics.diff">${t("productsFormatter.diagnostics.diff")}</h3>
                    <div id="products-diff-list" class="products-diff-list"></div>
                  </section>
                </div>
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

function createSectionBlock(title, items = [], type = "section", text = "", onCopy) {
  const section = document.createElement("section");
  section.className =
    type === "summary"
      ? "products-preview__section products-preview__section--summary"
      : "products-preview__section";
  section.dataset.previewType = type;

  const header = document.createElement("div");
  header.className = "products-preview__header";

  const heading = document.createElement("h3");
  heading.className = "products-preview__title";
  heading.textContent = title;
  header.appendChild(heading);

  if (text && typeof onCopy === "function") {
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className =
      "small-button products-section-copy products-icon-button";
    copyButton.dataset.copyText = text;
    copyButton.setAttribute("data-bs-toggle", "tooltip");
    copyButton.setAttribute("data-bs-placement", "top");
    copyButton.setAttribute("title", t("productsFormatter.copy"));
    copyButton.setAttribute("aria-label", t("productsFormatter.copy"));
    copyButton.innerHTML = `<i class="fa-regular fa-copy" aria-hidden="true"></i>`;
    copyButton.addEventListener("click", () => onCopy(text));
    header.appendChild(copyButton);
  }

  section.appendChild(header);

  const list = document.createElement("ul");
  list.className = "products-preview__list";

  items.forEach((entry) => {
    const item = document.createElement("li");
    item.className = entry.uncertain
      ? "products-preview__item products-preview__item--uncertain"
      : "products-preview__item";
    const textNode = document.createElement("span");
    textNode.className = "products-preview__item-text";
    textNode.textContent = entry.line || entry.text || "";
    item.appendChild(textNode);

    if (entry.uncertain) {
      const badge = document.createElement("span");
      badge.className = "products-preview__badge";
      badge.textContent = t("productsFormatter.uncertain");
      item.appendChild(badge);
    }
    list.appendChild(item);
  });

  section.appendChild(list);
  return section;
}

function formatIssue(issue) {
  if (!issue?.code) return "";
  switch (issue.code) {
    case "ambiguousUnitAssumedKg":
      return t("productsFormatter.issue.ambiguousUnitAssumedKg", {
        source: issue.source,
        output: issue.output,
      });
    case "duplicateMerged":
      return t("productsFormatter.issue.duplicateMerged", {
        section: issue.sectionTitle,
        name: issue.displayName,
      });
    case "storeQuantityIgnored":
      return t("productsFormatter.issue.storeQuantityIgnored", {
        section: issue.sectionTitle,
        source: issue.source,
      });
    case "typoCorrected":
      return t("productsFormatter.issue.typoCorrected", {
        source: issue.source,
        name: issue.displayName,
      });
    default:
      return issue.source || issue.displayName || issue.code;
  }
}

function renderDiagnostics(issuesEl, diffEl, diagnosticsEl, result) {
  if (!issuesEl || !diffEl || !diagnosticsEl) return;

  issuesEl.replaceChildren();
  diffEl.replaceChildren();

  const issues = Array.isArray(result.issues) ? result.issues : [];
  const diffEntries = Array.isArray(result.diffEntries) ? result.diffEntries : [];

  issues.forEach((issue) => {
    const item = document.createElement("div");
    item.className = "products-issue";
    item.textContent = formatIssue(issue);
    issuesEl.appendChild(item);
  });

  diffEntries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = entry.uncertain
      ? "products-diff-row products-diff-row--uncertain"
      : "products-diff-row";

    const meta = document.createElement("div");
    meta.className = "products-diff-row__meta";
    meta.textContent = entry.sectionTitle;
    row.appendChild(meta);

    const source = document.createElement("div");
    source.className = "products-diff-row__source";
    source.textContent = entry.source;
    row.appendChild(source);

    const output = document.createElement("div");
    output.className = "products-diff-row__output";
    output.textContent = entry.output;
    row.appendChild(output);

    diffEl.appendChild(row);
  });

  const issuesPanel = issuesEl.closest('[data-ui="products-issues-panel"]');
  const diffPanel = diffEl.closest('[data-ui="products-diff-panel"]');
  if (issuesPanel) issuesPanel.hidden = issues.length === 0;
  if (diffPanel) diffPanel.hidden = diffEntries.length === 0;
  diagnosticsEl.hidden = issues.length === 0 && diffEntries.length === 0;
}

function renderPreview(previewEl, summaryCardEl, result, onCopySection) {
  if (!previewEl || !summaryCardEl) return;

  previewEl.replaceChildren();
  summaryCardEl.replaceChildren();
  summaryCardEl.hidden = true;

  result.sections.forEach((section) => {
    previewEl.appendChild(
      createSectionBlock(
        section.title,
        section.items,
        "section",
        section.text,
        onCopySection,
      ),
    );
  });

  if (result.summary) {
    previewEl.appendChild(
      createSectionBlock(
        result.summary.title,
        result.summary.items,
        "summary",
        result.summary.text,
        onCopySection,
      ),
    );
  }

  if (result.greensSummary) {
    previewEl.appendChild(
      createSectionBlock(
        result.greensSummary.title,
        result.greensSummary.items,
        "summary",
        result.greensSummary.text,
        onCopySection,
      ),
    );
  }
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
    hasGreensSummary: !!result.greensSummary,
  };
}

function setCopyButtonState(copyButton, mode = "idle") {
  if (!copyButton) return;
  copyButton.dataset.state = mode;
  const icon = copyButton.querySelector("i");
  if (!icon) return;

  if (mode === "success") {
    icon.className = "fa-solid fa-check";
    copyButton.setAttribute("title", t("productsFormatter.copyDone"));
    copyButton.setAttribute("aria-label", t("productsFormatter.copyDone"));
    return;
  }

  icon.className = "fa-regular fa-copy";
  copyButton.setAttribute("title", t("productsFormatter.copy"));
  copyButton.setAttribute("aria-label", t("productsFormatter.copy"));
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
  const includeGreensSummary = wrapper.querySelector("#products-greens-toggle");
  const formatButton = wrapper.querySelector("#products-format");
  const pasteButton = wrapper.querySelector("#products-paste");
  const clearButton = wrapper.querySelector("#products-clear");
  const demoButton = wrapper.querySelector("#products-demo");
  const copyButton = wrapper.querySelector("#products-copy");
  const preview = wrapper.querySelector("#products-preview");
  const summaryCard = wrapper.querySelector("#products-summary-card");
  const resultContent = wrapper.querySelector("#products-result-content");
  const resultMeta = wrapper.querySelector("#products-result-meta");
  const diagnostics = wrapper.querySelector("#products-diagnostics");
  const issuesList = wrapper.querySelector("#products-issues-list");
  const diffList = wrapper.querySelector("#products-diff-list");
  const metaSections = wrapper.querySelector("#products-meta-sections");
  const metaItems = wrapper.querySelector("#products-meta-items");
  const metaSummary = wrapper.querySelector("#products-meta-summary");
  const metaGreens = wrapper.querySelector("#products-meta-greens");
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
    if (diagnostics) diagnostics.hidden = true;
    issuesList?.replaceChildren();
    diffList?.replaceChildren();
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
    if (metaGreens) {
      metaGreens.textContent = metrics.hasGreensSummary
        ? t("productsFormatter.meta.greensOn")
        : t("productsFormatter.meta.greensOff");
    }
  };

  const showResult = (result) => {
    state.copiedText = result.fullOutputText;
    state.hasResult = !!result.fullOutputText;
    clearCopyFeedbackTimer();
    renderPreview(preview, summaryCard, result, async (sectionText) => {
      try {
        await copyText(sectionText);
        clearCopyFeedbackTimer();
        setStatus(t("productsFormatter.status.sectionCopied"), "success");
      } catch {
        setStatus(t("productsFormatter.status.copyError"), "error");
      }
    });
    renderDiagnostics(issuesList, diffList, diagnostics, result);
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
        includeGreensSummary: includeGreensSummary?.checked === true,
        labels: {
          summary: t("productsFormatter.summaryTitle"),
          greens: t("productsFormatter.greensTitle"),
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
        initTooltips(wrapper);
        setStatus(t("productsFormatter.status.copied"), "success");
        state.copyFeedbackTimer = setTimeout(() => {
          setCopyButtonState(copyButton, state.hasResult ? "ready" : "idle");
          initTooltips(wrapper);
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

    input?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      formatButton?.click();
    });

    wrapper.__productsFormatterBound = true;
  }

  applyI18n(wrapper);
  initTooltips(wrapper);
  return wrapper;
}

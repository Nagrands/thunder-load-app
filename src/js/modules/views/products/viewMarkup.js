import { t } from "../../i18n.js";

export function buildMarkup() {
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
                  <label
                    class="products-formatter-toggle"
                    data-bs-toggle="tooltip"
                    data-bs-placement="top"
                    title="${t("productsFormatter.summaryToggleHint")}"
                    data-i18n-title="productsFormatter.summaryToggleHint"
                    aria-label="${t("productsFormatter.summaryToggleHint")}"
                    data-i18n-aria="productsFormatter.summaryToggleHint"
                  >
                    <input
                      id="products-summary-toggle"
                      type="checkbox"
                      checked
                    />
                    <span data-i18n="productsFormatter.summaryToggle">${t("productsFormatter.summaryToggle")}</span>
                  </label>
                  <label
                    class="products-formatter-toggle"
                    data-bs-toggle="tooltip"
                    data-bs-placement="top"
                    title="${t("productsFormatter.greensToggleHint")}"
                    data-i18n-title="productsFormatter.greensToggleHint"
                    aria-label="${t("productsFormatter.greensToggleHint")}"
                    data-i18n-aria="productsFormatter.greensToggleHint"
                  >
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
                <i class="fa-solid fa-flask"></i>
              </button>
              <button
                id="products-dictionary-toggle"
                type="button"
                class="small-button products-utility-button products-utility-button--icon"
                aria-expanded="false"
                aria-controls="products-dictionary-layer"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                title="${t("productsFormatter.dictionaryTitle")}"
                data-i18n-title="productsFormatter.dictionaryTitle"
                aria-label="${t("productsFormatter.dictionaryTitle")}"
                data-i18n-aria="productsFormatter.dictionaryTitle"
              >
                <i class="fa-solid fa-book-bookmark"></i>
              </button>
            </div>

            <div
              id="products-dictionary-layer"
              class="products-dictionary-layer"
              data-ui="products-dictionary"
              hidden
            >
              <div class="products-dictionary__backdrop" data-ui="products-dictionary-backdrop"></div>
              <div
                id="products-dictionary-panel"
                class="products-dictionary"
                data-ui="products-dictionary-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="products-dictionary-title"
              >
                <div class="products-dictionary__header">
                  <span
                    id="products-dictionary-title"
                    class="products-dictionary__title"
                    data-i18n="productsFormatter.dictionaryTitle"
                  >${t("productsFormatter.dictionaryTitle")}</span>
                  <button
                    id="products-dictionary-close"
                    type="button"
                    class="small-button products-icon-button products-dictionary__close"
                    data-bs-toggle="tooltip"
                    data-bs-placement="top"
                    title="${t("productsFormatter.closeDictionary")}"
                    data-i18n-title="productsFormatter.closeDictionary"
                    aria-label="${t("productsFormatter.closeDictionary")}"
                    data-i18n-aria="productsFormatter.closeDictionary"
                  >
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div class="products-dictionary__body">
                  <textarea
                    id="products-dictionary-input"
                    class="products-dictionary__textarea"
                    data-i18n-placeholder="productsFormatter.dictionaryPlaceholder"
                    placeholder="${t("productsFormatter.dictionaryPlaceholder")}"
                    spellcheck="false"
                  ></textarea>
                  <div
                    class="products-dictionary__hint"
                    data-i18n="productsFormatter.dictionaryHint"
                  >${t("productsFormatter.dictionaryHint")}</div>
                  <div
                    class="products-dictionary__examples"
                    data-ui="products-dictionary-examples"
                  >
                    <div class="products-dictionary__examples-title" data-i18n="productsFormatter.dictionaryExamplesTitle">${t("productsFormatter.dictionaryExamplesTitle")}</div>
                    <div class="products-dictionary__examples-list">
                      <span class="products-dictionary__example">батат = Картофель сладкий</span>
                      <span class="products-dictionary__example">лук зел = Лук зеленый</span>
                      <span class="products-dictionary__example">черри = Помидор Черри</span>
                    </div>
                  </div>
                  <div
                    id="products-dictionary-preview"
                    class="products-dictionary__preview"
                    data-ui="products-dictionary-preview"
                  >
                    <div class="products-dictionary__preview-title" data-i18n="productsFormatter.dictionaryPreviewTitle">${t("productsFormatter.dictionaryPreviewTitle")}</div>
                    <div id="products-dictionary-preview-body" class="products-dictionary__preview-body"></div>
                  </div>
                  <div
                    id="products-dictionary-summary"
                    class="products-dictionary__summary"
                    data-ui="products-dictionary-summary"
                    hidden
                  ></div>
                  <div class="products-dictionary__actions">
                    <div
                      id="products-dictionary-meta"
                      class="products-dictionary__meta"
                      role="status"
                      aria-live="polite"
                    ></div>
                    <div class="products-dictionary__buttons">
                      <button
                        id="products-dictionary-clean-invalid"
                        type="button"
                        class="small-button products-dictionary__reset"
                      >
                        <span data-i18n="productsFormatter.dictionaryCleanInvalid">${t("productsFormatter.dictionaryCleanInvalid")}</span>
                      </button>
                      <button
                        id="products-dictionary-reset"
                        type="button"
                        class="small-button products-dictionary__reset"
                      >
                        <span data-i18n="productsFormatter.dictionaryReset">${t("productsFormatter.dictionaryReset")}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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

            <footer class="products-pane__footer products-pane__footer--action">
              <div
                id="products-dirty-state"
                class="products-dirty-state"
                data-ui="products-dirty-state"
                hidden
              >
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                <span
                  id="products-dirty-text"
                  data-i18n="productsFormatter.staleBanner"
                >${t("productsFormatter.staleBanner")}</span>
              </div>
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
              class="products-result-toolbar"
              data-ui="products-result-toolbar"
              hidden
            >
              <label class="products-result-search">
                <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <input
                  id="products-search"
                  type="search"
                  data-i18n-placeholder="productsFormatter.resultActions.searchPlaceholder"
                  placeholder="${t("productsFormatter.resultActions.searchPlaceholder")}"
                  aria-label="${t("productsFormatter.resultActions.searchPlaceholder")}"
                  data-i18n-aria="productsFormatter.resultActions.searchPlaceholder"
                />
              </label>

              <div
                class="products-result-menu"
                data-ui="products-result-menu"
              >
                <button
                  id="products-result-menu-toggle"
                  type="button"
                  class="small-button products-utility-button products-result-menu__toggle"
                  aria-expanded="false"
                  aria-controls="products-result-menu-panel"
                >
                  <i class="fa-solid fa-sliders" aria-hidden="true"></i>
                  <span data-i18n="productsFormatter.resultActions.more">${t("productsFormatter.resultActions.more")}</span>
                </button>

                <div
                  id="products-result-menu-panel"
                  class="products-result-menu__panel"
                  data-ui="products-result-menu-panel"
                  hidden
                >
                  <button
                    id="products-collapse-all"
                    type="button"
                    class="products-result-menu__item"
                  >
                    <span data-i18n="productsFormatter.resultActions.collapseAll">${t("productsFormatter.resultActions.collapseAll")}</span>
                  </button>
                  <button
                    id="products-expand-all"
                    type="button"
                    class="products-result-menu__item"
                  >
                    <span data-i18n="productsFormatter.resultActions.expandAll">${t("productsFormatter.resultActions.expandAll")}</span>
                  </button>
                  <button
                    id="products-apply-input"
                    type="button"
                    class="products-result-menu__item"
                  >
                    <span data-i18n="productsFormatter.resultActions.applyInput">${t("productsFormatter.resultActions.applyInput")}</span>
                  </button>
                  <label class="products-result-menu__item products-result-menu__item--toggle">
                    <input id="products-filter-uncertain" type="checkbox" />
                    <span data-i18n="productsFormatter.resultActions.onlyUncertain">${t("productsFormatter.resultActions.onlyUncertain")}</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="products-pane__body products-pane__body--result">
              <div
                id="products-output-empty"
                class="products-formatter-empty"
                data-ui="products-empty"
              >
                <div class="products-formatter-empty__content">
                  <div
                    class="products-formatter-empty__title"
                    data-i18n="productsFormatter.emptyTitle"
                  >${t("productsFormatter.emptyTitle")}</div>
                  <div
                    class="products-formatter-empty__hint"
                    data-i18n="productsFormatter.emptyHint"
                  >${t("productsFormatter.emptyHint")}</div>
                  <div class="products-formatter-empty__actions">
                    <button
                      id="products-empty-paste"
                      type="button"
                      class="small-button products-utility-button"
                    >
                      <i class="fa-regular fa-paste" aria-hidden="true"></i>
                      <span data-i18n="productsFormatter.paste">${t("productsFormatter.paste")}</span>
                    </button>
                    <button
                      id="products-empty-demo"
                      type="button"
                      class="small-button products-utility-button"
                    >
                      <i class="fa-solid fa-flask" aria-hidden="true"></i>
                      <span data-i18n="productsFormatter.demo">${t("productsFormatter.demo")}</span>
                    </button>
                  </div>
                  <div
                    class="products-formatter-empty__shortcut"
                    data-i18n="productsFormatter.shortcutHint"
                  >${t("productsFormatter.shortcutHint")}</div>
                </div>
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
                  <div
                    id="products-diagnostics-filters"
                    class="products-diagnostics__filters"
                    data-ui="products-diagnostics-filters"
                  >
                    <button
                      type="button"
                      class="small-button products-diagnostics__filter"
                      data-filter="all"
                      data-i18n="productsFormatter.diagnostics.filter.all"
                    >${t("productsFormatter.diagnostics.filter.all")}</button>
                    <button
                      type="button"
                      class="small-button products-diagnostics__filter"
                      data-filter="review"
                      data-i18n="productsFormatter.diagnostics.filter.review"
                    >${t("productsFormatter.diagnostics.filter.review")}</button>
                    <button
                      type="button"
                      class="small-button products-diagnostics__filter"
                      data-filter="typos"
                      data-i18n="productsFormatter.diagnostics.filter.typos"
                    >${t("productsFormatter.diagnostics.filter.typos")}</button>
                    <button
                      type="button"
                      class="small-button products-diagnostics__filter"
                      data-filter="duplicates"
                      data-i18n="productsFormatter.diagnostics.filter.duplicates"
                    >${t("productsFormatter.diagnostics.filter.duplicates")}</button>
                  </div>
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
                    <button
                      id="products-diff-toggle"
                      type="button"
                      class="products-diagnostics__toggle"
                      aria-expanded="false"
                    >
                      <span class="products-diagnostics__toggle-copy">
                        <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                        <span
                          class="products-diagnostics__title"
                          data-i18n="productsFormatter.diagnostics.diff"
                        >${t("productsFormatter.diagnostics.diff")}</span>
                      </span>
                    </button>
                    <div id="products-diff-list" class="products-diff-list" hidden></div>
                  </section>

                  <section
                    id="products-comparison-panel"
                    class="products-diagnostics__panel"
                    data-ui="products-comparison-panel"
                    hidden
                  >
                    <h3 class="products-diagnostics__title" data-i18n="productsFormatter.diagnostics.comparison">${t("productsFormatter.diagnostics.comparison")}</h3>
                    <div
                      id="products-comparison-summary"
                      class="products-comparison-summary"
                    ></div>
                    <div id="products-comparison-list" class="products-comparison-list"></div>
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

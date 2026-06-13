const i18n = (t, key, params) => t(key, params);

export function renderFileSorterView(t) {
  return `
    <section class="tools-view hidden" data-tool-view="sorter" aria-label="${i18n(t, "tools.nav.current.sorter")}">
      <article class="tools-card tools-detail-card sorter-shell">
        <div class="tools-card__header sorter-header">
          <div class="sorter-header__mark" aria-hidden="true">
            <i class="fa-solid fa-layer-group"></i>
          </div>
          <div class="sorter-header__copy">
            <h2 data-i18n="tools.sorter.title">${i18n(t, "tools.sorter.title")}</h2>
            <p class="tools-card__hint" data-i18n="tools.sorter.subtitle">${i18n(t, "tools.sorter.subtitle")}</p>
          </div>
          <div class="sorter-header__actions">
            <button id="sorter-pick-folder" type="button" class="small-button sorter-icon-action" data-bs-toggle="tooltip" data-bs-placement="top" data-i18n-title="tools.sorter.pickFolder" data-i18n-aria="tools.sorter.pickFolder" title="${i18n(t, "tools.sorter.pickFolder")}" aria-label="${i18n(t, "tools.sorter.pickFolder")}">
              <i class="fa-regular fa-folder-open"></i>
            </button>
            <button id="sorter-open-folder" type="button" class="small-button sorter-icon-action" data-bs-toggle="tooltip" data-bs-placement="top" data-i18n-title="tools.sorter.openFolder" data-i18n-aria="tools.sorter.openFolder" title="${i18n(t, "tools.sorter.openFolder")}" aria-label="${i18n(t, "tools.sorter.openFolder")}" disabled>
              <i class="fa-solid fa-up-right-from-square"></i>
            </button>
            <button id="sorter-preview-run" type="button" class="small-button sorter-icon-action" data-bs-toggle="tooltip" data-bs-placement="top" data-i18n-title="tools.sorter.preview.show" data-i18n-aria="tools.sorter.preview.show" title="${i18n(t, "tools.sorter.preview.show")}" aria-label="${i18n(t, "tools.sorter.preview.show")}" aria-controls="sorter-preview-panel" aria-expanded="false">
              <i class="fa-regular fa-eye"></i>
            </button>
          </div>
        </div>

        <div class="sorter-folder-line">
          <i class="fa-regular fa-folder" aria-hidden="true"></i>
          <span id="sorter-folder-pill" class="muted" data-i18n="tools.sorter.noFolder">${i18n(t, "tools.sorter.noFolder")}</span>
        </div>

        <div class="sorter-config-surface">
          <section class="sorter-options-panel">
            <div class="sorter-config-heading">
              <h3 data-i18n="tools.sorter.options.title">${i18n(t, "tools.sorter.options.title")}</h3>
            </div>
            <div class="sorter-options-grid">
              <div class="sorter-option-field">
                <label for="sorter-conflict-toggle" class="muted" data-i18n="tools.sorter.conflicts.label">${i18n(t, "tools.sorter.conflicts.label")}</label>
                <div class="sorter-conflict-select" data-sorter-conflict-select>
                  <button id="sorter-conflict-toggle" type="button" class="sorter-conflict-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="sorter-conflict-menu">
                    <span id="sorter-conflict-label" data-i18n="tools.sorter.conflicts.rename">${i18n(t, "tools.sorter.conflicts.rename")}</span>
                    <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
                  </button>
                  <input id="sorter-conflict-mode" type="hidden" value="rename" />
                  <div id="sorter-conflict-menu" class="sorter-conflict-menu hidden" role="listbox" aria-label="${i18n(t, "tools.sorter.conflicts.label")}">
                    <button type="button" class="sorter-conflict-option" role="option" data-conflict-mode="rename" aria-selected="true">
                      <span data-i18n="tools.sorter.conflicts.rename">${i18n(t, "tools.sorter.conflicts.rename")}</span>
                      <i class="fa-solid fa-check" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="sorter-conflict-option" role="option" data-conflict-mode="skip" aria-selected="false">
                      <span data-i18n="tools.sorter.conflicts.skip">${i18n(t, "tools.sorter.conflicts.skip")}</span>
                      <i class="fa-solid fa-check" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="sorter-conflict-option" role="option" data-conflict-mode="replace" aria-selected="false">
                      <span data-i18n="tools.sorter.conflicts.replace">${i18n(t, "tools.sorter.conflicts.replace")}</span>
                      <i class="fa-solid fa-check" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </div>
              <label class="sorter-option-toggle" for="sorter-recursive">
                <span data-i18n="tools.sorter.recursive.label">${i18n(t, "tools.sorter.recursive.label")}</span>
                <input id="sorter-recursive" type="checkbox" />
              </label>
              <div class="sorter-option-field">
                <label for="sorter-ignore-extensions" class="muted" data-i18n="tools.sorter.ignoreExtensions.label">${i18n(t, "tools.sorter.ignoreExtensions.label")}</label>
                <input id="sorter-ignore-extensions" type="text" class="wg-input" data-i18n-placeholder="tools.sorter.ignoreExtensions.placeholder" placeholder="${i18n(t, "tools.sorter.ignoreExtensions.placeholder")}" />
              </div>
              <div class="sorter-option-field">
                <label for="sorter-ignore-folders" class="muted" data-i18n="tools.sorter.ignoreFolders.label">${i18n(t, "tools.sorter.ignoreFolders.label")}</label>
                <input id="sorter-ignore-folders" type="text" class="wg-input" data-i18n-placeholder="tools.sorter.ignoreFolders.placeholder" placeholder="${i18n(t, "tools.sorter.ignoreFolders.placeholder")}" />
              </div>
            </div>
          </section>

          <section class="sorter-rules-panel">
            <div class="sorter-config-heading sorter-rules-panel__header">
              <div class="sorter-section-intro">
                <h3 data-i18n="tools.sorter.rules.title">${i18n(t, "tools.sorter.rules.title")}</h3>
                <p class="muted" data-i18n="tools.sorter.rules.subtitle">${i18n(t, "tools.sorter.rules.subtitle")}</p>
              </div>
              <div class="sorter-rule-header-actions">
                <button id="sorter-rule-add" type="button" class="small-button sorter-icon-action" data-bs-toggle="tooltip" data-bs-placement="top" data-i18n-title="tools.sorter.rules.add" data-i18n-aria="tools.sorter.rules.add" title="${i18n(t, "tools.sorter.rules.add")}" aria-label="${i18n(t, "tools.sorter.rules.add")}">
                  <i class="fa-solid fa-plus"></i>
                </button>
                <button id="sorter-rules-reset" type="button" class="small-button sorter-icon-action" data-bs-toggle="tooltip" data-bs-placement="top" data-i18n-title="tools.sorter.rules.reset" data-i18n-aria="tools.sorter.rules.reset" title="${i18n(t, "tools.sorter.rules.reset")}" aria-label="${i18n(t, "tools.sorter.rules.reset")}">
                  <i class="fa-solid fa-rotate-left"></i>
                </button>
              </div>
            </div>
            <p class="sorter-category-help muted" data-i18n="tools.sorter.rules.compactHint">${i18n(t, "tools.sorter.rules.compactHint")}</p>
            <div id="sorter-rules-list" class="sorter-category-list"></div>
          </section>
        </div>

        <div id="sorter-result" class="quick-action-result muted" data-i18n="tools.sorter.resultIdle">${i18n(t, "tools.sorter.resultIdle")}</div>

        <section id="sorter-preview-panel" class="sorter-preview-panel sorter-surface sorter-surface--preview hidden" aria-live="polite">
          <div class="sorter-preview-summary">
            <div class="sorter-preview-heading">
              <div class="sorter-section-intro sorter-preview-heading__copy">
                <h3 id="sorter-preview-title" tabindex="-1" data-i18n="tools.sorter.preview.title">${i18n(t, "tools.sorter.preview.title")}</h3>
              </div>
              <span id="sorter-preview-badge" class="sorter-preview-badge" data-i18n="tools.sorter.preview.badge">${i18n(t, "tools.sorter.preview.badge")}</span>
            </div>
            <div class="sorter-preview-stats sorter-preview-summary__stats">
              <div class="sorter-preview-stat sorter-preview-stat--primary">
                <span class="muted" data-i18n="tools.sorter.preview.stats.moved">${i18n(t, "tools.sorter.preview.stats.moved")}</span>
                <strong id="sorter-preview-stat-moved">0</strong>
              </div>
              <div class="sorter-preview-stat">
                <span class="muted" data-i18n="tools.sorter.preview.stats.total">${i18n(t, "tools.sorter.preview.stats.total")}</span>
                <strong id="sorter-preview-stat-total">0</strong>
              </div>
              <div class="sorter-preview-stat sorter-preview-stat--warning">
                <span class="muted" data-i18n="tools.sorter.preview.stats.skipped">${i18n(t, "tools.sorter.preview.stats.skipped")}</span>
                <strong id="sorter-preview-stat-skipped">0</strong>
              </div>
              <div class="sorter-preview-stat sorter-preview-stat--danger">
                <span class="muted" data-i18n="tools.sorter.preview.stats.errors">${i18n(t, "tools.sorter.preview.stats.errors")}</span>
                <strong id="sorter-preview-stat-errors">0</strong>
              </div>
            </div>
          </div>

          <div class="sorter-preview-toolbar">
            <div class="sorter-preview-toolbar__primary">
              <div class="sorter-preview-toolbar__filters">
                <label class="sorter-option-toggle sorter-preview-selection" for="sorter-preview-select-all">
                  <input id="sorter-preview-select-all" type="checkbox" />
                  <span data-i18n="tools.sorter.preview.selectAll">${i18n(t, "tools.sorter.preview.selectAll")}</span>
                </label>
                <label class="sorter-preview-control sorter-preview-control--search">
                  <span data-i18n="tools.sorter.preview.searchLabel">${i18n(t, "tools.sorter.preview.searchLabel")}</span>
                  <input id="sorter-preview-search" type="text" class="wg-input" data-i18n-placeholder="tools.sorter.preview.searchPlaceholder" placeholder="${i18n(t, "tools.sorter.preview.searchPlaceholder")}" />
                </label>
                <label class="sorter-preview-control">
                  <span data-i18n="tools.sorter.preview.categoryFilterLabel">${i18n(t, "tools.sorter.preview.categoryFilterLabel")}</span>
                  <select id="sorter-preview-category-filter" class="wg-input">
                    <option value="all" data-i18n="tools.sorter.preview.filter.all">${i18n(t, "tools.sorter.preview.filter.all")}</option>
                  </select>
                </label>
                <label class="sorter-preview-control">
                  <span data-i18n="tools.sorter.preview.statusFilterLabel">${i18n(t, "tools.sorter.preview.statusFilterLabel")}</span>
                  <select id="sorter-preview-status-filter" class="wg-input">
                    <option value="all" data-i18n="tools.sorter.preview.statusFilter.all">${i18n(t, "tools.sorter.preview.statusFilter.all")}</option>
                    <option value="planned" data-i18n="tools.sorter.preview.statusFilter.planned">${i18n(t, "tools.sorter.preview.statusFilter.planned")}</option>
                    <option value="skipped" data-i18n="tools.sorter.preview.statusFilter.skipped">${i18n(t, "tools.sorter.preview.statusFilter.skipped")}</option>
                    <option value="error" data-i18n="tools.sorter.preview.statusFilter.error">${i18n(t, "tools.sorter.preview.statusFilter.error")}</option>
                  </select>
                </label>
              </div>
              <div class="sorter-preview-toolbar__actions sorter-preview-toolbar__apply">
                <div class="sorter-preview-apply-copy">
                  <span data-i18n="tools.sorter.preview.applyLabel">${i18n(t, "tools.sorter.preview.applyLabel")}</span>
                  <strong id="sorter-preview-selected-count">0</strong>
                  <small data-i18n="tools.sorter.preview.applyHint">${i18n(t, "tools.sorter.preview.applyHint")}</small>
                </div>
                <button id="sorter-apply-run" type="button" class="large-button sorter-apply-primary" disabled>
                  <i class="fa-solid fa-play"></i>
                  <span data-i18n="tools.sorter.applyAction">${i18n(t, "tools.sorter.applyAction")}</span>
                </button>
              </div>
            </div>
            <div class="sorter-preview-insights">
              <section class="sorter-breakdown">
                <div class="sorter-breakdown__header">
                  <h4 data-i18n="tools.sorter.breakdown.title">${i18n(t, "tools.sorter.breakdown.title")}</h4>
                  <span id="sorter-breakdown-count" class="sorter-section-count muted">0</span>
                </div>
                <div id="sorter-breakdown-list" class="sorter-breakdown-list"></div>
              </section>
              <details id="sorter-problems" class="sorter-problems hidden">
                <summary>
                  <span data-i18n="tools.sorter.problems.title">${i18n(t, "tools.sorter.problems.title")}</span>
                  <span id="sorter-problems-count" class="sorter-section-count">0</span>
                </summary>
                <div id="sorter-problems-list" class="sorter-problems-list"></div>
              </details>
            </div>
          </div>

          <section class="sorter-preview-main">
            <div class="sorter-preview-list-panel sorter-preview-surface">
              <div class="sorter-preview-list-panel__header">
                <h4 data-i18n="tools.sorter.preview.list.title">${i18n(t, "tools.sorter.preview.list.title")}</h4>
                <span id="sorter-preview-list-count" class="sorter-section-count muted">0</span>
              </div>
              <div id="sorter-preview-list" class="sorter-preview-list"></div>
              <p id="sorter-preview-filter-empty" class="sorter-preview-list__empty muted hidden" data-i18n="tools.sorter.preview.filterEmpty">${i18n(t, "tools.sorter.preview.filterEmpty")}</p>
            </div>
          </section>
        </section>

        <section id="sorter-result-panel" class="sorter-preview-panel sorter-surface hidden" aria-live="polite">
          <div class="sorter-preview-heading">
            <h3 data-i18n="tools.sorter.results.title">${i18n(t, "tools.sorter.results.title")}</h3>
            <button id="sorter-undo-run" type="button" class="small-button hidden">
              <i class="fa-solid fa-rotate-left"></i>
              <span data-i18n="tools.sorter.undo">${i18n(t, "tools.sorter.undo")}</span>
            </button>
          </div>
          <p id="sorter-result-summary" class="muted"></p>
          <div class="sorter-preview-toolbar__actions">
            <select id="sorter-export-format" class="wg-input sorter-export-format" data-i18n-aria="tools.sorter.exportFormatLabel" aria-label="${i18n(t, "tools.sorter.exportFormatLabel")}">
              <option value="txt">TXT</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <button id="sorter-copy-result" type="button" class="small-button">
              <i class="fa-regular fa-copy"></i>
              <span data-i18n="tools.sorter.copy">${i18n(t, "tools.sorter.copy")}</span>
            </button>
            <button id="sorter-export-result" type="button" class="small-button">
              <i class="fa-regular fa-file-export"></i>
              <span data-i18n="tools.sorter.export">${i18n(t, "tools.sorter.export")}</span>
            </button>
          </div>
        </section>
      </article>
    </section>
  `;
}

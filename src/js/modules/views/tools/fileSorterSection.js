import { showConfirmationDialog } from "../../modals.js";
import { initTooltips } from "../../tooltipInitializer.js";

const SORTER_LAST_FOLDER_KEY = "toolsSorterLastFolder";
const SORTER_RULES_KEY = "toolsSorterRules";
const SORTER_CONFLICT_MODE_KEY = "toolsSorterConflictMode";
const SORTER_RECURSIVE_KEY = "toolsSorterRecursive";
const SORTER_IGNORE_EXTENSIONS_KEY = "toolsSorterIgnoreExtensions";
const SORTER_IGNORE_FOLDERS_KEY = "toolsSorterIgnoreFolders";

const DEFAULT_RULES = [
  {
    id: "images",
    name: "Images",
    folderName: "Images",
    extensions: ".jpg, .jpeg, .png, .gif, .webp, .heic",
  },
  {
    id: "videos",
    name: "Videos",
    folderName: "Videos",
    extensions: ".mp4, .mov, .mkv, .webm, .avi",
  },
  {
    id: "music",
    name: "Music",
    folderName: "Music",
    extensions: ".mp3, .wav, .flac, .m4a, .aac",
  },
  {
    id: "documents",
    name: "Documents",
    folderName: "Documents",
    extensions: ".pdf, .doc, .docx, .txt, .xls, .xlsx",
  },
  {
    id: "archives",
    name: "Archives",
    folderName: "Archives",
    extensions: ".zip, .rar, .7z, .tar, .gz",
  },
  {
    id: "other",
    name: "Other",
    folderName: "Other",
    extensions: "",
    locked: true,
  },
];

const cloneDefaultRules = () => DEFAULT_RULES.map((rule) => ({ ...rule }));

const readStorage = (key, fallback = "") => {
  try {
    const value = window.localStorage.getItem(key);
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, String(value ?? ""));
  } catch {}
};

const normalizeRules = (rules) => {
  const editableRules = (Array.isArray(rules) ? rules : [])
    .filter((rule) => rule && rule.id !== "other" && !rule.locked)
    .map((rule, index) => ({
      id: String(rule.id || `rule-${Date.now()}-${index}`),
      name: String(rule.name || ""),
      folderName: String(rule.folderName || rule.folder || ""),
      extensions: String(rule.extensions || ""),
    }));
  return editableRules.concat({ ...DEFAULT_RULES.at(-1) });
};

const loadRules = () => {
  try {
    const stored = JSON.parse(readStorage(SORTER_RULES_KEY, "null"));
    return stored ? normalizeRules(stored) : cloneDefaultRules();
  } catch {
    return cloneDefaultRules();
  }
};

const operationId = (operation, index) =>
  String(
    operation?.id ||
      operation?.operationId ||
      operation?.sourcePath ||
      `${operation?.fileName || "operation"}-${index}`,
  );

const operationCategory = (operation) =>
  String(operation?.category || operation?.ruleName || "Other");

const operationStatus = (operation) => String(operation?.status || "planned");

const SORTER_REASON_KEYS = Object.freeze({
  "ignored-folder": "tools.sorter.reason.ignoredFolder",
  "managed-category": "tools.sorter.reason.managedCategory",
  "ignored-hidden": "tools.sorter.reason.ignoredHidden",
  "log-file": "tools.sorter.reason.logFile",
  "ignored-extension": "tools.sorter.reason.ignoredExtension",
  "target-exists": "tools.sorter.reason.targetExists",
  "path-outside-folder": "tools.sorter.reason.pathOutsideFolder",
  "source-unavailable": "tools.sorter.reason.sourceUnavailable",
  "source-changed": "tools.sorter.reason.sourceChanged",
  "target-changed": "tools.sorter.reason.targetChanged",
  "replacement-target-not-file": "tools.sorter.reason.replacementTargetNotFile",
  "sorted-file-unavailable": "tools.sorter.reason.sortedFileUnavailable",
  "source-path-occupied": "tools.sorter.reason.sourcePathOccupied",
  "replacement-backup-unavailable":
    "tools.sorter.reason.replacementBackupUnavailable",
  "operation-failed": "tools.sorter.reason.operationFailed",
});

const countByCategory = (operations) =>
  operations.reduce((counts, operation) => {
    const category = operationCategory(operation);
    counts[category] = Number(counts[category] || 0) + 1;
    return counts;
  }, {});

export function initFileSorterSection({ view, getEl, t }) {
  const elements = {
    pickFolder: getEl("sorter-pick-folder", view),
    openFolder: getEl("sorter-open-folder", view),
    folderPill: getEl("sorter-folder-pill", view),
    preview: getEl("sorter-preview-run", view),
    apply: getEl("sorter-apply-run", view),
    conflictMode: getEl("sorter-conflict-mode", view),
    conflictToggle: getEl("sorter-conflict-toggle", view),
    conflictLabel: getEl("sorter-conflict-label", view),
    conflictMenu: getEl("sorter-conflict-menu", view),
    recursive: getEl("sorter-recursive", view),
    ignoreExtensions: getEl("sorter-ignore-extensions", view),
    ignoreFolders: getEl("sorter-ignore-folders", view),
    addRule: getEl("sorter-rule-add", view),
    resetRules: getEl("sorter-rules-reset", view),
    rulesList: getEl("sorter-rules-list", view),
    result: getEl("sorter-result", view),
    previewPanel: getEl("sorter-preview-panel", view),
    previewTitle: getEl("sorter-preview-title", view),
    previewList: getEl("sorter-preview-list", view),
    previewListCount: getEl("sorter-preview-list-count", view),
    previewEmpty: getEl("sorter-preview-filter-empty", view),
    search: getEl("sorter-preview-search", view),
    categoryFilter: getEl("sorter-preview-category-filter", view),
    statusFilter: getEl("sorter-preview-status-filter", view),
    selectAll: getEl("sorter-preview-select-all", view),
    selectedCount: getEl("sorter-preview-selected-count", view),
    moved: getEl("sorter-preview-stat-moved", view),
    total: getEl("sorter-preview-stat-total", view),
    skipped: getEl("sorter-preview-stat-skipped", view),
    errors: getEl("sorter-preview-stat-errors", view),
    breakdownList: getEl("sorter-breakdown-list", view),
    breakdownCount: getEl("sorter-breakdown-count", view),
    problems: getEl("sorter-problems", view),
    problemsList: getEl("sorter-problems-list", view),
    problemsCount: getEl("sorter-problems-count", view),
    resultPanel: getEl("sorter-result-panel", view),
    resultSummary: getEl("sorter-result-summary", view),
    undo: getEl("sorter-undo-run", view),
    exportFormat: getEl("sorter-export-format", view),
    copy: getEl("sorter-copy-result", view),
    export: getEl("sorter-export-result", view),
  };

  let folderPath = readStorage(SORTER_LAST_FOLDER_KEY);
  let rules = loadRules();
  let previewResult = null;
  let latestResult = null;
  let busy = false;
  let selectedIds = new Set();
  const conflictOptions = Array.from(
    elements.conflictMenu?.querySelectorAll(".sorter-conflict-option") || [],
  );

  const closeConflictMenu = () => {
    elements.conflictMenu?.classList.add("hidden");
    elements.conflictToggle?.setAttribute("aria-expanded", "false");
  };

  const syncConflictMode = (mode) => {
    if (!elements.conflictMode) return;
    const option = conflictOptions.find(
      (item) => item.dataset.conflictMode === mode,
    );
    if (!option) return;
    elements.conflictMode.value = mode;
    if (elements.conflictLabel) {
      elements.conflictLabel.textContent =
        option.querySelector("span")?.textContent || mode;
      elements.conflictLabel.dataset.i18n =
        option.querySelector("span")?.dataset.i18n || "";
    }
    conflictOptions.forEach((item) => {
      item.setAttribute(
        "aria-selected",
        String(item.dataset.conflictMode === mode),
      );
    });
  };

  const selectConflictMode = (mode) => {
    if (!elements.conflictMode || elements.conflictToggle?.disabled) return;
    syncConflictMode(mode);
    elements.conflictMode.dispatchEvent(new Event("change", { bubbles: true }));
    closeConflictMenu();
  };

  const updatePreviewToggleUi = () => {
    if (!elements.preview) return;
    const isVisible =
      !!previewResult && !elements.previewPanel?.classList.contains("hidden");
    const key = isVisible
      ? "tools.sorter.preview.hide"
      : "tools.sorter.preview.show";
    const label = t(key);
    elements.preview.setAttribute("aria-expanded", String(isVisible));
    elements.preview.setAttribute("aria-label", label);
    elements.preview.setAttribute("title", label);
    elements.preview.setAttribute("data-i18n-title", key);
    elements.preview.setAttribute("data-i18n-aria", key);
    elements.preview.classList.toggle("is-active", isVisible);
    const icon = elements.preview.querySelector("i");
    if (icon) {
      icon.className = isVisible
        ? "fa-regular fa-eye-slash"
        : "fa-regular fa-eye";
    }
    initTooltips(view);
  };

  const focusPreview = () => {
    if (!elements.previewPanel || !elements.previewTitle) return;
    const scheduleFrame =
      window.requestAnimationFrame || ((callback) => setTimeout(callback, 0));
    scheduleFrame(() => {
      const reduceMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      )?.matches;
      elements.previewPanel.scrollIntoView?.({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      elements.previewTitle.focus({ preventScroll: true });
    });
  };

  const localizeOperationReason = (operation) => {
    const key = SORTER_REASON_KEYS[String(operation?.reasonCode || "")];
    if (!key) {
      return String(operation?.message || operationStatus(operation));
    }
    return t(key, operation?.reasonParams || {});
  };

  const localizeCategory = (category) => {
    const normalized = String(category || "Other");
    const key = `tools.sorter.category.${normalized}`;
    return DEFAULT_RULES.some((rule) => rule.name === normalized)
      ? t(key)
      : normalized;
  };

  const setResult = (message, tone = "muted") => {
    if (!elements.result) return;
    elements.result.textContent = message;
    elements.result.className = `quick-action-result ${tone}`;
  };

  const getConfig = () => ({
    conflictMode: elements.conflictMode?.value || "rename",
    recursive: !!elements.recursive?.checked,
    rules: rules.map((rule) => ({
      id: rule.id,
      name: rule.name.trim(),
      folderName: rule.folderName.trim(),
      extensions: rule.extensions,
      locked: !!rule.locked,
    })),
  });

  const persistConfig = () => {
    writeStorage(SORTER_RULES_KEY, JSON.stringify(rules));
    writeStorage(
      SORTER_CONFLICT_MODE_KEY,
      elements.conflictMode?.value || "rename",
    );
    writeStorage(
      SORTER_RECURSIVE_KEY,
      elements.recursive?.checked ? "true" : "false",
    );
    writeStorage(
      SORTER_IGNORE_EXTENSIONS_KEY,
      elements.ignoreExtensions?.value || "",
    );
    writeStorage(
      SORTER_IGNORE_FOLDERS_KEY,
      elements.ignoreFolders?.value || "",
    );
  };

  const normalizedExtensions = (value) =>
    String(value || "")
      .split(",")
      .map((extension) => extension.trim().toLowerCase())
      .filter(Boolean)
      .map((extension) =>
        extension.startsWith(".") ? extension : `.${extension}`,
      );

  const validateRules = () => {
    const folderNames = new Set();
    const extensions = new Set();
    for (const rule of rules) {
      if (rule.locked) continue;
      if (!rule.name.trim() || !rule.folderName.trim()) {
        return t("tools.sorter.rules.validation.required");
      }
      const folderName = rule.folderName.trim().toLowerCase();
      if (
        folderName === "." ||
        folderName === ".." ||
        /[\\/]/.test(folderName)
      ) {
        return t("tools.sorter.rules.validation.folder");
      }
      if (folderNames.has(folderName)) {
        return t("tools.sorter.rules.validation.duplicateFolder");
      }
      folderNames.add(folderName);
      for (const extension of normalizedExtensions(rule.extensions)) {
        if (extensions.has(extension)) {
          return t("tools.sorter.rules.validation.duplicateExtension", {
            extension,
          });
        }
        extensions.add(extension);
      }
    }
    return "";
  };

  const updateRuleValidity = () => {
    const error = validateRules();
    elements.rulesList?.classList.toggle("is-invalid", !!error);
    elements.rulesList
      ?.querySelectorAll(".sorter-category-item")
      .forEach((card) => card.setAttribute("aria-invalid", String(!!error)));
    if (elements.preview) elements.preview.disabled = busy || !!error;
    return error;
  };

  const updateApplyState = () => {
    if (elements.apply) {
      elements.apply.disabled =
        busy || !previewResult || selectedIds.size === 0;
    }
    if (elements.selectedCount) {
      elements.selectedCount.textContent = t(
        "tools.sorter.preview.selectedCount",
        { count: selectedIds.size },
      );
    }
  };

  const setBusy = (nextBusy) => {
    busy = !!nextBusy;
    [
      elements.pickFolder,
      elements.preview,
      elements.conflictToggle,
      elements.recursive,
      elements.ignoreExtensions,
      elements.ignoreFolders,
      elements.addRule,
      elements.resetRules,
    ].forEach((element) => {
      if (element) element.disabled = busy;
    });
    if (elements.openFolder) {
      elements.openFolder.disabled = busy || !folderPath;
    }
    if (elements.undo) elements.undo.disabled = busy;
    updateApplyState();
    updateRuleValidity();
  };

  const setFolder = (nextFolder) => {
    folderPath = String(nextFolder || "");
    writeStorage(SORTER_LAST_FOLDER_KEY, folderPath);
    if (elements.folderPill) {
      elements.folderPill.textContent =
        folderPath || t("tools.sorter.noFolder");
      elements.folderPill.title = folderPath;
      elements.folderPill.classList.toggle("muted", !folderPath);
      elements.folderPill.classList.toggle("is-selected", !!folderPath);
    }
    if (elements.openFolder) {
      elements.openFolder.disabled = busy || !folderPath;
    }
  };

  const invalidatePreview = () => {
    previewResult = null;
    selectedIds.clear();
    elements.previewPanel?.classList.add("hidden");
    updatePreviewToggleUi();
    updateApplyState();
    setResult(t("tools.sorter.preview.stale"), "warning");
  };

  const configChanged = () => {
    persistConfig();
    if (previewResult) invalidatePreview();
  };

  const renderRules = () => {
    if (!elements.rulesList) return;
    elements.rulesList.replaceChildren();
    rules.forEach((rule) => {
      const locked = !!rule.locked;
      const card = document.createElement("article");
      card.className = `sorter-category-item sorter-category-item--${rule.id}`;
      card.dataset.ruleId = rule.id;

      const name = document.createElement("input");
      name.className = "wg-input sorter-category-input sorter-rule-name";
      name.value = locked ? t("tools.sorter.category.Other") : rule.name;
      name.disabled = locked;
      name.setAttribute("aria-label", t("tools.sorter.rules.name"));
      const nameField = document.createElement("label");
      nameField.className = "sorter-category-field sorter-category-field--name";
      const nameLabel = document.createElement("span");
      nameLabel.textContent = t("tools.sorter.rules.nameShort");
      nameLabel.title = t("tools.sorter.rules.nameHint");
      nameLabel.dataset.i18n = "tools.sorter.rules.nameShort";
      nameField.append(nameLabel, name);

      const folder = document.createElement("input");
      folder.className = "wg-input sorter-category-input sorter-rule-folder";
      folder.value = rule.folderName;
      folder.disabled = locked;
      folder.setAttribute("aria-label", t("tools.sorter.rules.folder"));
      const folderField = document.createElement("label");
      folderField.className =
        "sorter-category-field sorter-category-field--folder";
      const folderLabel = document.createElement("span");
      folderLabel.textContent = t("tools.sorter.rules.folderShort");
      folderLabel.title = t("tools.sorter.rules.folderHint");
      folderLabel.dataset.i18n = "tools.sorter.rules.folderShort";
      folderField.append(folderLabel, folder);

      const extensions = document.createElement("input");
      extensions.className =
        "wg-input sorter-category-input sorter-rule-extensions";
      extensions.value = rule.extensions;
      extensions.disabled = locked;
      extensions.setAttribute("aria-label", t("tools.sorter.rules.extensions"));
      const extensionsField = document.createElement("label");
      extensionsField.className =
        "sorter-category-field sorter-category-field--extensions";
      const extensionsLabel = document.createElement("span");
      extensionsLabel.textContent = t("tools.sorter.rules.extensionsShort");
      extensionsLabel.dataset.i18n = "tools.sorter.rules.extensionsShort";
      extensionsField.append(extensionsLabel, extensions);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "small-button sorter-category-delete";
      remove.disabled = locked;
      remove.innerHTML = locked
        ? '<i class="fa-solid fa-lock"></i>'
        : '<i class="fa-solid fa-trash"></i>';
      const removeKey = locked
        ? "tools.sorter.rules.locked"
        : "tools.sorter.rules.delete";
      remove.setAttribute("aria-label", t(removeKey));
      remove.setAttribute("title", t(removeKey));
      remove.setAttribute("data-bs-toggle", "tooltip");
      remove.setAttribute("data-bs-placement", "top");
      card.append(nameField, folderField, remove, extensionsField);
      elements.rulesList.appendChild(card);

      const updateRule = () => {
        rule.name = name.value;
        rule.folderName = folder.value;
        rule.extensions = extensions.value;
        configChanged();
        updateRuleValidity();
      };
      name.addEventListener("input", updateRule);
      folder.addEventListener("input", updateRule);
      extensions.addEventListener("input", updateRule);
      remove.addEventListener("click", () => {
        rules = rules.filter((item) => item.id !== rule.id);
        persistConfig();
        renderRules();
        if (previewResult) invalidatePreview();
      });
    });
    updateRuleValidity();
    initTooltips(view);
  };

  const getOperations = () =>
    Array.isArray(previewResult?.operations) ? previewResult.operations : [];

  const getFilteredOperations = () => {
    const query = String(elements.search?.value || "")
      .trim()
      .toLowerCase();
    const category = elements.categoryFilter?.value || "all";
    const status = elements.statusFilter?.value || "all";
    return getOperations().filter((operation) => {
      const text = [
        operation.fileName,
        operation.sourcePath,
        operation.targetPath,
        operationCategory(operation),
      ]
        .join(" ")
        .toLowerCase();
      return (
        (!query || text.includes(query)) &&
        (category === "all" || operationCategory(operation) === category) &&
        (status === "all" || operationStatus(operation) === status)
      );
    });
  };

  const updateSelectAll = (filteredOperations = getFilteredOperations()) => {
    if (!elements.selectAll) return;
    const ids = filteredOperations
      .filter((operation) => operation.selectable !== false)
      .map((operation) => operation.__sorterId);
    const selectedVisible = ids.filter((id) => selectedIds.has(id)).length;
    elements.selectAll.checked =
      ids.length > 0 && selectedVisible === ids.length;
    elements.selectAll.indeterminate =
      selectedVisible > 0 && selectedVisible < ids.length;
  };

  const renderBreakdown = (operations) => {
    if (!elements.breakdownList) return;
    elements.breakdownList.replaceChildren();
    const entries = Object.entries(
      previewResult?.categoryCount || countByCategory(operations),
    ).filter(([, count]) => Number(count) > 0);
    if (elements.breakdownCount) {
      elements.breakdownCount.textContent = String(entries.length);
    }
    entries.forEach(([category, count]) => {
      const item = document.createElement("div");
      item.className = "sorter-breakdown-item";
      const label = document.createElement("span");
      label.textContent = localizeCategory(category);
      const value = document.createElement("strong");
      value.textContent = String(count);
      item.append(label, value);
      elements.breakdownList.appendChild(item);
    });
  };

  const renderProblems = (operations) => {
    if (!elements.problems || !elements.problemsList) return;
    const problems = operations.filter(
      (operation) =>
        operation.selectable === false ||
        operationStatus(operation) !== "planned",
    );
    elements.problems.classList.toggle("hidden", problems.length === 0);
    if (elements.problemsCount) {
      elements.problemsCount.textContent = String(problems.length);
    }
    elements.problemsList.replaceChildren();
    problems.forEach((operation) => {
      const item = document.createElement("div");
      item.className = "sorter-problem-item";
      const file = document.createElement("strong");
      file.textContent = String(
        operation.fileName || operation.sourcePath || "",
      );
      const message = document.createElement("span");
      message.textContent = localizeOperationReason(operation);
      item.append(file, message);
      elements.problemsList.appendChild(item);
    });
  };

  const renderPreview = ({ focus = false } = {}) => {
    if (!previewResult || !elements.previewList) return;
    const operations = getOperations();
    const filtered = getFilteredOperations();
    elements.previewList.replaceChildren();
    elements.previewPanel?.classList.remove("hidden");
    updatePreviewToggleUi();
    if (elements.previewEmpty) {
      elements.previewEmpty.textContent = t(
        operations.length === 0
          ? "tools.sorter.preview.list.empty"
          : "tools.sorter.preview.filterEmpty",
      );
      elements.previewEmpty.classList.toggle("hidden", filtered.length > 0);
    }
    if (elements.previewListCount) {
      elements.previewListCount.textContent = String(filtered.length);
    }

    filtered.forEach((operation) => {
      const row = document.createElement("label");
      row.className = `sorter-preview-row sorter-preview-row--${operationStatus(operation)}`;
      row.dataset.operationId = operation.__sorterId;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "sorter-operation-select";
      checkbox.checked = selectedIds.has(operation.__sorterId);
      checkbox.disabled = operation.selectable === false;
      const file = document.createElement("span");
      file.className = "sorter-preview-row__file";
      file.textContent = String(
        operation.fileName || operation.sourcePath || "",
      );
      const target = document.createElement("span");
      target.className = "sorter-preview-row__target muted";
      target.textContent = String(operation.targetPath || "");
      const category = document.createElement("span");
      category.className = "sorter-preview-row__category";
      category.textContent = localizeCategory(operationCategory(operation));
      row.append(checkbox, file, target, category);
      elements.previewList.appendChild(row);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selectedIds.add(operation.__sorterId);
        else selectedIds.delete(operation.__sorterId);
        updateSelectAll(filtered);
        updateApplyState();
      });
    });

    if (elements.moved) {
      elements.moved.textContent = String(
        previewResult.planned ?? previewResult.moved ?? selectedIds.size,
      );
    }
    if (elements.total) {
      elements.total.textContent = String(
        previewResult.totalFiles ?? operations.length,
      );
    }
    if (elements.skipped) {
      elements.skipped.textContent = String(previewResult.skipped || 0);
    }
    if (elements.errors) {
      elements.errors.textContent = String(
        Array.isArray(previewResult.errors) ? previewResult.errors.length : 0,
      );
    }
    renderBreakdown(operations);
    renderProblems(operations);
    updateSelectAll(filtered);
    updateApplyState();
    if (focus) focusPreview();
  };

  const updateCategoryFilter = (operations) => {
    if (!elements.categoryFilter) return;
    const selected = elements.categoryFilter.value || "all";
    const categories = [...new Set(operations.map(operationCategory))];
    elements.categoryFilter.replaceChildren();
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = t("tools.sorter.preview.filter.all");
    elements.categoryFilter.appendChild(all);
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = localizeCategory(category);
      elements.categoryFilter.appendChild(option);
    });
    elements.categoryFilter.value = categories.includes(selected)
      ? selected
      : "all";
  };

  const buildExportContent = () => {
    const format = elements.exportFormat?.value || "txt";
    if (format === "json") return JSON.stringify(latestResult, null, 2);
    const operations = Array.isArray(latestResult?.operations)
      ? latestResult.operations
      : [];
    if (format === "csv") {
      return [
        "status,fileName,category,targetPath",
        ...operations.map((operation) =>
          [
            operationStatus(operation),
            operation.fileName,
            operationCategory(operation),
            operation.targetPath,
          ]
            .map((value) => `"${String(value || "").replace(/"/g, '""')}"`)
            .join(","),
        ),
      ].join("\n");
    }
    return operations
      .map(
        (operation) =>
          `[${operationStatus(operation)}] ${operation.fileName || ""} -> ${operation.targetPath || ""}`,
      )
      .join("\n");
  };

  const runPreview = async () => {
    if (busy) return;
    if (!folderPath) {
      setResult(t("tools.sorter.needFolder"), "warning");
      return;
    }
    persistConfig();
    const validationError = updateRuleValidity();
    if (validationError) {
      setResult(validationError, "error");
      return;
    }
    setBusy(true);
    setResult(t("tools.sorter.runningPreview"));
    try {
      const result = await window.electron?.tools?.previewSorterPlan?.({
        folderPath,
        ignoreExtensions: elements.ignoreExtensions?.value || "",
        ignoreFolders: elements.ignoreFolders?.value || "",
        ...getConfig(),
      });
      if (!result?.success) {
        invalidatePreview();
        setResult(result?.error || t("tools.sorter.error"), "error");
        return;
      }
      const operations = (
        Array.isArray(result.operations) ? result.operations : []
      ).map((operation, index) => ({
        ...operation,
        __sorterId: operationId(operation, index),
      }));
      previewResult = { ...result, operations };
      selectedIds = new Set(
        operations
          .filter((operation) => operation.selectable !== false)
          .map((operation) => operation.__sorterId),
      );
      updateCategoryFilter(operations);
      renderPreview({ focus: true });
      setResult(t("tools.sorter.preview.ready"), "success");
    } catch (error) {
      invalidatePreview();
      setResult(error?.message || t("tools.sorter.error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const applyPreview = async () => {
    if (busy || !previewResult || selectedIds.size === 0) return;
    const confirmed = await showConfirmationDialog({
      title: t("tools.sorter.confirm.title"),
      message: t("tools.sorter.confirm.message", {
        count: selectedIds.size,
      }),
      confirmText: t("tools.sorter.confirm.apply"),
      tone: "warning",
    });
    if (!confirmed || !previewResult) return;

    setBusy(true);
    setResult(t("tools.sorter.runningApply"));
    try {
      const result = await window.electron?.tools?.applySorterPlan?.({
        planId: previewResult.planId,
        operationIds: [...selectedIds],
      });
      if (!result?.success) {
        setResult(result?.error || t("tools.sorter.error"), "error");
        return;
      }
      latestResult = result;
      previewResult = null;
      selectedIds.clear();
      elements.previewPanel?.classList.add("hidden");
      updatePreviewToggleUi();
      elements.resultPanel?.classList.remove("hidden");
      if (elements.resultSummary) {
        elements.resultSummary.textContent = t("tools.sorter.done", {
          moved: Number(result.moved || 0),
          total: Number(result.totalFiles || result.moved || 0),
          skipped: Number(result.skipped || 0),
        });
      }
      elements.undo?.classList.toggle("hidden", !result.runId);
      setResult(t("tools.sorter.apply.done"), "success");
    } catch (error) {
      setResult(error?.message || t("tools.sorter.error"), "error");
    } finally {
      setBusy(false);
    }
  };

  elements.pickFolder?.addEventListener("click", async () => {
    if (busy) return;
    try {
      const result = await window.electron?.tools?.pickSorterFolder?.();
      if (!result?.success || !result.folderPath) {
        if (!result?.canceled) {
          setResult(result?.error || t("tools.sorter.pickError"), "error");
        }
        return;
      }
      setFolder(result.folderPath);
      if (previewResult) invalidatePreview();
      else setResult(t("tools.sorter.folderSelected"));
    } catch (error) {
      setResult(error?.message || t("tools.sorter.pickError"), "error");
    }
  });

  elements.openFolder?.addEventListener("click", async () => {
    if (busy || !folderPath) return;
    try {
      const result =
        await window.electron?.tools?.openSorterFolder?.(folderPath);
      if (!result?.success) {
        setResult(result?.error || t("tools.sorter.openFolderError"), "error");
      }
    } catch (error) {
      setResult(error?.message || t("tools.sorter.openFolderError"), "error");
    }
  });

  elements.preview?.addEventListener("click", () => {
    if (!previewResult) {
      runPreview();
      return;
    }
    elements.previewPanel?.classList.toggle("hidden");
    updatePreviewToggleUi();
    if (!elements.previewPanel?.classList.contains("hidden")) {
      focusPreview();
    }
  });
  elements.apply?.addEventListener("click", applyPreview);
  elements.conflictToggle?.addEventListener("click", () => {
    if (busy) return;
    const willOpen = elements.conflictMenu?.classList.contains("hidden");
    elements.conflictMenu?.classList.toggle("hidden", !willOpen);
    elements.conflictToggle.setAttribute(
      "aria-expanded",
      String(Boolean(willOpen)),
    );
    if (willOpen) {
      const selected = conflictOptions.find(
        (option) => option.getAttribute("aria-selected") === "true",
      );
      selected?.focus();
    }
  });
  elements.conflictToggle?.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    elements.conflictToggle.click();
  });
  conflictOptions.forEach((option, index) => {
    option.addEventListener("click", () =>
      selectConflictMode(option.dataset.conflictMode || "rename"),
    );
    option.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeConflictMenu();
        elements.conflictToggle?.focus();
        return;
      }
      if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      conflictOptions[
        (index + offset + conflictOptions.length) % conflictOptions.length
      ]?.focus();
    });
  });
  document.addEventListener("click", (event) => {
    if (!event.target?.closest?.("[data-sorter-conflict-select]")) {
      closeConflictMenu();
    }
  });
  elements.conflictMode?.addEventListener("change", configChanged);
  elements.recursive?.addEventListener("change", configChanged);
  elements.ignoreExtensions?.addEventListener("input", configChanged);
  elements.ignoreFolders?.addEventListener("input", configChanged);
  elements.addRule?.addEventListener("click", () => {
    const id = `rule-${Date.now()}`;
    rules.splice(rules.length - 1, 0, {
      id,
      name: t("tools.sorter.rules.newName"),
      folderName: "",
      extensions: "",
    });
    persistConfig();
    renderRules();
    if (previewResult) invalidatePreview();
  });
  elements.resetRules?.addEventListener("click", () => {
    rules = cloneDefaultRules();
    persistConfig();
    renderRules();
    if (previewResult) invalidatePreview();
  });

  [elements.search, elements.categoryFilter, elements.statusFilter].forEach(
    (element) => {
      element?.addEventListener(
        element === elements.search ? "input" : "change",
        renderPreview,
      );
    },
  );
  elements.selectAll?.addEventListener("change", () => {
    getFilteredOperations()
      .filter((operation) => operation.selectable !== false)
      .forEach((operation) => {
        if (elements.selectAll.checked) selectedIds.add(operation.__sorterId);
        else selectedIds.delete(operation.__sorterId);
      });
    renderPreview();
  });
  elements.undo?.addEventListener("click", async () => {
    if (busy || !latestResult?.runId) return;
    setBusy(true);
    try {
      const result = await window.electron?.tools?.undoSorterRun?.({
        runId: latestResult.runId,
      });
      if (!result?.success) {
        if (result?.canUndo) {
          latestResult = { ...latestResult, ...result };
          elements.undo.classList.remove("hidden");
        }
        setResult(result?.error || t("tools.sorter.undo.error"), "error");
        return;
      }
      latestResult = { ...latestResult, ...result };
      elements.undo.classList.toggle("hidden", result.canUndo !== true);
      setResult(t("tools.sorter.undo.done"), "success");
    } catch (error) {
      setResult(error?.message || t("tools.sorter.undo.error"), "error");
    } finally {
      setBusy(false);
    }
  });
  elements.copy?.addEventListener("click", async () => {
    if (!latestResult) return;
    try {
      await navigator.clipboard?.writeText?.(buildExportContent());
      setResult(t("tools.sorter.copyDone"), "success");
    } catch (error) {
      setResult(error?.message || t("tools.sorter.copyError"), "error");
    }
  });
  elements.export?.addEventListener("click", async () => {
    if (!latestResult) return;
    const format = elements.exportFormat?.value || "txt";
    try {
      const result = await window.electron?.tools?.exportSorterResult?.({
        content: buildExportContent(),
        format,
        suggestedName: `file-sorter-result-${new Date().toISOString().slice(0, 10)}.${format}`,
      });
      if (!result?.success && !result?.canceled) {
        setResult(result?.error || t("tools.sorter.exportError"), "error");
      }
    } catch (error) {
      setResult(error?.message || t("tools.sorter.exportError"), "error");
    }
  });

  if (elements.conflictMode) {
    syncConflictMode(readStorage(SORTER_CONFLICT_MODE_KEY, "rename"));
  }
  if (elements.recursive) {
    elements.recursive.checked =
      readStorage(SORTER_RECURSIVE_KEY, "false") === "true";
  }
  if (elements.ignoreExtensions) {
    elements.ignoreExtensions.value = readStorage(
      SORTER_IGNORE_EXTENSIONS_KEY,
      "",
    );
  }
  if (elements.ignoreFolders) {
    elements.ignoreFolders.value = readStorage(SORTER_IGNORE_FOLDERS_KEY, "");
  }
  setFolder(folderPath);
  renderRules();
  updatePreviewToggleUi();
  updateApplyState();
  setResult(t("tools.sorter.resultIdle"));
}

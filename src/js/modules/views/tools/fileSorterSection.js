const SORTER_LAST_FOLDER_KEY = "toolsSorterLastFolder";
const SORTER_LOG_PATH_KEY = "toolsSorterLogPath";
const SORTER_CONFLICT_MODE_KEY = "toolsSorterConflictMode";
const SORTER_RECURSIVE_KEY = "toolsSorterRecursive";
const SORTER_IGNORE_EXTENSIONS_KEY = "toolsSorterIgnoreExtensions";
const SORTER_IGNORE_FOLDERS_KEY = "toolsSorterIgnoreFolders";

const SORTER_CATEGORY_ORDER = [
  "Images",
  "Videos",
  "Music",
  "Documents",
  "Archives",
  "Other",
];

export function initFileSorterSection({ view, getEl, t, registerCleanup }) {
  const SORTER_CATEGORY_SAMPLES = {
    Images: ".jpg .png .heic .webp",
    Videos: ".mp4 .mov .mkv .webm",
    Music: ".mp3 .wav .flac .m4a",
    Documents: ".pdf .docx .txt .xlsx",
    Archives: ".zip .rar .7z .tar",
    Other: t("tools.sorter.rules.other"),
  };

  const sorterPickFolderBtn = getEl("sorter-pick-folder", view);
  const sorterOpenFolderBtn = getEl("sorter-open-folder", view);
  const sorterPreviewRunBtn = getEl("sorter-preview-run", view);
  const sorterApplyRunBtn = getEl("sorter-apply-run", view);
  const sorterFolderPillEl = getEl("sorter-folder-pill", view);
  const sorterLogPathEl = getEl("sorter-log-path", view);
  const sorterConflictModeEl = getEl("sorter-conflict-mode", view);
  const sorterRecursiveEl = getEl("sorter-recursive", view);
  const sorterIgnoreExtensionsEl = getEl("sorter-ignore-extensions", view);
  const sorterIgnoreFoldersEl = getEl("sorter-ignore-folders", view);
  const sorterResultEl = getEl("sorter-result", view);
  const sorterPreviewPanelEl = getEl("sorter-preview-panel", view);
  const sorterPreviewTitleEl = getEl("sorter-preview-title", view);
  const sorterPreviewBadgeEl = getEl("sorter-preview-badge", view);
  const sorterPreviewSearchEl = getEl("sorter-preview-search", view);
  const sorterPreviewCategoryFilterEl = getEl(
    "sorter-preview-category-filter",
    view,
  );
  const sorterPreviewStatusFilterEl = getEl(
    "sorter-preview-status-filter",
    view,
  );
  const sorterExportFormatEl = getEl("sorter-export-format", view);
  const sorterCopyResultBtn = getEl("sorter-copy-result", view);
  const sorterExportResultBtn = getEl("sorter-export-result", view);
  const sorterRulesListEl = getEl("sorter-rules-list", view);
  const sorterBreakdownListEl = getEl("sorter-breakdown-list", view);
  const sorterErrorsPanelEl = getEl("sorter-errors-panel", view);
  const sorterErrorsListEl = getEl("sorter-errors-list", view);
  const sorterPreviewListEl = getEl("sorter-preview-list", view);
  const sorterPreviewFilterEmptyEl = getEl("sorter-preview-filter-empty", view);
  const sorterPreviewMoreEl = getEl("sorter-preview-more", view);
  const sorterPreviewMovedEl = getEl("sorter-preview-stat-moved", view);
  const sorterPreviewTotalEl = getEl("sorter-preview-stat-total", view);
  const sorterPreviewSkippedEl = getEl("sorter-preview-stat-skipped", view);
  const sorterPreviewErrorsEl = getEl("sorter-preview-stat-errors", view);
  const sorterOpenHowtoBtn = getEl("sorter-open-howto", view);
  const sorterHowtoModalEl = getEl("sorter-howto-modal", view);
  const sorterHowtoDialogEl = getEl("sorter-howto-dialog", view);
  const sorterHowtoTrackEl = getEl("sorter-howto-track", view);
  const sorterHowtoStepEl = getEl("sorter-howto-step", view);
  const sorterHowtoCloseBtn = getEl("sorter-howto-close", view);
  const sorterHowtoPrevBtn = getEl("sorter-howto-prev", view);
  const sorterHowtoNextBtn = getEl("sorter-howto-next", view);
  const sorterHowtoDotsEl = getEl("sorter-howto-dots", view);
  const sorterHowtoDots = Array.from(
    sorterHowtoDotsEl?.querySelectorAll(".sorter-howto-dot") || [],
  );

  const SORTER_PREVIEW_LIMIT = 20;
  const sorterHowtoSlideCount = 4;
  let sorterSelectedFolder = "";
  let sorterHowtoPrevOverflow = null;
  let sorterHowtoIndex = 0;
  let sorterHowtoReturnFocusEl = null;
  let sorterBusy = false;
  let sorterLatestResult = null;
  let sorterLatestMode = "preview";

  const saveSorterFolder = (folder) => {
    try {
      window.localStorage.setItem(SORTER_LAST_FOLDER_KEY, String(folder || ""));
    } catch {}
  };

  const loadSorterFolder = () => {
    try {
      return window.localStorage.getItem(SORTER_LAST_FOLDER_KEY) || "";
    } catch {
      return "";
    }
  };

  const saveSorterPref = (key, value) => {
    try {
      window.localStorage.setItem(key, String(value ?? ""));
    } catch {}
  };

  const loadSorterPref = (key, fallback = "") => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored == null ? fallback : stored;
    } catch {
      return fallback;
    }
  };

  const setSorterBusy = (busy) => {
    sorterBusy = !!busy;
    if (sorterPickFolderBtn) sorterPickFolderBtn.disabled = sorterBusy;
    if (sorterPreviewRunBtn) sorterPreviewRunBtn.disabled = sorterBusy;
    if (sorterApplyRunBtn) sorterApplyRunBtn.disabled = sorterBusy;
    if (sorterLogPathEl) sorterLogPathEl.disabled = sorterBusy;
    if (sorterConflictModeEl) sorterConflictModeEl.disabled = sorterBusy;
    if (sorterRecursiveEl) sorterRecursiveEl.disabled = sorterBusy;
    if (sorterIgnoreExtensionsEl) sorterIgnoreExtensionsEl.disabled = sorterBusy;
    if (sorterIgnoreFoldersEl) sorterIgnoreFoldersEl.disabled = sorterBusy;
    if (sorterPreviewSearchEl) sorterPreviewSearchEl.disabled = sorterBusy;
    if (sorterPreviewCategoryFilterEl) {
      sorterPreviewCategoryFilterEl.disabled = sorterBusy;
    }
    if (sorterPreviewStatusFilterEl) {
      sorterPreviewStatusFilterEl.disabled = sorterBusy;
    }
    if (sorterExportFormatEl) sorterExportFormatEl.disabled = sorterBusy;
    if (sorterCopyResultBtn) {
      sorterCopyResultBtn.disabled = sorterBusy || !sorterLatestResult;
    }
    if (sorterExportResultBtn) {
      sorterExportResultBtn.disabled = sorterBusy || !sorterLatestResult;
    }
    if (sorterOpenFolderBtn) {
      sorterOpenFolderBtn.disabled = sorterBusy || !sorterSelectedFolder;
    }
  };

  const getSorterOptions = () => ({
    logFilePath: sorterLogPathEl?.value || "",
    conflictMode: sorterConflictModeEl?.value || "rename",
    recursive: !!sorterRecursiveEl?.checked,
    ignoreExtensions: sorterIgnoreExtensionsEl?.value || "",
    ignoreFolders: sorterIgnoreFoldersEl?.value || "",
  });

  const applySorterOptionState = () => {
    if (sorterLogPathEl) {
      sorterLogPathEl.value = loadSorterPref(SORTER_LOG_PATH_KEY, "");
    }
    if (sorterConflictModeEl) {
      sorterConflictModeEl.value = loadSorterPref(
        SORTER_CONFLICT_MODE_KEY,
        "rename",
      );
    }
    if (sorterRecursiveEl) {
      sorterRecursiveEl.checked =
        loadSorterPref(SORTER_RECURSIVE_KEY, "false") === "true";
    }
    if (sorterIgnoreExtensionsEl) {
      sorterIgnoreExtensionsEl.value = loadSorterPref(
        SORTER_IGNORE_EXTENSIONS_KEY,
        "",
      );
    }
    if (sorterIgnoreFoldersEl) {
      sorterIgnoreFoldersEl.value = loadSorterPref(
        SORTER_IGNORE_FOLDERS_KEY,
        "",
      );
    }
  };

  const persistSorterOptions = () => {
    const options = getSorterOptions();
    saveSorterPref(SORTER_LOG_PATH_KEY, options.logFilePath);
    saveSorterPref(SORTER_CONFLICT_MODE_KEY, options.conflictMode);
    saveSorterPref(SORTER_RECURSIVE_KEY, options.recursive ? "true" : "false");
    saveSorterPref(SORTER_IGNORE_EXTENSIONS_KEY, options.ignoreExtensions);
    saveSorterPref(SORTER_IGNORE_FOLDERS_KEY, options.ignoreFolders);
    return options;
  };

  const renderSorterRules = () => {
    if (!sorterRulesListEl) return;
    sorterRulesListEl.replaceChildren();
    SORTER_CATEGORY_ORDER.forEach((category) => {
      const item = document.createElement("article");
      item.className = "sorter-rule-card";

      const title = document.createElement("strong");
      title.textContent = t(`tools.sorter.category.${category}`);

      const sample = document.createElement("span");
      sample.className = "muted";
      sample.textContent =
        SORTER_CATEGORY_SAMPLES[category] || t("tools.sorter.rules.other");

      item.append(title, sample);
      sorterRulesListEl.appendChild(item);
    });
  };

  const renderSorterBreakdown = (categoryCount = {}) => {
    if (!sorterBreakdownListEl) return;
    sorterBreakdownListEl.replaceChildren();

    const entries = SORTER_CATEGORY_ORDER.map((category) => ({
      category,
      count: Number(categoryCount?.[category] || 0),
    })).filter((entry) => entry.count > 0);

    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "sorter-breakdown-list__empty muted";
      empty.textContent = t("tools.sorter.breakdown.empty");
      sorterBreakdownListEl.appendChild(empty);
      return;
    }

    entries.forEach(({ category, count }) => {
      const item = document.createElement("div");
      item.className = "sorter-breakdown-item";

      const label = document.createElement("span");
      label.textContent = t(`tools.sorter.category.${category}`);

      const value = document.createElement("strong");
      value.textContent = String(count);

      item.append(label, value);
      sorterBreakdownListEl.appendChild(item);
    });
  };

  const updateSorterCategoryFilterOptions = (operations = []) => {
    if (!sorterPreviewCategoryFilterEl) return;
    const current = sorterPreviewCategoryFilterEl.value || "all";
    sorterPreviewCategoryFilterEl.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = t("tools.sorter.preview.filter.all");
    sorterPreviewCategoryFilterEl.appendChild(allOption);

    const presentCategories = new Set(
      operations
        .map((item) => String(item?.category || "").trim())
        .filter(Boolean),
    );
    SORTER_CATEGORY_ORDER.forEach((category) => {
      if (!presentCategories.has(category)) return;
      const option = document.createElement("option");
      option.value = category;
      option.textContent = t(`tools.sorter.category.${category}`);
      sorterPreviewCategoryFilterEl.appendChild(option);
    });
    sorterPreviewCategoryFilterEl.value = Array.from(
      sorterPreviewCategoryFilterEl.options,
    ).some((option) => option.value === current)
      ? current
      : "all";
  };

  const formatSorterOperationRow = (item = {}) => {
    const fileName = String(item.fileName || "").trim() || "—";
    const category = String(item.category || "").trim() || "Other";
    const targetName =
      String(item.targetPath || "")
        .split(/[\\/]/)
        .pop()
        ?.trim() || fileName;
    const relativeDir = String(item.relativeDir || "").trim();
    const status = String(item.status || "").trim() || "planned";
    const action = String(item.action || "").trim() || "";
    return { fileName, targetName, category, relativeDir, status, action };
  };

  const getSorterDisplayName = (item = {}) => {
    const row = formatSorterOperationRow(item);
    return row.relativeDir && row.relativeDir !== "."
      ? `${row.relativeDir}/${row.fileName}`
      : row.fileName;
  };

  const getSorterProblemLabel = (item = {}) => {
    if (item?.status === "error") {
      return item.message || t("tools.sorter.error");
    }

    const action = String(item?.action || "").trim();
    if (action === "ignored-hidden") {
      return t("tools.sorter.status.ignoredHidden");
    }
    if (action === "ignored-extension") {
      return item.message || t("tools.sorter.status.ignoredExtension");
    }
    if (action === "ignored-folder") {
      return t("tools.sorter.status.ignoredFolder");
    }
    if (action === "managed-category") {
      return t("tools.sorter.status.managedCategory");
    }
    if (action === "log-file") {
      return t("tools.sorter.status.logFile");
    }
    return t("tools.sorter.status.skipExisting");
  };

  const getFilteredSorterOperations = (operations = []) => {
    const query = String(sorterPreviewSearchEl?.value || "")
      .trim()
      .toLowerCase();
    const category = String(sorterPreviewCategoryFilterEl?.value || "all");
    const statusFilter = String(sorterPreviewStatusFilterEl?.value || "all");

    return operations.filter((item) => {
      const rowData = formatSorterOperationRow(item);
      const haystack = [
        rowData.fileName,
        rowData.targetName,
        rowData.category,
        rowData.relativeDir,
      ]
        .join(" ")
        .toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (category !== "all" && rowData.category !== category) return false;
      if (statusFilter !== "all" && rowData.status !== statusFilter) {
        return false;
      }
      return true;
    });
  };

  const buildSorterExportContent = (res = {}, operations = [], format = "txt") => {
    if (format === "json") {
      return JSON.stringify(
        {
          meta: {
            dryRun: !!res?.dryRun,
            folderPath: res?.folderPath || sorterSelectedFolder || "",
            moved: Number(res?.moved || 0),
            totalFiles: Number(res?.totalFiles || 0),
            skipped: Number(res?.skipped || 0),
            errors: Array.isArray(res?.errors) ? res.errors.length : 0,
            conflictMode: res?.conflictMode || getSorterOptions().conflictMode,
            recursive: !!res?.recursive,
          },
          operations: operations.map((item) => ({
            ...formatSorterOperationRow(item),
            message: String(item?.message || ""),
            sourcePath: String(item?.sourcePath || ""),
          })),
        },
        null,
        2,
      );
    }

    if (format === "csv") {
      const header = [
        "status",
        "action",
        "fileName",
        "targetName",
        "category",
        "relativeDir",
        "message",
      ];
      const rows = operations.map((item) => {
        const row = formatSorterOperationRow(item);
        return [
          row.status,
          row.action,
          row.fileName,
          row.targetName,
          row.category,
          row.relativeDir,
          String(item?.message || ""),
        ]
          .map((value) => `"${String(value || "").replace(/"/g, '""')}"`)
          .join(",");
      });
      return [header.join(","), ...rows].join("\n");
    }

    const header = [
      `File Sorter ${res?.dryRun ? "Preview" : "Results"}`,
      `Folder: ${res?.folderPath || sorterSelectedFolder || "-"}`,
      `Processed: ${Number(res?.moved || 0)}/${Number(res?.totalFiles || 0)}`,
      `Skipped: ${Number(res?.skipped || 0)}`,
      `Errors: ${Array.isArray(res?.errors) ? res.errors.length : 0}`,
      `Conflict mode: ${res?.conflictMode || getSorterOptions().conflictMode}`,
      `Recursive: ${res?.recursive ? "yes" : "no"}`,
      "",
      "Operations:",
    ];

    const body = operations.map((item) => {
      const row = formatSorterOperationRow(item);
      const sourcePrefix = row.relativeDir ? `${row.relativeDir} -> ` : "";
      const suffix = item?.message ? ` | ${item.message}` : "";
      return `- [${row.status}] ${row.fileName} => ${sourcePrefix}${row.targetName} (${row.category})${suffix}`;
    });

    return header.concat(body).join("\n");
  };

  const setSorterFolder = (folderPath) => {
    sorterSelectedFolder = String(folderPath || "");
    if (sorterOpenFolderBtn) {
      sorterOpenFolderBtn.disabled = sorterBusy || !sorterSelectedFolder;
    }
    if (!sorterFolderPillEl) return;
    if (!sorterSelectedFolder) {
      sorterFolderPillEl.classList.add("muted");
      sorterFolderPillEl.textContent = t("tools.sorter.noFolder");
      sorterFolderPillEl.removeAttribute("title");
      return;
    }
    sorterFolderPillEl.classList.remove("muted");
    sorterFolderPillEl.textContent = sorterSelectedFolder;
    sorterFolderPillEl.title = sorterSelectedFolder;
  };

  const setSorterResult = (message, tone = "muted") => {
    if (!sorterResultEl) return;
    sorterResultEl.textContent = message;
    sorterResultEl.className = `quick-action-result ${tone}`;
  };

  const hideSorterPreview = () => {
    sorterPreviewPanelEl?.classList.add("hidden");
    sorterLatestResult = null;
    if (sorterPreviewTitleEl) {
      sorterPreviewTitleEl.textContent = t("tools.sorter.preview.title");
    }
    if (sorterPreviewBadgeEl) {
      sorterPreviewBadgeEl.textContent = t("tools.sorter.preview.badge");
    }
    renderSorterBreakdown({});
    sorterErrorsPanelEl?.classList.add("hidden");
    if (sorterErrorsListEl) sorterErrorsListEl.replaceChildren();
    if (sorterPreviewListEl) sorterPreviewListEl.replaceChildren();
    sorterPreviewFilterEmptyEl?.classList.add("hidden");
    if (sorterPreviewMoreEl) {
      sorterPreviewMoreEl.classList.add("hidden");
      sorterPreviewMoreEl.textContent = "";
      delete sorterPreviewMoreEl.dataset.count;
    }
    if (sorterPreviewMovedEl) sorterPreviewMovedEl.textContent = "0";
    if (sorterPreviewTotalEl) sorterPreviewTotalEl.textContent = "0";
    if (sorterPreviewSkippedEl) sorterPreviewSkippedEl.textContent = "0";
    if (sorterPreviewErrorsEl) sorterPreviewErrorsEl.textContent = "0";
    if (sorterCopyResultBtn) sorterCopyResultBtn.disabled = true;
    if (sorterExportResultBtn) sorterExportResultBtn.disabled = true;
  };

  const renderSorterErrors = (res = {}) => {
    if (!sorterErrorsPanelEl || !sorterErrorsListEl) return;
    sorterErrorsListEl.replaceChildren();

    const problemItems = []
      .concat(Array.isArray(res.operations) ? res.operations : [])
      .filter((item) => item?.status === "skipped" || item?.status === "error");

    if (!problemItems.length) {
      sorterErrorsPanelEl.classList.add("hidden");
      return;
    }

    sorterErrorsPanelEl.classList.remove("hidden");
    problemItems.forEach((item) => {
      const row = document.createElement("div");
      row.className = "sorter-errors-row";

      const name = document.createElement("strong");
      name.textContent = getSorterDisplayName(item);
      name.title = String(item.sourcePath || name.textContent);

      const meta = document.createElement("span");
      meta.className = "muted";
      meta.textContent = getSorterProblemLabel(item);

      row.append(name, meta);
      sorterErrorsListEl.appendChild(row);
    });
  };

  const renderSorterPreview = (res = {}, mode = "preview") => {
    if (!sorterPreviewPanelEl || !sorterPreviewListEl) return;
    const operations = Array.isArray(res.operations) ? res.operations : [];
    sorterLatestResult = res;
    sorterLatestMode = mode;
    updateSorterCategoryFilterOptions(operations);
    const filteredOperations = getFilteredSorterOperations(operations);
    const shownOperations = filteredOperations.slice(0, SORTER_PREVIEW_LIMIT);
    const remainingCount = Math.max(
      0,
      filteredOperations.length - shownOperations.length,
    );

    sorterPreviewPanelEl.classList.remove("hidden");
    if (sorterPreviewTitleEl) {
      sorterPreviewTitleEl.textContent = t(
        mode === "preview"
          ? "tools.sorter.preview.title"
          : "tools.sorter.results.title",
      );
    }
    if (sorterPreviewBadgeEl) {
      sorterPreviewBadgeEl.textContent = t(
        mode === "preview"
          ? "tools.sorter.preview.badge"
          : "tools.sorter.results.badge",
      );
    }
    if (sorterPreviewMovedEl) {
      sorterPreviewMovedEl.textContent = String(Number(res.moved || 0));
    }
    if (sorterPreviewTotalEl) {
      sorterPreviewTotalEl.textContent = String(Number(res.totalFiles || 0));
    }
    if (sorterPreviewSkippedEl) {
      sorterPreviewSkippedEl.textContent = String(Number(res.skipped || 0));
    }
    if (sorterPreviewErrorsEl) {
      sorterPreviewErrorsEl.textContent = String(
        Array.isArray(res.errors) ? res.errors.length : 0,
      );
    }
    renderSorterBreakdown(res.categoryCount || {});
    renderSorterErrors(res);
    if (sorterCopyResultBtn) sorterCopyResultBtn.disabled = false;
    if (sorterExportResultBtn) sorterExportResultBtn.disabled = false;

    sorterPreviewListEl.replaceChildren();
    sorterPreviewFilterEmptyEl?.classList.toggle(
      "hidden",
      !(filteredOperations.length === 0 && operations.length > 0),
    );

    if (!shownOperations.length && operations.length === 0) {
      const emptyEl = document.createElement("p");
      emptyEl.className = "sorter-preview-list__empty muted";
      emptyEl.textContent = t("tools.sorter.preview.list.empty");
      sorterPreviewListEl.appendChild(emptyEl);
    } else if (shownOperations.length) {
      shownOperations.forEach((operation) => {
        const rowData = formatSorterOperationRow(operation);
        const row = document.createElement("div");
        row.className = "sorter-preview-row";

        const fileEl = document.createElement("span");
        fileEl.className = "sorter-preview-row__file";
        fileEl.textContent = rowData.fileName;
        fileEl.title = rowData.fileName;

        const targetEl = document.createElement("span");
        targetEl.className = "sorter-preview-row__target muted";
        const sourcePrefix = rowData.relativeDir ? `${rowData.relativeDir} -> ` : "";
        const actionLabel =
          rowData.action === "replace"
            ? ` (${t("tools.sorter.status.replaced")})`
            : rowData.action === "rename"
              ? ` (${t("tools.sorter.status.renamed")})`
              : rowData.status === "skipped"
                ? ` (${t("tools.sorter.status.skipped")})`
                : rowData.status === "error"
                  ? ` (${t("tools.sorter.status.error")})`
                  : "";
        targetEl.textContent = `${sourcePrefix}${rowData.targetName}${actionLabel}`;
        targetEl.title = targetEl.textContent;

        const categoryEl = document.createElement("span");
        categoryEl.className = "sorter-preview-row__category";
        categoryEl.textContent = rowData.category;

        row.append(fileEl, targetEl, categoryEl);
        sorterPreviewListEl.appendChild(row);
      });
    }

    if (sorterPreviewMoreEl) {
      if (remainingCount > 0) {
        sorterPreviewMoreEl.classList.remove("hidden");
        sorterPreviewMoreEl.textContent = t("tools.sorter.preview.more", {
          count: remainingCount,
        });
        sorterPreviewMoreEl.dataset.count = String(remainingCount);
      } else {
        sorterPreviewMoreEl.classList.add("hidden");
        sorterPreviewMoreEl.textContent = "";
        delete sorterPreviewMoreEl.dataset.count;
      }
    }
  };

  const updateSorterHowtoUi = () => {
    if (!sorterHowtoTrackEl) return;
    sorterHowtoTrackEl.style.transform = `translateX(-${sorterHowtoIndex * 100}%)`;
    if (sorterHowtoStepEl) {
      sorterHowtoStepEl.textContent = t("tools.sorter.howto.step", {
        current: sorterHowtoIndex + 1,
        total: sorterHowtoSlideCount,
      });
    }
    if (sorterHowtoPrevBtn) sorterHowtoPrevBtn.disabled = sorterHowtoIndex <= 0;
    if (sorterHowtoNextBtn) {
      sorterHowtoNextBtn.disabled =
        sorterHowtoIndex >= sorterHowtoSlideCount - 1;
    }
    sorterHowtoDots.forEach((dot, idx) => {
      const isActive = idx === sorterHowtoIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-current", isActive ? "true" : "false");
    });
  };

  const setSorterHowtoSlide = (index) => {
    const nextIndex = Math.max(
      0,
      Math.min(Number(index) || 0, sorterHowtoSlideCount - 1),
    );
    sorterHowtoIndex = nextIndex;
    updateSorterHowtoUi();
  };

  const openSorterHowtoModal = () => {
    if (!sorterHowtoModalEl || !sorterHowtoDialogEl) return;
    sorterHowtoReturnFocusEl = document.activeElement;
    if (sorterHowtoPrevOverflow === null) {
      sorterHowtoPrevOverflow = document.documentElement.style.overflow;
    }
    document.documentElement.style.overflow = "hidden";
    sorterHowtoModalEl.classList.remove("hidden");
    sorterHowtoModalEl.setAttribute("aria-hidden", "false");
    sorterHowtoDialogEl.setAttribute("aria-hidden", "false");
    setSorterHowtoSlide(0);
    setTimeout(() => sorterHowtoCloseBtn?.focus(), 0);
  };

  const closeSorterHowtoModal = ({ returnFocus = true } = {}) => {
    if (!sorterHowtoModalEl || !sorterHowtoDialogEl) return;
    sorterHowtoModalEl.classList.add("hidden");
    sorterHowtoModalEl.setAttribute("aria-hidden", "true");
    sorterHowtoDialogEl.setAttribute("aria-hidden", "true");
    if (sorterHowtoPrevOverflow !== null) {
      document.documentElement.style.overflow = sorterHowtoPrevOverflow;
      sorterHowtoPrevOverflow = null;
    }
    if (returnFocus) {
      if (sorterHowtoReturnFocusEl?.focus) sorterHowtoReturnFocusEl.focus();
      else sorterOpenHowtoBtn?.focus();
    }
  };

  const runSorter = async (dryRun) => {
    if (sorterBusy) return;
    if (!sorterSelectedFolder) {
      hideSorterPreview();
      setSorterResult(t("tools.sorter.needFolder"), "warning");
      return;
    }
    const sorterOptions = persistSorterOptions();
    setSorterBusy(true);
    hideSorterPreview();
    setSorterResult(
      t(dryRun ? "tools.sorter.runningPreview" : "tools.sorter.runningApply"),
      "muted",
    );
    try {
      const res = await window.electron?.tools?.sortFilesByCategory?.({
        folderPath: sorterSelectedFolder,
        dryRun,
        ...sorterOptions,
      });
      if (!res?.success) {
        hideSorterPreview();
        setSorterResult(res?.error || t("tools.sorter.error"), "error");
        return;
      }

      const summary = t("tools.sorter.done", {
        moved: Number(res.moved || 0),
        total: Number(res.totalFiles || 0),
        skipped: Number(res.skipped || 0),
      });
      const hasErrors = Array.isArray(res.errors) && res.errors.length > 0;
      const modeHint = res.dryRun ? ` ${t("tools.sorter.dryRunHint")}` : "";
      const errorHint = hasErrors
        ? ` ${t("tools.sorter.errors", { count: res.errors.length })}`
        : "";
      setSorterResult(
        `${summary}${modeHint}${errorHint}`,
        hasErrors ? "warning" : "success",
      );
      renderSorterPreview(res, res.dryRun ? "preview" : "results");
    } catch (error) {
      hideSorterPreview();
      setSorterResult(error?.message || t("tools.sorter.error"), "error");
    } finally {
      setSorterBusy(false);
    }
  };

  sorterPickFolderBtn?.addEventListener("click", async () => {
    if (sorterBusy) return;
    try {
      const res = await window.electron?.tools?.pickSorterFolder?.();
      if (!res?.success || !res?.folderPath) {
        if (res?.canceled) return;
        setSorterResult(res?.error || t("tools.sorter.pickError"), "error");
        return;
      }
      setSorterFolder(res.folderPath);
      saveSorterFolder(res.folderPath);
      hideSorterPreview();
      setSorterResult(t("tools.sorter.folderSelected"), "muted");
    } catch (error) {
      hideSorterPreview();
      setSorterResult(error?.message || t("tools.sorter.pickError"), "error");
    }
  });

  sorterOpenFolderBtn?.addEventListener("click", async () => {
    if (sorterBusy || !sorterSelectedFolder) return;
    try {
      const res = await window.electron?.tools?.openSorterFolder?.(
        sorterSelectedFolder,
      );
      if (!res?.success) {
        setSorterResult(
          res?.error || t("tools.sorter.openFolderError"),
          "error",
        );
      }
    } catch (error) {
      setSorterResult(
        error?.message || t("tools.sorter.openFolderError"),
        "error",
      );
    }
  });

  sorterPreviewRunBtn?.addEventListener("click", async () => runSorter(true));
  sorterApplyRunBtn?.addEventListener("click", async () => runSorter(false));
  sorterLogPathEl?.addEventListener("change", persistSorterOptions);
  sorterConflictModeEl?.addEventListener("change", persistSorterOptions);
  sorterRecursiveEl?.addEventListener("change", persistSorterOptions);
  sorterIgnoreExtensionsEl?.addEventListener("change", persistSorterOptions);
  sorterIgnoreFoldersEl?.addEventListener("change", persistSorterOptions);
  sorterPreviewSearchEl?.addEventListener("input", () => {
    if (sorterLatestResult) renderSorterPreview(sorterLatestResult, sorterLatestMode);
  });
  sorterPreviewCategoryFilterEl?.addEventListener("change", () => {
    if (sorterLatestResult) renderSorterPreview(sorterLatestResult, sorterLatestMode);
  });
  sorterPreviewStatusFilterEl?.addEventListener("change", () => {
    if (sorterLatestResult) renderSorterPreview(sorterLatestResult, sorterLatestMode);
  });
  sorterCopyResultBtn?.addEventListener("click", async () => {
    if (!sorterLatestResult) return;
    const format = String(sorterExportFormatEl?.value || "txt");
    const content = buildSorterExportContent(
      sorterLatestResult,
      getFilteredSorterOperations(
        Array.isArray(sorterLatestResult.operations)
          ? sorterLatestResult.operations
          : [],
      ),
      format,
    );
    try {
      await navigator.clipboard?.writeText?.(content);
      setSorterResult(t("tools.sorter.copyDone"), "success");
    } catch (error) {
      setSorterResult(error?.message || t("tools.sorter.copyError"), "error");
    }
  });
  sorterExportResultBtn?.addEventListener("click", async () => {
    if (!sorterLatestResult) return;
    const format = String(sorterExportFormatEl?.value || "txt");
    const content = buildSorterExportContent(
      sorterLatestResult,
      getFilteredSorterOperations(
        Array.isArray(sorterLatestResult.operations)
          ? sorterLatestResult.operations
          : [],
      ),
      format,
    );
    try {
      const res = await window.electron?.tools?.exportSorterResult?.({
        content,
        suggestedName: `file-sorter-${sorterLatestResult.dryRun ? "preview" : "result"}-${new Date().toISOString().slice(0, 10)}.${format}`,
        format,
      });
      if (!res?.success) {
        if (!res?.canceled) {
          setSorterResult(res?.error || t("tools.sorter.exportError"), "error");
        }
        return;
      }
      setSorterResult(
        t("tools.sorter.exportDone", { filePath: res.filePath || "" }),
        "success",
      );
    } catch (error) {
      setSorterResult(error?.message || t("tools.sorter.exportError"), "error");
    }
  });

  sorterOpenHowtoBtn?.addEventListener("click", () => openSorterHowtoModal());
  sorterHowtoCloseBtn?.addEventListener("click", () => closeSorterHowtoModal());
  sorterHowtoPrevBtn?.addEventListener("click", () =>
    setSorterHowtoSlide(sorterHowtoIndex - 1),
  );
  sorterHowtoNextBtn?.addEventListener("click", () =>
    setSorterHowtoSlide(sorterHowtoIndex + 1),
  );
  sorterHowtoDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      setSorterHowtoSlide(Number(dot.dataset.index || "0"));
    });
  });
  sorterHowtoModalEl?.addEventListener("mousedown", (event) => {
    if (event.target === sorterHowtoModalEl) closeSorterHowtoModal();
  });

  setSorterFolder(loadSorterFolder());
  hideSorterPreview();
  renderSorterRules();
  renderSorterBreakdown({});
  applySorterOptionState();
  setSorterResult(t("tools.sorter.resultIdle"), "muted");
  updateSorterHowtoUi();

  registerCleanup?.(() => {
    if (sorterHowtoPrevOverflow !== null) {
      document.documentElement.style.overflow = sorterHowtoPrevOverflow;
      sorterHowtoPrevOverflow = null;
    }
  });
}

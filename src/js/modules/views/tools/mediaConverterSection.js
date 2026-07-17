const TARGET_FORMATS = [
  { value: "mp4", groupKey: "tools.converter.group.video" },
  { value: "webm", groupKey: "tools.converter.group.video" },
  { value: "mkv", groupKey: "tools.converter.group.video" },
  { value: "mp3", groupKey: "tools.converter.group.audio" },
  { value: "m4a", groupKey: "tools.converter.group.audio" },
  { value: "wav", groupKey: "tools.converter.group.audio" },
  { value: "flac", groupKey: "tools.converter.group.audio" },
  { value: "ogg", groupKey: "tools.converter.group.audio" },
  { value: "opus", groupKey: "tools.converter.group.audio" },
];

const QUALITY_PRESETS = ["balanced", "small", "high"];

const getFileName = (filePath, fallback) => {
  if (!filePath) return fallback;
  return String(filePath).split(/[\\/]/).pop() || String(filePath);
};

const getDirName = (filePath) => {
  const text = String(filePath || "");
  const index = Math.max(text.lastIndexOf("/"), text.lastIndexOf("\\"));
  return index > 0 ? text.slice(0, index) : "";
};

const createFormatOptions = (t) =>
  TARGET_FORMATS.map(
    (item) => `
      <button
        type="button"
        class="converter-option"
        role="option"
        aria-selected="${item.value === "mp4" ? "true" : "false"}"
        data-converter-format="${item.value}"
      >
        <strong>${item.value.toUpperCase()}</strong>
        <span data-i18n="${item.groupKey}">${t(item.groupKey)}</span>
      </button>
    `,
  ).join("");

const createQualityOptions = (t) =>
  QUALITY_PRESETS.map(
    (quality) => `
      <button
        type="button"
        class="converter-option"
        role="option"
        aria-selected="${quality === "balanced" ? "true" : "false"}"
        data-converter-quality="${quality}"
      >
        <strong data-i18n="tools.converter.quality.${quality}">${t(`tools.converter.quality.${quality}`)}</strong>
        <span data-i18n="tools.converter.quality.${quality}.hint">${t(`tools.converter.quality.${quality}.hint`)}</span>
      </button>
    `,
  ).join("");

export function renderMediaConverterSection(t) {
  return `
    <section class="tools-view hidden" data-tool-view="media-converter" aria-label="${t("tools.nav.current.mediaConverter")}">
      <article class="tools-card tools-detail-card converter-card">
        <div class="tools-card__header converter-header">
          <div>
            <h2 data-i18n="tools.converter.title">${t("tools.converter.title")}</h2>
            <p class="tools-card__hint" data-i18n="tools.converter.subtitle">${t("tools.converter.subtitle")}</p>
          </div>
        </div>

        <div class="converter-shell">
          <section class="converter-panel converter-panel--source">
            <div class="converter-panel__header">
              <h3 data-i18n="tools.converter.source.title">${t("tools.converter.source.title")}</h3>
              <button id="converter-pick-file" type="button" class="small-button">
                <i class="fa-regular fa-folder-open"></i>
                <span data-i18n="tools.converter.pickFile">${t("tools.converter.pickFile")}</span>
              </button>
            </div>
            <div id="converter-drop-zone" class="converter-drop-zone" role="button" tabindex="0">
              <i class="fa-solid fa-file-arrow-up" aria-hidden="true"></i>
              <div>
                <strong id="converter-file-name" data-i18n="tools.converter.noFile">${t("tools.converter.noFile")}</strong>
                <span id="converter-file-path" class="muted" data-i18n="tools.converter.dropHint">${t("tools.converter.dropHint")}</span>
              </div>
            </div>
          </section>

          <section class="converter-panel converter-panel--settings">
            <div class="converter-panel__header">
              <h3 data-i18n="tools.converter.settings.title">${t("tools.converter.settings.title")}</h3>
            </div>
            <div class="converter-control-group">
              <span class="converter-label" data-i18n="tools.converter.format">${t("tools.converter.format")}</span>
              <div id="converter-format-options" class="converter-options" role="listbox">
                ${createFormatOptions(t)}
              </div>
            </div>
            <div class="converter-control-group">
              <span class="converter-label" data-i18n="tools.converter.quality">${t("tools.converter.quality")}</span>
              <div id="converter-quality-options" class="converter-options" role="listbox">
                ${createQualityOptions(t)}
              </div>
            </div>
          </section>

          <section class="converter-panel converter-panel--output">
            <div class="converter-panel__header">
              <h3 data-i18n="tools.converter.output.title">${t("tools.converter.output.title")}</h3>
              <button id="converter-pick-folder" type="button" class="small-button">
                <i class="fa-regular fa-folder-open"></i>
                <span data-i18n="tools.converter.pickFolder">${t("tools.converter.pickFolder")}</span>
              </button>
            </div>
            <div class="converter-output-pill">
              <span id="converter-output-dir" data-i18n="tools.converter.output.auto">${t("tools.converter.output.auto")}</span>
            </div>
          </section>

          <section class="converter-panel converter-panel--run">
            <div class="converter-progress hidden" id="converter-progress" aria-hidden="true">
              <div class="converter-progress__meta">
                <span id="converter-progress-label" class="muted" data-i18n="tools.converter.progress.idle">${t("tools.converter.progress.idle")}</span>
                <span id="converter-progress-percent" class="muted">0%</span>
              </div>
              <div class="converter-progress__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <span id="converter-progress-bar" class="converter-progress__bar" style="width: 0%"></span>
              </div>
            </div>
            <div id="converter-result" class="converter-result muted" data-i18n="tools.converter.status.idle">${t("tools.converter.status.idle")}</div>
            <div class="converter-actions">
              <button id="converter-run" type="button" class="small-button media-inspector-primary" disabled>
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <span data-i18n="tools.converter.convert">${t("tools.converter.convert")}</span>
              </button>
              <button id="converter-cancel" type="button" class="small-button media-inspector-secondary" disabled>
                <i class="fa-solid fa-stop"></i>
                <span data-i18n="tools.converter.cancel">${t("tools.converter.cancel")}</span>
              </button>
              <button id="converter-open-result" type="button" class="small-button media-inspector-secondary" disabled>
                <i class="fa-regular fa-folder-open"></i>
                <span data-i18n="tools.converter.openResult">${t("tools.converter.openResult")}</span>
              </button>
            </div>
          </section>
        </div>
      </article>
    </section>
  `;
}

export function initMediaConverterSection({
  view,
  getEl,
  t,
  registerCleanup,
} = {}) {
  const root = view?.querySelector('[data-tool-view="media-converter"]');
  if (!root) return null;

  const elements = {
    pickFile: getEl("converter-pick-file", root),
    pickFolder: getEl("converter-pick-folder", root),
    dropZone: getEl("converter-drop-zone", root),
    fileName: getEl("converter-file-name", root),
    filePath: getEl("converter-file-path", root),
    outputDir: getEl("converter-output-dir", root),
    run: getEl("converter-run", root),
    cancel: getEl("converter-cancel", root),
    openResult: getEl("converter-open-result", root),
    result: getEl("converter-result", root),
    progress: getEl("converter-progress", root),
    progressLabel: getEl("converter-progress-label", root),
    progressPercent: getEl("converter-progress-percent", root),
    progressBar: getEl("converter-progress-bar", root),
    progressTrack: root.querySelector(".converter-progress__track"),
    formatOptions: Array.from(root.querySelectorAll("[data-converter-format]")),
    qualityOptions: Array.from(
      root.querySelectorAll("[data-converter-quality]"),
    ),
  };

  const state = {
    inputPath: "",
    outputDir: "",
    targetFormat: "mp4",
    quality: "balanced",
    requestId: "",
    busy: false,
    outputPath: "",
  };

  const getDroppedFilePath = (entry) => {
    if (!entry) return "";
    try {
      const file =
        typeof entry.getAsFile === "function" ? entry.getAsFile() : entry;
      return window.electron?.tools?.getDroppedFilePath?.(file || entry) || "";
    } catch {
      return "";
    }
  };

  const collectDroppedFilePaths = (dataTransfer) => {
    if (!dataTransfer) return [];
    return [
      ...Array.from(dataTransfer.files || []),
      ...Array.from(dataTransfer.items || []),
    ]
      .map(getDroppedFilePath)
      .filter(Boolean);
  };

  const setBusy = (busy) => {
    state.busy = !!busy;
    if (elements.pickFile) elements.pickFile.disabled = state.busy;
    if (elements.pickFolder) elements.pickFolder.disabled = state.busy;
    if (elements.run) elements.run.disabled = state.busy || !state.inputPath;
    if (elements.cancel) elements.cancel.disabled = !state.busy;
    elements.formatOptions.forEach((option) => {
      option.disabled = state.busy;
    });
    elements.qualityOptions.forEach((option) => {
      option.disabled = state.busy;
    });
  };

  const setResult = (
    messageKeyOrText,
    { isText = false, tone = "idle" } = {},
  ) => {
    if (!elements.result) return;
    elements.result.textContent = isText
      ? messageKeyOrText
      : t(messageKeyOrText);
    elements.result.className = `converter-result is-${tone}`;
  };

  const setProgress = ({ percent = 0, visible = true, labelKey } = {}) => {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    elements.progress?.classList.toggle("hidden", !visible);
    elements.progress?.setAttribute("aria-hidden", visible ? "false" : "true");
    if (elements.progressLabel) {
      elements.progressLabel.textContent = t(
        labelKey || "tools.converter.progress.running",
      );
    }
    if (elements.progressPercent) {
      elements.progressPercent.textContent = `${safePercent}%`;
    }
    if (elements.progressBar) {
      elements.progressBar.style.width = `${safePercent}%`;
    }
    elements.progressTrack?.setAttribute("aria-valuenow", String(safePercent));
  };

  const updateSelectedButtons = () => {
    elements.formatOptions.forEach((option) => {
      option.setAttribute(
        "aria-selected",
        option.dataset.converterFormat === state.targetFormat
          ? "true"
          : "false",
      );
    });
    elements.qualityOptions.forEach((option) => {
      option.setAttribute(
        "aria-selected",
        option.dataset.converterQuality === state.quality ? "true" : "false",
      );
    });
  };

  const setInputPath = (filePath) => {
    state.inputPath = String(filePath || "");
    state.outputPath = "";
    if (elements.fileName) {
      elements.fileName.textContent = state.inputPath
        ? getFileName(state.inputPath, t("tools.converter.noFile"))
        : t("tools.converter.noFile");
    }
    if (elements.filePath) {
      elements.filePath.textContent = state.inputPath
        ? state.inputPath
        : t("tools.converter.dropHint");
    }
    if (!state.outputDir && elements.outputDir) {
      const sourceDir = getDirName(state.inputPath);
      elements.outputDir.textContent =
        sourceDir || t("tools.converter.output.auto");
    }
    if (elements.openResult) elements.openResult.disabled = true;
    setResult("tools.converter.status.ready");
    setBusy(state.busy);
  };

  const setOutputDir = (folderPath) => {
    state.outputDir = String(folderPath || "");
    if (elements.outputDir) {
      elements.outputDir.textContent =
        state.outputDir ||
        getDirName(state.inputPath) ||
        t("tools.converter.output.auto");
    }
  };

  elements.pickFile?.addEventListener("click", async () => {
    if (state.busy) return;
    const response = await window.electron?.tools?.pickConverterFile?.();
    if (response?.success && response.filePath) {
      setInputPath(response.filePath);
    }
  });

  elements.pickFolder?.addEventListener("click", async () => {
    if (state.busy) return;
    const response = await window.electron?.tools?.pickConverterFolder?.();
    if (response?.success && response.folderPath) {
      setOutputDir(response.folderPath);
    }
  });

  elements.formatOptions.forEach((option) => {
    option.addEventListener("click", () => {
      if (state.busy) return;
      state.targetFormat = option.dataset.converterFormat || "mp4";
      updateSelectedButtons();
      setBusy(false);
    });
  });

  elements.qualityOptions.forEach((option) => {
    option.addEventListener("click", () => {
      if (state.busy) return;
      state.quality = option.dataset.converterQuality || "balanced";
      updateSelectedButtons();
    });
  });

  if (elements.dropZone) {
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
    elements.dropZone.addEventListener("dragenter", () => {
      if (!state.busy) elements.dropZone.classList.add("is-drag-over");
    });
    elements.dropZone.addEventListener("dragover", () => {
      if (!state.busy) elements.dropZone.classList.add("is-drag-over");
    });
    elements.dropZone.addEventListener("dragleave", () => {
      elements.dropZone.classList.remove("is-drag-over");
    });
    elements.dropZone.addEventListener("drop", (event) => {
      elements.dropZone.classList.remove("is-drag-over");
      if (state.busy) return;
      const [filePath] = collectDroppedFilePaths(event.dataTransfer);
      if (filePath) setInputPath(filePath);
    });
  }

  elements.run?.addEventListener("click", async () => {
    if (state.busy || !state.inputPath) return;
    state.requestId = `converter-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
    setBusy(true);
    if (elements.openResult) elements.openResult.disabled = true;
    setProgress({ percent: 0, visible: true });
    setResult("tools.converter.status.running", { tone: "loading" });
    const response = await window.electron?.tools?.convertMediaFile?.({
      requestId: state.requestId,
      inputPath: state.inputPath,
      outputDir: state.outputDir,
      targetFormat: state.targetFormat,
      quality: state.quality,
    });
    setBusy(false);
    if (response?.success) {
      state.outputPath = response.outputPath || "";
      setProgress({
        percent: 100,
        visible: true,
        labelKey: "tools.converter.progress.done",
      });
      setResult(
        t("tools.converter.status.done", {
          fileName: getFileName(state.outputPath, state.outputPath),
        }),
        { isText: true, tone: "success" },
      );
      if (elements.openResult) elements.openResult.disabled = !state.outputPath;
      return;
    }
    const key =
      response?.code === "missingDependency"
        ? "tools.converter.error.missingDependency"
        : response?.code === "cancelled"
          ? "tools.converter.status.cancelled"
          : "tools.converter.error.failed";
    setResult(response?.error || t(key), {
      isText: !!response?.error,
      tone: "error",
    });
  });

  elements.cancel?.addEventListener("click", async () => {
    if (!state.busy || !state.requestId) return;
    await window.electron?.tools?.cancelMediaConversion?.({
      requestId: state.requestId,
    });
    setResult("tools.converter.status.cancelled", { tone: "warning" });
  });

  elements.openResult?.addEventListener("click", async () => {
    if (!state.outputPath || state.busy) return;
    await window.electron?.tools?.showInFolder?.(state.outputPath);
  });

  const unsubscribe = window.electron?.tools?.onConverterProgress?.(
    (progress = {}) => {
      if (!state.requestId || progress.requestId !== state.requestId) return;
      if (Number.isFinite(Number(progress.percent))) {
        setProgress({ percent: Number(progress.percent), visible: true });
      } else {
        setProgress({ percent: 0, visible: true });
      }
    },
  );

  registerCleanup?.(() => {
    if (typeof unsubscribe === "function") unsubscribe();
  });

  updateSelectedButtons();
  setOutputDir("");
  setResult("tools.converter.status.idle");
  setBusy(false);
  return { setInputPath };
}

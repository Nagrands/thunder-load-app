function createMarkup(t) {
  return `
    <article class="tools-card tools-detail-card media-inspector-card">
      <div class="tools-card__header media-inspector-header">
        <div>
          <h2 data-i18n="tools.mediaInspector.title">${t("tools.mediaInspector.title")}</h2>
          <p class="tools-card__hint" data-i18n="tools.mediaInspector.subtitle">${t("tools.mediaInspector.subtitle")}</p>
        </div>
        <div class="media-inspector-header__actions">
          <button id="media-inspector-pick-file" type="button" class="small-button media-inspector-primary">
            <i class="fa-regular fa-file-video"></i>
            <span data-i18n="tools.mediaInspector.pickFile">${t("tools.mediaInspector.pickFile")}</span>
          </button>
          <button
            id="media-inspector-analyze"
            type="button"
            class="small-button media-inspector-secondary"
            data-bs-toggle="tooltip"
            data-bs-placement="top"
            data-i18n-title="tools.mediaInspector.reAnalyze"
            data-i18n-aria="tools.mediaInspector.reAnalyze"
            title="${t("tools.mediaInspector.reAnalyze")}"
            aria-label="${t("tools.mediaInspector.reAnalyze")}"
            disabled
          >
            <i class="fa-solid fa-rotate"></i>
          </button>
          <button
            id="media-inspector-open-folder"
            type="button"
            class="small-button media-inspector-secondary"
            data-bs-toggle="tooltip"
            data-bs-placement="top"
            data-i18n-title="tools.mediaInspector.openFolder"
            data-i18n-aria="tools.mediaInspector.openFolder"
            title="${t("tools.mediaInspector.openFolder")}"
            aria-label="${t("tools.mediaInspector.openFolder")}"
            disabled
          >
            <i class="fa-regular fa-folder-open"></i>
          </button>
          <button
            id="media-inspector-copy-report"
            type="button"
            class="small-button media-inspector-secondary"
            data-bs-toggle="tooltip"
            data-bs-placement="top"
            data-i18n-title="tools.mediaInspector.copyReport"
            data-i18n-aria="tools.mediaInspector.copyReport"
            title="${t("tools.mediaInspector.copyReport")}"
            aria-label="${t("tools.mediaInspector.copyReport")}"
            disabled
          >
            <i class="fa-regular fa-copy"></i>
          </button>
        </div>
      </div>

      <section
        class="media-inspector-path-panel"
        data-i18n-aria="tools.mediaInspector.pathPanel.aria"
        aria-label="${t("tools.mediaInspector.pathPanel.aria")}"
      >
        <div class="media-inspector-path-panel__row">
          <span class="media-inspector-path-panel__label" data-i18n="tools.mediaInspector.selectedFileLabel">${t("tools.mediaInspector.selectedFileLabel")}</span>
          <span id="media-inspector-file-pill" class="media-inspector-file-pill is-empty" data-i18n="tools.mediaInspector.noFile">${t("tools.mediaInspector.noFile")}</span>
        </div>
        <span id="media-inspector-status" class="media-inspector-status is-idle" data-i18n="tools.mediaInspector.status.idle">${t("tools.mediaInspector.status.idle")}</span>
      </section>

      <section id="media-inspector-state" class="media-inspector-state media-inspector-state--empty">
        <div class="media-inspector-state__surface">
          <div class="media-inspector-state__topline">
            <div id="media-inspector-state-icon" class="media-inspector-state__icon">
              <i class="fa-solid fa-film"></i>
            </div>
            <div class="media-inspector-state__heading">
              <strong id="media-inspector-state-title" data-i18n="tools.mediaInspector.empty.title">${t("tools.mediaInspector.empty.title")}</strong>
              <p id="media-inspector-state-body" data-i18n="tools.mediaInspector.empty.body">${t("tools.mediaInspector.empty.body")}</p>
            </div>
          </div>
          <div
            id="media-inspector-state-meta"
            class="media-inspector-state__meta hidden"
            data-i18n="tools.mediaInspector.loading.meta"
          >
            ${t("tools.mediaInspector.loading.meta")}
          </div>
        </div>
      </section>

      <section id="media-inspector-report" class="media-inspector-report hidden">
        <div class="media-inspector-report__header">
          <div>
            <h3 data-i18n="tools.mediaInspector.report.title">${t("tools.mediaInspector.report.title")}</h3>
            <p class="tools-card__hint" data-i18n="tools.mediaInspector.report.subtitle">${t("tools.mediaInspector.report.subtitle")}</p>
          </div>
          <span id="media-inspector-copy-feedback" class="hash-copy-feedback muted"></span>
        </div>

        <div class="media-inspector-summary-grid">
          <article class="media-inspector-metric">
            <span data-i18n="tools.mediaInspector.summary.container">${t("tools.mediaInspector.summary.container")}</span>
            <strong id="media-inspector-summary-container">-</strong>
          </article>
          <article class="media-inspector-metric">
            <span data-i18n="tools.mediaInspector.summary.duration">${t("tools.mediaInspector.summary.duration")}</span>
            <strong id="media-inspector-summary-duration">-</strong>
          </article>
          <article class="media-inspector-metric">
            <span data-i18n="tools.mediaInspector.summary.size">${t("tools.mediaInspector.summary.size")}</span>
            <strong id="media-inspector-summary-size">-</strong>
          </article>
          <article class="media-inspector-metric">
            <span data-i18n="tools.mediaInspector.summary.bitrate">${t("tools.mediaInspector.summary.bitrate")}</span>
            <strong id="media-inspector-summary-bitrate">-</strong>
          </article>
          <article class="media-inspector-metric">
            <span data-i18n="tools.mediaInspector.summary.score">${t("tools.mediaInspector.summary.score")}</span>
            <strong id="media-inspector-summary-score">-</strong>
          </article>
        </div>

        <div class="media-inspector-streams-grid">
          <section class="media-inspector-stream-section media-inspector-warnings">
            <div class="media-inspector-stream-section__header">
              <h4 data-i18n="tools.mediaInspector.warnings.title">${t("tools.mediaInspector.warnings.title")}</h4>
              <span id="media-inspector-warnings-count" class="media-inspector-section-count">0</span>
            </div>
            <div id="media-inspector-warnings" class="media-inspector-warning-list"></div>
          </section>

          <section class="media-inspector-stream-section">
            <div class="media-inspector-stream-section__header">
              <h4 data-i18n="tools.mediaInspector.streams.video">${t("tools.mediaInspector.streams.video")}</h4>
              <span id="media-inspector-video-count" class="media-inspector-section-count">0</span>
            </div>
            <div id="media-inspector-video-streams" class="media-inspector-stream-list"></div>
          </section>

          <section class="media-inspector-stream-section">
            <div class="media-inspector-stream-section__header">
              <h4 data-i18n="tools.mediaInspector.streams.audio">${t("tools.mediaInspector.streams.audio")}</h4>
              <span id="media-inspector-audio-count" class="media-inspector-section-count">0</span>
            </div>
            <div id="media-inspector-audio-streams" class="media-inspector-stream-list"></div>
          </section>

          <section class="media-inspector-stream-section">
            <div class="media-inspector-stream-section__header">
              <h4 data-i18n="tools.mediaInspector.streams.subtitle">${t("tools.mediaInspector.streams.subtitle")}</h4>
              <span id="media-inspector-subtitle-count" class="media-inspector-section-count">0</span>
            </div>
            <div id="media-inspector-subtitle-streams" class="media-inspector-stream-list"></div>
          </section>
        </div>
      </section>
    </article>
  `;
}

function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return "-";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatBytes(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 0) return "-";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let current = size / 1024;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current.toFixed(current >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function formatBitrate(value) {
  const bitrate = Number(value);
  if (!Number.isFinite(bitrate) || bitrate <= 0) return "-";
  if (bitrate >= 1000 * 1000) return `${(bitrate / (1000 * 1000)).toFixed(1)} Mbps`;
  if (bitrate >= 1000) return `${Math.round(bitrate / 1000)} kbps`;
  return `${bitrate} bps`;
}

function formatFps(value) {
  const fps = Number(value);
  if (!Number.isFinite(fps) || fps <= 0) return "-";
  return `${fps.toFixed(fps >= 10 ? 2 : 3).replace(/\.?0+$/, "")}`;
}

function createEmptyItem(className, text) {
  const empty = document.createElement("p");
  empty.className = className;
  empty.textContent = text;
  return empty;
}

function createField(label, value) {
  const field = document.createElement("div");
  field.className = "media-inspector-stream-card__field";

  const labelEl = document.createElement("span");
  labelEl.textContent = label;

  const valueEl = document.createElement("strong");
  valueEl.textContent = value || "-";

  field.append(labelEl, valueEl);
  return field;
}

function buildReportText(t, report) {
  const lines = [
    t("tools.mediaInspector.report.copyHeading"),
    `${t("tools.mediaInspector.report.fileName")}: ${report.file?.name || "-"}`,
    `${t("tools.mediaInspector.report.filePath")}: ${report.file?.path || "-"}`,
    `${t("tools.mediaInspector.report.fileExtension")}: ${report.file?.extension || "-"}`,
    `${t("tools.mediaInspector.summary.container")}: ${report.format?.container || "-"}`,
    `${t("tools.mediaInspector.summary.duration")}: ${formatDuration(report.format?.durationSec)}`,
    `${t("tools.mediaInspector.summary.size")}: ${formatBytes(report.file?.sizeBytes)}`,
    `${t("tools.mediaInspector.summary.bitrate")}: ${formatBitrate(report.format?.bitrate)}`,
    `${t("tools.mediaInspector.summary.score")}: ${report.format?.probeScore ?? "-"}`,
    "",
  ];

  const appendGroup = (title, items, formatter) => {
    lines.push(`${title}: ${items.length}`);
    items.forEach((item, index) => {
      lines.push(`- ${index + 1}. ${formatter(item)}`);
    });
    lines.push("");
  };

  appendGroup(
    t("tools.mediaInspector.streams.video"),
    report.videoStreams || [],
    (stream) =>
      [
        stream.codec || "-",
        stream.width && stream.height ? `${stream.width}x${stream.height}` : "-",
        `${formatFps(stream.fps)} fps`,
        formatBitrate(stream.bitrate),
        stream.hdr ? "HDR" : "SDR",
      ]
        .filter(Boolean)
        .join(" • "),
  );
  appendGroup(
    t("tools.mediaInspector.streams.audio"),
    report.audioStreams || [],
    (stream) =>
      [
        stream.codec || "-",
        stream.channels ? `${stream.channels}ch` : "-",
        stream.sampleRate ? `${stream.sampleRate} Hz` : "-",
        formatBitrate(stream.bitrate),
        stream.language || "",
      ]
        .filter(Boolean)
        .join(" • "),
  );
  appendGroup(
    t("tools.mediaInspector.streams.subtitle"),
    report.subtitleStreams || [],
    (stream) =>
      [stream.codec || "-", stream.language || "", stream.title || ""]
        .filter(Boolean)
        .join(" • ") || "-",
  );

  lines.push(`${t("tools.mediaInspector.warnings.title")}: ${(report.warnings || []).length}`);
  (report.warnings || []).forEach((warning) => {
    lines.push(`- ${t(warning.messageKey)}`);
  });
  return lines.join("\n").trim();
}

export function initMediaInspectorSection({
  view,
  getEl,
  t,
  registerCleanup,
}) {
  const root = view.querySelector('[data-tool-view="media-inspector"]');
  if (!root) return;
  if (!root.childNodes.length) {
    root.innerHTML = createMarkup(t);
  }

  const pickFileBtn = getEl("media-inspector-pick-file", view);
  const analyzeBtn = getEl("media-inspector-analyze", view);
  const openFolderBtn = getEl("media-inspector-open-folder", view);
  const copyReportBtn = getEl("media-inspector-copy-report", view);
  const filePillEl = getEl("media-inspector-file-pill", view);
  const statusEl = getEl("media-inspector-status", view);
  const stateEl = getEl("media-inspector-state", view);
  const stateIconEl = getEl("media-inspector-state-icon", view);
  const stateTitleEl = getEl("media-inspector-state-title", view);
  const stateBodyEl = getEl("media-inspector-state-body", view);
  const stateMetaEl = getEl("media-inspector-state-meta", view);
  const reportEl = getEl("media-inspector-report", view);
  const copyFeedbackEl = getEl("media-inspector-copy-feedback", view);
  const warningsEl = getEl("media-inspector-warnings", view);
  const warningsCountEl = getEl("media-inspector-warnings-count", view);
  const videoListEl = getEl("media-inspector-video-streams", view);
  const audioListEl = getEl("media-inspector-audio-streams", view);
  const subtitleListEl = getEl("media-inspector-subtitle-streams", view);
  const videoCountEl = getEl("media-inspector-video-count", view);
  const audioCountEl = getEl("media-inspector-audio-count", view);
  const subtitleCountEl = getEl("media-inspector-subtitle-count", view);
  const summaryContainerEl = getEl("media-inspector-summary-container", view);
  const summaryDurationEl = getEl("media-inspector-summary-duration", view);
  const summarySizeEl = getEl("media-inspector-summary-size", view);
  const summaryBitrateEl = getEl("media-inspector-summary-bitrate", view);
  const summaryScoreEl = getEl("media-inspector-summary-score", view);

  let selectedFilePath = "";
  let latestReport = null;
  let busy = false;
  let copyFeedbackTimer = null;

  const setBusy = (nextBusy) => {
    busy = !!nextBusy;
    if (pickFileBtn) pickFileBtn.disabled = busy;
    if (analyzeBtn) analyzeBtn.disabled = busy || !selectedFilePath;
    if (openFolderBtn) openFolderBtn.disabled = busy || !selectedFilePath;
    if (copyReportBtn) {
      copyReportBtn.disabled = busy || !latestReport?.rawAvailable;
    }
  };

  const setStatus = (state, messageKey) => {
    if (!statusEl) return;
    statusEl.className = `media-inspector-status is-${state}`;
    statusEl.textContent = t(messageKey);
  };

  const showState = (mode, titleKey, bodyKeyOrText, { isText = false } = {}) => {
    if (
      !stateEl ||
      !stateTitleEl ||
      !stateBodyEl ||
      !stateIconEl ||
      !reportEl ||
      !stateMetaEl
    ) {
      return;
    }
    reportEl.classList.add("hidden");
    stateEl.className = `media-inspector-state media-inspector-state--${mode}`;
    stateEl.classList.remove("hidden");
    stateTitleEl.textContent = t(titleKey);
    stateBodyEl.textContent = isText ? bodyKeyOrText : t(bodyKeyOrText);
    stateMetaEl.classList.toggle("hidden", mode !== "loading");
    stateMetaEl.textContent =
      mode === "loading" ? t("tools.mediaInspector.loading.meta") : "";

    const icon = stateIconEl.querySelector("i");
    stateIconEl.classList.remove("is-animated");
    if (icon) {
      icon.className =
        mode === "loading"
          ? "fa-solid fa-spinner"
          : mode === "error"
            ? "fa-solid fa-triangle-exclamation"
            : "fa-solid fa-film";
    }
    if (mode === "loading") {
      stateIconEl.classList.add("is-animated");
    }
  };

  const showReport = () => {
    if (!stateEl || !reportEl) return;
    stateEl.classList.add("hidden");
    reportEl.classList.remove("hidden");
  };

  const clearSummary = () => {
    if (summaryContainerEl) summaryContainerEl.textContent = "-";
    if (summaryDurationEl) summaryDurationEl.textContent = "-";
    if (summarySizeEl) summarySizeEl.textContent = "-";
    if (summaryBitrateEl) summaryBitrateEl.textContent = "-";
    if (summaryScoreEl) summaryScoreEl.textContent = "-";
  };

  const renderEmptyLists = () => {
    if (warningsEl) {
      warningsEl.replaceChildren(
        createEmptyItem(
          "media-inspector-warning-list__empty muted",
          t("tools.mediaInspector.warnings.none"),
        ),
      );
    }
    if (videoListEl) {
      videoListEl.replaceChildren(
        createEmptyItem(
          "media-inspector-stream-list__empty muted",
          t("tools.mediaInspector.streams.empty.video"),
        ),
      );
    }
    if (audioListEl) {
      audioListEl.replaceChildren(
        createEmptyItem(
          "media-inspector-stream-list__empty muted",
          t("tools.mediaInspector.streams.empty.audio"),
        ),
      );
    }
    if (subtitleListEl) {
      subtitleListEl.replaceChildren(
        createEmptyItem(
          "media-inspector-stream-list__empty muted",
          t("tools.mediaInspector.streams.empty.subtitle"),
        ),
      );
    }
    if (warningsCountEl) warningsCountEl.textContent = "0";
    if (videoCountEl) videoCountEl.textContent = "0";
    if (audioCountEl) audioCountEl.textContent = "0";
    if (subtitleCountEl) subtitleCountEl.textContent = "0";
  };

  const clearReport = () => {
    latestReport = null;
    clearSummary();
    renderEmptyLists();
    setBusy(false);
  };

  const setSelectedFile = (filePath) => {
    selectedFilePath = String(filePath || "");
    if (!filePillEl) return;
    filePillEl.classList.toggle("is-empty", !selectedFilePath);
    if (selectedFilePath) {
      filePillEl.textContent = t("tools.mediaInspector.selectedFile", {
        fileName: selectedFilePath.split(/[\\/]/).pop() || selectedFilePath,
      });
      filePillEl.removeAttribute("data-i18n");
      filePillEl.title = selectedFilePath;
      setStatus("idle", "tools.mediaInspector.status.fileSelected");
    } else {
      filePillEl.textContent = t("tools.mediaInspector.noFile");
      filePillEl.setAttribute("data-i18n", "tools.mediaInspector.noFile");
      filePillEl.title = "";
      setStatus("idle", "tools.mediaInspector.status.idle");
    }
    setBusy(busy);
  };

  const createWarningItem = (warning) => {
    const item = document.createElement("article");
    item.className = `media-inspector-warning media-inspector-warning--${warning.severity || "warning"}`;

    const title = document.createElement("strong");
    title.textContent = t("tools.mediaInspector.warning.item");

    const text = document.createElement("span");
    text.textContent = t(warning.messageKey || "tools.mediaInspector.warnings.unknown");

    item.append(title, text);
    return item;
  };

  const createStreamCard = (stream, type, index) => {
    const card = document.createElement("article");
    card.className = "media-inspector-stream-card";

    const header = document.createElement("div");
    header.className = "media-inspector-stream-card__header";
    const title = document.createElement("strong");
    title.textContent = `${t(`tools.mediaInspector.streamLabels.${type}`)} #${index + 1}`;
    header.appendChild(title);

    const fields = document.createElement("div");
    fields.className = "media-inspector-stream-card__fields";

    if (type === "video") {
      fields.append(
        createField(t("tools.mediaInspector.fields.codec"), stream.codec || "-"),
        createField(t("tools.mediaInspector.fields.profile"), stream.profile || "-"),
        createField(
          t("tools.mediaInspector.fields.resolution"),
          stream.width && stream.height ? `${stream.width}x${stream.height}` : "-",
        ),
        createField(t("tools.mediaInspector.fields.fps"), formatFps(stream.fps)),
        createField(t("tools.mediaInspector.fields.bitrate"), formatBitrate(stream.bitrate)),
        createField(
          t("tools.mediaInspector.fields.hdr"),
          stream.hdr
            ? t("tools.mediaInspector.value.yes")
            : t("tools.mediaInspector.value.no"),
        ),
        createField(t("tools.mediaInspector.fields.colorSpace"), stream.colorSpace || "-"),
      );
    } else if (type === "audio") {
      fields.append(
        createField(t("tools.mediaInspector.fields.codec"), stream.codec || "-"),
        createField(t("tools.mediaInspector.fields.channels"), stream.channels ? String(stream.channels) : "-"),
        createField(t("tools.mediaInspector.fields.channelLayout"), stream.channelLayout || "-"),
        createField(
          t("tools.mediaInspector.fields.sampleRate"),
          stream.sampleRate ? `${stream.sampleRate} Hz` : "-",
        ),
        createField(t("tools.mediaInspector.fields.bitrate"), formatBitrate(stream.bitrate)),
        createField(t("tools.mediaInspector.fields.language"), stream.language || "-"),
      );
    } else {
      fields.append(
        createField(t("tools.mediaInspector.fields.codec"), stream.codec || "-"),
        createField(t("tools.mediaInspector.fields.language"), stream.language || "-"),
        createField(t("tools.mediaInspector.fields.title"), stream.title || "-"),
      );
    }

    card.append(header, fields);
    return card;
  };

  const renderReport = (report) => {
    latestReport = report;
    if (summaryContainerEl) summaryContainerEl.textContent = report.format?.container || "-";
    if (summaryDurationEl) summaryDurationEl.textContent = formatDuration(report.format?.durationSec);
    if (summarySizeEl) summarySizeEl.textContent = formatBytes(report.file?.sizeBytes);
    if (summaryBitrateEl) summaryBitrateEl.textContent = formatBitrate(report.format?.bitrate);
    if (summaryScoreEl) {
      summaryScoreEl.textContent =
        Number.isFinite(Number(report.format?.probeScore))
          ? String(report.format.probeScore)
          : "-";
    }

    const warnings = Array.isArray(report.warnings) ? report.warnings : [];
    if (warningsCountEl) warningsCountEl.textContent = String(warnings.length);
    if (warningsEl) {
      warningsEl.replaceChildren();
      if (!warnings.length) {
        warningsEl.appendChild(
          createEmptyItem(
            "media-inspector-warning-list__empty muted",
            t("tools.mediaInspector.warnings.none"),
          ),
        );
      } else {
        warnings.forEach((warning) => warningsEl.appendChild(createWarningItem(warning)));
      }
    }

    const renderStreamGroup = (items, type, container, countEl) => {
      if (countEl) countEl.textContent = String(items.length);
      if (!container) return;
      container.replaceChildren();
      if (!items.length) {
        container.appendChild(
          createEmptyItem(
            "media-inspector-stream-list__empty muted",
            t(`tools.mediaInspector.streams.empty.${type}`),
          ),
        );
        return;
      }
      items.forEach((item, index) => {
        container.appendChild(createStreamCard(item, type, index));
      });
    };

    renderStreamGroup(report.videoStreams || [], "video", videoListEl, videoCountEl);
    renderStreamGroup(report.audioStreams || [], "audio", audioListEl, audioCountEl);
    renderStreamGroup(report.subtitleStreams || [], "subtitle", subtitleListEl, subtitleCountEl);

    setStatus(
      warnings.some((warning) => warning.severity === "warning")
        ? "warning"
        : "success",
      "tools.mediaInspector.status.ready",
    );
    showReport();
    setBusy(false);
  };

  const mapErrorMessageKey = (response = {}) => {
    const code = String(response.code || "");
    if (code === "missingDependency") return "tools.mediaInspector.error.missingDependency";
    if (code === "fileNotFound") return "tools.mediaInspector.error.fileNotFound";
    if (code === "accessDenied") return "tools.mediaInspector.error.accessDenied";
    if (code === "invalidPayload") return "tools.mediaInspector.error.invalidPayload";
    return "";
  };

  const showCopyFeedback = (messageKey) => {
    if (!copyFeedbackEl) return;
    copyFeedbackEl.textContent = t(messageKey);
    if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = setTimeout(() => {
      copyFeedbackEl.textContent = "";
      copyFeedbackTimer = null;
    }, 1800);
  };

  const analyze = async () => {
    if (!selectedFilePath || busy) return;
    clearReport();
    setBusy(true);
    setStatus("loading", "tools.mediaInspector.status.loading");
    showState("loading", "tools.mediaInspector.loading.title", "tools.mediaInspector.loading.body");

    try {
      const response = await window.electron?.tools?.analyzeMediaFile?.({
        filePath: selectedFilePath,
      });
      if (!response?.success || !response.report) {
        const key = mapErrorMessageKey(response);
        setStatus("error", "tools.mediaInspector.status.error");
        showState(
          "error",
          "tools.mediaInspector.error.title",
          key ? key : response?.error || t("tools.mediaInspector.error.analyzeFailed"),
          { isText: !key },
        );
        setBusy(false);
        return;
      }
      renderReport(response.report);
    } catch (error) {
      setStatus("error", "tools.mediaInspector.status.error");
      showState(
        "error",
        "tools.mediaInspector.error.title",
        error?.message || t("tools.mediaInspector.error.analyzeFailed"),
        { isText: true },
      );
      setBusy(false);
    }
  };

  pickFileBtn?.addEventListener("click", async () => {
    if (busy) return;
    try {
      const response = await window.electron?.tools?.pickMediaInspectorFile?.();
      if (!response?.success || !response.filePath) return;
      setSelectedFile(response.filePath);
      await analyze();
    } catch (error) {
      setStatus("error", "tools.mediaInspector.status.error");
      showState(
        "error",
        "tools.mediaInspector.error.title",
        error?.message || t("tools.mediaInspector.error.analyzeFailed"),
        { isText: true },
      );
    }
  });

  analyzeBtn?.addEventListener("click", () => {
    analyze();
  });

  openFolderBtn?.addEventListener("click", async () => {
    if (!selectedFilePath || busy) return;
    const response = await window.electron?.tools?.showInFolder?.(selectedFilePath);
    if (response?.success) {
      showCopyFeedback("tools.mediaInspector.openFolderDone");
      return;
    }
    showCopyFeedback("tools.mediaInspector.openFolderFailed");
  });

  copyReportBtn?.addEventListener("click", async () => {
    if (!latestReport || busy) return;
    try {
      await navigator.clipboard.writeText(buildReportText(t, latestReport));
      showCopyFeedback("tools.mediaInspector.copyDone");
    } catch {
      showCopyFeedback("tools.mediaInspector.copyFailed");
    }
  });

  registerCleanup?.(() => {
    if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
  });

  clearReport();
  setSelectedFile("");
  showState("empty", "tools.mediaInspector.empty.title", "tools.mediaInspector.empty.body");
}

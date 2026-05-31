/** @jest-environment jsdom */

const buildDom = () => {
  document.body.innerHTML = `
    <div class="input-container">
      <div class="url-entry-shell">
        <div class="url-input-wrapper">
          <div class="url-input-main">
            <div class="url-input-leading">
              <button id="url-source-link" class="url-input-leading__icon" type="button">
                <i id="icon-url-globe" class="fas fa-globe search-icon" aria-hidden="true"></i>
              </button>
              <span class="url-input-leading__label">URL</span>
            </div>
            <div class="url-input-field">
              <input id="url" type="text" />
              <span id="url-preview-spinner" class="url-preview-spinner hidden"></span>
            </div>
            <div class="button-grid">
              <button id="paste-url" class="paste-button hidden"></button>
              <button id="clear-url" class="clear-button hidden"></button>
              <button id="select-folder" class="folder-button"></button>
            </div>
          </div>
          <div class="url-input-service-row">
            <div class="url-input-statusline">
              <span class="url-input-statusline__dot"></span>
              <span id="url-helper-text" class="url-helper-text"></span>
            </div>
          <div class="url-input-shortcuts"></div>
          </div>
          <nav class="button-group downloader-action-row url-input-action-row">
            <button id="open-last-video" type="button"></button>
            <div class="download-quality-group downloader-action-row__primary">
              <button id="download-button" type="button"></button>
              <button id="download-cancel" type="button">
                <span id="download-cancel-count" class="cancel-count hidden">0</span>
              </button>
            </div>
            <button id="open-folder" type="button"></button>
          </nav>
        </div>
        <div id="url-inline-error" class="url-inline-error hidden"></div>
      </div>
      <div id="preview-card" style="display:none;">
        <div class="preview-media">
          <img id="preview-thumb" style="display:none;" />
        </div>
        <div class="preview-meta">
          <div class="preview-kicker"></div>
          <div id="preview-title"></div>
          <small id="preview-duration"></small>
        </div>
        <div id="preview-live-player" class="hidden">
          <button id="preview-live-close" type="button"></button>
          <video id="preview-live-video">
            <source id="preview-live-video-source" />
          </video>
        </div>
      </div>
    </div>
    <div id="download-quality-modal" class="modal-overlay" aria-hidden="true"></div>
  `;
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const getState = () => ({
  input: document.getElementById("url"),
  wrapper: document.querySelector(".url-input-wrapper"),
  error: document.getElementById("url-inline-error"),
  pasteBtn: document.getElementById("paste-url"),
  clearBtn: document.getElementById("clear-url"),
  previewCard: document.getElementById("preview-card"),
  spinner: document.getElementById("url-preview-spinner"),
  downloadBtn: document.getElementById("download-button"),
  helperText: document.getElementById("url-helper-text"),
  container: document.querySelector(".input-container"),
  sourceLink: document.getElementById("url-source-link"),
  actionRow: document.querySelector(".url-input-action-row"),
});

describe("urlInputHandler", () => {
  let updateButtonStateMock;
  let getVideoInfoMock;
  let applyDownloaderBackgroundPreviewMock;
  let clearDownloaderBackgroundPreviewMock;
  let hideDownloaderLivePreviewMock;
  let isCompactDownloaderModeMock;
  let initUrlInputHandler;

  const loadModule = () => {
    jest.isolateModules(() => {
      jest.doMock("../domElements", () => ({
        urlInput: document.getElementById("url"),
      }));
      jest.doMock("../tooltipInitializer", () => ({
        initTooltips: jest.fn(),
      }));
      jest.doMock("../videoInfoCache", () => ({
        setCachedVideoInfo: jest.fn(),
      }));
      jest.doMock("../state", () => ({
        updateButtonState: updateButtonStateMock,
      }));
      jest.doMock("../downloaderBackgroundPreview.js", () => ({
        RECOVERY_EVENT: "downloader:background-preview-recover",
        applyDownloaderBackgroundPreview: applyDownloaderBackgroundPreviewMock,
        clearDownloaderBackgroundPreview: clearDownloaderBackgroundPreviewMock,
      }));
      jest.doMock("../downloaderLivePreview.js", () => ({
        PLAY_EVENT: "downloader:live-preview-open",
        RETRY_EVENT: "downloader:live-preview-retry",
        STATE_EVENT: "downloader:live-preview-state",
        hideDownloaderLivePreview: hideDownloaderLivePreviewMock,
      }));
      jest.doMock("../compactDownloaderQuality.js", () => ({
        PREVIEW_EVENT: "downloader:preview-info",
        isCompactDownloaderMode: isCompactDownloaderModeMock,
      }));
      jest.doMock("../i18n", () => ({
        t: (key, vars = {}) => {
          if (key === "input.url.helper") {
            return "Вставьте ссылку или перетащите её сюда";
          }
          if (key === "input.url.helper.loading") {
            return "Получаем превью и проверяем ссылку…";
          }
          if (key === "input.url.helper.valid") {
            return "Ссылка распознана. Нажмите Enter или выберите режим в окне качества.";
          }
          if (key === "input.url.helper.playlistChoice") {
            return "Это плейлист. Можно скачать текущий ролик или добавить весь плейлист в очередь.";
          }
          if (key === "input.url.helper.drag") {
            return "Отпустите ссылку, чтобы вставить её в поле";
          }
          if (key === "input.url.error.invalidOrUnsupported") {
            return "Проверьте ссылку: нужен корректный URL поддерживаемого источника.";
          }
          if (key === "input.url.error.empty") {
            return "Вставьте ссылку, чтобы начать загрузку.";
          }
          if (key === "input.url.error.invalid") {
            return "Ссылка введена некорректно. Проверьте формат URL.";
          }
          if (key === "input.url.error.unsupported") {
            return "Этот источник пока не поддерживается.";
          }
          if (key === "download.error.authRequired") {
            return "Видео требует авторизации. Добавьте cookies браузера и повторите попытку.";
          }
          if (key === "download.error.geoBlocked") {
            return "Видео недоступно в вашем регионе.";
          }
          if (key === "download.error.unavailable") {
            return "Видео недоступно или было удалено.";
          }
          if (key === "download.error.networkTimeout") {
            return "Не удалось получить данные от источника. Проверьте подключение и повторите попытку.";
          }
          if (key === "download.error.youtubeRateLimit") {
            return "YouTube временно ограничил запросы. Повторите попытку позже.";
          }
          if (key === "download.error.youtubeRateLimitTimed") {
            return `YouTube временно ограничил запросы. Повторите примерно через ${vars.minutes} мин.`;
          }
          if (key === "input.url.preview.duration") {
            return `Длительность: ${vars.duration}`;
          }
          if (key === "input.url.preview.openLive") {
            return "Открыть live preview";
          }
          if (key === "input.url.preview.openLiveTitle") {
            return "Открыть встроенный preview-плеер со звуком";
          }
          if (key === "input.url.preview.closeLive") {
            return "Закрыть live preview";
          }
          if (key === "input.url.preview.closeLiveTitle") {
            return "Закрыть встроенный preview-плеер со звуком";
          }
          if (key === "input.url.preview.kicker") {
            return "Предпросмотр";
          }
          if (key === "input.url.preview.addAll") {
            return `Добавить все (${vars.count})`;
          }
          if (key === "input.url.preview.addAllTitle") {
            return "Добавить все элементы плейлиста в очередь";
          }
          if (key === "input.url.preview.currentOnly") {
            return "Текущий ролик";
          }
          if (key === "input.url.preview.currentOnlyTitle") {
            return "Скачать или добавить в очередь только текущий ролик по выбранному режиму";
          }
          if (key === "input.url.preview.playlistCount") {
            return `${vars.count} элементов`;
          }
          if (key === "input.url.preview.playlistDuration") {
            return `Всего: ${vars.duration}`;
          }
          if (key === "input.url.preview.close") {
            return "Закрыть предпросмотр";
          }
          if (key === "input.url.preview.save") {
            return "Сохранить превью";
          }
          if (key === "input.url.preview.saveWithTitle") {
            return `Сохранить: "${vars.title}"`;
          }
          return key;
        },
      }));
      ({ initUrlInputHandler } = require("../urlInputHandler"));
    });
  };

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    buildDom();
    updateButtonStateMock = jest.fn();
    getVideoInfoMock = jest.fn().mockResolvedValue({ success: true });
    applyDownloaderBackgroundPreviewMock = jest.fn().mockResolvedValue(true);
    clearDownloaderBackgroundPreviewMock = jest.fn();
    hideDownloaderLivePreviewMock = jest.fn();
    isCompactDownloaderModeMock = jest.fn(() => false);
    window.electron = {
      invoke: jest.fn(),
      ipcRenderer: { invoke: getVideoInfoMock },
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: jest.fn().mockResolvedValue("youtube.com/watch?v=test"),
      },
    });
    loadModule();
    initUrlInputHandler();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("does not show inline error while typing before blur/enter", () => {
    const { input, error, wrapper, actionRow } = getState();
    input.value = "http://";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(error.classList.contains("hidden")).toBe(true);
    expect(wrapper.classList.contains("is-invalid")).toBe(false);
    expect(actionRow.hidden).toBe(false);
  });

  test("hides action row when URL is empty and shows it after input", () => {
    const { input, actionRow } = getState();

    expect(actionRow.hidden).toBe(true);
    expect(actionRow.getAttribute("aria-hidden")).toBe("true");

    input.value = "https://example.com/video";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(actionRow.hidden).toBe(false);
    expect(actionRow.getAttribute("aria-hidden")).toBe("false");

    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(actionRow.hidden).toBe(true);
    expect(actionRow.getAttribute("aria-hidden")).toBe("true");
  });

  test("shows inline error on blur for invalid URL", () => {
    const { input, error, wrapper } = getState();
    input.value = "http://";
    input.dispatchEvent(new Event("blur", { bubbles: true }));

    expect(error.classList.contains("hidden")).toBe(false);
    expect(error.textContent).toContain("Ссылка введена некорректно");
    expect(wrapper.classList.contains("is-invalid")).toBe(true);
  });

  test("shows error and does not trigger download on Enter with invalid URL", () => {
    const { input, error, downloadBtn } = getState();
    const clickSpy = jest.spyOn(downloadBtn, "click");
    downloadBtn.disabled = false;
    input.value = "http://";

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(clickSpy).not.toHaveBeenCalled();
    expect(error.classList.contains("hidden")).toBe(false);
  });

  test("Shift+Enter triggers queue-only mode", () => {
    const { input, downloadBtn } = getState();
    const clickSpy = jest.spyOn(downloadBtn, "click");
    downloadBtn.disabled = false;
    input.value = "https://example.com/video";

    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        bubbles: true,
      }),
    );

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(downloadBtn.dataset.enqueueOnly).toBe("1");
    expect(downloadBtn.dataset.forceAudioOnly).toBeUndefined();
  });

  test("Alt+Enter does not trigger a dedicated action", () => {
    const { input, downloadBtn } = getState();
    const clickSpy = jest.spyOn(downloadBtn, "click");
    downloadBtn.disabled = false;
    input.value = "https://example.com/video";

    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        altKey: true,
        bubbles: true,
      }),
    );

    expect(clickSpy).not.toHaveBeenCalled();
    expect(downloadBtn.dataset.forceAudioOnly).toBeUndefined();
    expect(downloadBtn.dataset.enqueueOnly).toBeUndefined();
  });

  test("hides error and invalid style when URL becomes valid", () => {
    const { input, error, wrapper } = getState();
    input.value = "http://";
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    expect(error.classList.contains("hidden")).toBe(false);

    input.value = "https://example.com/video";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(error.classList.contains("hidden")).toBe(true);
    expect(wrapper.classList.contains("is-invalid")).toBe(false);
    expect(wrapper.classList.contains("is-valid")).toBe(true);
  });

  test("normalizes URL on blur, paste, drop and Enter", async () => {
    const { input, pasteBtn, downloadBtn } = getState();
    downloadBtn.disabled = false;
    const clickSpy = jest.spyOn(downloadBtn, "click");

    input.value = "example.com/video";
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    expect(input.value).toBe("https://example.com/video");

    pasteBtn.click();
    await flushPromises();
    expect(input.value).toBe("https://youtube.com/watch?v=test");

    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", {
      value: {
        getData: (type) => (type === "text" ? "example.org/file" : ""),
      },
    });
    document.querySelector(".url-input-wrapper").dispatchEvent(drop);
    expect(input.value).toBe("https://example.org/file");

    input.value = "example.net/test";
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(input.value).toBe("https://example.net/test");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test("auto-opens quality selection after pasted URL resolves with preview and formats", async () => {
    const { pasteBtn, downloadBtn } = getState();
    downloadBtn.disabled = false;
    const clickSpy = jest.spyOn(downloadBtn, "click");
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Demo title",
      duration: 90,
      thumbnail: "https://example.com/thumb.jpg",
      formats: [{ format_id: "18", vcodec: "h264", acodec: "aac" }],
    });

    pasteBtn.click();
    await flushPromises();
    await flushPromises();
    jest.runOnlyPendingTimers();
    await flushPromises();

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(downloadBtn.dataset.forceQualityModal).toBe("1");
  });

  test("auto-opens quality selection when recognized preview has no loaded formats yet", async () => {
    const { pasteBtn, downloadBtn } = getState();
    downloadBtn.disabled = false;
    const clickSpy = jest.spyOn(downloadBtn, "click");
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Demo title",
      duration: 90,
      thumbnail: "https://example.com/thumb.jpg",
    });

    pasteBtn.click();
    await flushPromises();
    await flushPromises();
    jest.runOnlyPendingTimers();
    await flushPromises();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test("auto-opens quality selection when yt-dlp returns preview only in thumbnails", async () => {
    const { pasteBtn, downloadBtn } = getState();
    downloadBtn.disabled = false;
    const clickSpy = jest.spyOn(downloadBtn, "click");
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Demo title",
      duration: 90,
      thumbnails: [{ url: "https://example.com/thumb.jpg" }],
      formats: [{ format_id: "18", vcodec: "h264", acodec: "aac" }],
    });

    pasteBtn.click();
    await flushPromises();
    await flushPromises();
    jest.runOnlyPendingTimers();
    await flushPromises();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test("auto-opens quality selection for pasted URL that already has loaded formats", async () => {
    const { input, downloadBtn } = getState();
    const url = "https://youtube.com/watch?v=test";
    downloadBtn.disabled = false;
    const clickSpy = jest.spyOn(downloadBtn, "click");
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Demo title",
      duration: 90,
      thumbnail: "https://example.com/thumb.jpg",
      formats: [{ format_id: "18", vcodec: "h264", acodec: "aac" }],
    });

    input.value = url;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();
    await flushPromises();

    expect(getVideoInfoMock).toHaveBeenCalledTimes(1);
    expect(clickSpy).not.toHaveBeenCalled();

    const pasteEvent = new Event("paste", { bubbles: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: {
        getData: (type) => (type === "text" ? url : ""),
      },
    });
    input.dispatchEvent(pasteEvent);
    input.value = url;
    const inputEvent = new Event("input", { bubbles: true });
    Object.defineProperty(inputEvent, "inputType", {
      value: "insertFromPaste",
    });
    input.dispatchEvent(inputEvent);
    jest.advanceTimersByTime(600);
    await flushPromises();
    jest.runOnlyPendingTimers();
    await flushPromises();

    expect(getVideoInfoMock).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test("normalizes native pasted URL before preview and auto-open", async () => {
    const { input, downloadBtn } = getState();
    downloadBtn.disabled = false;
    const clickSpy = jest.spyOn(downloadBtn, "click");
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Demo title",
      duration: 90,
      thumbnail: "https://example.com/thumb.jpg",
      formats: [{ format_id: "18", vcodec: "h264", acodec: "aac" }],
    });

    const pasteEvent = new Event("paste", { bubbles: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: {
        getData: (type) => (type === "text" ? "youtube.com/watch?v=test" : ""),
      },
    });
    input.dispatchEvent(pasteEvent);
    input.value = "youtube.com/watch?v=test";
    const inputEvent = new Event("input", { bubbles: true });
    Object.defineProperty(inputEvent, "inputType", {
      value: "insertFromPaste",
    });
    input.dispatchEvent(inputEvent);

    expect(input.value).toBe("https://youtube.com/watch?v=test");

    jest.advanceTimersByTime(600);
    await flushPromises();
    await flushPromises();
    jest.runOnlyPendingTimers();
    await flushPromises();

    expect(getVideoInfoMock).toHaveBeenCalledWith(
      "get-video-preview",
      "https://youtube.com/watch?v=test",
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test("auto-opens quality selection when force-preview requests it", async () => {
    const { input, downloadBtn } = getState();
    downloadBtn.disabled = false;
    const clickSpy = jest.spyOn(downloadBtn, "click");
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Demo title",
      duration: 90,
      thumbnail: "https://example.com/thumb.jpg",
    });

    input.value = "https://youtube.com/watch?v=retry";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(
      new CustomEvent("force-preview", {
        detail: { autoOpenQuality: true },
      }),
    );

    await flushPromises();
    await flushPromises();
    jest.runOnlyPendingTimers();
    await flushPromises();

    expect(getVideoInfoMock).toHaveBeenCalledWith(
      "get-video-preview",
      "https://youtube.com/watch?v=retry",
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test("does not auto-open quality selection after paste in compact mode", async () => {
    isCompactDownloaderModeMock.mockReturnValue(true);
    const { pasteBtn, downloadBtn } = getState();
    downloadBtn.disabled = false;
    const clickSpy = jest.spyOn(downloadBtn, "click");
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Demo title",
      duration: 90,
      thumbnail: "https://example.com/thumb.jpg",
      formats: [{ format_id: "18", vcodec: "h264", acodec: "aac" }],
    });

    pasteBtn.click();
    await flushPromises();
    await flushPromises();
    jest.runOnlyPendingTimers();
    await flushPromises();

    expect(getVideoInfoMock).toHaveBeenCalledWith(
      "get-video-preview",
      "https://youtube.com/watch?v=test",
    );
    expect(clickSpy).not.toHaveBeenCalled();
    expect(downloadBtn.dataset.forceQualityModal).toBeUndefined();
  });

  test("does not auto-open quality selection when force-preview requests it in compact mode", async () => {
    isCompactDownloaderModeMock.mockReturnValue(true);
    const { input, downloadBtn } = getState();
    downloadBtn.disabled = false;
    const clickSpy = jest.spyOn(downloadBtn, "click");
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Demo title",
      duration: 90,
      thumbnail: "https://example.com/thumb.jpg",
    });

    input.value = "https://youtube.com/watch?v=retry";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(
      new CustomEvent("force-preview", {
        detail: { autoOpenQuality: true },
      }),
    );

    await flushPromises();
    await flushPromises();
    jest.runOnlyPendingTimers();
    await flushPromises();

    expect(getVideoInfoMock).toHaveBeenCalledWith(
      "get-video-preview",
      "https://youtube.com/watch?v=retry",
    );
    expect(clickSpy).not.toHaveBeenCalled();
    expect(downloadBtn.dataset.forceQualityModal).toBeUndefined();
  });

  test("does not auto-open quality selection when preview image is missing", async () => {
    const { pasteBtn, downloadBtn } = getState();
    downloadBtn.disabled = false;
    const clickSpy = jest.spyOn(downloadBtn, "click");
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Demo title",
      duration: 90,
      formats: [{ format_id: "18", vcodec: "h264", acodec: "aac" }],
    });

    pasteBtn.click();
    await flushPromises();
    await flushPromises();
    jest.runOnlyPendingTimers();

    expect(clickSpy).not.toHaveBeenCalled();
  });

  test("does not auto-open quality selection when content is not recognized", async () => {
    const { pasteBtn, downloadBtn } = getState();
    downloadBtn.disabled = false;
    const clickSpy = jest.spyOn(downloadBtn, "click");
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      thumbnail: "https://example.com/thumb.jpg",
      formats: [{ format_id: "18", vcodec: "h264", acodec: "aac" }],
    });

    pasteBtn.click();
    await flushPromises();
    await flushPromises();
    jest.runOnlyPendingTimers();

    expect(clickSpy).not.toHaveBeenCalled();
  });

  test("does not auto-open quality selection when the setting is disabled", async () => {
    localStorage.setItem("downloadAutoOpenQualityModal", "0");
    const { pasteBtn, downloadBtn } = getState();
    downloadBtn.disabled = false;
    const clickSpy = jest.spyOn(downloadBtn, "click");
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Demo title",
      duration: 90,
      thumbnail: "https://example.com/thumb.jpg",
      formats: [{ format_id: "18", vcodec: "h264", acodec: "aac" }],
    });

    pasteBtn.click();
    await flushPromises();
    await flushPromises();
    jest.runOnlyPendingTimers();

    expect(clickSpy).not.toHaveBeenCalled();
  });

  test("does not request preview for invalid URL and keeps preview hidden", () => {
    const { input, previewCard } = getState();
    input.value = "bad-url";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);

    expect(getVideoInfoMock).not.toHaveBeenCalled();
    expect(previewCard.style.display).toBe("none");
  });

  test("shows preview spinner while waiting and fetching preview", async () => {
    const { input, spinner, wrapper, helperText, container } = getState();
    input.value = "https://example.com/video";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(wrapper.classList.contains("is-preview-loading")).toBe(true);
    expect(container.classList.contains("is-preview-loading")).toBe(true);
    expect(spinner.classList.contains("hidden")).toBe(false);
    expect(helperText.textContent).toContain("Получаем превью");

    jest.advanceTimersByTime(600);
    await flushPromises();
    await flushPromises();

    expect(getVideoInfoMock).toHaveBeenCalled();
    expect(wrapper.classList.contains("is-preview-loading")).toBe(false);
    expect(container.classList.contains("is-preview-loading")).toBe(false);
    expect(spinner.classList.contains("hidden")).toBe(true);
  });

  test("shows auth-required inline error for preview fetch failures", async () => {
    const { input, error, previewCard } = getState();
    getVideoInfoMock.mockResolvedValueOnce({
      success: false,
      errorCode: "AUTH_REQUIRED",
      error: "ERR_YTDLP_AUTH_REQUIRED: auth required",
    });
    input.value = "https://example.com/video";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    jest.advanceTimersByTime(600);
    await flushPromises();

    expect(error.classList.contains("hidden")).toBe(false);
    expect(error.textContent).toContain("требует авторизации");
    expect(previewCard.style.display).toBe("none");
    expect(clearDownloaderBackgroundPreviewMock).toHaveBeenCalled();
    expect(hideDownloaderLivePreviewMock).toHaveBeenCalled();
  });

  test("shows neutral network-timeout inline error for non-YouTube preview failures", async () => {
    const { input, error, previewCard } = getState();
    getVideoInfoMock.mockResolvedValueOnce({
      success: false,
      errorCode: "NETWORK_TIMEOUT",
      error: "ERR_YTDLP_NETWORK_TIMEOUT: read timed out",
    });
    input.value = "https://www.avito.ru/profile/";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    jest.advanceTimersByTime(600);
    await flushPromises();

    expect(error.classList.contains("hidden")).toBe(false);
    expect(error.textContent).toBe(
      "Не удалось получить данные от источника. Проверьте подключение и повторите попытку.",
    );
    expect(error.textContent).not.toContain("YouTube");
    expect(previewCard.style.display).toBe("none");
  });

  test("Escape clears input, preview and inline error", () => {
    const { input, error, wrapper, previewCard } = getState();
    input.value = "bad-url";
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    previewCard.style.display = "block";

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(input.value).toBe("");
    expect(previewCard.style.display).toBe("none");
    expect(error.classList.contains("hidden")).toBe(true);
    expect(wrapper.classList.contains("is-invalid")).toBe(false);
    expect(clearDownloaderBackgroundPreviewMock).toHaveBeenCalled();
    expect(hideDownloaderLivePreviewMock).toHaveBeenCalled();
  });

  test("does not handle Enter or Escape from URL input while quality modal is open", () => {
    const { input, downloadBtn, previewCard } = getState();
    const clickSpy = jest.spyOn(downloadBtn, "click");
    const qualityModal = document.getElementById("download-quality-modal");

    input.value = "https://example.com/video";
    previewCard.style.display = "block";
    qualityModal.classList.add("is-open");

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(clickSpy).not.toHaveBeenCalled();
    expect(input.value).toBe("https://example.com/video");
    expect(previewCard.style.display).toBe("block");
  });

  test("keeps current paste/clear visibility behavior and shell states", () => {
    const { input, clearBtn, pasteBtn, wrapper, container, helperText } =
      getState();

    input.value = "https://example.com";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(clearBtn.classList.contains("hidden")).toBe(false);
    expect(pasteBtn.classList.contains("hidden")).toBe(true);
    expect(wrapper.classList.contains("has-value")).toBe(true);
    expect(container.classList.contains("has-value")).toBe(true);
    expect(helperText.textContent).toContain("Получаем превью");

    clearBtn.click();
    expect(input.value).toBe("");
    expect(clearBtn.classList.contains("hidden")).toBe(true);
    expect(pasteBtn.classList.contains("hidden")).toBe(false);
    expect(wrapper.classList.contains("is-empty")).toBe(true);
    expect(container.classList.contains("is-empty")).toBe(true);
  });

  test("adds and removes drag-over class for drag events", () => {
    const { wrapper, container, helperText } = getState();
    wrapper.dispatchEvent(new Event("dragenter", { bubbles: true }));
    expect(wrapper.classList.contains("drag-over")).toBe(true);
    expect(container.classList.contains("drag-over")).toBe(true);
    expect(helperText.textContent).toContain("Отпустите ссылку");
    wrapper.dispatchEvent(new Event("dragleave", { bubbles: true }));
    expect(wrapper.classList.contains("drag-over")).toBe(false);
    expect(container.classList.contains("drag-over")).toBe(false);
  });

  test("marks shell as having preview when preview data is rendered", async () => {
    const { input, wrapper, container, previewCard } = getState();
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Demo title",
      duration: 90,
      thumbnail: "https://example.com/thumb.jpg",
    });

    input.value = "https://example.com/video";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();

    expect(previewCard.style.display).not.toBe("none");
    expect(wrapper.classList.contains("has-preview")).toBe(true);
    expect(container.classList.contains("has-preview")).toBe(true);
    expect(clearDownloaderBackgroundPreviewMock).toHaveBeenCalled();
  });

  test("enables downloader background video for YouTube preview candidates", async () => {
    const { input } = getState();
    const backgroundPreview = {
      src: "https://rr1---sn.example.googlevideo.com/videoplayback?id=demo",
      poster: "https://i.ytimg.com/vi/demo/maxresdefault.jpg",
      mime: "video/mp4",
      container: "mp4",
      width: 854,
      height: 480,
    };
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "YouTube demo",
      duration: 120,
      thumbnail: "https://example.com/thumb.jpg",
      backgroundPreview,
    });

    input.value = "https://www.youtube.com/watch?v=demo";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();

    expect(applyDownloaderBackgroundPreviewMock).toHaveBeenCalledWith(
      backgroundPreview,
      { pageUrl: "https://www.youtube.com/watch?v=demo" },
    );
  });

  test("shows live preview action only when livePreview is available", async () => {
    const { input, previewCard } = getState();
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "YouTube demo",
      duration: 120,
      thumbnail: "https://example.com/thumb.jpg",
      livePreview: {
        src: "https://rr1---sn.example.googlevideo.com/videoplayback?id=demo-live",
        mime: "video/mp4",
        container: "mp4",
      },
    });

    input.value = "https://www.youtube.com/watch?v=demo";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();

    expect(previewCard.textContent).toContain("Открыть live preview");
    expect(document.getElementById("preview-open-live")?.style.display).toBe(
      "",
    );
  });

  test("clicking live preview action dispatches explicit player-open event", async () => {
    const { input } = getState();
    const listener = jest.fn();
    window.addEventListener("downloader:live-preview-open", listener);
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "YouTube demo",
      duration: 120,
      thumbnail: "https://example.com/thumb.jpg",
      livePreview: {
        src: "https://rr1---sn.example.googlevideo.com/videoplayback?id=demo-live",
        mime: "video/mp4",
        container: "mp4",
      },
    });

    input.value = "https://www.youtube.com/watch?v=demo";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();

    document.getElementById("preview-open-live").click();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail.preview.src).toContain("demo-live");
  });

  test("live preview action becomes a close toggle while player is open", async () => {
    const { input } = getState();
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "YouTube demo",
      duration: 120,
      thumbnail: "https://example.com/thumb.jpg",
      livePreview: {
        src: "https://rr1---sn.example.googlevideo.com/videoplayback?id=demo-live",
        mime: "video/mp4",
        container: "mp4",
      },
    });

    input.value = "https://www.youtube.com/watch?v=demo";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();

    window.dispatchEvent(
      new CustomEvent("downloader:live-preview-state", {
        detail: { isOpen: true },
      }),
    );

    const btn = document.getElementById("preview-open-live");
    expect(btn?.textContent).toContain("Закрыть live preview");
    btn.click();
    expect(hideDownloaderLivePreviewMock).toHaveBeenCalled();
  });

  test("live preview retry refreshes current preview and reopens player", async () => {
    const { input } = getState();
    const listener = jest.fn();
    window.addEventListener("downloader:live-preview-open", listener);
    getVideoInfoMock
      .mockResolvedValueOnce({
        success: true,
        title: "YouTube demo",
        duration: 120,
        thumbnail: "https://example.com/thumb.jpg",
        webpage_url: "https://www.youtube.com/watch?v=demo",
        livePreview: {
          src: "https://rr1---sn.example.googlevideo.com/videoplayback?id=demo-live-1",
          mime: "video/mp4",
          container: "mp4",
        },
      })
      .mockResolvedValueOnce({
        success: true,
        title: "YouTube demo",
        duration: 120,
        thumbnail: "https://example.com/thumb.jpg",
        webpage_url: "https://www.youtube.com/watch?v=demo",
        livePreview: {
          src: "https://rr1---sn.example.googlevideo.com/videoplayback?id=demo-live-2",
          mime: "video/mp4",
          container: "mp4",
        },
      });

    input.value = "https://www.youtube.com/watch?v=demo";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();

    window.dispatchEvent(
      new CustomEvent("downloader:live-preview-retry", {
        detail: {
          url: "https://www.youtube.com/watch?v=demo",
          resumeTime: 28.5,
        },
      }),
    );
    await flushPromises();

    expect(getVideoInfoMock).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail.preview.src).toContain(
      "demo-live-2",
    );
    expect(listener.mock.calls[0][0].detail.options.resumeTime).toBe(28.5);
  });

  test("non-YouTube preview keeps the default downloader background", async () => {
    const { input } = getState();
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Vimeo demo",
      duration: 120,
      thumbnail: "https://example.com/thumb.jpg",
      backgroundPreview: null,
    });

    input.value = "https://vimeo.com/123";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();

    expect(applyDownloaderBackgroundPreviewMock).not.toHaveBeenCalled();
    expect(clearDownloaderBackgroundPreviewMock).toHaveBeenCalled();
  });

  test("clearing the URL stops and resets downloader background video", () => {
    const { input, clearBtn } = getState();

    input.value = "https://www.youtube.com/watch?v=demo";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    clearBtn.click();

    expect(clearDownloaderBackgroundPreviewMock).toHaveBeenCalled();
    expect(hideDownloaderLivePreviewMock).toHaveBeenCalled();
  });

  test("closing the preview card clears the downloader background video", async () => {
    const { input, previewCard } = getState();
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "YouTube demo",
      duration: 120,
      thumbnail: "https://example.com/thumb.jpg",
      backgroundPreview: {
        src: "https://rr1---sn.example.googlevideo.com/videoplayback?id=demo",
        mime: "video/mp4",
        container: "mp4",
      },
    });

    input.value = "https://www.youtube.com/watch?v=demo";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();

    previewCard.querySelector(".preview-close").click();

    expect(clearDownloaderBackgroundPreviewMock).toHaveBeenCalled();
    expect(hideDownloaderLivePreviewMock).toHaveBeenCalled();
  });

  test("switching from YouTube preview to another source clears stale video background", async () => {
    const { input } = getState();
    getVideoInfoMock
      .mockResolvedValueOnce({
        success: true,
        title: "YouTube demo",
        duration: 120,
        thumbnail: "https://example.com/thumb.jpg",
        backgroundPreview: {
          src: "https://rr1---sn.example.googlevideo.com/videoplayback?id=demo",
          poster: "https://i.ytimg.com/vi/demo/maxresdefault.jpg",
          mime: "video/mp4",
          container: "mp4",
          width: 854,
          height: 480,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        title: "Other source",
        duration: 90,
        thumbnail: "https://example.com/thumb-2.jpg",
        backgroundPreview: null,
      });

    input.value = "https://www.youtube.com/watch?v=demo";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();

    input.value = "https://example.com/video";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();

    expect(applyDownloaderBackgroundPreviewMock).toHaveBeenCalledTimes(1);
    expect(clearDownloaderBackgroundPreviewMock).toHaveBeenCalled();
    expect(hideDownloaderLivePreviewMock).toHaveBeenCalled();
  });

  test("background recovery refreshes current YouTube preview without showing an error", async () => {
    const { input, error } = getState();
    getVideoInfoMock
      .mockResolvedValueOnce({
        success: true,
        title: "YouTube demo",
        duration: 120,
        thumbnail: "https://example.com/thumb.jpg",
        webpage_url: "https://www.youtube.com/watch?v=demo",
        backgroundPreview: {
          src: "https://rr1---sn.example.googlevideo.com/videoplayback?id=demo-1",
          mime: "video/mp4",
          container: "mp4",
        },
      })
      .mockResolvedValueOnce({
        success: true,
        title: "YouTube demo",
        duration: 120,
        thumbnail: "https://example.com/thumb.jpg",
        webpage_url: "https://www.youtube.com/watch?v=demo",
        backgroundPreview: {
          src: "https://rr1---sn.example.googlevideo.com/videoplayback?id=demo-2",
          mime: "video/mp4",
          container: "mp4",
        },
      });

    input.value = "https://www.youtube.com/watch?v=demo";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();

    window.dispatchEvent(
      new CustomEvent("downloader:background-preview-recover", {
        detail: { url: "https://www.youtube.com/watch?v=demo" },
      }),
    );
    await flushPromises();

    expect(getVideoInfoMock).toHaveBeenCalledTimes(2);
    expect(error.classList.contains("hidden")).toBe(true);
    expect(applyDownloaderBackgroundPreviewMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        src: "https://rr1---sn.example.googlevideo.com/videoplayback?id=demo-2",
      }),
      { pageUrl: "https://www.youtube.com/watch?v=demo" },
    );
  });

  test("renders playlist summary and add-all action inside preview", async () => {
    const { input, previewCard, helperText } = getState();
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Playlist demo",
      duration: 90,
      playlistCount: 3,
      playlistDuration: 420,
      entries: [
        "https://example.com/a",
        "https://example.com/b",
        "https://example.com/c",
      ],
    });

    input.value = "https://example.com/playlist";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();

    expect(previewCard.textContent).toContain("3 элементов");
    expect(previewCard.textContent).toContain("Всего: 7:00");
    expect(previewCard.textContent).toContain("Текущий ролик");
    expect(previewCard.textContent).toContain("Добавить все (3)");
    expect(helperText.textContent).toContain("Это плейлист");
  });

  test("playlist current-item action reuses the normal download flow", async () => {
    const { input, downloadBtn } = getState();
    const clickSpy = jest.spyOn(downloadBtn, "click");
    downloadBtn.disabled = false;
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Playlist demo",
      duration: 90,
      playlistCount: 2,
      playlistDuration: 180,
      entries: ["https://example.com/a", "https://example.com/b"],
    });

    input.value = "https://example.com/playlist";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();

    document.getElementById("preview-current-only").click();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test("playlist add-all action dispatches queue:addMany with entries", async () => {
    const { input } = getState();
    const listener = jest.fn();
    window.addEventListener("queue:addMany", listener);
    getVideoInfoMock.mockResolvedValueOnce({
      success: true,
      title: "Playlist demo",
      duration: 90,
      playlistCount: 2,
      playlistDuration: 180,
      entries: ["https://example.com/a", "https://example.com/b"],
    });

    input.value = "https://example.com/playlist";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    jest.advanceTimersByTime(600);
    await flushPromises();

    document.getElementById("preview-enqueue-all").click();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail.urls).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  test("opens current source URL when clicking the source icon button", async () => {
    const { input, sourceLink } = getState();
    input.value = "youtube.com/watch?v=test";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    sourceLink.click();

    expect(window.electron.invoke).toHaveBeenCalledWith(
      "open-external-link",
      "https://youtube.com/watch?v=test",
    );
  });
});

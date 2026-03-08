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
      </div>
    </div>
    <button id="download-button"></button>
  `;
};

const flushPromises = async () => {
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
});

describe("urlInputHandler", () => {
  let updateButtonStateMock;
  let getVideoInfoMock;
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
      jest.doMock("../i18n", () => ({
        t: (key, vars = {}) => {
          if (key === "input.url.helper") {
            return "Вставьте ссылку или перетащите её сюда";
          }
          if (key === "input.url.helper.loading") {
            return "Получаем превью и проверяем ссылку…";
          }
          if (key === "input.url.helper.valid") {
            return "Ссылка распознана. Нажмите Enter для загрузки.";
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
            return "Не удалось связаться с YouTube. Проверьте подключение и повторите попытку.";
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
          if (key === "input.url.preview.kicker") {
            return "Предпросмотр";
          }
          if (key === "input.url.preview.addAll") {
            return `Добавить все (${vars.count})`;
          }
          if (key === "input.url.preview.addAllTitle") {
            return "Добавить все элементы плейлиста в очередь";
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
    const { input, error, wrapper } = getState();
    input.value = "http://";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(error.classList.contains("hidden")).toBe(true);
    expect(wrapper.classList.contains("is-invalid")).toBe(false);
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
  });

  test("keeps current paste/clear visibility behavior and shell states", () => {
    const { input, clearBtn, pasteBtn, wrapper, container, helperText } = getState();

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

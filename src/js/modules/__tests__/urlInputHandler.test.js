/** @jest-environment jsdom */

const buildDom = () => {
  document.body.innerHTML = `
    <div class="input-container">
      <div class="url-input-wrapper">
        <i id="icon-url-globe" class="fas fa-globe search-icon" aria-hidden="true"></i>
        <input id="url" type="text" />
        <div class="button-grid">
          <button id="paste-url" class="paste-button hidden"></button>
          <button id="clear-url" class="clear-button hidden"></button>
          <button id="select-folder" class="folder-button"></button>
        </div>
      </div>
      <div id="url-inline-error" class="url-inline-error hidden"></div>
      <div id="preview-card" style="display:none;">
        <img id="preview-thumb" style="display:none;" />
        <div id="preview-title"></div>
        <small id="preview-duration"></small>
      </div>
      <div id="progress-bar-container"></div>
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
  progressContainer: document.getElementById("progress-bar-container"),
  downloadBtn: document.getElementById("download-button"),
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
        t: (key) =>
          key === "input.url.error.invalidOrUnsupported"
            ? "Проверьте ссылку: нужен корректный URL поддерживаемого источника."
            : key,
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
    expect(error.textContent).toContain("Проверьте ссылку");
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

  test("keeps current paste/clear visibility behavior", () => {
    const { input, clearBtn, pasteBtn } = getState();

    input.value = "https://example.com";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(clearBtn.classList.contains("hidden")).toBe(false);
    expect(pasteBtn.classList.contains("hidden")).toBe(true);

    clearBtn.click();
    expect(input.value).toBe("");
    expect(clearBtn.classList.contains("hidden")).toBe(true);
    expect(pasteBtn.classList.contains("hidden")).toBe(false);
  });

  test("syncs progress overlay bounds to url input wrapper rect", () => {
    const { wrapper, progressContainer } = getState();
    const container = document.querySelector(".input-container");
    const baseComputedStyle = window.getComputedStyle;

    jest
      .spyOn(container, "getBoundingClientRect")
      .mockReturnValue({ top: 100, left: 50 });
    jest.spyOn(wrapper, "getBoundingClientRect").mockReturnValue({
      top: 132,
      left: 78,
      width: 640,
      height: 52,
    });
    jest.spyOn(window, "getComputedStyle").mockImplementation((el) => {
      if (el === wrapper) return { borderRadius: "14px" };
      return baseComputedStyle(el);
    });

    window.dispatchEvent(new Event("resize"));
    jest.runOnlyPendingTimers();

    expect(progressContainer.style.top).toBe("32px");
    expect(progressContainer.style.left).toBe("28px");
    expect(progressContainer.style.width).toBe("640px");
    expect(progressContainer.style.height).toBe("52px");
    expect(progressContainer.style.borderRadius).toBe("14px");
  });
});

describe("clipboardHandler", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <div class="group-menu">
        <button data-menu="download" type="button"></button>
      </div>
      <input id="url" />
    `;
  });

  test("does not auto-paste focused clipboard URL when open-on-copy is disabled", async () => {
    await jest.isolateModulesAsync(async () => {
      let focusCallback = null;
      window.electron = {
        invoke: jest.fn(async () => false),
        onWindowFocused: jest.fn((cb) => {
          focusCallback = cb;
        }),
      };

      const updateButtonState = jest.fn();
      const updateIcon = jest.fn();
      const showToast = jest.fn();
      const isValidUrl = jest.fn(() => true);
      const isSupportedUrl = jest.fn(() => true);

      jest.doMock("../state.js", () => ({
        state: { isDownloading: false, lastPastedUrl: "" },
        updateButtonState,
      }));
      jest.doMock("../validation.js", () => ({ isValidUrl, isSupportedUrl }));
      jest.doMock("../domElements.js", () => ({
        urlInput: document.getElementById("url"),
      }));
      jest.doMock("../iconUpdater.js", () => ({ updateIcon }));
      jest.doMock("../toast.js", () => ({ showToast }));
      jest.doMock("../i18n.js", () => ({ t: (key) => key }));

      const { initClipboardHandler } = await import("../clipboardHandler.js");
      initClipboardHandler();
      await focusCallback?.("https://example.com/video");

      expect(window.electron.invoke).toHaveBeenCalledWith(
        "get-open-on-copy-url-status",
      );
      expect(isValidUrl).not.toHaveBeenCalled();
      expect(document.getElementById("url").value).toBe("");
      expect(updateIcon).not.toHaveBeenCalled();
      expect(updateButtonState).not.toHaveBeenCalled();
      expect(showToast).not.toHaveBeenCalled();
    });
  });

  test("auto-pastes focused clipboard URL when open-on-copy is enabled", async () => {
    await jest.isolateModulesAsync(async () => {
      let focusCallback = null;
      window.electron = {
        invoke: jest.fn(async () => true),
        onWindowFocused: jest.fn((cb) => {
          focusCallback = cb;
        }),
      };

      const updateButtonState = jest.fn();
      const updateIcon = jest.fn();
      const showToast = jest.fn();
      const tabButton = document.querySelector('[data-menu="download"]');
      const tabClick = jest.spyOn(tabButton, "click");

      jest.doMock("../state.js", () => ({
        state: { isDownloading: false, lastPastedUrl: "" },
        updateButtonState,
      }));
      jest.doMock("../validation.js", () => ({
        isValidUrl: jest.fn(() => true),
        isSupportedUrl: jest.fn(() => true),
      }));
      jest.doMock("../domElements.js", () => ({
        urlInput: document.getElementById("url"),
      }));
      jest.doMock("../iconUpdater.js", () => ({ updateIcon }));
      jest.doMock("../toast.js", () => ({ showToast }));
      jest.doMock("../i18n.js", () => ({ t: (key) => key }));

      const { initClipboardHandler } = await import("../clipboardHandler.js");
      initClipboardHandler();
      await focusCallback?.("https://example.com/video");

      expect(tabClick).toHaveBeenCalledTimes(1);
      expect(document.getElementById("url").value).toBe(
        "https://example.com/video",
      );
      expect(updateIcon).toHaveBeenCalledWith("https://example.com/video");
      expect(updateButtonState).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenCalledWith("clipboard.autoPaste", "info");
    });
  });
});

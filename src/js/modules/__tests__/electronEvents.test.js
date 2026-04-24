describe("electronEvents", () => {
  beforeEach(() => {
    jest.resetModules();
    global.window = global.window || {};
    window.notificationHandlerRegistered = false;
    window.openSettingsHandlerRegistered = false;
  });

  test("forwards toast options to showToast", async () => {
    await jest.isolateModulesAsync(async () => {
      const onToastCallbacks = [];
      window.electron = {
        on: jest.fn(),
        onVersion: jest.fn(),
        onNotification: jest.fn(),
        onPasteNotification: jest.fn(),
        onToast: jest.fn((cb) => {
          onToastCallbacks.push(cb);
        }),
      };

      const showToast = jest.fn();
      jest.doMock("../toast.js", () => ({
        showToast,
      }));
      jest.doMock("../domElements.js", () => ({
        downloadCancelButton: { disabled: true },
        versionElement: null,
        settingsTrigger: null,
      }));

      const { initElectronEvents } = await import("../electronEvents.js");

      initElectronEvents();
      onToastCallbacks[0]?.("Value <strong>saved</strong>", "success", {
        allowHtml: true,
      });

      expect(showToast).toHaveBeenCalledWith(
        "Value <strong>saved</strong>",
        "success",
        undefined,
        null,
        null,
        false,
        { allowHtml: true },
      );
    });
  });

  test("updates about settings version fields", async () => {
    document.body.innerHTML = `
      <strong id="settings-app-version">—</strong>
      <strong id="settings-tabs-version">—</strong>
      <strong id="settings-tabs-electron-version">—</strong>
      <strong id="settings-about-electron-version">—</strong>
      <strong id="settings-about-chrome-version">—</strong>
      <strong id="settings-about-node-version">—</strong>
    `;

    await jest.isolateModulesAsync(async () => {
      let versionCallback = null;
      window.electron = {
        on: jest.fn(),
        onVersion: jest.fn((cb) => {
          versionCallback = cb;
        }),
        onNotification: jest.fn(),
        onPasteNotification: jest.fn(),
        onToast: jest.fn(),
        getRuntimeInfo: jest.fn().mockResolvedValue({
          electron: "39.0.0",
          chrome: "140.0.0.0",
          node: "22.18.0",
        }),
      };

      jest.doMock("../toast.js", () => ({
        showToast: jest.fn(),
      }));
      jest.doMock("../domElements.js", () => ({
        downloadCancelButton: { disabled: true },
        versionElement: null,
        settingsTrigger: null,
      }));

      const { initElectronEvents } = await import("../electronEvents.js");
      initElectronEvents();
      await versionCallback?.("1.4.4");
    });

    expect(document.getElementById("settings-app-version")?.textContent).toBe(
      "v1.4.4",
    );
    expect(
      document.getElementById("settings-about-electron-version")?.textContent,
    ).toBe("v39.0.0");
    expect(
      document.getElementById("settings-about-chrome-version")?.textContent,
    ).toBe("v140.0.0.0");
    expect(
      document.getElementById("settings-about-node-version")?.textContent,
    ).toBe("v22.18.0");
  });
});

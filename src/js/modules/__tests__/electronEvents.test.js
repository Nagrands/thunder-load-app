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
        settingsButton: null,
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
});

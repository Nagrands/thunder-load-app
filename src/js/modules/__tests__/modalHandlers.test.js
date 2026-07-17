describe("modalHandlers", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <button id="shortcuts-button" type="button">open</button>
      <div id="whats-new-modal" style="display:none" aria-hidden="true"></div>
      <div id="confirmation-modal" style="display:none" aria-hidden="true"></div>
      <div id="settings-modal" style="display:none" aria-hidden="true"></div>
      <div id="first-run-modal" style="display:none" aria-hidden="true"></div>
    `;
  });

  test("opens the shortcuts settings section from the top bar", async () => {
    await jest.isolateModulesAsync(async () => {
      const openSettingsWithTab = jest.fn();
      jest.doMock("../settingsModal.js", () => ({ openSettingsWithTab }));
      const { initModalHandlers } = await import("../modalHandlers.js");

      initModalHandlers();
      document.getElementById("shortcuts-button").click();

      expect(openSettingsWithTab).toHaveBeenCalledWith("shortcuts-settings");
    });
  });
});

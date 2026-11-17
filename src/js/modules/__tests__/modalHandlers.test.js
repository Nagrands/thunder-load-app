describe("modalHandlers", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <div id="whats-new-modal" style="display:none" aria-hidden="true"></div>
      <div id="confirmation-modal" style="display:none" aria-hidden="true"></div>
      <div id="settings-modal" style="display:none" aria-hidden="true"></div>
      <div id="first-run-modal" style="display:none" aria-hidden="true"></div>
    `;
  });

  test("does not require the removed topbar shortcuts control", async () => {
    await jest.isolateModulesAsync(async () => {
      const { initModalHandlers } = await import("../modalHandlers.js");

      initModalHandlers();
      expect(document.getElementById("settings-modal")).not.toBeNull();
    });
  });
});

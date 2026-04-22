describe("modalHandlers", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <button id="shortcuts-button" type="button">open</button>
      <div id="shortcuts-modal" style="display:none" aria-hidden="true">
        <button class="close" type="button">x</button>
      </div>
      <div id="whats-new-modal" style="display:none" aria-hidden="true"></div>
      <div id="confirmation-modal" style="display:none" aria-hidden="true"></div>
      <div id="settings-modal" style="display:none" aria-hidden="true"></div>
      <div id="first-run-modal" style="display:none" aria-hidden="true"></div>
    `;
  });

  test("marks shortcuts modal as overlay-active while open", async () => {
    await jest.isolateModulesAsync(async () => {
      const { initModalHandlers } = await import("../modalHandlers.js");

      initModalHandlers();
      document.getElementById("shortcuts-button").click();

      const modal = document.getElementById("shortcuts-modal");
      expect(modal.style.display).toBe("flex");
      expect(modal.getAttribute("aria-hidden")).toBe("false");
      expect(document.body.classList.contains("modal-overlay-active")).toBe(
        true,
      );

      modal.querySelector(".close").click();

      expect(modal.style.display).toBe("none");
      expect(modal.getAttribute("aria-hidden")).toBe("true");
      expect(document.body.classList.contains("modal-overlay-active")).toBe(
        false,
      );
    });
  });
});

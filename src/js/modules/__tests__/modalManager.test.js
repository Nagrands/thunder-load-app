jest.mock("../scrollLockManager.js", () => ({
  releaseOverlayActive: jest.fn(),
  releaseBodyScrollLock: jest.fn(),
  repairScrollLocks: jest.fn(),
}));

describe("modalManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="settings-modal" style="display:flex" aria-hidden="false"></div>
      <div id="shortcuts-modal" style="display:flex" aria-hidden="false"></div>
    `;
  });

  test("closes settings through its lifecycle handler", () => {
    const {
      releaseOverlayActive,
      repairScrollLocks,
    } = require("../scrollLockManager.js");
    const { closeAllModals } = require("../modalManager.js");
    const settingsModal = document.getElementById("settings-modal");
    const shortcutsModal = document.getElementById("shortcuts-modal");
    const lifecycleHandler = jest.fn((event) => event.preventDefault());
    settingsModal.addEventListener("modal:close-request", lifecycleHandler);

    closeAllModals([settingsModal, shortcutsModal]);

    expect(lifecycleHandler).toHaveBeenCalledTimes(1);
    expect(settingsModal.style.display).toBe("flex");
    expect(shortcutsModal.style.display).toBe("none");
    expect(shortcutsModal.getAttribute("aria-hidden")).toBe("true");
    expect(releaseOverlayActive).toHaveBeenCalledWith("shortcuts-modal");
    expect(repairScrollLocks).toHaveBeenCalledTimes(1);
  });
});

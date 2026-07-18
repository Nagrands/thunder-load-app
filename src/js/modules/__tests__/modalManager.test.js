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
      <div id="confirmation-modal" style="display:flex" aria-hidden="false"></div>
    `;
  });

  test("closes settings through its lifecycle handler", () => {
    const {
      releaseOverlayActive,
      repairScrollLocks,
    } = require("../scrollLockManager.js");
    const { closeAllModals } = require("../modalManager.js");
    const settingsModal = document.getElementById("settings-modal");
    const confirmationModal = document.getElementById("confirmation-modal");
    const lifecycleHandler = jest.fn((event) => event.preventDefault());
    settingsModal.addEventListener("modal:close-request", lifecycleHandler);

    closeAllModals([settingsModal, confirmationModal]);

    expect(lifecycleHandler).toHaveBeenCalledTimes(1);
    expect(settingsModal.style.display).toBe("flex");
    expect(confirmationModal.style.display).toBe("none");
    expect(confirmationModal.getAttribute("aria-hidden")).toBe("true");
    expect(releaseOverlayActive).toHaveBeenCalledWith("confirmation-modal");
    expect(repairScrollLocks).toHaveBeenCalledTimes(1);
  });

  test("registers and controls feature-owned dialogs", () => {
    const {
      closeRegisteredModal,
      openRegisteredModal,
      registerModal,
    } = require("../modalManager.js");
    const dialog = document.createElement("div");
    document.body.appendChild(dialog);
    const unregister = registerModal(dialog);

    openRegisteredModal(dialog);
    expect(dialog.getAttribute("open")).toBe("");
    expect(dialog.getAttribute("aria-hidden")).toBe("false");

    closeRegisteredModal(dialog);
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(dialog.getAttribute("aria-hidden")).toBe("true");
    expect(() => unregister()).not.toThrow();
  });

  test("opens feature dialogs without making the document inert when requested", () => {
    const {
      closeRegisteredModal,
      openRegisteredModal,
      registerModal,
    } = require("../modalManager.js");
    const dialog = document.createElement("dialog");
    const show = jest.fn(() => dialog.setAttribute("open", ""));
    const showModal = jest.fn();
    const close = jest.fn(() => dialog.removeAttribute("open"));
    Object.defineProperties(dialog, {
      show: { value: show },
      showModal: { value: showModal },
      close: { value: close },
      open: { get: () => dialog.hasAttribute("open") },
    });
    document.body.appendChild(dialog);
    const unregister = registerModal(dialog);

    openRegisteredModal(dialog, { blocking: false });

    expect(show).toHaveBeenCalledTimes(1);
    expect(showModal).not.toHaveBeenCalled();
    expect(dialog.getAttribute("aria-hidden")).toBe("false");

    closeRegisteredModal(dialog);
    expect(close).toHaveBeenCalledTimes(1);
    expect(dialog.open).toBe(false);
    closeRegisteredModal(dialog);
    openRegisteredModal(dialog, { blocking: false });
    expect(show).toHaveBeenCalledTimes(2);
    expect(dialog.style.display).toBe("");
    unregister();
  });
});

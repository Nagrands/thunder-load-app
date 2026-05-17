/** @jest-environment jsdom */

import createDOMPurify from "dompurify";

function createConfirmationModalDom() {
  document.body.innerHTML = `
    <div id="confirmation-modal">
      <div id="confirmation-title"></div>
      <div id="confirmation-subtitle"></div>
      <div class="confirmation-message"></div>
      <button class="confirm-button"></button>
      <button class="cancel-button"></button>
      <button class="close-modal"></button>
    </div>
  `;
  return document.getElementById("confirmation-modal");
}

jest.mock("../modalManager.js", () => ({
  closeAllModals: jest.fn(),
}));

jest.mock("../tooltipInitializer.js", () => ({
  hideAllTooltips: jest.fn(),
}));

jest.mock("../i18n.js", () => ({
  t: (key) => key,
}));

describe("showConfirmationDialog (allowHtml)", () => {
  beforeEach(() => {
    jest.resetModules();
    global.DOMPurify = createDOMPurify(window);
  });

  afterEach(() => {
    delete global.DOMPurify;
  });

  test("sanitizes HTML when allowHtml=true", async () => {
    const confirmationModal = createConfirmationModalDom();

    jest.doMock("../domElements.js", () => ({
      confirmationModal,
      shortcutsModal: null,
      whatsNewModal: null,
      settingsModal: null,
    }));

    const { showConfirmationDialog } = await import("../modals.js");

    const resultPromise = showConfirmationDialog({
      allowHtml: true,
      message:
        '<h4 class="toast-success">OK</h4><img src=x onerror="alert(1)"><script>alert(2)</script>',
      singleButton: true,
    });

    const messageEl = confirmationModal.querySelector(".confirmation-message");
    expect(messageEl.innerHTML).toContain("toast-success");
    expect(messageEl.querySelector("script")).toBeNull();
    expect(messageEl.querySelector("img")).toBeNull();
    expect(confirmationModal.getAttribute("aria-hidden")).toBe("false");
    expect(document.body.classList.contains("modal-overlay-active")).toBe(true);

    // Close immediately to resolve promise and avoid hanging listeners.
    confirmationModal.querySelector(".close-modal").click();
    await expect(resultPromise).resolves.toBe(false);
    expect(confirmationModal.getAttribute("aria-hidden")).toBe("true");
    expect(document.body.classList.contains("modal-overlay-active")).toBe(
      false,
    );
  });

  test("falls back to text when DOMPurify is missing", async () => {
    delete global.DOMPurify;

    const confirmationModal = createConfirmationModalDom();
    jest.doMock("../domElements.js", () => ({
      confirmationModal,
      shortcutsModal: null,
      whatsNewModal: null,
      settingsModal: null,
    }));

    const { showConfirmationDialog } = await import("../modals.js");

    const resultPromise = showConfirmationDialog({
      allowHtml: true,
      message: "<h4>Title</h4>",
      singleButton: true,
    });

    const messageEl = confirmationModal.querySelector(".confirmation-message");
    expect(messageEl.textContent).toContain("<h4>Title</h4>");

    confirmationModal.querySelector(".close-modal").click();
    await expect(resultPromise).resolves.toBe(false);
  });

  test("returns custom confirm, cancel, and close results", async () => {
    const confirmationModal = createConfirmationModalDom();
    jest.doMock("../domElements.js", () => ({
      confirmationModal,
      shortcutsModal: null,
      whatsNewModal: null,
      settingsModal: null,
    }));

    const { showConfirmationDialog } = await import("../modals.js");

    const confirmPromise = showConfirmationDialog({
      message: "Confirm result",
      confirmResult: "all",
      cancelResult: "single",
      closeResult: false,
    });
    confirmationModal.querySelector(".confirm-button").click();
    await expect(confirmPromise).resolves.toBe("all");

    const cancelPromise = showConfirmationDialog({
      message: "Cancel result",
      confirmResult: "all",
      cancelResult: "single",
      closeResult: false,
    });
    confirmationModal.querySelector(".cancel-button").click();
    await expect(cancelPromise).resolves.toBe("single");

    const closePromise = showConfirmationDialog({
      message: "Close result",
      confirmResult: "all",
      cancelResult: "single",
      closeResult: false,
    });
    confirmationModal.querySelector(".close-modal").click();
    await expect(closePromise).resolves.toBe(false);
  });
});

import createDOMPurify from "dompurify";

describe("toast safe html rendering", () => {
  let showToast;
  let showLoading;
  let closeAllToasts;

  beforeEach(() => {
    jest.resetModules();
    const container = document.getElementById("toast-container");
    if (container) container.innerHTML = "";
    jest.isolateModules(() => {
      jest.doMock("../domElements.js", () => ({
        toastContainer: document.getElementById("toast-container"),
      }));
      const mod = require("../toast.js");
      showToast = mod.showToast;
      showLoading = mod.showLoading;
      closeAllToasts = mod.closeAllToasts;
    });
    window.DOMPurify = createDOMPurify(window);
  });

  afterEach(() => {
    jest.useRealTimers();
    closeAllToasts?.();
    delete window.DOMPurify;
    const container = document.getElementById("toast-container");
    if (container) container.innerHTML = "";
  });

  it("keeps the legacy positional API and renders compact toast metadata", () => {
    const toast = showToast("Saved", "success", 1000, "Done");

    expect(toast).toBeTruthy();
    expect(toast?.classList.contains("toast-success")).toBe(true);
    expect(toast?.dataset.ui).toBe("toast");
    expect(toast?.dataset.type).toBe("success");
    expect(toast?.querySelector(".toast-title")?.textContent).toBe("Done");
    expect(toast?.querySelector(".toast-message")?.textContent).toBe("Saved");
  });

  it("supports object options without breaking existing callers", () => {
    const onUndo = jest.fn();

    showToast("Removed", {
      type: "warning",
      duration: 8000,
      title: "History",
      onUndo,
      accent: true,
    });

    const toast = document.querySelector(".toast");
    expect(toast?.classList.contains("toast-warning")).toBe(true);
    expect(toast?.classList.contains("toast-accent-warning")).toBe(true);
    expect(toast?.querySelector(".toast-title")?.textContent).toBe("History");

    toast?.querySelector("#undo-action")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("renders allowed html tags when allowHtml=true", () => {
    showToast(
      "Размер <strong>текста</strong> обновлён",
      "success",
      1000,
      null,
      null,
      false,
      { allowHtml: true },
    );
    const messageEl = document.querySelector(".toast-message");
    expect(messageEl).not.toBeNull();
    expect(messageEl?.querySelector("strong")?.textContent).toBe("текста");
  });

  it("sanitizes dangerous html and strips scripts/events", () => {
    showToast(
      '<img src=x onerror="alert(1)"><script>alert(1)</script><strong>OK</strong>',
      "warning",
      1000,
      null,
      null,
      false,
      { allowHtml: true },
    );
    const messageEl = document.querySelector(".toast-message");
    expect(messageEl).not.toBeNull();
    expect(messageEl?.querySelector("script")).toBeNull();
    expect(messageEl?.querySelector("img")).toBeNull();
    expect(messageEl?.innerHTML.includes("onerror")).toBe(false);
    expect(messageEl?.querySelector("strong")?.textContent).toBe("OK");
  });

  it("falls back to plain text if DOMPurify is unavailable", () => {
    delete window.DOMPurify;
    showToast(
      "<strong>Safe fallback</strong>",
      "info",
      1000,
      null,
      null,
      false,
      { allowHtml: true },
    );
    const messageEl = document.querySelector(".toast-message");
    expect(messageEl).not.toBeNull();
    expect(messageEl?.querySelector("strong")).toBeNull();
    expect(messageEl?.textContent).toBe("<strong>Safe fallback</strong>");
  });

  it("closes from the icon button and Escape", () => {
    jest.useFakeTimers();
    const first = showToast("Closable", "info", 1000);
    first?.querySelector(".toast-close")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(first?.classList.contains("hide")).toBe(true);
    jest.advanceTimersByTime(220);
    expect(document.querySelectorAll(".toast")).toHaveLength(0);

    const second = showToast("Keyboard", "info", 1000);
    second?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(second?.classList.contains("hide")).toBe(true);
  });

  it("limits visible toasts to five", () => {
    for (let index = 0; index < 6; index += 1) {
      showToast(`Toast ${index + 1}`, "info", 1000);
    }

    expect(document.querySelectorAll(".toast")).toHaveLength(6);
    expect(document.querySelectorAll(".toast:not(.hide)")).toHaveLength(5);
    expect(document.querySelector(".toast")?.classList.contains("hide")).toBe(
      true,
    );
  });

  it("returns a loading toast controller that updates and closes", () => {
    jest.useFakeTimers();
    const controller = showLoading("Preparing", "Loading");

    expect(document.querySelector(".toast-loading")).toBeTruthy();
    controller.update("Ready", "Complete");
    expect(document.querySelector(".toast-message")?.textContent).toBe("Ready");
    expect(document.querySelector(".toast-title")?.textContent).toBe(
      "Complete",
    );

    controller.close();
    jest.advanceTimersByTime(220);
    expect(document.querySelector(".toast-loading")).toBeNull();
  });
});

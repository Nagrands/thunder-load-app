import createDOMPurify from "dompurify";

describe("toast safe html rendering", () => {
  let showToast;
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
      closeAllToasts = mod.closeAllToasts;
    });
    global.DOMPurify = createDOMPurify(window);
  });

  afterEach(() => {
    closeAllToasts?.();
    delete global.DOMPurify;
    const container = document.getElementById("toast-container");
    if (container) container.innerHTML = "";
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
    delete global.DOMPurify;
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
});

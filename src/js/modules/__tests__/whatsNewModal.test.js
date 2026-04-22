import createDOMPurify from "dompurify";

jest.mock("../domElements.js", () => {
  const makeEl = () => ({
    style: {},
    addEventListener: jest.fn(),
    querySelector: jest.fn(),
    insertAdjacentHTML: jest.fn(),
    setAttribute: jest.fn(),
  });

  return {
    versionContainer: makeEl(),
    whatsNewModal: makeEl(),
    whatsNewContent: makeEl(),
    closeWhatsNewBtn: makeEl(),
    shortcutsModal: makeEl(),
    confirmationModal: makeEl(),
    settingsModal: makeEl(),
  };
});

let sanitize;

beforeAll(async () => {
  global.DOMPurify = createDOMPurify(window);
  const mod = await import("../whatsNewModal.js");
  sanitize = mod.__test_sanitizeWhatsNewHtml;
});

describe("whatsNew sanitizer", () => {
  test("keeps allowed tags", () => {
    const input = "<p>ok</p>";
    const output = sanitize(input);
    expect(output).toBe("<p>ok</p>");
  });

  test("removes script tags", () => {
    const input = "<script>alert(1)</script><p>x</p>";
    const output = sanitize(input);
    expect(output).toBe("<p>x</p>");
  });

  test("keeps h1 and table tags for rich markdown", () => {
    const input =
      '<h1>Title</h1><table><thead><tr><th align="right">A</th></tr></thead><tbody><tr><td align="center">B</td></tr></tbody></table>';
    const output = sanitize(input);
    expect(output).toContain("<h1>Title</h1>");
    expect(output).toContain("<table>");
    expect(output).toContain("<th>A</th>");
    expect(output).toContain("<td>B</td>");
  });

  test("strips javascript: href", () => {
    const input = '<a href="javascript:alert(1)">x</a>';
    const output = sanitize(input);
    expect(output).toBe("<a>x</a>");
  });
});

describe("whatsNew overlay state", () => {
  test("adds and removes modal overlay class when modal opens and closes", async () => {
    jest.resetModules();

    const listeners = {};
    const header = {
      innerHTML: "",
      appendChild: jest.fn(),
      insertAdjacentText: jest.fn(),
    };
    const whatsNewModal = {
      style: {},
      setAttribute: jest.fn(),
      querySelector: jest.fn(() => header),
    };
    const whatsNewContent = {
      innerHTML: "",
      insertAdjacentHTML: jest.fn(),
    };
    const versionContainer = {
      addEventListener: jest.fn((event, handler) => {
        listeners[event] = handler;
      }),
    };
    const closeWhatsNewBtn = {
      addEventListener: jest.fn((event, handler) => {
        listeners[`close:${event}`] = handler;
      }),
    };

    jest.doMock("../domElements.js", () => ({
      versionContainer,
      whatsNewModal,
      whatsNewContent,
      closeWhatsNewBtn,
      shortcutsModal: null,
      confirmationModal: null,
      settingsModal: null,
    }));
    jest.doMock("../modalManager.js", () => ({
      closeAllModals: jest.fn(),
    }));
    jest.doMock("../i18n.js", () => ({
      getLanguage: jest.fn(() => "en"),
      t: (key, vars = {}) =>
        key === "whatsnew.version" ? `Version ${vars.version}` : key,
    }));

    window.electron = {
      invoke: jest.fn(async (channel) => {
        if (channel === "get-version") return "1.4.4";
        if (channel === "get-whats-new") {
          return { version: "1.4.4", changes: ["<p>ok</p>"] };
        }
        return undefined;
      }),
      onShowWhatsNew: jest.fn(),
    };

    const mod = await import("../whatsNewModal.js");
    mod.initWhatsNewModal();

    await listeners.click();

    expect(whatsNewModal.style.display).toBe("flex");
    expect(whatsNewModal.setAttribute).toHaveBeenCalledWith(
      "aria-hidden",
      "false",
    );
    expect(document.body.classList.contains("modal-overlay-active")).toBe(true);

    listeners["close:click"]();

    expect(whatsNewModal.style.display).toBe("none");
    expect(whatsNewModal.setAttribute).toHaveBeenCalledWith(
      "aria-hidden",
      "true",
    );
    expect(document.body.classList.contains("modal-overlay-active")).toBe(
      false,
    );
  });
});

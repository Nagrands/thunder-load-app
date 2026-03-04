import createDOMPurify from "dompurify";

jest.mock("../domElements.js", () => {
  const makeEl = () => ({
    style: {},
    addEventListener: jest.fn(),
    querySelector: jest.fn(),
    insertAdjacentHTML: jest.fn(),
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

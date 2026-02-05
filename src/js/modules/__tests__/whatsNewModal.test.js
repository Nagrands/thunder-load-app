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

import { __test_sanitizeWhatsNewHtml } from "../whatsNewModal.js";

describe("whatsNew sanitizer", () => {
  test("keeps allowed tags", () => {
    const input = "<p>ok</p>";
    const output = __test_sanitizeWhatsNewHtml(input);
    expect(output).toBe("<p>ok</p>");
  });

  test("removes script tags", () => {
    const input = "<script>alert(1)</script><p>x</p>";
    const output = __test_sanitizeWhatsNewHtml(input);
    expect(output).toBe("<p>x</p>");
  });

  test("strips javascript: href", () => {
    const input = '<a href="javascript:alert(1)">x</a>';
    const output = __test_sanitizeWhatsNewHtml(input);
    expect(output).toBe("<a>x</a>");
  });
});

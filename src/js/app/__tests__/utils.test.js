const { isValidUrl, normalizeUrl } = require("../utils");

describe("utils.normalizeUrl", () => {
  test("adds https:// when scheme is missing", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
  });

  test("preserves existing scheme", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
  });

  test("trims whitespace and surrounding quotes/brackets", () => {
    expect(normalizeUrl('  "example.com"  ')).toBe("https://example.com");
    expect(normalizeUrl("<example.com>")).toBe("https://example.com");
  });

  test("returns empty string for invalid input", () => {
    expect(normalizeUrl("")).toBe("");
    expect(normalizeUrl("   ")).toBe("");
    expect(normalizeUrl(null)).toBe("");
  });
});

describe("utils.isValidUrl", () => {
  test("accepts http/https URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://example.com/path?x=1")).toBe(true);
  });

  test("rejects unsupported schemes and invalid strings", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});

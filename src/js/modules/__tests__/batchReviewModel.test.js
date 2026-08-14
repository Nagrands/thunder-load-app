const {
  canonicalizeBatchUrl,
  extractBatchUrls,
  normalizePlaylistItems,
  parseBatchText,
} = require("../features/batchReview/model");

describe("batch review model", () => {
  test("extracts links from mixed text and preserves order", () => {
    expect(
      extractBatchUrls(
        "first https://example.com/a\nhttps://example.com/b; ignored",
      ),
    ).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  test("canonicalizes YouTube and tracking parameters", () => {
    expect(
      canonicalizeBatchUrl("https://youtu.be/demo?si=tracking&utm_source=x"),
    ).toBe("https://www.youtube.com/watch?v=demo");
  });

  test("separates valid, duplicate, and unsupported links", () => {
    const result = parseBatchText(
      [
        "https://example.com/a?utm_source=test",
        "https://example.com/a",
        "https://unsupported.example/file",
      ].join("\n"),
      {
        isValidUrl: (url) => url.startsWith("https://"),
        isSupportedUrl: (url) => !url.includes("unsupported"),
      },
    );

    expect(result.valid.map((item) => item.url)).toEqual([
      "https://example.com/a",
    ]);
    expect(result.duplicates).toHaveLength(1);
    expect(result.unsupported).toHaveLength(1);
  });

  test("normalizes playlist metadata and retains unavailable rows", () => {
    expect(
      normalizePlaylistItems([
        { id: "a", url: "https://example.com/a", title: "A" },
        { id: "private", url: "", title: "Private", available: false },
      ]),
    ).toEqual([
      expect.objectContaining({ id: "a", index: 1, available: true }),
      expect.objectContaining({
        id: "private",
        index: 2,
        url: "",
        available: false,
      }),
    ]);
  });

  test("handles an empty and a 250-link batch", () => {
    expect(parseBatchText("").valid).toEqual([]);
    const text = Array.from(
      { length: 250 },
      (_, index) => `https://example.com/${index}`,
    ).join("\n");
    expect(parseBatchText(text).valid).toHaveLength(250);
  });
});

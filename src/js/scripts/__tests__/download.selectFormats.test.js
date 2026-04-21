jest.mock("electron", () => ({
  app: {
    getPath: jest.fn(() => "/tmp"),
    getAppPath: jest.fn(() => "/tmp"),
  },
}));

jest.mock("electron-log", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  selectFormatsByQuality,
  classifyYtDlpErrorMessage,
  makeYtDlpExitError,
} = require("../download.js");

describe("selectFormatsByQuality object fallback", () => {
  it("falls back by quality label when stored format IDs are unavailable", () => {
    const formats = [
      {
        format_id: "401",
        vcodec: "av01",
        acodec: "none",
        height: 1080,
        width: 1920,
        ext: "mp4",
      },
      {
        format_id: "251",
        vcodec: "none",
        acodec: "opus",
        abr: 160,
        ext: "webm",
      },
    ];

    const picked = selectFormatsByQuality(formats, {
      quality: "FHD 1080p",
      videoFormatId: "137",
      audioFormatId: "140",
      label: "FHD 1080p • old profile",
    });

    expect(picked.videoFormat).toBe("401");
    expect(picked.audioFormat).toBe("251");
  });

  it("falls back to audio-only when object has stale audio format ID", () => {
    const formats = [
      {
        format_id: "251",
        vcodec: "none",
        acodec: "opus",
        abr: 160,
        ext: "webm",
      },
    ];

    const picked = selectFormatsByQuality(formats, {
      type: "audio-only",
      quality: "Audio Only",
      audioFormatId: "140",
      videoFormatId: null,
      label: "Audio",
    });

    expect(picked.videoFormat).toBeNull();
    expect(picked.audioFormat).toBe("251");
  });
});

describe("yt-dlp error classification helpers", () => {
  it("classifies unsupported URLs, 404, 429 and spawn-like failures", () => {
    expect(
      classifyYtDlpErrorMessage("ERROR: Unsupported URL: https://avito.ru"),
    ).toMatchObject({
      code: "ERR_YTDLP_UNSUPPORTED_URL",
    });

    expect(
      classifyYtDlpErrorMessage(
        "ERROR: [generic] Unable to download webpage: HTTP Error 404: Not Found",
      ),
    ).toMatchObject({
      code: "ERR_YTDLP_NOT_FOUND",
    });

    expect(
      classifyYtDlpErrorMessage(
        "ERROR: [generic] Unable to download webpage: HTTP Error 429: Too Many Requests",
      ),
    ).toMatchObject({
      code: "ERR_YTDLP_RATE_LIMIT",
    });
  });

  it("converts yt-dlp exit output into structured errors", () => {
    const unsupported = makeYtDlpExitError(
      1,
      "ERROR: Unsupported URL: https://avito.ru",
    );
    expect(unsupported.message).toContain("ERR_YTDLP_UNSUPPORTED_URL");

    const notFound = makeYtDlpExitError(
      1,
      "ERROR: [generic] Unable to download webpage: HTTP Error 404: Not Found",
    );
    expect(notFound.message).toContain("ERR_YTDLP_NOT_FOUND");
  });
});

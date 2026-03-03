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

const { selectFormatsByQuality } = require("../download.js");

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

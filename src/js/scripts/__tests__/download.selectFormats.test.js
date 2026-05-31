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
  _buildYtDlpVideoInfoArgs,
  _getVideoInfoCacheTtl,
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

  it("preserves mp3 audio output for explicit audio-only selections", () => {
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
      label: "MP3",
      audioFormatId: "251",
      videoFormatId: null,
      audioExt: "mp3",
      resolution: "MP3",
    });

    expect(picked.videoFormat).toBeNull();
    expect(picked.audioFormat).toBe("251");
    expect(picked.audioExt).toBe("mp3");
    expect(picked.resolution).toBe("MP3");
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

describe("yt-dlp video info optimization helpers", () => {
  it("adds no-playlist for a YouTube watch link with playlist metadata", () => {
    const args = _buildYtDlpVideoInfoArgs(
      "https://www.youtube.com/watch?v=abc123&list=PL123&index=2",
      "/tmp/ffmpeg",
    );

    expect(args).toContain("--no-playlist");
    expect(args).toEqual(
      expect.arrayContaining(["-J", "--ffmpeg-location", "/tmp/ffmpeg"]),
    );
  });

  it("keeps playlist URLs eligible for playlist extraction", () => {
    const args = _buildYtDlpVideoInfoArgs(
      "https://www.youtube.com/playlist?list=PL123",
      "/tmp/ffmpeg",
    );

    expect(args).not.toContain("--no-playlist");
  });

  it("uses a longer cache TTL for normal videos and a short TTL for live videos", () => {
    expect(_getVideoInfoCacheTtl({ is_live: false })).toBe(10 * 60 * 1000);
    expect(_getVideoInfoCacheTtl({ is_live: true })).toBe(60 * 1000);
  });

  it("caches the resolved yt-dlp binary while the file signature is unchanged", async () => {
    jest.resetModules();
    const { EventEmitter } = require("events");
    const fs = require("fs");
    const os = require("os");
    const path = require("path");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-dlp-cache-"));
    const binaryPath = path.join(
      tmpDir,
      process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp",
    );
    fs.writeFileSync(binaryPath, "demo");

    const spawnMock = jest.fn(() => {
      const proc = new EventEmitter();
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      proc.kill = jest.fn();
      process.nextTick(() => {
        proc.stdout.emit("data", "2026.01.01\n");
        proc.emit("close", 0);
      });
      return proc;
    });

    jest.doMock("child_process", () => ({
      spawn: spawnMock,
    }));
    jest.doMock("../../app/toolsPaths", () => ({
      getEffectiveToolsDir: jest.fn(() => tmpDir),
      getDefaultToolsDir: jest.fn(() => tmpDir),
      ensureToolsDir: jest.fn(() => tmpDir),
      resolveToolPath: jest.fn(() => binaryPath),
    }));
    jest.doMock("../../app/runtimeTools", () => ({
      getRuntimeFfprobePath: jest.fn(() => path.join(tmpDir, "ffprobe")),
      resolveRuntimeBinaryPath: jest.fn(() => binaryPath),
      resolveRuntimeBinaryCandidates: jest.fn(() => [
        { path: binaryPath, source: "test" },
      ]),
      resolveRuntimeBinaryDetails: jest.fn(() => ({
        path: binaryPath,
        source: "test",
      })),
      prepareBinaryForExecution: jest.fn(),
      resolveRuntimeFfmpegDir: jest.fn(() => tmpDir),
    }));

    const mod = require("../download.js");
    mod._resetYtDlpBinaryCache();

    await mod._resolveUsableYtDlpBinary();
    await mod._resolveUsableYtDlpBinary();

    expect(spawnMock).toHaveBeenCalledTimes(1);

    jest.dontMock("child_process");
    jest.dontMock("../../app/toolsPaths");
    jest.dontMock("../../app/runtimeTools");
  });
});

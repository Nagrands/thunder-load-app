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
  _buildYtDlpVideoPreviewArgs,
  _getVideoInfoCacheTtl,
  _getPersistentPreviewCachePath,
  _getPersistentPreviewMetadata,
  _setPersistentPreviewMetadata,
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

  it("builds lightweight preview args without format checking", () => {
    const args = _buildYtDlpVideoPreviewArgs(
      "https://www.youtube.com/watch?v=abc123&list=PL123",
      "/tmp/ffmpeg",
    );

    expect(args).toEqual(
      expect.arrayContaining([
        "-J",
        "--skip-download",
        "--no-check-formats",
        "--no-playlist",
      ]),
    );
  });

  it("uses flat playlist extraction only for explicit playlist preview URLs", () => {
    const args = _buildYtDlpVideoPreviewArgs(
      "https://www.youtube.com/playlist?list=PL123",
      "/tmp/ffmpeg",
    );

    expect(args).toContain("--flat-playlist");
    expect(args).not.toContain("--no-playlist");
  });

  it("uses a longer cache TTL for normal videos and a short TTL for live videos", () => {
    expect(_getVideoInfoCacheTtl({ is_live: false })).toBe(10 * 60 * 1000);
    expect(_getVideoInfoCacheTtl({ is_live: true })).toBe(60 * 1000);
  });

  it("stores lightweight preview metadata in persistent cache without formats", () => {
    const fs = require("fs");
    const cachePath = _getPersistentPreviewCachePath();
    try {
      fs.rmSync(cachePath, { force: true });
    } catch {}

    _setPersistentPreviewMetadata("https://example.com/video", {
      title: "Preview title",
      thumbnail: "https://cdn.example.com/thumb.jpg",
      duration: 120,
      formats: [{ format_id: "18" }],
      thumbnails: [{ url: "https://cdn.example.com/1.jpg", width: 320 }],
    });

    const cached = _getPersistentPreviewMetadata("https://example.com/video");

    expect(cached).toMatchObject({
      success: true,
      title: "Preview title",
      thumbnail: "https://cdn.example.com/thumb.jpg",
      duration: 120,
    });
    expect(cached.formats).toBeUndefined();
    expect(cached.thumbnails).toEqual([
      {
        url: "https://cdn.example.com/1.jpg",
        width: 320,
        height: null,
      },
    ]);
  });

  it("does not persist live preview metadata but keeps playlist summary", () => {
    const fs = require("fs");
    const cachePath = _getPersistentPreviewCachePath();
    try {
      fs.rmSync(cachePath, { force: true });
    } catch {}

    _setPersistentPreviewMetadata("live", {
      title: "Live",
      is_live: true,
      thumbnail: "https://cdn.example.com/live.jpg",
    });
    _setPersistentPreviewMetadata("playlist", {
      title: "Playlist",
      entries: [{ id: "1" }, { id: "2" }],
      thumbnail: "https://cdn.example.com/playlist.jpg",
      playlistDuration: 300,
    });

    expect(_getPersistentPreviewMetadata("live")).toBeNull();
    expect(_getPersistentPreviewMetadata("playlist")).toMatchObject({
      title: "Playlist",
      playlistCount: 2,
      playlistDuration: 300,
    });
    expect(_getPersistentPreviewMetadata("playlist").entries).toBeUndefined();
  });

  it("invalidates persistent preview metadata after the preview TTL", () => {
    const fs = require("fs");
    const cachePath = _getPersistentPreviewCachePath();
    try {
      fs.rmSync(cachePath, { force: true });
    } catch {}
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1000);

    try {
      _setPersistentPreviewMetadata("ttl", {
        title: "TTL demo",
        thumbnail: "https://cdn.example.com/ttl.jpg",
      });

      nowSpy.mockReturnValue(1000 + 24 * 60 * 60 * 1000 + 1);
      expect(_getPersistentPreviewMetadata("ttl")).toBeNull();

      const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      expect(cache.entries.ttl).toBeUndefined();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("invalidates persistent preview metadata when the yt-dlp signature changes", () => {
    const fs = require("fs");
    const cachePath = _getPersistentPreviewCachePath();
    try {
      fs.rmSync(cachePath, { force: true });
    } catch {}

    _setPersistentPreviewMetadata("signature", {
      title: "Signature demo",
      thumbnail: "https://cdn.example.com/signature.jpg",
    });

    const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    cache.entries.signature.ytDlpSignature = "old-binary-signature";
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");

    expect(_getPersistentPreviewMetadata("signature")).toBeNull();
    const refreshed = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    expect(refreshed.entries.signature).toBeUndefined();
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

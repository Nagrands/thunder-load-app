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

const fs = require("fs");
const os = require("os");
const path = require("path");
const storeHolder = {
  current: null,
  get(...args) {
    return this.current?.get?.(...args);
  },
};
const setSharedStore = (store) => {
  storeHolder.current = store;
};

const {
  selectFormatsByQuality,
  classifyYtDlpErrorMessage,
  makeYtDlpExitError,
  buildSubtitleDownloadArgs,
  buildYtDlpCookiesArgs,
  buildYtDlpVideoInfoArgs,
  buildYtDlpVideoPreviewArgs,
  findSubtitleOutputPath,
  getVideoInfoCacheTtl,
  getPersistentPreviewCachePath,
  getPersistentPreviewMetadata,
  normalizeSubtitleDownloadOptions,
  normalizeYtDlpCookiesSettings,
  resolveAvailableOutputPath,
  safeMoveFile,
  setPersistentPreviewMetadata,
} = require("../../app/download/engine").createDownloadEngine({
  store: storeHolder,
});

describe("download output collisions", () => {
  it("preserves existing files and moves output to the next available name", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "thunder-output-collision-"),
    );
    try {
      const target = path.join(tempDir, "video.mkv");
      const firstCollision = path.join(tempDir, "video (1).mkv");
      const source = path.join(tempDir, "combined.tmp.mkv");
      fs.writeFileSync(target, "original");
      fs.writeFileSync(firstCollision, "previous-copy");
      fs.writeFileSync(source, "new-download");

      expect(resolveAvailableOutputPath(target)).toBe(
        path.join(tempDir, "video (2).mkv"),
      );
      const movedPath = safeMoveFile(source, target);

      expect(movedPath).toBe(path.join(tempDir, "video (2).mkv"));
      expect(fs.readFileSync(target, "utf8")).toBe("original");
      expect(fs.readFileSync(firstCollision, "utf8")).toBe("previous-copy");
      expect(fs.readFileSync(movedPath, "utf8")).toBe("new-download");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("yt-dlp cookies args", () => {
  afterEach(() => {
    setSharedStore(null);
  });

  it("normalizes cookies settings and defaults to off", () => {
    expect(normalizeYtDlpCookiesSettings(null)).toEqual({
      mode: "off",
      browser: "chrome",
      filePath: "",
    });
    expect(
      normalizeYtDlpCookiesSettings({
        mode: "unknown",
        browser: "netscape",
        filePath: "bad\u0000path",
        extra: true,
      }),
    ).toEqual({
      mode: "off",
      browser: "chrome",
      filePath: "",
    });
  });

  it("does not add cookies args by default", () => {
    setSharedStore({
      get: jest.fn(() => ({ mode: "off", browser: "chrome", filePath: "" })),
    });

    expect(buildYtDlpCookiesArgs()).toEqual([]);
    expect(
      buildYtDlpVideoInfoArgs("https://youtube.com/watch?v=abc"),
    ).not.toContain("--cookies");
  });

  it("adds browser cookies args to info and preview calls", () => {
    setSharedStore({
      get: jest.fn(() => ({ mode: "browser", browser: "chrome" })),
    });

    expect(buildYtDlpCookiesArgs()).toEqual([
      "--cookies-from-browser",
      "chrome",
    ]);
    expect(buildYtDlpVideoInfoArgs("https://youtube.com/watch?v=abc")).toEqual(
      expect.arrayContaining(["--cookies-from-browser", "chrome"]),
    );
    expect(
      buildYtDlpVideoPreviewArgs("https://youtube.com/watch?v=abc"),
    ).toEqual(expect.arrayContaining(["--cookies-from-browser", "chrome"]));
  });

  it("does not add configured cookies args to non-YouTube urls", () => {
    setSharedStore({
      get: jest.fn(() => ({ mode: "browser", browser: "chrome" })),
    });

    expect(buildYtDlpVideoInfoArgs("https://example.com/video")).not.toContain(
      "--cookies-from-browser",
    );
    expect(
      buildYtDlpVideoPreviewArgs("https://example.com/video"),
    ).not.toContain("--cookies-from-browser");
  });

  it("adds cookies file args only for an existing absolute file", () => {
    const cookiesPath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "cookies-")),
      "cookies.txt",
    );
    fs.writeFileSync(cookiesPath, "# Netscape HTTP Cookie File\n");
    setSharedStore({
      get: jest.fn(() => ({
        mode: "file",
        browser: "chrome",
        filePath: cookiesPath,
      })),
    });

    expect(buildYtDlpCookiesArgs()).toEqual(["--cookies", cookiesPath]);
    expect(buildYtDlpVideoInfoArgs("https://youtube.com/watch?v=abc")).toEqual(
      expect.arrayContaining(["--cookies", cookiesPath]),
    );
  });

  it("skips invalid or missing cookies files", () => {
    setSharedStore({
      get: jest.fn(() => ({
        mode: "file",
        browser: "chrome",
        filePath: path.join(os.tmpdir(), "missing-cookies.txt"),
      })),
    });

    expect(buildYtDlpCookiesArgs()).toEqual([]);
  });
});

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

  it("returns empty media formats for subtitle-only selections", () => {
    const picked = selectFormatsByQuality([], {
      type: "subtitle-only",
      downloadKind: "subtitle",
      subtitleLang: "ru",
    });

    expect(picked).toMatchObject({
      videoFormat: null,
      audioFormat: null,
      resolution: "ru",
    });
  });
});

describe("subtitle download helpers", () => {
  it("builds manual subtitle-only yt-dlp args with SRT conversion", () => {
    expect(
      buildSubtitleDownloadArgs({ lang: "pt-BR", source: "manual" }),
    ).toEqual(
      expect.arrayContaining([
        "--skip-download",
        "--write-subs",
        "--sub-langs",
        "pt-BR",
        "--sub-format",
        "srt/vtt/best",
        "--convert-subs",
        "srt",
      ]),
    );
  });

  it("builds automatic subtitle args and falls back unsafe languages to English", () => {
    expect(
      normalizeSubtitleDownloadOptions({
        type: "subtitle-only",
        subtitleLang: "../../ru",
        subtitleSource: "automatic",
      }),
    ).toMatchObject({ lang: "en", source: "automatic", format: "srt" });

    expect(
      buildSubtitleDownloadArgs({ lang: "en", source: "automatic" }),
    ).toEqual(expect.arrayContaining(["--write-auto-subs"]));
    expect(
      buildSubtitleDownloadArgs({ lang: "en", source: "automatic" }),
    ).not.toContain("--write-subs");
  });

  it("downloads only the explicitly selected subtitle source", () => {
    const args = buildSubtitleDownloadArgs({
      lang: "zh-Hans",
      source: "manual",
    });

    expect(args).toEqual(expect.arrayContaining(["--write-subs"]));
    expect(args).not.toContain("--write-auto-subs");
    expect(args).toEqual(expect.arrayContaining(["--sub-langs", "zh-Hans"]));
  });

  it("finds the requested converted subtitle output by temp prefix", () => {
    const fs = require("fs");
    const path = require("path");
    const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "subs-"));
    const outputPath = path.join(dir, "subs_key.ru.srt");
    fs.writeFileSync(outputPath, "1\n00:00:00,000 --> 00:00:01,000\nText");

    expect(findSubtitleOutputPath(dir, "subs_key", "ru")).toBe(outputPath);
  });

  it("falls back to source subtitle artifacts when SRT was not produced", () => {
    const fs = require("fs");
    const path = require("path");
    const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "subs-"));
    const outputPath = path.join(dir, "subs_key.zh-Hans.vtt");
    fs.writeFileSync(outputPath, "WEBVTT\n\n00:00.000 --> 00:01.000\nText");

    expect(findSubtitleOutputPath(dir, "subs_key", "zh-Hans")).toBe(
      outputPath,
    );
  });

  it("finds yt-dlp automatic caption artifacts before conversion", () => {
    const fs = require("fs");
    const path = require("path");
    const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "subs-"));
    const outputPath = path.join(dir, "subs_key.pt-BR.json3");
    fs.writeFileSync(outputPath, '{"events":[]}');

    expect(findSubtitleOutputPath(dir, "subs_key", "pt-BR")).toBe(outputPath);
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
    const args = buildYtDlpVideoInfoArgs(
      "https://www.youtube.com/watch?v=abc123&list=PL123&index=2",
      "/tmp/ffmpeg",
    );

    expect(args).toContain("--no-playlist");
    expect(args).toEqual(
      expect.arrayContaining(["-J", "--ffmpeg-location", "/tmp/ffmpeg"]),
    );
  });

  it("keeps playlist URLs eligible for playlist extraction", () => {
    const args = buildYtDlpVideoInfoArgs(
      "https://www.youtube.com/playlist?list=PL123",
      "/tmp/ffmpeg",
    );

    expect(args).not.toContain("--no-playlist");
  });

  it("builds lightweight preview args without format checking", () => {
    const args = buildYtDlpVideoPreviewArgs(
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
    const args = buildYtDlpVideoPreviewArgs(
      "https://www.youtube.com/playlist?list=PL123",
      "/tmp/ffmpeg",
    );

    expect(args).toContain("--flat-playlist");
    expect(args).not.toContain("--no-playlist");
  });

  it("uses a longer cache TTL for normal videos and a short TTL for live videos", () => {
    expect(getVideoInfoCacheTtl({ is_live: false })).toBe(10 * 60 * 1000);
    expect(getVideoInfoCacheTtl({ is_live: true })).toBe(60 * 1000);
  });

  it("stores lightweight preview metadata in persistent cache without formats", () => {
    const fs = require("fs");
    const cachePath = getPersistentPreviewCachePath();
    try {
      fs.rmSync(cachePath, { force: true });
    } catch {}

    setPersistentPreviewMetadata("https://example.com/video", {
      title: "Preview title",
      thumbnail: "https://cdn.example.com/thumb.jpg",
      duration: 120,
      formats: [{ format_id: "18" }],
      thumbnails: [{ url: "https://cdn.example.com/1.jpg", width: 320 }],
    });

    const cached = getPersistentPreviewMetadata("https://example.com/video");

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
    const cachePath = getPersistentPreviewCachePath();
    try {
      fs.rmSync(cachePath, { force: true });
    } catch {}

    setPersistentPreviewMetadata("live", {
      title: "Live",
      is_live: true,
      thumbnail: "https://cdn.example.com/live.jpg",
    });
    setPersistentPreviewMetadata("playlist", {
      title: "Playlist",
      entries: [{ id: "1" }, { id: "2" }],
      thumbnail: "https://cdn.example.com/playlist.jpg",
      playlistDuration: 300,
    });

    expect(getPersistentPreviewMetadata("live")).toBeNull();
    expect(getPersistentPreviewMetadata("playlist")).toMatchObject({
      title: "Playlist",
      playlistCount: 2,
      playlistDuration: 300,
    });
    expect(getPersistentPreviewMetadata("playlist").entries).toBeUndefined();
  });

  it("invalidates persistent preview metadata after the preview TTL", () => {
    const fs = require("fs");
    const cachePath = getPersistentPreviewCachePath();
    try {
      fs.rmSync(cachePath, { force: true });
    } catch {}
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1000);

    try {
      setPersistentPreviewMetadata("ttl", {
        title: "TTL demo",
        thumbnail: "https://cdn.example.com/ttl.jpg",
      });

      nowSpy.mockReturnValue(1000 + 24 * 60 * 60 * 1000 + 1);
      expect(getPersistentPreviewMetadata("ttl")).toBeNull();

      const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      expect(cache.entries.ttl).toBeUndefined();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("invalidates persistent preview metadata when the yt-dlp signature changes", () => {
    const fs = require("fs");
    const cachePath = getPersistentPreviewCachePath();
    try {
      fs.rmSync(cachePath, { force: true });
    } catch {}

    setPersistentPreviewMetadata("signature", {
      title: "Signature demo",
      thumbnail: "https://cdn.example.com/signature.jpg",
    });

    const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    cache.entries.signature.ytDlpSignature = "old-binary-signature";
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");

    expect(getPersistentPreviewMetadata("signature")).toBeNull();
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
        { path: binaryPath, source: "test", executable: true },
      ]),
      resolveRuntimeBinaryDetails: jest.fn(() => ({
        path: binaryPath,
        source: "test",
        executable: true,
      })),
      prepareBinaryForExecution: jest.fn(),
      resolveRuntimeFfmpegDir: jest.fn(() => tmpDir),
    }));

    const mod = require("../../app/download/engine").createDownloadEngine();
    mod.resetYtDlpBinaryCache();

    await mod.resolveUsableYtDlpBinary();
    await mod.resolveUsableYtDlpBinary();

    expect(spawnMock).toHaveBeenCalledTimes(1);

    jest.dontMock("child_process");
    jest.dontMock("../../app/toolsPaths");
    jest.dontMock("../../app/runtimeTools");
  });

  it("skips blocked yt-dlp candidates during preflight", async () => {
    jest.resetModules();
    const { EventEmitter } = require("events");
    const fs = require("fs");
    const os = require("os");
    const path = require("path");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-dlp-blocked-"));
    const blockedPath = path.join(tmpDir, "blocked-yt-dlp");
    const binaryPath = path.join(tmpDir, "yt-dlp");
    fs.writeFileSync(blockedPath, "#!/usr/bin/python3\n");
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
        {
          path: blockedPath,
          source: "path",
          executable: false,
          blockedReason: "python-backed-yt-dlp",
        },
        { path: binaryPath, source: "default", executable: true },
      ]),
      resolveRuntimeBinaryDetails: jest.fn(() => ({
        path: binaryPath,
        source: "default",
        executable: true,
      })),
      prepareBinaryForExecution: jest.fn(),
      resolveRuntimeFfmpegDir: jest.fn(() => tmpDir),
    }));

    const mod = require("../../app/download/engine").createDownloadEngine();
    mod.resetYtDlpBinaryCache();

    const resolved = await mod.resolveUsableYtDlpBinary();

    expect(resolved).toEqual({ path: binaryPath, source: "default" });
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledWith(
      binaryPath,
      ["--version"],
      expect.any(Object),
    );

    jest.dontMock("child_process");
    jest.dontMock("../../app/toolsPaths");
    jest.dontMock("../../app/runtimeTools");
  });
});

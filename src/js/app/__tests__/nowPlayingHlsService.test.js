const { EventEmitter } = require("events");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Writable } = require("stream");

const {
  NowPlayingHlsService,
  buildFfmpegArgs,
  buildMultiAudioFfmpegArgs,
  getMultiAudioVideoProfiles,
  parseByteRange,
  validateInputs,
} = require("../nowPlayingHlsService");

function serveRequest(service, request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const response = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });
    response.statusCode = 0;
    response.headers = {};
    response.writeHead = (statusCode, headers = {}) => {
      response.statusCode = statusCode;
      response.headers = Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [
          key.toLowerCase(),
          value,
        ]),
      );
      return response;
    };
    response.on("finish", () =>
      resolve({
        body: Buffer.concat(chunks).toString("utf8"),
        headers: response.headers,
        statusCode: response.statusCode,
      }),
    );
    response.on("error", reject);
    void service.serve(request, response);
  });
}

describe("Now Playing HLS service", () => {
  test("accepts only one or two resolved HTTP inputs", () => {
    expect(validateInputs(["https://media.example/video"])).toEqual([
      "https://media.example/video",
    ]);
    expect(() => validateInputs(["file:///private/demo.mp4"])).toThrow(
      expect.objectContaining({ code: "INVALID_HLS_INPUT" }),
    );
    expect(validateInputs(["/private/demo.avi"], { allowLocal: true })).toEqual(
      ["/private/demo.avi"],
    );
    expect(() =>
      validateInputs(["https://one", "https://two", "https://three"]),
    ).toThrow(expect.objectContaining({ code: "INVALID_HLS_INPUT" }));
  });

  test("maps adaptive video and audio and uses copy for compatible codecs", () => {
    const args = buildFfmpegArgs({
      inputs: ["https://media.example/video", "https://media.example/audio"],
      copyCodecs: true,
      outputPath: "/tmp/player/index.m3u8",
    });

    expect(args).toEqual(
      expect.arrayContaining(["-map", "0:v:0", "1:a:0", "-c", "copy"]),
    );
    expect(args).not.toContain("libx264");
    expect(args).toEqual(
      expect.arrayContaining([
        "-hls_list_size",
        "0",
        "-hls_playlist_type",
        "event",
      ]),
    );
  });

  test("does not map a selected stream for local compatibility playback", () => {
    const args = buildFfmpegArgs({
      inputs: ["/media/movie.mkv"],
      copyCodecs: false,
      outputPath: "/tmp/player/index.m3u8",
    });

    expect(args).not.toContain("-map");
    expect(args).toEqual(expect.arrayContaining(["-c:a", "aac"]));
  });

  test("builds one master playlist with every transcoded audio rendition", () => {
    const args = buildMultiAudioFfmpegArgs({
      audioTracks: [
        { id: "audio-1", order: 0, codec: "ac3", isDefault: true },
        { id: "audio-2", order: 1, codec: "aac" },
        { id: "audio-3", order: 2, codec: "aac" },
      ],
      copyVideo: true,
      includeVideo: true,
      input: "/media/movie.mkv",
      outputPath: "/tmp/player/index.m3u8",
    });

    expect(args).toEqual(
      expect.arrayContaining([
        "-map",
        "0:v:0",
        "0:a:0",
        "0:a:1",
        "0:a:2",
        "-c:v",
        "copy",
        "-c:a:0",
        "aac",
        "-c:a:1",
        "copy",
        "-master_pl_name",
        "index.m3u8",
      ]),
    );
    expect(args).toEqual(
      expect.arrayContaining([
        "-readrate",
        "2",
        "-readrate_initial_burst",
        "12",
        "-readrate_catchup",
        "3",
        "-hls_flags",
        "single_file+independent_segments",
      ]),
    );
    expect(args).not.toContain("-hls_segment_filename");
    expect(args[args.indexOf("-var_stream_map") + 1]).toContain(
      "name:audio-1",
    );
    expect(args[args.indexOf("-var_stream_map") + 1]).toContain(
      "name:audio-3",
    );
  });

  test("seeks before paced input and bounds the software video encoder", () => {
    const software = getMultiAudioVideoProfiles({
      copyVideo: false,
      includeVideo: true,
      platform: "linux",
    });
    const args = buildMultiAudioFfmpegArgs({
      audioTracks: [
        { id: "audio-1", order: 0, codec: "ac3", isDefault: true },
        { id: "audio-2", order: 1, codec: "aac" },
      ],
      includeVideo: true,
      input: "/media/movie.mkv",
      outputPath: "/tmp/player/index.m3u8",
      startTime: 600,
      videoEncoderArgs: software[0].args,
    });

    expect(args.slice(args.indexOf("-ss"), args.indexOf("-i") + 1)).toEqual([
      "-ss",
      "600",
      "-readrate",
      "2",
      "-readrate_initial_burst",
      "12",
      "-readrate_catchup",
      "3",
      "-i",
    ]);
    expect(args).toEqual(
      expect.arrayContaining([
        "-c:v",
        "libx264",
        "-threads",
        "2",
      ]),
    );
  });

  test("orders platform hardware encoders before the software fallback", () => {
    expect(
      getMultiAudioVideoProfiles({
        copyVideo: false,
        includeVideo: true,
        platform: "darwin",
      }).map((profile) => profile.id),
    ).toEqual(["videotoolbox", "software"]);
    expect(
      getMultiAudioVideoProfiles({
        copyVideo: false,
        includeVideo: true,
        platform: "win32",
      }).map((profile) => profile.id),
    ).toEqual(["nvenc", "qsv", "amf", "software"]);
  });

  test("parses valid byte ranges and rejects unavailable offsets", () => {
    expect(parseByteRange("bytes=2-5", 10)).toEqual({ start: 2, end: 5 });
    expect(parseByteRange("bytes=-4", 10)).toEqual({ start: 6, end: 9 });
    expect(parseByteRange("bytes=10-", 10)).toBe(false);
    expect(parseByteRange("bytes=broken", 10)).toBe(false);
  });

  test("serves single-file HLS ranges and purges only orphan UUID caches", async () => {
    const cacheRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "now-playing-hls-range-"),
    );
    const orphanId = "12345678-1234-4123-8123-123456789abc";
    const retainedName = "keep-me";
    fs.mkdirSync(path.join(cacheRoot, orphanId));
    fs.mkdirSync(path.join(cacheRoot, retainedName));
    const service = new NowPlayingHlsService({
      cacheRoot,
      ffmpegPathResolver: () => "/tools/ffmpeg",
    });

    await service.purgeOrphanedSessions();
    expect(fs.existsSync(path.join(cacheRoot, orphanId))).toBe(false);
    expect(fs.existsSync(path.join(cacheRoot, retainedName))).toBe(true);

    const sessionId = "87654321-4321-4321-8321-cba987654321";
    const token = "a".repeat(48);
    const directory = path.join(cacheRoot, sessionId);
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "stream-0.ts"), "0123456789");
    service.sessions.set(sessionId, {
      child: null,
      createdAt: Date.now(),
      directory,
      id: sessionId,
      inputs: [],
      lastAccessedAt: Date.now(),
      token,
    });

    const url = `/${token}/${sessionId}/stream-0.ts`;
    await expect(
      serveRequest(service, {
        headers: { range: "bytes=2-5" },
        method: "GET",
        url,
      }),
    ).resolves.toMatchObject({
        body: "2345",
        headers: {
          "accept-ranges": "bytes",
          "content-range": "bytes 2-5/10",
        },
        statusCode: 206,
      });
    await expect(
      serveRequest(service, {
        headers: { range: "bytes=20-30" },
        method: "GET",
        url,
      }),
    ).resolves.toMatchObject({
        statusCode: 416,
      });

    await service.dispose();
    fs.rmSync(cacheRoot, { recursive: true, force: true });
  });

  test("serves tokenized manifests on loopback and cleans the session", async () => {
    const cacheRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "now-playing-hls-"),
    );
    const spawnProcess = jest.fn((_binary, args) => {
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      child.exitCode = null;
      child.kill = jest.fn(() => {
        child.exitCode = 0;
      });
      const manifestPath = args.at(-1);
      setTimeout(() => fs.writeFileSync(manifestPath, "#EXTM3U\n"), 1);
      return child;
    });
    const server = new EventEmitter();
    server.listen = jest.fn((_port, _host, callback) => callback());
    server.address = jest.fn(() => ({ port: 43123 }));
    server.close = jest.fn((callback) => callback());
    const service = new NowPlayingHlsService({
      cacheRoot,
      ffmpegPathResolver: () => "/tools/ffmpeg",
      spawnProcess,
      serverFactory: () => server,
    });

    const descriptor = await service.createSession({
      inputs: ["https://media.example/video"],
      copyCodecs: true,
    });
    expect(new URL(descriptor.src).hostname).toBe("127.0.0.1");
    expect(new URL(descriptor.src).port).toBe("43123");
    expect(service.getPreviewInputs(descriptor.sessionId)).toEqual([
      "https://media.example/video",
    ]);
    await expect(service.closeSession(descriptor.sessionId)).resolves.toBe(
      true,
    );
    expect(service.getPreviewInputs(descriptor.sessionId)).toEqual([]);
    expect(spawnProcess.mock.results[0].value.kill).toHaveBeenCalledWith(
      "SIGTERM",
    );
    await service.dispose();
    fs.rmSync(cacheRoot, { recursive: true, force: true });
  });

  test("starts one FFmpeg process for a multi-audio master session", async () => {
    const cacheRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "now-playing-hls-audio-"),
    );
    const spawnProcess = jest.fn((_binary, args) => {
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      child.exitCode = null;
      child.kill = jest.fn(() => {
        child.exitCode = 0;
      });
      const outputPattern = args.at(-1);
      const directory = path.dirname(outputPattern);
      const masterName = args[args.indexOf("-master_pl_name") + 1];
      setTimeout(
        () => fs.writeFileSync(path.join(directory, masterName), "#EXTM3U\n"),
        1,
      );
      return child;
    });
    const server = new EventEmitter();
    server.listen = jest.fn((_port, _host, callback) => callback());
    server.address = jest.fn(() => ({ port: 43125 }));
    server.close = jest.fn((callback) => callback());
    const service = new NowPlayingHlsService({
      cacheRoot,
      ffmpegPathResolver: () => "/tools/ffmpeg",
      spawnProcess,
      serverFactory: () => server,
    });

    const descriptor = await service.createSession({
      inputs: ["/media/movie.mkv"],
      allowLocal: true,
      multiAudioTracks: [
        { id: "audio-1", order: 0, codec: "ac3", isDefault: true },
        { id: "audio-2", order: 1, codec: "aac" },
      ],
      includeVideo: true,
      copyVideo: true,
    });

    expect(descriptor).toMatchObject({ kind: "hls" });
    expect(spawnProcess).toHaveBeenCalledTimes(1);
    expect(spawnProcess.mock.calls[0][1]).toContain("-var_stream_map");
    await service.dispose();
    fs.rmSync(cacheRoot, { recursive: true, force: true });
  });

  test("falls back from a failed hardware encoder to bounded software", async () => {
    const cacheRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "now-playing-hls-encoder-"),
    );
    const spawnProcess = jest.fn((_binary, args) => {
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      child.exitCode = spawnProcess.mock.calls.length === 1 ? 1 : null;
      child.kill = jest.fn(() => {
        child.exitCode = 0;
      });
      if (child.exitCode === null) {
        const outputPattern = args.at(-1);
        const directory = path.dirname(outputPattern);
        const masterName = args[args.indexOf("-master_pl_name") + 1];
        setTimeout(
          () => fs.writeFileSync(path.join(directory, masterName), "#EXTM3U\n"),
          1,
        );
      }
      return child;
    });
    const server = new EventEmitter();
    server.listen = jest.fn((_port, _host, callback) => callback());
    server.address = jest.fn(() => ({ port: 43126 }));
    server.close = jest.fn((callback) => callback());
    const service = new NowPlayingHlsService({
      cacheRoot,
      ffmpegPathResolver: () => "/tools/ffmpeg",
      platform: "darwin",
      spawnProcess,
      serverFactory: () => server,
    });

    await expect(
      service.createSession({
        inputs: ["/media/movie.mkv"],
        allowLocal: true,
        multiAudioTracks: [
          { id: "audio-1", order: 0, codec: "ac3", isDefault: true },
          { id: "audio-2", order: 1, codec: "aac" },
        ],
        includeVideo: true,
        copyVideo: false,
      }),
    ).resolves.toMatchObject({ kind: "hls" });

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    expect(spawnProcess.mock.calls[0][1]).toContain("h264_videotoolbox");
    expect(spawnProcess.mock.calls[1][1]).toEqual(
      expect.arrayContaining(["libx264", "-threads", "2"]),
    );

    await service.dispose();
    fs.rmSync(cacheRoot, { recursive: true, force: true });
  });

  test("supersedes an initializing session and keeps only one FFmpeg process", async () => {
    const cacheRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "now-playing-hls-"),
    );
    let spawnCount = 0;
    let markFirstSpawned;
    const firstSpawned = new Promise((resolve) => {
      markFirstSpawned = resolve;
    });
    const children = [];
    const spawnProcess = jest.fn((_binary, args) => {
      spawnCount += 1;
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      child.exitCode = null;
      child.kill = jest.fn(() => {
        child.exitCode = 0;
      });
      children.push(child);
      if (spawnCount === 1) markFirstSpawned();
      if (spawnCount === 2) {
        const manifestPath = args.at(-1);
        setTimeout(() => fs.writeFileSync(manifestPath, "#EXTM3U\n"), 1);
      }
      return child;
    });
    const server = new EventEmitter();
    server.listen = jest.fn((_port, _host, callback) => callback());
    server.address = jest.fn(() => ({ port: 43124 }));
    server.close = jest.fn((callback) => callback());
    const service = new NowPlayingHlsService({
      cacheRoot,
      ffmpegPathResolver: () => "/tools/ffmpeg",
      spawnProcess,
      serverFactory: () => server,
    });

    const first = service.createSession({
      inputs: ["https://media.example/first"],
      copyCodecs: true,
    });
    await firstSpawned;
    const second = service.createSession({
      inputs: ["https://media.example/second"],
      copyCodecs: true,
    });

    await expect(first).rejects.toMatchObject({
      code: "PLAYBACK_SESSION_CANCELLED",
    });
    await expect(second).resolves.toMatchObject({ kind: "hls" });
    expect(children[0].kill).toHaveBeenCalledWith("SIGTERM");
    expect(children.filter((child) => child.exitCode === null)).toHaveLength(1);
    expect(service.sessions).toHaveProperty("size", 1);

    await service.dispose();
    fs.rmSync(cacheRoot, { recursive: true, force: true });
  });
});

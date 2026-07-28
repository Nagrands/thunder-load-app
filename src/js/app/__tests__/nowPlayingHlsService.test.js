const { EventEmitter } = require("events");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  NowPlayingHlsService,
  buildFfmpegArgs,
  buildMultiAudioFfmpegArgs,
  validateInputs,
} = require("../nowPlayingHlsService");

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
        "-c:a",
        "aac",
        "-master_pl_name",
        "index.m3u8",
      ]),
    );
    expect(args[args.indexOf("-var_stream_map") + 1]).toContain(
      "name:audio-1",
    );
    expect(args[args.indexOf("-var_stream_map") + 1]).toContain(
      "name:audio-3",
    );
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

  test("supersedes an initializing session and keeps only one FFmpeg process", async () => {
    const cacheRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "now-playing-hls-"),
    );
    let spawnCount = 0;
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
    await new Promise((resolve) => setTimeout(resolve, 0));
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

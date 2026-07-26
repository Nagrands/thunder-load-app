const {
  MAX_AUDIO_TRACKS,
  NowPlayingAudioTracksService,
  PROBE_TIMEOUT_MS,
  normalizeAudioTracks,
} = require("../nowPlayingAudioTracksService");

const localTrack = {
  id: "local-demo",
  providerId: "local",
  sourceRef: "/media/demo.mkv",
};

describe("Now Playing audio tracks service", () => {
  test("normalizes safe audio metadata and limits the result", () => {
    const streams = Array.from({ length: MAX_AUDIO_TRACKS + 4 }, (_, index) => ({
      index,
      codec_type: "audio",
      codec_name: index === 0 ? "AAC" : "ac3",
      channels: index === 0 ? 2 : 6,
      channel_layout: index === 0 ? "stereo" : "5.1(side)",
      disposition: { default: index === 0 ? 1 : 0 },
      tags: {
        language: index === 0 ? "ENG" : "rus",
        title: index === 0 ? "Original\u0000" : `Dub ${index}`,
      },
    }));
    streams.unshift({ index: 100, codec_type: "video" });

    const tracks = normalizeAudioTracks({ streams });

    expect(tracks).toHaveLength(MAX_AUDIO_TRACKS);
    expect(tracks[0]).toEqual({
      id: "audio-0",
      index: 0,
      order: 0,
      title: "Original",
      language: "eng",
      codec: "aac",
      channels: 2,
      channelLayout: "stereo",
      isDefault: true,
    });
  });

  test("uses a stat-keyed LRU cache and re-probes a changed file", async () => {
    let mtimeMs = 1;
    const execFileProcess = jest.fn().mockResolvedValue({
      stdout: JSON.stringify({
        streams: [{ index: 2, codec_type: "audio", codec_name: "aac" }],
      }),
    });
    const service = new NowPlayingAudioTracksService({
      ffprobePathResolver: () => "/tools/ffprobe",
      execFileProcess,
      statFile: jest.fn(async () => ({
        isFile: () => true,
        size: 42,
        mtimeMs,
      })),
    });

    await service.getTracks(localTrack);
    await service.getTracks(localTrack);
    expect(execFileProcess).toHaveBeenCalledTimes(1);

    mtimeMs = 2;
    await service.getTracks(localTrack);
    expect(execFileProcess).toHaveBeenCalledTimes(2);
    expect(execFileProcess).toHaveBeenLastCalledWith(
      "/tools/ffprobe",
      expect.arrayContaining([
        "-show_entries",
        expect.stringContaining("stream=index"),
        "/media/demo.mkv",
      ]),
      expect.objectContaining({
        timeout: PROBE_TIMEOUT_MS,
        windowsHide: true,
      }),
    );
  });

  test("validates a selected audio id against probed streams", async () => {
    const service = new NowPlayingAudioTracksService({
      ffprobePathResolver: () => "/tools/ffprobe",
      execFileProcess: jest.fn().mockResolvedValue({
        stdout: JSON.stringify({
          streams: [{ index: 4, codec_type: "audio" }],
        }),
      }),
      statFile: jest.fn(async () => ({
        isFile: () => true,
        size: 42,
        mtimeMs: 1,
      })),
    });

    await expect(
      service.resolveStreamIndex(localTrack, "audio-4"),
    ).resolves.toBe(4);
    await expect(service.resolveStreamIndex(localTrack, null)).resolves.toBeNull();
    await expect(
      service.resolveStreamIndex(localTrack, "audio-3"),
    ).rejects.toMatchObject({ code: "AUDIO_TRACK_NOT_FOUND" });
    await expect(
      service.resolveStreamIndex(localTrack, "0:a:1"),
    ).rejects.toMatchObject({ code: "AUDIO_TRACK_NOT_FOUND" });
  });

  test("reports missing tools, files and probe timeouts safely", async () => {
    const missingTool = new NowPlayingAudioTracksService({
      ffprobePathResolver: () => "",
      statFile: jest.fn(async () => ({
        isFile: () => true,
        size: 1,
        mtimeMs: 1,
      })),
    });
    await expect(missingTool.getTracks(localTrack)).rejects.toMatchObject({
      code: "FFPROBE_UNAVAILABLE",
    });

    const missingFile = new NowPlayingAudioTracksService({
      ffprobePathResolver: () => "/tools/ffprobe",
      statFile: jest.fn().mockRejectedValue(new Error("ENOENT")),
    });
    await expect(missingFile.getTracks(localTrack)).rejects.toMatchObject({
      code: "TRACK_UNAVAILABLE",
    });

    const timeout = new NowPlayingAudioTracksService({
      ffprobePathResolver: () => "/tools/ffprobe",
      execFileProcess: jest.fn().mockRejectedValue(
        Object.assign(new Error("timeout"), { killed: true }),
      ),
      statFile: jest.fn(async () => ({
        isFile: () => true,
        size: 1,
        mtimeMs: 1,
      })),
    });
    await expect(timeout.getTracks(localTrack)).rejects.toMatchObject({
      code: "AUDIO_TRACKS_TIMEOUT",
    });
  });
});

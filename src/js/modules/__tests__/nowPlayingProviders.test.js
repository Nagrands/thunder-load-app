import LocalMusicProvider, {
  normalizeLocalTrack,
} from "../nowPlaying/localMusicProvider.js";
import MusicProviderRegistry from "../nowPlaying/providerRegistry.js";

describe("Now Playing providers", () => {
  test("normalizes metadata and deduplicates local paths", () => {
    const provider = new LocalMusicProvider({
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    });

    const playlist = provider.restore({
      tracks: [
        { sourceRef: "C:\\Music\\Demo.MP4", duration: "12.5" },
        { sourceRef: "c:/Music/Demo.MP4", title: "duplicate" },
        { sourceRef: "/music/song.mp3", available: false },
      ],
    });

    expect(playlist.tracks).toHaveLength(2);
    expect(playlist.tracks[0]).toMatchObject({
      title: "Demo",
      kind: "video",
      duration: 12.5,
      availability: "available",
    });
    expect(playlist.tracks[1].availability).toBe("missing");
  });

  test("merges structured import results without replacing the queue", async () => {
    const api = {
      importFiles: jest.fn().mockResolvedValue({
        success: true,
        data: {
          tracks: [
            {
              id: "second",
              sourceRef: "/music/second.mp3",
              title: "Second",
            },
          ],
        },
      }),
      importFolder: jest.fn(),
    };
    const provider = new LocalMusicProvider(api);
    provider.restore({
      tracks: [{ id: "first", sourceRef: "/music/first.mp3" }],
    });

    const playlist = await provider.importSource("files");

    expect(api.importFiles).toHaveBeenCalledTimes(1);
    expect(playlist.tracks.map((track) => track.id)).toEqual([
      "first",
      "second",
    ]);
  });

  test("resolves local files into playback DTOs and rejects missing tracks", async () => {
    const provider = new LocalMusicProvider({
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    });
    const playback = await provider.resolveTrack(
      normalizeLocalTrack({
        sourceRef: "/music/space song.mp3",
        artworkUrl: "file:///cover.jpg",
      }),
    );

    expect(playback).toEqual({
      src: "file:///music/space%20song.mp3",
      mimeType: "",
      posterUrl: "file:///cover.jpg",
    });
    await expect(
      provider.resolveTrack({
        sourceRef: "/music/gone.mp3",
        availability: "missing",
      }),
    ).rejects.toMatchObject({ code: "TRACK_UNAVAILABLE" });
  });

  test("registry validates and routes provider calls", async () => {
    const registry = new MusicProviderRegistry();
    expect(() => registry.register({ id: "broken" })).toThrow(
      "must implement importSource",
    );
    const provider = {
      id: "demo",
      importSource: jest.fn(),
      restore: jest.fn(),
      resolveTrack: jest.fn().mockResolvedValue({ src: "demo" }),
      dispose: jest.fn(),
    };
    registry.register(provider);

    await expect(
      registry.resolveTrack({ providerId: "demo", id: "track" }),
    ).resolves.toEqual({ src: "demo" });
    registry.dispose();
    expect(provider.dispose).toHaveBeenCalledTimes(1);
  });
});

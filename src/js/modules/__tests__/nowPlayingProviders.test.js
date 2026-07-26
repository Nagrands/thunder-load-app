import LocalMusicProvider, {
  normalizeLocalTrack,
} from "../nowPlaying/localMusicProvider.js";
import MusicProviderRegistry from "../nowPlaying/providerRegistry.js";
import YouTubeProvider, {
  canonicalizeYouTubeUrl,
  normalizeYouTubeTrack,
} from "../nowPlaying/youtubeProvider.js";

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

  test("normalizes extended video formats and V3 metadata", () => {
    expect(
      normalizeLocalTrack({
        sourceRef: "/media/archive.avi",
        displayTitle: "Archive",
        sizeBytes: "2048",
      }),
    ).toMatchObject({
      kind: "video",
      displayTitle: "Archive",
      sizeBytes: 2048,
      qualitySelection: null,
    });
    expect(normalizeLocalTrack({ sourceRef: "/media/movie.mpeg" }).kind).toBe(
      "video",
    );
  });

  test("merges structured import results without replacing the queue", async () => {
    const api = {
      importFiles: jest.fn().mockResolvedValue({
        success: true,
        data: {
          importedTrackIds: ["second"],
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
    expect(playlist.importedTrackIds).toEqual(["second"]);
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

  test("routes AVI/MPEG through the protected local HLS session", async () => {
    const api = {
      importFiles: jest.fn(),
      importFolder: jest.fn(),
      createLocalPlaybackSession: jest.fn().mockResolvedValue({
        success: true,
        data: {
          kind: "hls",
          sessionId: "session",
          src: "http://127.0.0.1/hls",
        },
      }),
      closePlaybackSession: jest.fn().mockResolvedValue({ success: true }),
    };
    const provider = new LocalMusicProvider(api);

    const playback = await provider.resolveTrack({
      sourceRef: "/media/archive.avi",
      availability: "available",
    });
    expect(api.createLocalPlaybackSession).toHaveBeenCalledWith({
      trackId: "local:/media/archive.avi",
    });
    expect(playback).toMatchObject({ kind: "hls", sessionId: "session" });
    await provider.releasePlayback(playback);
    expect(api.closePlaybackSession).toHaveBeenCalledWith("session");
  });

  test("keeps exact selected audio tracks on the direct local source", async () => {
    const api = {
      createLocalPlaybackSession: jest.fn().mockResolvedValue({
        success: true,
        data: { kind: "hls", sessionId: "audio", src: "http://127.0.0.1/hls" },
      }),
      getAudioTracks: jest.fn().mockResolvedValue({
        success: true,
        data: {
          tracks: [
            { id: "audio-1", order: 0, isDefault: true },
            { id: "audio-3", order: 1, isDefault: false },
          ],
        },
      }),
    };
    const provider = new LocalMusicProvider(api);

    const playback = await provider.resolveTrack({
      id: "movie",
      sourceRef: "/media/movie.mp4",
      availability: "available",
      selectedAudioTrackId: "audio-3",
    });

    expect(api.createLocalPlaybackSession).not.toHaveBeenCalled();
    expect(api.getAudioTracks).toHaveBeenCalledWith({ trackId: "movie" });
    expect(playback).toMatchObject({
      src: "file:///media/movie.mp4",
      nativeAudioTrackSelection: {
        selectedAudioTrackId: "audio-3",
        tracks: [
          { id: "audio-1", order: 0 },
          { id: "audio-3", order: 1 },
        ],
      },
    });
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

  test("canonicalizes and imports a single YouTube video", async () => {
    const api = {
      importYouTubeVideo: jest.fn().mockResolvedValue({
        success: true,
        data: {
          track: {
            videoId: "abcdefghijk",
            title: "Thunder video",
            channel: "Thunder",
            duration: 123,
            thumbnail: "https://img.example/cover.jpg",
          },
        },
      }),
      resolveYouTubeTrack: jest.fn(),
    };
    const provider = new YouTubeProvider(api);

    const track = await provider.importSource(
      "https://youtu.be/abcdefghijk?feature=shared",
    );

    expect(api.importYouTubeVideo).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=abcdefghijk",
    );
    expect(track).toEqual(
      expect.objectContaining({
        id: "youtube:abcdefghijk",
        providerId: "youtube",
        title: "Thunder video",
        artist: "Thunder",
        kind: "video",
      }),
    );
  });

  test("rejects YouTube playlist URLs and invalid hosts", () => {
    expect(() =>
      canonicalizeYouTubeUrl(
        "https://www.youtube.com/watch?v=abcdefghijk&list=PL123",
      ),
    ).toThrow(
      expect.objectContaining({ code: "YOUTUBE_PLAYLIST_UNSUPPORTED" }),
    );
    expect(() =>
      canonicalizeYouTubeUrl("https://example.com/watch?v=abcdefghijk"),
    ).toThrow(expect.objectContaining({ code: "INVALID_YOUTUBE_URL" }));
  });

  test("restores canonical YouTube tracks and resolves fresh playback URLs", async () => {
    const api = {
      importYouTubeVideo: jest.fn(),
      resolveYouTubeTrack: jest.fn().mockResolvedValue({
        success: true,
        data: {
          src: "https://stream.example/fresh",
          mimeType: "video/mp4",
        },
      }),
    };
    const provider = new YouTubeProvider(api);
    const track = normalizeYouTubeTrack({
      sourceRef: "https://youtu.be/abcdefghijk",
      title: "Video",
      playback: { src: "https://expired.example" },
    });

    expect(provider.restore({ tracks: [track, track] })).toHaveLength(1);
    await expect(provider.resolveTrack(track)).resolves.toEqual({
      src: "https://stream.example/fresh",
      mimeType: "video/mp4",
      posterUrl: "",
    });
    expect(api.resolveYouTubeTrack).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=abcdefghijk",
      { forceRefresh: false },
    );
  });

  test("surfaces structured YouTube resolve errors", async () => {
    const provider = new YouTubeProvider({
      importYouTubeVideo: jest.fn(),
      resolveYouTubeTrack: jest.fn().mockResolvedValue({
        success: false,
        error: { code: "YOUTUBE_PRIVATE", message: "Private video" },
      }),
    });

    await expect(
      provider.resolveTrack({
        providerId: "youtube",
        sourceRef: "https://youtu.be/abcdefghijk",
      }),
    ).rejects.toMatchObject({
      code: "YOUTUBE_PRIVATE",
      message: "Private video",
    });
  });
});

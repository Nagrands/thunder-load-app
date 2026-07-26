const path = require("path");

const {
  LIBRARY_PLAYLIST_ID,
  STATE_VERSION,
  sanitizeState,
} = require("../nowPlayingState");

describe("nowPlayingState", () => {
  test("migrates V2 state to V3 while preserving playlist selection", () => {
    const sourceRef = path.resolve("/media/song.mp3");
    const state = sanitizeState({
      version: 2,
      catalog: {
        tracks: [
          {
            id: "song",
            providerId: "local",
            sourceRef,
            title: "Metadata title",
            displayTitle: "My title",
            sizeBytes: "42",
            mediaInfo: {
              width: "1920",
              height: 1080.8,
              container: "mp4",
              videoCodec: "h264",
              audioCodec: "aac",
              ignored: "value",
            },
          },
        ],
      },
      playlists: [{ id: "mix", title: "Mix", trackIds: ["song"] }],
      activePlaylistId: "mix",
      selectedTrackId: "song",
    });

    expect(state).toMatchObject({
      version: STATE_VERSION,
      activePlaylistId: "mix",
      selectedTrackId: "song",
    });
    expect(state.catalog.tracks[0]).toMatchObject({
      displayTitle: "My title",
      sizeBytes: 42,
      qualitySelection: null,
      mediaInfo: {
        width: 1920,
        height: 1080,
        container: "mp4",
        videoCodec: "h264",
        audioCodec: "aac",
      },
    });
  });

  test("migrates legacy V1 tracks into the media library", () => {
    const sourceRef = path.resolve("/media/legacy.wav");
    const state = sanitizeState({
      version: 1,
      playlist: { tracks: [{ id: "legacy", sourceRef }] },
      currentTrackId: "legacy",
    });

    expect(state.version).toBe(3);
    expect(state.activePlaylistId).toBe(LIBRARY_PLAYLIST_ID);
    expect(state.selectedTrackId).toBe("legacy");
  });

  test("sanitizes YouTube quality selections and network tracks", () => {
    const state = sanitizeState({
      catalog: {
        tracks: [
          {
            providerId: "youtube",
            sourceRef: "https://youtu.be/abcdefghijk",
            qualitySelection: {
              mode: "audio",
              transientUrl: "https://expired.example",
            },
            sizeBytes: 1234,
          },
          {
            providerId: "network",
            sourceRef: "https://media.example/live/channel.m3u8",
            title: "Live",
          },
          {
            providerId: "network",
            sourceRef: "https://youtube.com/watch?v=abcdefghijk",
          },
        ],
      },
    });

    expect(state.catalog.tracks).toHaveLength(2);
    expect(state.catalog.tracks[0].qualitySelection).toEqual({
      mode: "audio",
      formatId: null,
      videoFormatId: null,
      audioFormatId: null,
    });
    expect(state.catalog.tracks[0]).toMatchObject({
      kind: "audio",
      mimeType: "audio/mp4",
    });
    expect(state.catalog.tracks[0].sizeBytes).toBe(1234);
    expect(state.catalog.tracks[1]).toMatchObject({
      providerId: "network",
      sourceRef: "https://media.example/live/channel.m3u8",
      displayTitle: "Live",
    });
  });
});

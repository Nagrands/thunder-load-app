import {
  createMediaLibraryModel,
  getActiveTracksFromState,
  MEDIA_LIBRARY_ID,
  normalizeMediaLibraryState,
} from "../nowPlaying/mediaLibraryModel.js";

const localTracks = [
  {
    id: "local-one",
    providerId: "local",
    sourceRef: "/media/one.mp3",
    title: "One",
  },
  {
    id: "local-two",
    providerId: "local",
    sourceRef: "/media/two.mp4",
    title: "Two",
  },
];

describe("Now Playing media library model", () => {
  test("migrates the V1 queue into the virtual media library", () => {
    const state = normalizeMediaLibraryState({
      version: 1,
      playlist: { tracks: localTracks },
      selectedTrackId: "local-two",
      volume: 0.4,
      backgroundPlayback: false,
    });

    expect(state).toMatchObject({
      version: 3,
      activePlaylistId: MEDIA_LIBRARY_ID,
      selectedTrackId: "local-two",
      volume: 0.4,
      backgroundPlayback: false,
      playlists: [],
    });
    expect(state.catalog.tracks.map((track) => track.id)).toEqual([
      "local-one",
      "local-two",
    ]);
    expect(getActiveTracksFromState(state)).toHaveLength(2);
  });

  test("sanitizes broken playlist references and falls back to the library", () => {
    const state = normalizeMediaLibraryState({
      version: 2,
      catalog: { tracks: localTracks },
      playlists: [
        {
          id: "mix",
          title: "Mix",
          trackIds: ["local-one", "missing", "local-one"],
        },
      ],
      activePlaylistId: "deleted-playlist",
      selectedTrackId: "missing",
    });

    expect(state.activePlaylistId).toBe(MEDIA_LIBRARY_ID);
    expect(state.selectedTrackId).toBeNull();
    expect(state.playlists[0].trackIds).toEqual(["local-one"]);
  });

  test("deduplicates local paths and YouTube videos by canonical video id", () => {
    const model = createMediaLibraryModel(
      {},
      { idFactory: () => "mix", now: () => 100 },
    );
    model.createPlaylist("Mix");
    model.setActivePlaylist("mix");

    const added = model.addTracks([
      localTracks[0],
      {
        id: "duplicate-local",
        providerId: "local",
        sourceRef: "/media/one.mp3",
      },
      {
        providerId: "youtube",
        sourceRef: "https://youtu.be/abcdefghijk",
        title: "Video",
      },
      {
        providerId: "youtube",
        sourceRef: "https://www.youtube.com/watch?v=abcdefghijk",
        title: "Duplicate video",
      },
    ]);

    expect(added).toEqual(["local-one", "youtube:abcdefghijk"]);
    expect(model.getState().catalog.tracks).toHaveLength(2);
    expect(model.getPlaylist("mix").trackIds).toEqual(added);
  });

  test("supports playlist CRUD, ordering and catalog deletion", () => {
    let sequence = 0;
    const model = createMediaLibraryModel(
      { version: 2, catalog: { tracks: localTracks } },
      {
        idFactory: () => `mix-${++sequence}`,
        now: () => 500,
      },
    );
    const playlist = model.createPlaylist("Road trip", {
      trackIds: ["local-one"],
    });

    expect(model.renamePlaylist(playlist.id, "Night drive")).toBe(true);
    expect(model.addTrackToPlaylist("local-two", playlist.id)).toBe(true);
    expect(model.addTrackToPlaylist("local-two", playlist.id)).toBe(false);
    expect(model.reorderTrack(playlist.id, "local-two", 0)).toBe(true);
    expect(model.getPlaylist(playlist.id)).toMatchObject({
      title: "Night drive",
      trackIds: ["local-two", "local-one"],
    });
    expect(model.renameTrack("local-one", "Renamed track")).toBe(true);
    expect(model.renameTrack("missing", "Ignored")).toBe(false);
    expect(model.setTrackAudioSelection("local-two", "audio-3")).toBe(true);
    expect(model.setTrackAudioSelection("local-two", "0:a:1")).toBe(false);
    expect(
      model.getState().catalog.tracks.find((track) => track.id === "local-one"),
    ).toMatchObject({ title: "One", displayTitle: "Renamed track" });
    expect(
      model.getState().catalog.tracks.find((track) => track.id === "local-two"),
    ).toMatchObject({ selectedAudioTrackId: "audio-3" });

    model.setActivePlaylist(playlist.id);
    expect(model.getActiveTracks().map((track) => track.id)).toEqual([
      "local-two",
      "local-one",
    ]);
    expect(model.deleteFromCatalog("local-two")).toBe(true);
    expect(model.getPlaylist(playlist.id).trackIds).toEqual(["local-one"]);
    expect(model.deletePlaylist(playlist.id)).toBe(true);
    expect(model.getState().activePlaylistId).toBe(MEDIA_LIBRARY_ID);
  });

  test("reorders the system media library without changing the selected track", () => {
    const model = createMediaLibraryModel({
      version: 3,
      catalog: { tracks: localTracks },
      activePlaylistId: MEDIA_LIBRARY_ID,
      selectedTrackId: "local-one",
    });

    expect(model.reorderTrack(MEDIA_LIBRARY_ID, "local-two", 0)).toBe(true);
    expect(model.getState().catalog.tracks.map((track) => track.id)).toEqual([
      "local-two",
      "local-one",
    ]);
    expect(model.getState().selectedTrackId).toBe("local-one");
  });

  test("returns defensive state copies", () => {
    const model = createMediaLibraryModel({
      version: 2,
      catalog: { tracks: localTracks },
    });
    const state = model.getState();

    state.catalog.tracks[0].title = "Changed";
    state.catalog.tracks.push({ id: "unexpected" });

    expect(model.getState().catalog.tracks[0].title).toBe("One");
    expect(model.getState().catalog.tracks).toHaveLength(2);
  });

  test("migrates V2 metadata and keeps the active network playlist", () => {
    const state = normalizeMediaLibraryState({
      version: 2,
      catalog: {
        tracks: [
          {
            providerId: "youtube",
            sourceRef: "https://youtu.be/abcdefghijk",
            title: "Video",
            displayTitle: "Custom video",
            sizeBytes: "2048",
            mediaInfo: {
              width: 1920,
              height: 1080,
              videoCodec: "avc1",
              audioCodec: "aac",
            },
            qualitySelection: {
              mode: "format",
              videoFormatId: "137",
              audioFormatId: "140",
            },
          },
          {
            id: "stream",
            providerId: "network",
            sourceRef: "https://media.example/live.m3u8",
            title: "Live",
          },
        ],
      },
      playlists: [
        { id: "streams", title: "Streams", trackIds: ["stream"] },
      ],
      activePlaylistId: "streams",
    });

    expect(state.version).toBe(3);
    expect(state.activePlaylistId).toBe("streams");
    expect(state.catalog.tracks[0]).toMatchObject({
      displayTitle: "Custom video",
      sizeBytes: 2048,
      qualitySelection: {
        mode: "format",
        videoFormatId: "137",
        audioFormatId: "140",
      },
      mediaInfo: {
        width: 1920,
        height: 1080,
        videoCodec: "avc1",
        audioCodec: "aac",
      },
    });
    expect(state.catalog.tracks[1]).toMatchObject({
      providerId: "network",
      displayTitle: "Live",
    });
  });

  test("returns defensive copies of quality selections", () => {
    const model = createMediaLibraryModel({
      catalog: {
        tracks: [
          {
            providerId: "youtube",
            sourceRef: "https://youtu.be/abcdefghijk",
            qualitySelection: { mode: "best" },
          },
        ],
      },
    });
    const state = model.getState();
    state.catalog.tracks[0].qualitySelection.mode = "audio";

    expect(model.getState().catalog.tracks[0].qualitySelection.mode).toBe(
      "best",
    );
  });
});

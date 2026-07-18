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
      version: 2,
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
});

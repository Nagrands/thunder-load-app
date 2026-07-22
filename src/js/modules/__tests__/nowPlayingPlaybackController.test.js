import PlaybackController from "../nowPlaying/playbackController.js";

function createMedia() {
  const media = document.createElement("video");
  media.load = jest.fn();
  media.pause = jest.fn();
  media.play = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(media, "duration", {
    configurable: true,
    writable: true,
    value: 120,
  });
  return media;
}

function createController(random = () => 0) {
  const mediaLayers = [createMedia(), createMedia()];
  const providers = {
    resolveTrack: jest.fn(async (track) => ({
      src: `file://${track.sourceRef}`,
      mimeType: "audio/mpeg",
      posterUrl: "",
    })),
  };
  const controller = new PlaybackController({
    providers,
    mediaLayers,
    random,
  });
  return { controller, mediaLayers, providers };
}

const tracks = [
  {
    id: "one",
    providerId: "local",
    sourceRef: "/one.mp3",
    title: "One",
    availability: "available",
  },
  {
    id: "two",
    providerId: "local",
    sourceRef: "/two.mp3",
    title: "Two",
    availability: "available",
  },
  {
    id: "three",
    providerId: "local",
    sourceRef: "/three.mp3",
    title: "Three",
    availability: "available",
  },
];

describe("Now Playing playback controller", () => {
  beforeEach(() => {
    jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  test("selects a track, swaps the reusable media layer and starts playback", async () => {
    const { controller, mediaLayers, providers } = createController();
    controller.setQueue(tracks);

    await controller.selectTrack("two");

    expect(providers.resolveTrack).toHaveBeenCalledWith(tracks[1], {
      forceRefresh: false,
    });
    expect(controller.currentTrack.id).toBe("two");
    expect(controller.activeLayerIndex).toBe(1);
    expect(mediaLayers[1].src).toContain("/two.mp3");
    expect(mediaLayers[1].play).toHaveBeenCalledTimes(1);
    expect(mediaLayers[0].muted).toBe(true);
  });

  test("supports previous, next, shuffle and repeat modes", async () => {
    const { controller } = createController(() => 0);
    controller.setQueue(tracks, { selectedTrackId: "two" });
    await controller.selectTrack("two", { autoplay: false });

    await controller.next();
    expect(controller.currentTrack.id).toBe("three");
    controller.cycleRepeat();
    expect(controller.repeat).toBe("one");
    controller.activeMedia.dispatchEvent(new Event("ended"));
    await Promise.resolve();
    expect(controller.currentTrack.id).toBe("three");

    controller.cycleRepeat();
    expect(controller.repeat).toBe("all");
    controller.cycleRepeat();
    controller.toggleShuffle();
    await controller.selectTrack("one", { autoplay: false });
    await controller.next();
    expect(controller.currentTrack.id).toBe("two");
  });

  test("persists selectedTrackId and settings but not playback position", () => {
    const { controller } = createController();
    controller.restoreState({
      playlist: { tracks },
      selectedTrackId: "two",
      volume: 0.4,
      muted: true,
      shuffle: true,
      repeat: "all",
    });
    controller.activeMedia.currentTime = 44;

    expect(controller.getPersistentState()).toMatchObject({
      selectedTrackId: "two",
      volume: 0.4,
      muted: true,
      shuffle: true,
      repeat: "all",
    });
    expect(controller.getPersistentState()).not.toHaveProperty("currentTime");
  });

  test("restores a V2 active playlist without taking ownership of library CRUD", () => {
    const { controller } = createController();
    controller.restoreState({
      version: 2,
      catalog: { tracks },
      playlists: [
        {
          id: "favorites",
          title: "Favorites",
          trackIds: ["three", "one"],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activePlaylistId: "favorites",
      selectedTrackId: "one",
      volume: 0.7,
      muted: false,
      shuffle: true,
      repeat: "all",
    });

    expect(controller.queue.map((track) => track.id)).toEqual(["three", "one"]);
    expect(controller.currentTrack.id).toBe("one");
    expect(controller.getPersistentState()).toMatchObject({
      version: 3,
      activePlaylistId: "favorites",
      selectedTrackId: "one",
      volume: 0.7,
      shuffle: true,
      repeat: "all",
    });
    expect(controller.getPersistentState().playlists[0].trackIds).toEqual([
      "three",
      "one",
    ]);
  });

  test("updates its queue from a library model state", () => {
    const { controller } = createController();
    controller.setQueue(tracks, { selectedTrackId: "two" });

    controller.setLibraryState({
      version: 2,
      catalog: { tracks },
      playlists: [
        {
          id: "short-list",
          title: "Short list",
          trackIds: ["two", "three"],
        },
      ],
      activePlaylistId: "short-list",
    });

    expect(controller.queue.map((track) => track.id)).toEqual(["two", "three"]);
    expect(controller.currentTrack.id).toBe("two");
  });

  test("pauses while hidden and resumes only when it was playing", async () => {
    const { controller } = createController();
    controller.setQueue(tracks);
    await controller.selectTrack("one");

    controller.suspend();
    expect(controller.isPlaying).toBe(false);
    expect(controller.isSuspended).toBe(true);
    await controller.resume();
    expect(controller.isPlaying).toBe(true);

    controller.pause();
    controller.suspend();
    await controller.resume();
    expect(controller.isPlaying).toBe(false);
  });

  test("does not auto-resume after an explicit pause while suspended", async () => {
    const { controller, mediaLayers } = createController();
    controller.setQueue(tracks);
    await controller.selectTrack("one");

    controller.suspend();
    controller.pause();
    mediaLayers[1].play.mockClear();
    await controller.resume();

    expect(controller.isPlaying).toBe(false);
    expect(mediaLayers[1].play).not.toHaveBeenCalled();
  });

  test("keeps the media session active on pause and reactivates it on play", async () => {
    const { controller } = createController();
    controller.setQueue(tracks);

    expect(controller.getSnapshot().isStopped).toBe(true);
    await controller.selectTrack("one");
    expect(controller.getSnapshot().isStopped).toBe(false);

    controller.pause();
    expect(controller.getSnapshot()).toMatchObject({
      isPlaying: false,
      isStopped: false,
    });

    await controller.play();
    expect(controller.getSnapshot()).toMatchObject({
      isPlaying: true,
      isStopped: false,
    });
  });

  test("stops playback, resets progress and cancels a pending track load", async () => {
    const { controller, mediaLayers, providers } = createController();
    controller.setQueue(tracks);
    await controller.selectTrack("one");
    let resolvePlayback;
    providers.resolveTrack.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePlayback = resolve;
        }),
    );

    const selection = controller.selectTrack("two");
    controller.activeMedia.currentTime = 48;
    controller.stop();

    expect(controller.currentTrack.id).toBe("two");
    expect(controller.getSnapshot()).toMatchObject({
      isPlaying: false,
      isStopped: true,
      isLoading: false,
      loadingTrackId: null,
      currentTime: 0,
    });
    expect(mediaLayers[1].pause).toHaveBeenCalled();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();

    resolvePlayback({
      src: "file:///two.mp3",
      mimeType: "audio/mpeg",
      posterUrl: "",
    });
    await expect(selection).resolves.toBe(false);
    expect(controller.activeLayerIndex).toBe(1);
    expect(controller.getSnapshot().isStopped).toBe(true);

    await controller.play();
    expect(controller.currentTrack.id).toBe("two");
    expect(controller.activeMedia.dataset.trackId).toBe("two");
    expect(controller.activeMedia.src).toContain("/two.mp3");
    expect(controller.getSnapshot()).toMatchObject({
      isPlaying: true,
      isStopped: false,
    });
  });

  test("marks explicit seeks for immediate external position updates", () => {
    const { controller } = createController();
    controller.setQueue(tracks);
    const initialRevision = controller.getSnapshot().positionRevision;

    controller.seek(12);

    expect(controller.getSnapshot()).toMatchObject({
      currentTime: 12,
      positionRevision: initialRevision + 1,
    });
  });

  test("ends the session at the natural end of the final track", async () => {
    const { controller } = createController();
    controller.setQueue(tracks, { selectedTrackId: "three" });
    await controller.selectTrack("three");
    controller.activeMedia.currentTime = 120;

    controller.activeMedia.dispatchEvent(new Event("ended"));
    await Promise.resolve();

    expect(controller.currentTrack.id).toBe("three");
    expect(controller.getSnapshot()).toMatchObject({
      isPlaying: false,
      isStopped: true,
      currentTime: 0,
    });
  });

  test("ends the session for an empty queue and active media errors", async () => {
    const { controller } = createController();
    controller.setQueue(tracks);
    await controller.selectTrack("one");

    controller.setQueue([]);
    expect(controller.getSnapshot()).toMatchObject({
      currentTrack: null,
      isPlaying: false,
      isStopped: true,
      currentTime: 0,
    });

    controller.setQueue(tracks);
    await controller.selectTrack("one");
    controller.activeMedia.dispatchEvent(new Event("error"));

    expect(controller.getSnapshot()).toMatchObject({
      isPlaying: false,
      isStopped: true,
      error: { code: "MEDIA_LOAD_FAILED" },
    });
  });

  test("ends playback state when disposed", async () => {
    const { controller, mediaLayers } = createController();
    controller.setQueue(tracks);
    await controller.selectTrack("one");

    controller.dispose();

    expect(controller.getSnapshot()).toMatchObject({
      isPlaying: false,
      isStopped: true,
      isLoading: false,
      loadingTrackId: null,
    });
    expect(mediaLayers[0].hasAttribute("src")).toBe(false);
    expect(mediaLayers[1].hasAttribute("src")).toBe(false);
  });

  test("keeps unavailable tracks selected and exposes a recoverable error", async () => {
    const { controller, providers } = createController();
    controller.setQueue([
      {
        ...tracks[0],
        availability: "missing",
      },
    ]);

    await expect(controller.selectTrack("one")).resolves.toBe(false);
    expect(controller.currentTrack.id).toBe("one");
    expect(controller.getSnapshot().error.code).toBe("TRACK_UNAVAILABLE");
    expect(controller.getSnapshot().isStopped).toBe(true);
    expect(providers.resolveTrack).not.toHaveBeenCalled();
  });

  test("shows a distinct loading state and pauses the old track while resolving", async () => {
    const { controller, mediaLayers, providers } = createController();
    controller.setQueue(tracks);
    await controller.selectTrack("one");
    let resolvePlayback;
    providers.resolveTrack.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePlayback = resolve;
        }),
    );

    const selection = controller.selectTrack("two");

    expect(controller.getSnapshot()).toMatchObject({
      currentTrack: { id: "two" },
      isPlaying: false,
      isLoading: true,
      loadingTrackId: "two",
    });
    expect(mediaLayers[1].pause).toHaveBeenCalled();

    resolvePlayback({
      src: "file:///two.mp3",
      mimeType: "audio/mpeg",
      posterUrl: "",
    });
    await selection;

    expect(controller.getSnapshot()).toMatchObject({
      currentTrack: { id: "two" },
      isPlaying: true,
      isLoading: false,
      loadingTrackId: null,
    });
  });

  test("requests a forced refresh only when retrying playback", async () => {
    const { controller, providers } = createController();
    controller.setQueue(tracks);
    await controller.selectTrack("one", { autoplay: false });
    providers.resolveTrack.mockClear();

    await controller.retry();

    expect(providers.resolveTrack).toHaveBeenCalledWith(tracks[0], {
      forceRefresh: true,
    });
  });
});

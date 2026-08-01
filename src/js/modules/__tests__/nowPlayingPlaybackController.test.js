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

function exposeAudioTracks(media, count = 2, enabledOrder = 0) {
  const audioTracks = Array.from({ length: count }, (_, index) => ({
    enabled: index === enabledOrder,
  }));
  Object.defineProperty(media, "audioTracks", {
    configurable: true,
    value: audioTracks,
  });
  return audioTracks;
}

function createController(random = () => 0, { hlsLoader = undefined } = {}) {
  const mediaLayers = [createMedia(), createMedia()];
  const providers = {
    resolveTrack: jest.fn(async (track) => ({
      src: `file://${track.sourceRef}`,
      mimeType: "audio/mpeg",
      posterUrl: "",
    })),
    releasePlayback: jest.fn(async () => {}),
  };
  const controller = new PlaybackController({
    providers,
    mediaLayers,
    random,
    ...(hlsLoader ? { hlsLoader } : {}),
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

async function flushPlaybackCleanup() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("Now Playing playback controller", () => {
  beforeEach(() => {
    jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  test("reports the buffered range without mutating playback position", () => {
    const { controller, mediaLayers } = createController();
    controller.setQueue(tracks);
    mediaLayers[0].currentTime = 12;
    Object.defineProperty(mediaLayers[0], "buffered", {
      configurable: true,
      value: { length: 1, end: jest.fn(() => 48) },
    });

    expect(controller.getSnapshot()).toMatchObject({
      bufferedEnd: 48,
      currentTime: 12,
    });
  });

  test("reports absolute time and buffer for a restarted HLS timeline", () => {
    const { controller, mediaLayers } = createController();
    controller.setQueue([{ ...tracks[0], duration: 1200 }]);
    const media = mediaLayers[0];
    media.dataset.trackId = "one";
    media.currentTime = 5;
    Object.defineProperty(media, "buffered", {
      configurable: true,
      value: { length: 1, end: jest.fn(() => 20) },
    });
    controller.layerPlaybacks[0] = {
      playback: {
        kind: "hls",
        sourceDuration: 1200,
        timelineOffset: 600,
      },
      track: controller.currentTrack,
    };

    expect(controller.getSnapshot()).toMatchObject({
      bufferedEnd: 620,
      currentTime: 605,
      duration: 1200,
    });
  });

  test("selects a track, swaps the reusable media layer and starts playback", async () => {
    const { controller, mediaLayers, providers } = createController();
    controller.setQueue(tracks);

    await controller.selectTrack("two");

    expect(providers.resolveTrack).toHaveBeenCalledWith(
      tracks[1],
      expect.objectContaining({
        forceRefresh: false,
        signal: expect.any(AbortSignal),
      }),
    );
    expect(controller.currentTrack.id).toBe("two");
    expect(controller.activeLayerIndex).toBe(1);
    expect(mediaLayers[1].src).toContain("/two.mp3");
    expect(mediaLayers[1].play).toHaveBeenCalledTimes(1);
    expect(mediaLayers[0].muted).toBe(true);
  });

  test("classifies the loaded media by its actual video track", async () => {
    const { controller, mediaLayers } = createController();
    const audioOnlyMp4 = {
      ...tracks[0],
      kind: "video",
      sourceRef: "/audio-only.mp4",
      mediaInfo: { videoCodec: "", audioCodec: "aac" },
    };
    controller.setQueue([audioOnlyMp4]);
    await controller.selectTrack(audioOnlyMp4.id, { autoplay: false });
    const media = mediaLayers[controller.activeLayerIndex];
    Object.defineProperties(media, {
      readyState: { configurable: true, value: 1 },
      videoHeight: { configurable: true, value: 0 },
      videoWidth: { configurable: true, value: 0 },
    });
    media.dispatchEvent(new Event("loadedmetadata"));

    expect(controller.getSnapshot()).toMatchObject({
      mediaReady: true,
      hasVideoTrack: false,
      visualizerAnalysisAllowed: true,
    });

    Object.defineProperties(media, {
      videoHeight: { configurable: true, value: 1080 },
      videoWidth: { configurable: true, value: 1920 },
    });
    media.dispatchEvent(new Event("loadedmetadata"));
    expect(controller.getSnapshot().hasVideoTrack).toBe(true);
  });

  test("marks direct network media as unsafe for Web Audio analysis", async () => {
    const { controller, mediaLayers } = createController();
    const networkTrack = {
      ...tracks[0],
      providerId: "network",
      sourceRef: "https://media.example/song.mp3",
    };
    controller.setQueue([networkTrack]);
    await controller.selectTrack(networkTrack.id, { autoplay: false });
    const media = mediaLayers[controller.activeLayerIndex];
    Object.defineProperties(media, {
      readyState: { configurable: true, value: 1 },
      videoHeight: { configurable: true, value: 0 },
      videoWidth: { configurable: true, value: 0 },
    });
    media.dispatchEvent(new Event("loadedmetadata"));

    expect(controller.getSnapshot()).toMatchObject({
      mediaReady: true,
      hasVideoTrack: false,
      visualizerAnalysisAllowed: false,
    });
  });

  test("switches native audio without loading, seeking or restarting playback", async () => {
    const { controller, mediaLayers, providers } = createController();
    const nativeTracks = exposeAudioTracks(mediaLayers[1]);
    controller.setQueue(tracks);
    await controller.selectTrack("one");
    mediaLayers[1].currentTime = 38.5;
    mediaLayers[1].load.mockClear();
    mediaLayers[1].play.mockClear();
    const selectionVersion = controller.selectionVersion;

    const result = controller.selectNativeAudioTrack({
      audioTrackId: "audio-4",
      tracks: [
        { id: "audio-2", order: 0, isDefault: true },
        { id: "audio-4", order: 1, isDefault: false },
      ],
    });

    expect(result).toEqual({
      success: true,
      audioTrackId: "audio-4",
      order: 1,
    });
    expect(nativeTracks.map((track) => track.enabled)).toEqual([false, true]);
    expect(mediaLayers[1].currentTime).toBe(38.5);
    expect(mediaLayers[1].duration).toBe(120);
    expect(mediaLayers[1].load).not.toHaveBeenCalled();
    expect(mediaLayers[1].play).not.toHaveBeenCalled();
    expect(providers.resolveTrack).toHaveBeenCalledTimes(1);
    expect(controller.selectionVersion).toBe(selectionVersion);
    expect(controller.currentTrack.selectedAudioTrackId).toBe("audio-4");
  });

  test("switches fallback HLS audio without reloading or restarting playback", async () => {
    const { controller, mediaLayers, providers } = createController();
    const trackMetadata = [
      { id: "audio-1", order: 0, codec: "ac3", isDefault: true },
      { id: "audio-2", order: 1, codec: "aac" },
    ];
    controller.setQueue(tracks);
    await controller.selectTrack("one");
    const activeIndex = controller.activeLayerIndex;
    const media = mediaLayers[activeIndex];
    media.currentTime = 38.5;
    media.load.mockClear();
    media.play.mockClear();
    controller.layerPlaybacks[activeIndex].playback = {
      kind: "hls",
      hlsAudioTrackSelection: {
        selectedAudioTrackId: null,
        tracks: trackMetadata,
      },
    };
    const hls = {
      audioTrack: 0,
      audioTracks: [{ name: "audio-1" }, { name: "audio-2" }],
    };
    controller.hlsInstances[activeIndex] = hls;

    const result = controller.selectNativeAudioTrack({
      audioTrackId: "audio-2",
      tracks: trackMetadata,
    });

    expect(result).toMatchObject({
      success: true,
      audioTrackId: "audio-2",
      hlsOrder: 1,
    });
    expect(hls.audioTrack).toBe(1);
    expect(media.currentTime).toBe(38.5);
    expect(media.load).not.toHaveBeenCalled();
    expect(media.play).not.toHaveBeenCalled();
    expect(providers.resolveTrack).toHaveBeenCalledTimes(1);
    expect(controller.currentTrack.selectedAudioTrackId).toBe("audio-2");

    hls.audioTracks = [{ name: "audio_0" }, { name: "audio_1" }];
    expect(
      controller.selectNativeAudioTrack({
        audioTrackId: "audio-1",
        tracks: trackMetadata,
      }),
    ).toMatchObject({ success: true, hlsOrder: 0 });
    expect(hls.audioTrack).toBe(0);
  });

  test("returns to the probed default native audio track", async () => {
    const { controller, mediaLayers } = createController();
    const nativeTracks = exposeAudioTracks(mediaLayers[1], 3, 2);
    controller.setQueue(tracks);
    await controller.selectTrack("one", { autoplay: false });

    const result = controller.selectNativeAudioTrack({
      audioTrackId: null,
      tracks: [
        { id: "audio-1", order: 0 },
        { id: "audio-3", order: 1, isDefault: true },
        { id: "audio-4", order: 2 },
      ],
    });

    expect(result.success).toBe(true);
    expect(nativeTracks.map((track) => track.enabled)).toEqual([
      false,
      true,
      false,
    ]);
    expect(controller.currentTrack.selectedAudioTrackId).toBeNull();
    expect(mediaLayers[1].play).not.toHaveBeenCalled();
  });

  test("applies rapid native selections synchronously with the last one active", async () => {
    const { controller, mediaLayers, providers } = createController();
    const nativeTracks = exposeAudioTracks(mediaLayers[1], 3);
    controller.setQueue(tracks);
    await controller.selectTrack("one");
    mediaLayers[1].currentTime = 18;
    mediaLayers[1].load.mockClear();
    mediaLayers[1].play.mockClear();
    const trackMetadata = [
      { id: "audio-1", order: 0, isDefault: true },
      { id: "audio-2", order: 1 },
      { id: "audio-3", order: 2 },
    ];
    const startedAt = performance.now();

    controller.selectNativeAudioTrack({
      audioTrackId: "audio-2",
      tracks: trackMetadata,
    });
    const result = controller.selectNativeAudioTrack({
      audioTrackId: "audio-3",
      tracks: trackMetadata,
    });

    expect(performance.now() - startedAt).toBeLessThan(250);
    expect(result.success).toBe(true);
    expect(nativeTracks.map((track) => track.enabled)).toEqual([
      false,
      false,
      true,
    ]);
    expect(mediaLayers[1].currentTime).toBe(18);
    expect(mediaLayers[1].load).not.toHaveBeenCalled();
    expect(mediaLayers[1].play).not.toHaveBeenCalled();
    expect(providers.resolveTrack).toHaveBeenCalledTimes(1);
  });

  test("blocks mismatched and compatibility audio track lists", async () => {
    const { controller, mediaLayers } = createController();
    exposeAudioTracks(mediaLayers[1], 2);
    controller.setQueue(tracks);
    await controller.selectTrack("one", { autoplay: false });

    expect(
      controller.selectNativeAudioTrack({
        audioTrackId: "audio-1",
        tracks: [{ id: "audio-1", order: 0 }],
      }),
    ).toMatchObject({
      success: false,
      code: "AUDIO_TRACKS_NATIVE_MISMATCH",
    });

    controller.hlsInstances[controller.activeLayerIndex] = {};
    expect(controller.getNativeAudioTrackState()).toMatchObject({
      supported: false,
      code: "AUDIO_TRACKS_FALLBACK_UNSUPPORTED",
    });
  });

  test("rolls back native flags when an audio track setter fails", async () => {
    const { controller, mediaLayers } = createController();
    const first = { enabled: true };
    let secondEnabled = false;
    const second = {};
    Object.defineProperty(second, "enabled", {
      configurable: true,
      get: () => secondEnabled,
      set: () => {
        throw new Error("native setter failed");
      },
    });
    Object.defineProperty(mediaLayers[1], "audioTracks", {
      configurable: true,
      value: [first, second],
    });
    controller.setQueue(tracks);
    await controller.selectTrack("one", { autoplay: false });

    expect(
      controller.selectNativeAudioTrack({
        audioTrackId: "audio-2",
        tracks: [
          { id: "audio-1", order: 0, isDefault: true },
          { id: "audio-2", order: 1 },
        ],
      }),
    ).toMatchObject({
      success: false,
      code: "AUDIO_TRACK_SWITCH_FAILED",
    });
    expect(first.enabled).toBe(true);
    expect(secondEnabled).toBe(false);
    expect(controller.currentTrack.selectedAudioTrackId).toBeUndefined();
  });

  test("applies a persisted native audio track before initial autoplay", async () => {
    const { controller, mediaLayers, providers } = createController();
    const nativeTracks = exposeAudioTracks(mediaLayers[1]);
    providers.resolveTrack.mockResolvedValue({
      src: "file:///one.mkv",
      nativeAudioTrackSelection: {
        selectedAudioTrackId: "audio-7",
        tracks: [
          { id: "audio-2", order: 0, isDefault: true },
          { id: "audio-7", order: 1 },
        ],
      },
    });
    mediaLayers[1].play.mockImplementation(async () => {
      expect(nativeTracks[1].enabled).toBe(true);
    });
    controller.setQueue([{ ...tracks[0], selectedAudioTrackId: "audio-7" }]);

    const selection = controller.selectTrack("one");
    await flushPlaybackCleanup();
    expect(mediaLayers[1].play).not.toHaveBeenCalled();
    mediaLayers[1].dispatchEvent(new Event("loadedmetadata"));
    await selection;

    expect(nativeTracks.map((track) => track.enabled)).toEqual([false, true]);
    expect(mediaLayers[1].play).toHaveBeenCalledTimes(1);
  });

  test("waits for HLS metadata without requiring media.src", async () => {
    const operationOrder = [];
    class DeferredHls {
      static Events = {
        AUDIO_TRACKS_UPDATED: "audioTracksUpdated",
        MEDIA_ATTACHED: "mediaAttached",
        MANIFEST_PARSED: "manifestParsed",
        ERROR: "error",
      };

      static instances = [];

      static isSupported() {
        return true;
      }

      constructor() {
        this.handlers = new Map();
        DeferredHls.instances.push(this);
      }

      on(eventName, handler) {
        const handlers = this.handlers.get(eventName) || new Set();
        handlers.add(handler);
        this.handlers.set(eventName, handlers);
      }

      off(eventName, handler) {
        this.handlers.get(eventName)?.delete(handler);
      }

      emit(eventName, data) {
        this.handlers
          .get(eventName)
          ?.forEach((handler) => handler(eventName, data));
      }

      attachMedia(media) {
        this.media = media;
        queueMicrotask(() => this.emit(DeferredHls.Events.MEDIA_ATTACHED));
      }

      loadSource(src) {
        operationOrder.push("load-source");
        this.source = src;
      }

      destroy() {}
    }

    const { controller, mediaLayers, providers } = createController(() => 0, {
      hlsLoader: async () => DeferredHls,
    });
    providers.resolveTrack.mockResolvedValue({
      kind: "hls",
      src: "http://127.0.0.1/playback/master.m3u8",
      posterUrl: "",
    });
    mediaLayers[1].play.mockImplementation(async () => {
      operationOrder.push(`play-at-${mediaLayers[1].currentTime}`);
    });
    controller.setQueue(tracks);

    const selection = controller.selectTrack("one", { startTime: 42 });
    await flushPlaybackCleanup();

    expect(DeferredHls.instances).toHaveLength(1);
    expect(operationOrder).toEqual(["load-source"]);
    expect(mediaLayers[1].play).not.toHaveBeenCalled();

    DeferredHls.instances[0].emit(DeferredHls.Events.MANIFEST_PARSED);
    await Promise.resolve();
    expect(mediaLayers[1].play).not.toHaveBeenCalled();
    expect(mediaLayers[1].src).toBe("");

    mediaLayers[1].dispatchEvent(new Event("loadedmetadata"));
    await selection;

    expect(operationOrder).toEqual(["load-source", "play-at-42"]);
    expect(providers.resolveTrack).toHaveBeenCalledTimes(1);
    expect(DeferredHls.instances).toHaveLength(1);
    expect(controller.getSnapshot().error).toBeNull();
  });

  test("restores a persisted HLS audio rendition before autoplay", async () => {
    class MultiAudioHls {
      static Events = {
        AUDIO_TRACKS_UPDATED: "audioTracksUpdated",
        MEDIA_ATTACHED: "mediaAttached",
        MANIFEST_PARSED: "manifestParsed",
        ERROR: "error",
      };

      static instances = [];

      static isSupported() {
        return true;
      }

      constructor() {
        this.handlers = new Map();
        this.audioTrack = 0;
        this.audioTracks = [];
        MultiAudioHls.instances.push(this);
      }

      on(eventName, handler) {
        const handlers = this.handlers.get(eventName) || new Set();
        handlers.add(handler);
        this.handlers.set(eventName, handlers);
      }

      off(eventName, handler) {
        this.handlers.get(eventName)?.delete(handler);
      }

      emit(eventName, data) {
        this.handlers
          .get(eventName)
          ?.forEach((handler) => handler(eventName, data));
      }

      attachMedia(media) {
        this.media = media;
        queueMicrotask(() => this.emit(MultiAudioHls.Events.MEDIA_ATTACHED));
      }

      loadSource() {}
      destroy() {}
    }

    const { controller, mediaLayers, providers } = createController(() => 0, {
      hlsLoader: async () => MultiAudioHls,
    });
    providers.resolveTrack.mockResolvedValue({
      kind: "hls",
      src: "http://127.0.0.1/playback/index.m3u8",
      hlsAudioTrackSelection: {
        selectedAudioTrackId: "audio-3",
        tracks: [
          { id: "audio-1", order: 0, isDefault: true },
          { id: "audio-2", order: 1 },
          { id: "audio-3", order: 2 },
        ],
      },
    });
    mediaLayers[1].play.mockImplementation(async () => {
      expect(MultiAudioHls.instances[0].audioTrack).toBe(2);
    });
    controller.setQueue([{ ...tracks[0], selectedAudioTrackId: "audio-3" }]);

    const selection = controller.selectTrack("one");
    await flushPlaybackCleanup();
    MultiAudioHls.instances[0].emit(MultiAudioHls.Events.MANIFEST_PARSED);
    mediaLayers[1].dispatchEvent(new Event("loadedmetadata"));
    await Promise.resolve();
    expect(mediaLayers[1].play).not.toHaveBeenCalled();
    MultiAudioHls.instances[0].audioTracks = [
      { name: "audio_1" },
      { name: "audio_2" },
      { name: "audio_3" },
    ];
    MultiAudioHls.instances[0].emit(MultiAudioHls.Events.AUDIO_TRACKS_UPDATED);
    await selection;

    expect(mediaLayers[1].play).toHaveBeenCalledTimes(1);
    expect(controller.getNativeAudioTrackState()).toMatchObject({
      supported: true,
      count: 3,
      enabledOrder: 2,
      mode: "hls",
    });
  });

  test("retries an interrupted play once after media becomes ready", async () => {
    const { controller, mediaLayers } = createController();
    const interrupted = new DOMException(
      "The play() request was interrupted by a new load request.",
      "AbortError",
    );
    mediaLayers[1].play
      .mockRejectedValueOnce(interrupted)
      .mockResolvedValueOnce(undefined);
    controller.setQueue(tracks);

    const selection = controller.selectTrack("one");
    await flushPlaybackCleanup();

    expect(mediaLayers[1].play).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().error).toBeNull();

    mediaLayers[1].dispatchEvent(new Event("canplay"));
    await selection;

    expect(mediaLayers[1].play).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toMatchObject({
      isPlaying: true,
      isLoading: false,
      error: null,
    });
  });

  test("returns a sanitized terminal error when the play retry fails", async () => {
    const { controller, mediaLayers } = createController();
    mediaLayers[1].play
      .mockRejectedValueOnce(
        new DOMException(
          "The play() request was interrupted by a new load request. https://goo.gl/LdLk22",
          "AbortError",
        ),
      )
      .mockRejectedValueOnce(new Error("Media pipeline reset"));
    controller.setQueue(tracks);

    const selection = controller.selectTrack("one");
    await flushPlaybackCleanup();
    mediaLayers[1].dispatchEvent(new Event("canplay"));

    await expect(selection).resolves.toBe(false);
    expect(mediaLayers[1].play).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().error).toEqual({
      code: "PLAYBACK_RESTART_FAILED",
      message: "Unable to resume playback after changing media source",
    });
    expect(controller.getSnapshot().error.message).not.toContain("goo.gl");
  });

  test("does not retry an interrupted play after the session is replaced", async () => {
    const { controller, mediaLayers } = createController();
    mediaLayers[1].play.mockRejectedValueOnce(
      new DOMException(
        "The play() request was interrupted by a new load request.",
        "AbortError",
      ),
    );
    controller.setQueue(tracks);

    const firstSelection = controller.selectTrack("one");
    await flushPlaybackCleanup();
    expect(mediaLayers[1].play).toHaveBeenCalledTimes(1);

    const secondSelection = controller.selectTrack("two");
    await expect(firstSelection).resolves.toBe(false);
    await expect(secondSelection).resolves.toBe(true);
    mediaLayers[1].dispatchEvent(new Event("canplay"));

    expect(mediaLayers[1].play).toHaveBeenCalledTimes(1);
    expect(controller.currentTrack.id).toBe("two");
    expect(controller.getSnapshot().error).toBeNull();
  });

  test("restores playback position while preserving a paused state", async () => {
    const { controller } = createController();
    controller.setQueue(tracks);

    await controller.selectTrack("one", {
      autoplay: false,
      forceRefresh: true,
      startTime: 42,
    });

    expect(controller.activeMedia.currentTime).toBe(42);
    expect(controller.getSnapshot()).toMatchObject({
      currentTime: 42,
      isPlaying: false,
      isLoading: false,
    });
    controller.activeMedia.currentTime = 0;
    controller.activeMedia.dispatchEvent(new Event("loadedmetadata"));
    expect(controller.activeMedia.currentTime).toBe(42);
  });

  test("supports previous, next, shuffle and repeat modes", async () => {
    const { controller } = createController(() => 0);
    controller.setQueue(tracks, { selectedTrackId: "two" });
    await controller.selectTrack("two", { autoplay: false });

    await controller.next();
    expect(controller.currentTrack.id).toBe("three");
    controller.cycleRepeat();
    expect(controller.repeat).toBe("all");
    controller.cycleRepeat();
    expect(controller.repeat).toBe("one");
    controller.activeMedia.dispatchEvent(new Event("ended"));
    await Promise.resolve();
    expect(controller.currentTrack.id).toBe("three");

    controller.cycleRepeat();
    expect(controller.repeat).toBe("off");
    controller.toggleShuffle();
    await controller.selectTrack("one", { autoplay: false });
    await controller.next();
    expect(controller.currentTrack.id).toBe("two");
  });

  test("applies explicit playback preferences in one snapshot update", () => {
    const { controller, mediaLayers } = createController();
    const listener = jest.fn();
    controller.subscribe(listener);
    listener.mockClear();

    expect(
      controller.applyPlaybackSettings({
        shuffle: true,
        repeat: "all",
        volume: 0.42,
        muted: false,
      }),
    ).toBe(true);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      shuffle: true,
      repeat: "all",
      volume: 0.42,
      muted: false,
    });
    expect(mediaLayers[0].volume).toBe(0.42);
    expect(controller.setShuffle(false)).toBe(true);
    expect(controller.setRepeat("one")).toBe(true);
    expect(controller.setMuted(true)).toBe(true);
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
      version: 4,
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

  test("keeps the current playback while switching to a playlist without it", async () => {
    const { controller, mediaLayers } = createController();
    controller.setQueue(tracks);
    await controller.selectTrack("one");
    mediaLayers.forEach((media) => media.pause.mockClear());

    controller.setLibraryState(
      {
        version: 3,
        catalog: { tracks },
        playlists: [
          {
            id: "next-playlist",
            title: "Next playlist",
            trackIds: ["two", "three"],
          },
        ],
        activePlaylistId: "next-playlist",
      },
      { selectedTrackId: "one", preservePlayback: true },
    );

    expect(controller.queue.map((track) => track.id)).toEqual([
      "one",
      "two",
      "three",
    ]);
    expect(controller.currentTrack.id).toBe("one");
    expect(controller.isPlaying).toBe(true);
    expect(
      mediaLayers.every((media) => media.pause.mock.calls.length === 0),
    ).toBe(true);

    await controller.next();
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

  test("restores active media audio after pause without moving the volume control", async () => {
    const { controller } = createController();
    controller.setQueue(tracks);
    controller.setVolume(0.35);
    await controller.selectTrack("one");

    expect(controller.activeMedia).toMatchObject({
      muted: false,
      volume: 0.35,
    });

    controller.pause();
    expect(controller.activeMedia).toMatchObject({
      muted: true,
      volume: 0,
    });

    await controller.play();
    expect(controller.activeMedia).toMatchObject({
      muted: false,
      volume: 0.35,
    });
    expect(controller.getSnapshot()).toMatchObject({
      isPlaying: true,
      muted: false,
      volume: 0.35,
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
    await flushPlaybackCleanup();
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

  test("closes the current playback without clearing the queue", async () => {
    const { controller, mediaLayers } = createController();
    controller.setQueue(tracks, { selectedTrackId: "two" });
    await controller.selectTrack("two");
    controller.activeMedia.currentTime = 36;

    expect(controller.closeCurrent()).toBe(true);

    expect(controller.queue.map((track) => track.id)).toEqual([
      "one",
      "two",
      "three",
    ]);
    expect(controller.currentTrack).toBeNull();
    expect(controller.getSnapshot()).toMatchObject({
      currentTrack: null,
      currentIndex: -1,
      isPlaying: false,
      isStopped: true,
      currentTime: 0,
    });
    expect(mediaLayers[1].pause).toHaveBeenCalled();
    expect(controller.closeCurrent()).toBe(false);
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

  test("seeks inside prepared HLS data and debounces a distant restart", async () => {
    jest.useFakeTimers();
    try {
      const { controller, providers } = createController();
      controller.setQueue([{ ...tracks[0], duration: 120 }]);
      await controller.selectTrack("one");
      const media = controller.activeMedia;
      Object.defineProperty(media, "seekable", {
        configurable: true,
        value: {
          length: 1,
          start: jest.fn(() => 0),
          end: jest.fn(() => 30),
        },
      });
      controller.layerPlaybacks[controller.activeLayerIndex].playback = {
        kind: "hls",
        sourceDuration: 120,
        timelineOffset: 0,
        hlsAudioTrackSelection: {
          selectedAudioTrackId: null,
          tracks: [
            { id: "audio-1", order: 0 },
            { id: "audio-2", order: 1 },
          ],
        },
      };

      controller.seek(20);
      expect(media.currentTime).toBe(20);
      expect(providers.resolveTrack).toHaveBeenCalledTimes(1);

      controller.seek(90);
      controller.seek(100);
      expect(controller.getSnapshot()).toMatchObject({
        currentTime: 100,
        positionRevision: 3,
      });
      await jest.advanceTimersByTimeAsync(179);
      expect(providers.resolveTrack).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(providers.resolveTrack).toHaveBeenCalledTimes(2);
      expect(providers.resolveTrack).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: "one" }),
        expect.objectContaining({
          forceRefresh: true,
          startTime: 100,
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test("keeps a paused state while restarting HLS at a distant position", async () => {
    jest.useFakeTimers();
    try {
      const { controller, mediaLayers, providers } = createController();
      controller.setQueue([
        {
          ...tracks[0],
          duration: 120,
          selectedAudioTrackId: "audio-2",
        },
      ]);
      await controller.selectTrack("one", { autoplay: false });
      const activeIndex = controller.activeLayerIndex;
      controller.layerPlaybacks[activeIndex].playback = {
        kind: "hls",
        sourceDuration: 120,
        timelineOffset: 0,
        hlsAudioTrackSelection: {
          selectedAudioTrackId: "audio-2",
          tracks: [
            { id: "audio-1", order: 0 },
            { id: "audio-2", order: 1 },
          ],
        },
      };
      Object.defineProperty(mediaLayers[activeIndex], "seekable", {
        configurable: true,
        value: { length: 0 },
      });

      controller.seek(80);
      await jest.advanceTimersByTimeAsync(180);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(providers.resolveTrack).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: "one",
          selectedAudioTrackId: "audio-2",
        }),
        expect.objectContaining({
          forceRefresh: true,
          startTime: 80,
        }),
      );
      expect(mediaLayers[0].play).not.toHaveBeenCalled();
      expect(mediaLayers[1].play).not.toHaveBeenCalled();
      expect(controller.getSnapshot()).toMatchObject({
        currentTime: 80,
        isPlaying: false,
      });
    } finally {
      jest.useRealTimers();
    }
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
    await flushPlaybackCleanup();

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

    expect(providers.resolveTrack).toHaveBeenCalledWith(
      tracks[0],
      expect.objectContaining({
        forceRefresh: true,
        signal: expect.any(AbortSignal),
      }),
    );
  });

  test("releases a superseded playback descriptor and starts only the latest track", async () => {
    const { controller, mediaLayers, providers } = createController();
    controller.setQueue(tracks);
    let resolveFirst;
    providers.resolveTrack
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(async () => ({
        src: "file:///two.mp3",
        mimeType: "audio/mpeg",
      }));

    const firstSelection = controller.selectTrack("one");
    await flushPlaybackCleanup();
    expect(resolveFirst).toEqual(expect.any(Function));
    const secondSelection = controller.selectTrack("two");
    await secondSelection;
    const stalePlayback = {
      src: "http://127.0.0.1/stale/index.m3u8",
      kind: "hls",
      sessionId: "stale-session",
    };
    resolveFirst(stalePlayback);

    await expect(firstSelection).resolves.toBe(false);
    expect(providers.releasePlayback).toHaveBeenCalledWith(
      tracks[0],
      stalePlayback,
    );
    expect(controller.currentTrack.id).toBe("two");
    expect(mediaLayers[controller.activeLayerIndex].play).toHaveBeenCalledTimes(
      1,
    );
    expect(
      mediaLayers.reduce(
        (count, media) => count + (media.dataset.trackId === "two" ? 1 : 0),
        0,
      ),
    ).toBe(1);
  });

  test("waits for resource release before resolving the next track", async () => {
    const { controller, providers } = createController();
    controller.setQueue(tracks);
    await controller.selectTrack("one", { autoplay: false });
    let finishRelease;
    providers.releasePlayback.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRelease = resolve;
        }),
    );
    providers.resolveTrack.mockClear();

    const selection = controller.selectTrack("two");
    await flushPlaybackCleanup();
    expect(providers.resolveTrack).not.toHaveBeenCalled();

    finishRelease();
    await selection;
    expect(providers.resolveTrack).toHaveBeenCalledWith(
      tracks[1],
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test("does not let a rejected stale play promise overwrite the latest state", async () => {
    const { controller, mediaLayers } = createController();
    controller.setQueue(tracks);
    await controller.selectTrack("one", { autoplay: false });
    let rejectOldPlay;
    mediaLayers[controller.activeLayerIndex].play.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectOldPlay = reject;
        }),
    );

    const oldPlay = controller.play();
    await controller.selectTrack("two");
    rejectOldPlay(new Error("stale play failure"));

    await expect(oldPlay).resolves.toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      currentTrack: { id: "two" },
      isPlaying: true,
      error: null,
    });
  });
});
